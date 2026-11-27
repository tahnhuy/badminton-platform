import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users, playerProfiles, courtOwnerProfiles } from '../../db/schema/users';

/** Batch identity lookup for Admin finance displays; IDs remain the stable keys. */
export async function financeIdentities(ids: number[]) {
  const uniqueIds = [...new Set(ids.filter(id => Number.isSafeInteger(id) && id > 0))];
  if (!uniqueIds.length) return [];
  return db.select({
    id: users.id,
    name: sql<string | null>`COALESCE(NULLIF(BTRIM(${playerProfiles.fullName}), ''), NULLIF(BTRIM(${courtOwnerProfiles.businessName}), ''))`,
    email: users.email,
  }).from(users)
    .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
    .leftJoin(courtOwnerProfiles, eq(courtOwnerProfiles.userId, users.id))
    .where(inArray(users.id, uniqueIds));
}
