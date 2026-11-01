import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { mkdir, open, rename, unlink, readFile, readdir, stat } from 'fs/promises';

export const privateUploadsRoot =
  process.env.PRIVATE_UPLOADS_DIR ||
  (process.env.NODE_ENV === 'test'
    ? path.join(os.tmpdir(), `badminton-private-uploads-${process.pid}`)
    : path.resolve(__dirname, '../../../private-uploads'));

export const MESSAGE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MESSAGE_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MESSAGE_MAX_IMAGES = 4;

const SAFE_STORAGE_KEY = /^[a-f0-9-]{36}\.(jpeg|png|webp|pdf|docx|xlsx|txt)$/;

export class PrivateMediaStorage {
  constructor(readonly root: string = privateUploadsRoot) {}

  private get tmpDir(): string {
    return path.join(this.root, 'tmp');
  }

  private get mediaDir(): string {
    return path.join(this.root, 'media');
  }

  /**
   * Follows database-schema.md §13.9:
   * Write to <private-root>/tmp/<uuid>, fsync, and atomically rename to <private-root>/media/<storage_key>.
   */
  async writeAtomic(bytes: Buffer, extension: string): Promise<string> {
    const storageKey = `${randomUUID()}.${extension}`;
    if (!SAFE_STORAGE_KEY.test(storageKey)) {
      throw new Error('Invalid storage key extension');
    }

    await mkdir(this.tmpDir, { recursive: true });
    await mkdir(this.mediaDir, { recursive: true });

    const tmpPath = path.join(this.tmpDir, `${randomUUID()}.tmp`);
    const finalPath = path.join(this.mediaDir, storageKey);

    let handle: Awaited<ReturnType<typeof open>> | null = null;
    try {
      handle = await open(tmpPath, 'wx', 0o600);
      await handle.writeFile(bytes);
      await handle.sync();
      await handle.close();
      handle = null;

      await rename(tmpPath, finalPath);
      return storageKey;
    } catch (err) {
      if (handle) {
        await handle.close().catch(() => {});
      }
      await unlink(tmpPath).catch(() => {});
      await unlink(finalPath).catch(() => {});
      throw err;
    }
  }

  async removeBestEffort(storageKey: string): Promise<void> {
    if (!SAFE_STORAGE_KEY.test(storageKey)) {
      return;
    }
    const finalPath = path.join(this.mediaDir, storageKey);
    await unlink(finalPath).catch(() => {});
  }

  async readBytes(storageKey: string): Promise<Buffer | null> {
    if (!SAFE_STORAGE_KEY.test(storageKey)) {
      return null;
    }
    const finalPath = path.join(this.mediaDir, storageKey);
    try {
      return await readFile(finalPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Cleanup job helper (§13.9 step 4):
   * Deletes tmp files older than 1 hour, and media files without a MEDIA_FILES row older than 1 hour.
   */
  async cleanupOrphans(knownStorageKeys: Set<string>, nowMs = Date.now()): Promise<number> {
    let removed = 0;
    const oneHourAgo = nowMs - 60 * 60 * 1000;

    const tmpEntries = await readdir(this.tmpDir, { withFileTypes: true }).catch(() => []);
    for (const entry of tmpEntries) {
      if (!entry.isFile()) continue;
      const fullPath = path.join(this.tmpDir, entry.name);
      const info = await stat(fullPath).catch(() => null);
      if (info && info.mtimeMs < oneHourAgo) {
        await unlink(fullPath).catch(() => {});
        removed++;
      }
    }

    const mediaEntries = await readdir(this.mediaDir, { withFileTypes: true }).catch(() => []);
    for (const entry of mediaEntries) {
      if (!entry.isFile()) continue;
      if (knownStorageKeys.has(entry.name)) continue;
      const fullPath = path.join(this.mediaDir, entry.name);
      const info = await stat(fullPath).catch(() => null);
      if (info && info.mtimeMs < oneHourAgo) {
        await unlink(fullPath).catch(() => {});
        removed++;
      }
    }

    return removed;
  }
}

export const privateMediaStorage = new PrivateMediaStorage();

