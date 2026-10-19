import { PlayerProfileRepository } from '../../repositories/players/PlayerProfileRepository';
import { AvatarStorage } from '../../shared/storage/avatar-storage';
import { normalizeAvatar } from '../../validation/avatar';
import { NotFoundError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';

export class PlayerAvatarService {
  constructor(private readonly repository = new PlayerProfileRepository(), private readonly storage = new AvatarStorage()) {}

  async upload(actorId: number, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    const normalized = await normalizeAvatar(file);
    let staged: string | null = null;
    let previous: string | null | undefined;
    try {
      await this.repository.transaction(async tx => {
        previous = await this.repository.lockAvatar(actorId, tx);
        if (previous === undefined || !await this.repository.findActive(actorId, tx)) {
          throw new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND');
        }
        staged = await this.storage.write(actorId, normalized.bytes, normalized.format);
        await this.repository.setAvatar(actorId, staged, tx);
      });
    } catch (error) {
      if (staged) await this.cleanUnreferenced(staged);
      throw error;
    }
    if (previous) await this.cleanUnreferenced(previous);
    return { avatarUrl: staged! };
  }

  /** Persistent files, not in-memory ownership, drive retries; row lock protects in-flight writes. */
  async cleanUnreferenced(url: string): Promise<void> {
    const file = this.storage.generatedFile(url);
    if (!file) return;
    try {
      await this.repository.transaction(async tx => {
        await this.repository.lockAvatar(file.userId, tx);
        if (!await this.repository.isAvatarReferenced(url, tx)) await this.storage.remove(url);
      });
    } catch {
      // The hourly sweep discovers and retries this generated file after its grace period.
      logger.warn('Avatar cleanup deferred', { userId: file.userId });
    }
  }

  async sweep(): Promise<void> {
    for (const url of await this.storage.staleCandidates()) await this.cleanUnreferenced(url);
  }
}
export const playerAvatarService = new PlayerAvatarService();
