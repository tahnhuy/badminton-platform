import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { mkdir, writeFile, unlink, readdir, stat } from 'fs/promises';

export const uploadsRoot = process.env.NODE_ENV === 'test'
  ? path.join(os.tmpdir(), `badminton-profile-uploads-${process.pid}`)
  : path.resolve(__dirname, '../../../uploads');
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const GENERATED_AVATAR = /^([1-9]\d*)-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpeg|png|webp)$/;

export class AvatarStorage {
  constructor(readonly root = uploadsRoot) {}
  generatedFile(url: string): { filename: string; userId: number } | null {
    if (!url.startsWith('/uploads/avatars/')) return null;
    const filename = url.slice('/uploads/avatars/'.length);
    const match = GENERATED_AVATAR.exec(filename);
    return match && Number.isSafeInteger(Number(match[1])) ? { filename, userId: Number(match[1]) } : null;
  }
  async write(userId: number, bytes: Buffer, extension: string): Promise<string> {
    const filename = `${userId}-${randomUUID()}.${extension}`;
    if (!GENERATED_AVATAR.test(filename)) throw new Error('Invalid generated avatar filename');
    await mkdir(path.join(this.root, 'avatars'), { recursive: true });
    const target = path.join(this.root, 'avatars', filename);
    try { await writeFile(target, bytes, { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') await unlink(target).catch(() => {});
      throw error;
    }
    return `/uploads/avatars/${filename}`;
  }
  async remove(url: string): Promise<void> {
    const file = this.generatedFile(url);
    if (!file) return;
    await unlink(path.join(this.root, 'avatars', file.filename)).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
  async staleCandidates(now = Date.now()): Promise<string[]> {
    const folder = path.join(this.root, 'avatars');
    const entries = await readdir(folder, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const candidates: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !GENERATED_AVATAR.test(entry.name)) continue;
      const info = await stat(path.join(folder, entry.name)).catch(() => null);
      if (info && info.mtimeMs < now - 60 * 60 * 1000) candidates.push(`/uploads/avatars/${entry.name}`);
    }
    return candidates;
  }
}
