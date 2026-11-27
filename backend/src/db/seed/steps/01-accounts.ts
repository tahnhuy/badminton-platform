import { eq, inArray } from 'drizzle-orm';
import { db } from '../../index';
import { courtOwnerProfiles, playerProfiles, users } from '../../schema/users';
import { playerSkillSurveys } from '../../schema/skill-survey';
import { withdrawalPins } from '../../schema/auth';
import { DEMO_ADMIN, DEMO_OWNERS, DEMO_PLAYERS } from '../data/people';
import { ensureSeedPlayerProfile } from '../lib/survey';
import type { SeedContext } from '../context';

/** Admin, Court Owners and Players: verified e-mail, survey-backed level, withdrawal PIN. */
export async function seedAccounts(ctx: SeedContext): Promise<void> {
  const { clock } = ctx;
  const joined = (daysAgo: number) => clock.at(-daysAgo, '08:30');

  const [admin] = await db.insert(users).values({
    email: DEMO_ADMIN.email, passwordHash: ctx.passwordHash, role: 'ADMIN', status: 'ACTIVE',
    emailVerifiedAt: joined(DEMO_ADMIN.joinedDaysAgo), createdAt: joined(DEMO_ADMIN.joinedDaysAgo), updatedAt: joined(DEMO_ADMIN.joinedDaysAgo),
  }).returning({ id: users.id });
  ctx.adminId = admin.id;

  for (const owner of DEMO_OWNERS) {
    const at = joined(owner.joinedDaysAgo);
    const [row] = await db.insert(users).values({
      email: owner.email, passwordHash: ctx.passwordHash, role: 'COURT_OWNER', status: 'ACTIVE',
      emailVerifiedAt: at, createdAt: at, updatedAt: at,
    }).returning({ id: users.id });
    await db.insert(courtOwnerProfiles).values({ userId: row.id, businessName: owner.businessName, phone: owner.phone, createdAt: at, updatedAt: at });
    await db.insert(withdrawalPins).values({ userId: row.id, pinHash: ctx.pinHash, updatedAt: at });
    ctx.owners.set(owner.key, row.id);
  }

  for (const player of DEMO_PLAYERS) {
    const at = joined(player.joinedDaysAgo);
    const status = player.status ?? 'ACTIVE';
    const [row] = await db.insert(users).values({
      email: player.email, passwordHash: ctx.passwordHash, role: 'PLAYER', status,
      emailVerifiedAt: at, createdAt: at, updatedAt: at,
    }).returning({ id: users.id });
    // Same path as a real registration: the survey row is scored by the engine.
    await ensureSeedPlayerProfile(db, { userId: row.id, fullName: player.fullName, levelCode: player.level, avatarUrl: player.avatarUrl ?? null, phone: player.phone });
    await db.update(playerProfiles).set({ createdAt: at, updatedAt: at }).where(eq(playerProfiles.userId, row.id));
    await db.update(playerSkillSurveys).set({ createdAt: at }).where(eq(playerSkillSurveys.userId, row.id));
    await db.insert(withdrawalPins).values({ userId: row.id, pinHash: ctx.pinHash, updatedAt: at });
    ctx.players.set(player.key, { id: row.id, key: player.key, email: player.email, fullName: player.fullName, level: player.level, joinedAt: at, active: status === 'ACTIVE' });
  }

  const ids = [...ctx.players.values()].map(p => p.id);
  const profiles = await db.select({ id: playerProfiles.userId }).from(playerProfiles).where(inArray(playerProfiles.userId, ids));
  if (profiles.length !== ids.length) throw new Error(`Expected ${ids.length} player profiles, found ${profiles.length}`);
  ctx.log(`Tài khoản: 1 Admin, ${DEMO_OWNERS.length} chủ sân, ${DEMO_PLAYERS.length} người chơi`);
}
