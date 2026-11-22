import { and, eq, isNull } from 'drizzle-orm';
import { db, playerProfiles, skillLevels, users } from '../../db';
import type { ProfileIdentity, ProfileReader, ProfileTransaction } from '../../contracts/PlayerProfileRead';
import { readProfileStatistics } from './profile-statistics';

export class PlayerProfileRepository {
  constructor(private readonly database = db) {}

  async findActive(userId: number, reader: ProfileReader = this.database): Promise<ProfileIdentity | null> {
    const [profile] = await reader.select({
      userId: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl,
      skillLevel: { code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank, description: skillLevels.description },
      isSkillTentative: playerProfiles.isSkillTentative,
    }).from(playerProfiles).innerJoin(users, eq(users.id, playerProfiles.userId))
      .innerJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(and(eq(users.id, userId), eq(users.role, 'PLAYER'), eq(users.status, 'ACTIVE'), isNull(users.deletedAt))).limit(1);
    return profile ?? null;
  }

  statistics(userId: number, reader: ProfileReader = this.database) {
    return readProfileStatistics(reader, userId);
  }

  transaction<T>(work: (tx: ProfileTransaction) => Promise<T>): Promise<T> {
    return this.database.transaction(work);
  }

  async lockAvatar(userId: number, tx: ProfileTransaction): Promise<string | null | undefined> {
    const [row] = await tx.select({ avatarUrl: playerProfiles.avatarUrl }).from(playerProfiles)
      .where(eq(playerProfiles.userId, userId)).for('update');
    return row?.avatarUrl;
  }

  async isAvatarReferenced(avatarUrl: string, reader: ProfileReader): Promise<boolean> {
    const rows = await reader.select({ id: playerProfiles.userId }).from(playerProfiles)
      .where(eq(playerProfiles.avatarUrl, avatarUrl)).limit(1);
    return rows.length > 0;
  }

  async setAvatar(userId: number, avatarUrl: string, tx: ProfileTransaction): Promise<void> {
    await tx.update(playerProfiles).set({ avatarUrl, updatedAt: new Date() }).where(eq(playerProfiles.userId, userId));
  }

  async updateName(userId: number, fullName: string, tx: ProfileTransaction): Promise<boolean> {
    const rows = await tx.update(playerProfiles).set({ fullName, updatedAt: new Date() })
      .where(eq(playerProfiles.userId, userId)).returning({ userId: playerProfiles.userId });
    return rows.length === 1;
  }
}
