import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { mediaFiles } from '../../db/schema/media';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { MediaRecord } from '../../contracts/PrivateMediaService';

export interface MediaInsertRow {
  ownerId: number;
  kind: 'IMAGE' | 'FILE';
  mimeType: string;
  byteSize: number;
  sha256: string;
  storageKey: string;
  originalName: string | null;
}

const recordColumns = {
  id: mediaFiles.id,
  ownerId: mediaFiles.ownerId,
  kind: mediaFiles.kind,
  mimeType: mediaFiles.mimeType,
  byteSize: mediaFiles.byteSize,
  storageKey: mediaFiles.storageKey,
  originalName: mediaFiles.originalName,
  state: mediaFiles.state,
};

export const mediaRepository = {
  async insertReady(tx: TransactionContext, rows: MediaInsertRow[]) {
    if (rows.length === 0) return [];
    return tx
      .insert(mediaFiles)
      .values(rows.map(row => ({ ...row, state: 'READY' })))
      .returning({
        id: mediaFiles.id,
        kind: mediaFiles.kind,
        mimeType: mediaFiles.mimeType,
        byteSize: mediaFiles.byteSize,
        sha256: mediaFiles.sha256,
      });
  },

  async findById(id: number): Promise<MediaRecord | null> {
    const [row] = await db.select(recordColumns).from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
    return (row as MediaRecord | undefined) ?? null;
  },

  async markMissing(id: number): Promise<void> {
    await db.update(mediaFiles).set({ state: 'MISSING' }).where(and(eq(mediaFiles.id, id), eq(mediaFiles.state, 'READY')));
  },

  /** Storage keys that have a committed row (rows are never deleted in MVP). */
  async existingStorageKeys(keys: string[]): Promise<Set<string>> {
    if (keys.length === 0) return new Set();
    const rows = await db.select({ storageKey: mediaFiles.storageKey }).from(mediaFiles).where(inArray(mediaFiles.storageKey, keys));
    return new Set(rows.map(row => row.storageKey));
  },
};
