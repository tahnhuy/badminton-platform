import { db } from '../../db';
import type { PlayerProfileRead, ProfileRatingsReader, ProfileReader, ProfileRatingDimension } from '../../contracts/PlayerProfileRead';
import { PlayerProfileRepository } from '../../repositories/players/PlayerProfileRepository';
import { AppError, NotFoundError } from '../../errors/AppError';
import { updatePlayerProfileSchema } from '../../validation/players';

function dimension(count: number, average: number | null): ProfileRatingDimension {
  if (!Number.isSafeInteger(count) || count < 0 || (count >= 3 &&
    (average === null || !Number.isFinite(average) || average < 1 || average > 5))) {
    throw new AppError('INTERNAL_ERROR', 500, 'Không thể tải đánh giá người chơi.');
  }
  return { average: count < 3 ? null : Math.round(average! * 100) / 100, count, notEnoughData: count < 3 };
}

export class PlayerProfileService {
  constructor(
    private readonly ratings: ProfileRatingsReader | null = null,
    private readonly repository = new PlayerProfileRepository(),
    private readonly options: { statisticsEnabled?: boolean } = {},
  ) {}

  async read(userId: number, reader?: ProfileReader): Promise<PlayerProfileRead> {
    const identity = await this.repository.findActive(userId, reader);
    if (!identity) throw new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND');
    // Missing capabilities are explicit nulls. Enabled dependencies must not hide read failures.
    const summary = this.ratings ? await this.ratings.summary(userId, reader ?? db) : null;
    const stats = this.options.statisticsEnabled ? await this.repository.statistics(userId, reader) : null;
    return { ...identity, stats, ratings: summary ? {
      skill: dimension(summary.totalRatings, summary.averageSkillRating),
      attitude: dimension(summary.totalRatings, summary.averageAttitudeRating),
    } : null };
  }

  async updateName(actorId: number, input: unknown): Promise<PlayerProfileRead> {
    const { fullName } = updatePlayerProfileSchema.parse(input);
    return this.repository.transaction(async tx => {
      if (!await this.repository.findActive(actorId, tx)) {
        throw new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND');
      }
      if (!await this.repository.updateName(actorId, fullName, tx)) {
        throw new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND');
      }
      return this.read(actorId, tx);
    });
  }
}
