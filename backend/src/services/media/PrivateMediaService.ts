import { createHash } from 'crypto';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';
import { PrivateMediaStorage } from '../../shared/storage/private-media';
import { mediaRepository } from '../../repositories/media/MediaRepository';
import { normalizeMediaImage, MEDIA_IMAGE_MAX_COUNT } from '../../validation/media-images';
import type {
  MediaAccessResolver, MediaRecord, MediaViewer, PrivateMediaService, StoreImagesOptions, StoredMedia, UploadedImage,
} from '../../contracts/PrivateMediaService';
import type { TransactionContext } from '../../contracts/TransactionContext';

// SOC-02 provider of contracts/PrivateMediaService (Social Tech Design §7.4, schema §13.9).
export class PrivateMediaServiceImpl implements PrivateMediaService {
  // Files staged inside a transaction opened by `transaction()`; cleaned when it fails.
  private readonly staged = new WeakMap<object, string[]>();
  private readonly resolvers = new Map<string, MediaAccessResolver>();

  constructor(readonly storage: PrivateMediaStorage = new PrivateMediaStorage()) {}

  async transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    let keys: string[] | undefined;
    try {
      // db.transaction rejects when the work throws and also when COMMIT itself fails,
      // so every failure path reaches the cleanup below.
      return await db.transaction(async tx => {
        keys = [];
        this.staged.set(tx, keys);
        return work(tx);
      });
    } catch (error) {
      for (const key of keys ?? []) {
        await this.storage.remove(key).catch(cleanupError => {
          logger.error('Private media rollback cleanup failed; GC will retry', { storageKey: key, cause: String(cleanupError) });
        });
      }
      throw error;
    }
  }

  async storeImages(
    files: readonly UploadedImage[],
    ownerId: number,
    tx: TransactionContext,
    options: StoreImagesOptions,
  ): Promise<StoredMedia[]> {
    const keys = this.staged.get(tx);
    if (!keys) throw new Error('storeImages requires a transaction opened by PrivateMediaService.transaction');
    if (files.length === 0) return [];
    const invalid = () => new AppError(options.invalidImageCode, 400, 'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh và tối đa 4 ảnh.');
    if (files.length > MEDIA_IMAGE_MAX_COUNT) throw invalid();
    // Validate every image before writing any file.
    const normalized = await Promise.all(files.map(file => normalizeMediaImage(file)));
    if (normalized.some(image => image === null)) throw invalid();
    const rows = [];
    for (const image of normalized) {
      const storageKey = await this.storage.write(image!.bytes);
      keys.push(storageKey);
      rows.push({
        ownerId,
        kind: 'IMAGE' as const,
        mimeType: image!.mimeType,
        byteSize: image!.bytes.length,
        sha256: createHash('sha256').update(image!.bytes).digest('hex'),
        storageKey,
        originalName: null,
      });
    }
    const inserted = await mediaRepository.insertReady(tx, rows);
    return inserted.map(row => ({ ...row, kind: row.kind as 'IMAGE' | 'FILE' }));
  }

  registerResolver(name: string, resolver: MediaAccessResolver): void {
    this.resolvers.set(name, resolver);
  }

  async resolveAccess(mediaId: number, viewer: MediaViewer): Promise<MediaRecord | null> {
    const media = await mediaRepository.findById(mediaId);
    if (!media || media.state !== 'READY') return null;
    for (const resolver of this.resolvers.values()) {
      if (await resolver(media, viewer)) return media;
    }
    // Default deny: no resolver proved access.
    return null;
  }

  /** Authorized download: null → 404 MEDIA_NOT_FOUND. A missing file is marked MISSING and logged. */
  async openForDownload(mediaId: number, viewer: MediaViewer) {
    const media = await this.resolveAccess(mediaId, viewer);
    if (!media) return null;
    const file = await this.storage.openRead(media.storageKey);
    if (!file) {
      await mediaRepository.markMissing(media.id);
      logger.error('Private media file missing; marked MISSING', { mediaId: media.id });
      return null;
    }
    return { media, ...file };
  }

  /**
   * GC (schema §13.9 rule 4): deletes tmp files and row-less final files older than the
   * grace period. A file with a MEDIA_FILES row is never deleted (rows are never deleted,
   * so detached images and report evidence keep their files).
   */
  async sweep(now = Date.now()): Promise<{ tmpRemoved: number; orphansRemoved: number }> {
    const tmp = await this.storage.staleTmpFiles(now);
    for (const name of tmp) await this.storage.removeTmp(name);
    const candidates = await this.storage.staleMediaKeys(now);
    const withRow = await mediaRepository.existingStorageKeys(candidates);
    const orphans = candidates.filter(key => !withRow.has(key));
    for (const key of orphans) await this.storage.remove(key);
    if (tmp.length || orphans.length) logger.info('Private media GC', { tmpRemoved: tmp.length, orphansRemoved: orphans.length });
    return { tmpRemoved: tmp.length, orphansRemoved: orphans.length };
  }
}

export const privateMediaService = new PrivateMediaServiceImpl();
