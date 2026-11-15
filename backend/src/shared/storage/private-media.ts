import path from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, ReadStream } from 'fs';
import { open, readdir, realpath, rename, stat, unlink } from 'fs/promises';
import { env } from '../config/env';
import { checkPrivateUploadsLayout, PrivateUploadsLayout } from './private-root';
import { uploadsRoot } from './avatar-storage';

// database-schema.md §13.9 file lifecycle on the private root (SOC-02).
// Files live at <root>/media/<storage_key>; staging uses <root>/tmp/<uuid>.
export const PRIVATE_MEDIA_GRACE_MS = 60 * 60 * 1000;
const STORAGE_KEY = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

async function fsyncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r').catch(() => null);
  if (!handle) return;
  try {
    await handle.sync();
  } catch {
    // Directory fsync is best effort (not supported on every filesystem).
  } finally {
    await handle.close();
  }
}

export class PrivateMediaStorage {
  readonly root: string;
  private readonly layout: PrivateUploadsLayout;

  /**
   * Refuses to construct on an invalid layout (root, tmp/ or media/ resolving outside the
   * private root or inside a public static root), so no file operation can start from it.
   */
  constructor(root: string = env.PRIVATE_UPLOADS_DIR, publicRoots: readonly string[] = [uploadsRoot]) {
    const { layout, problems } = checkPrivateUploadsLayout(root, publicRoots);
    if (!layout) throw new Error(`Invalid private uploads layout: ${problems.join('; ')}`);
    this.layout = layout;
    this.root = layout.root;
  }

  private tmpDir(): string {
    return this.layout.tmp;
  }

  private mediaDir(): string {
    return this.layout.media;
  }

  /**
   * Re-verifies before every file operation that the validated directories still resolve to
   * themselves (no symlink swapped in after startup). Fails closed; the error stays internal.
   */
  private async assertLayout(): Promise<void> {
    const [tmp, media] = await Promise.all([
      realpath(this.layout.tmp).catch(() => null),
      realpath(this.layout.media).catch(() => null),
    ]);
    if (tmp !== this.layout.tmp || media !== this.layout.media) {
      throw new Error('Private uploads layout changed after validation');
    }
  }

  pathFor(storageKey: string): string {
    if (!STORAGE_KEY.test(storageKey)) throw new Error('Invalid storage key');
    return path.join(this.mediaDir(), storageKey);
  }

  /** tmp → fsync → atomic rename. Returns the new random storage key. */
  async write(bytes: Buffer): Promise<string> {
    await this.assertLayout();
    const storageKey = randomUUID();
    const tmp = path.join(this.tmpDir(), randomUUID());
    const handle = await open(tmp, 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } catch (error) {
      await handle.close();
      await unlink(tmp).catch(() => {});
      throw error;
    }
    await handle.close();
    try {
      await this.assertLayout();
      await rename(tmp, this.pathFor(storageKey));
    } catch (error) {
      await unlink(tmp).catch(() => {});
      throw error;
    }
    await fsyncDirectory(this.mediaDir());
    return storageKey;
  }

  /** Best-effort delete of a final file (rollback cleanup). */
  async remove(storageKey: string): Promise<void> {
    await this.assertLayout();
    await unlink(this.pathFor(storageKey)).catch(error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
  }

  /** Opens a final file for streaming; null when it no longer exists. */
  async openRead(storageKey: string): Promise<{ stream: ReadStream; size: number } | null> {
    const file = this.pathFor(storageKey);
    await this.assertLayout();
    try {
      const info = await stat(file);
      if (!info.isFile()) return null;
      const stream = createReadStream(file);
      await new Promise<void>((resolve, reject) => {
        stream.once('open', () => resolve());
        stream.once('error', reject);
      });
      return { stream, size: info.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /** Staged tmp files older than the grace period. */
  async staleTmpFiles(now: number): Promise<string[]> {
    return this.olderThan(this.tmpDir(), now, () => true);
  }

  /** Final files older than the grace period, as storage keys. */
  async staleMediaKeys(now: number): Promise<string[]> {
    return this.olderThan(this.mediaDir(), now, name => STORAGE_KEY.test(name));
  }

  async removeTmp(name: string): Promise<void> {
    await this.assertLayout();
    await unlink(path.join(this.tmpDir(), path.basename(name))).catch(() => {});
  }

  private async olderThan(directory: string, now: number, accept: (name: string) => boolean): Promise<string[]> {
    await this.assertLayout();
    const entries = await readdir(directory, { withFileTypes: true }).catch(error => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    });
    const result: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !accept(entry.name)) continue;
      const info = await stat(path.join(directory, entry.name)).catch(() => null);
      if (info && info.mtimeMs < now - PRIVATE_MEDIA_GRACE_MS) result.push(entry.name);
    }
    return result;
  }
}
