import { db } from '../db';
import { users } from '../db/schema/users';
import { passwordHasher } from '../services/auth/password-hasher';

export interface CreateTestUserOptions {
  email?: string;
  password?: string;
  role?: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  mustChangePassword?: boolean;
  deletedAt?: Date | null;
}

export async function createTestUser(options: CreateTestUserOptions = {}) {
  const email = options.email || `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
  const plainPassword = options.password || 'ValidPassword123!';
  const passwordHash = await passwordHasher.hash(plainPassword);

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      role: options.role || 'PLAYER',
      status: options.status || 'ACTIVE',
      mustChangePassword: options.mustChangePassword ?? false,
      deletedAt: options.deletedAt || null,
    })
    .returning();

  return {
    ...created,
    plainPassword,
  };
}

/**
 * MM-21 fixtures: every recruitment row needs its MATCH_FINDING post and interval fields.
 * Returns the extra columns to spread into a `matchmakingRequests` insert.
 */
export async function recruitmentFixtureColumns(hostId: number, matchType: 'SINGLES' | 'DOUBLES', startAt: Date, durationMinutes: number) {
  const { posts } = await import('../db/schema/social');
  const [post] = await db.insert(posts).values({ authorId: hostId, type: 'MATCH_FINDING' }).returning({ id: posts.id });
  const slots = matchType === 'SINGLES' ? 2 : 4;
  return { postId: post.id, startAt, durationMinutes, capacity: slots, minPlayers: slots };
}
