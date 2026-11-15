import type { TransactionContext } from './TransactionContext';

// Shared private media (Social Tech Design §7.4; database-schema.md §13.1, §13.9).
// Provider: Social (SOC-02). Consumers: Social posts, Messaging attachments (MSG-04/05),
// Report evidence (RP-07). Consumers never write files or MEDIA_FILES rows directly.

export interface UploadedImage {
  buffer: Buffer;
  /** Client-declared type; verified against the decoded format, never trusted. */
  mimetype: string;
}

export interface StoredMedia {
  id: number;
  kind: 'IMAGE' | 'FILE';
  mimeType: string;
  byteSize: number;
  sha256: string;
}

export interface MediaRecord {
  id: number;
  ownerId: number;
  kind: 'IMAGE' | 'FILE';
  mimeType: string;
  byteSize: number;
  storageKey: string;
  originalName: string | null;
  state: 'READY' | 'MISSING';
}

export interface MediaViewer {
  id: number;
  role: string;
}

/**
 * Decides whether the viewer may download the media through its owning content.
 * Returns false when the media does not belong to this resolver's content type or
 * access is not proven. Access is granted if any registered resolver returns true.
 */
export type MediaAccessResolver = (media: MediaRecord, viewer: MediaViewer, tx?: TransactionContext) => Promise<boolean>;

export interface StoreImagesOptions {
  /** Feature error code for an invalid image, e.g. SOCIAL_IMAGE_INVALID or MESSAGING_IMAGE_INVALID. */
  invalidImageCode: string;
}

export interface PrivateMediaService {
  /**
   * Runs `work` in a new database transaction. Files staged by `storeImages` inside it
   * are deleted when the transaction fails for any reason, including COMMIT failure.
   * Media writes must use this transaction; `storeImages` refuses any other.
   */
  transaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /**
   * Validates and re-encodes JPEG/PNG/WebP images (≤ 5 MB each, ≤ 4; EXIF/GPS removed),
   * writes them tmp → fsync → atomic rename, and inserts READY MEDIA_FILES rows in `tx`.
   * All images are validated before any file is written. Rejects with a 400 using
   * `options.invalidImageCode`.
   */
  storeImages(
    files: readonly UploadedImage[],
    ownerId: number,
    tx: TransactionContext,
    options: StoreImagesOptions,
  ): Promise<StoredMedia[]>;

  /** Registers an owning-content resolver (post image, message attachment, report evidence). */
  registerResolver(name: string, resolver: MediaAccessResolver): void;

  /** The media if the viewer is authorized and the row is READY; otherwise null (callers answer 404). */
  resolveAccess(mediaId: number, viewer: MediaViewer): Promise<MediaRecord | null>;
}
