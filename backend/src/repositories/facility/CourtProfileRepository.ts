import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, courts, facilities, users } from '../../db';
import { courtProfileChanges } from '../../db/schema/facilities';
import { OwnerExecutor, OwnerTransaction } from '../owner/owner-db';

export type CourtRow = typeof courts.$inferSelect;

export interface CourtProfileChangeInput {
  courtId: number;
  actorId: number;
  changeType: 'PROFILE' | 'CONDITION';
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  reason?: string | null;
}

export const courtProfileRepository = {
  async findOwned(ownerId: number, courtId: number, executor: OwnerExecutor = db, lock = false) {
    const query = executor
      .select({ court: courts, facility: facilities })
      .from(courts)
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(
        and(
          eq(courts.id, courtId),
          eq(facilities.ownerId, ownerId),
          isNull(courts.deletedAt),
          isNull(facilities.deletedAt)
        )
      );
    const [row] = lock ? await query.for('update') : await query;
    return row ?? null;
  },

  async findInFacility(
    facilityId: number,
    courtId: number,
    executor: OwnerExecutor = db,
    lock = false
  ) {
    const query = executor
      .select()
      .from(courts)
      .where(and(eq(courts.id, courtId), eq(courts.facilityId, facilityId), isNull(courts.deletedAt)));
    const [row] = lock ? await query.for('update') : await query;
    return row ?? null;
  },

  async updateVersioned(
    courtId: number,
    expectedVersion: number,
    patch: Record<string, unknown>,
    tx: OwnerTransaction
  ) {
    const [row] = await tx
      .update(courts)
      .set({
        ...patch,
        profileVersion: sql`${courts.profileVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(courts.id, courtId), eq(courts.profileVersion, expectedVersion)))
      .returning();
    return row ?? null;
  },

  async insertChanges(rows: CourtProfileChangeInput[], tx: OwnerTransaction) {
    if (rows.length === 0) return;
    await tx.insert(courtProfileChanges).values(
      rows.map((row) => ({
        courtId: row.courtId,
        actorId: row.actorId,
        changeType: row.changeType,
        beforeValues: row.beforeValues,
        afterValues: row.afterValues,
        reason: row.reason ?? null,
      }))
    );
  },

  async listChanges(courtId: number, page: number, limit: number) {
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: courtProfileChanges.id,
          changeType: courtProfileChanges.changeType,
          beforeValues: courtProfileChanges.beforeValues,
          afterValues: courtProfileChanges.afterValues,
          reason: courtProfileChanges.reason,
          createdAt: courtProfileChanges.createdAt,
          actorId: courtProfileChanges.actorId,
          actorEmail: users.email,
        })
        .from(courtProfileChanges)
        .leftJoin(users, eq(users.id, courtProfileChanges.actorId))
        .where(eq(courtProfileChanges.courtId, courtId))
        .orderBy(desc(courtProfileChanges.createdAt), desc(courtProfileChanges.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ value: count() })
        .from(courtProfileChanges)
        .where(eq(courtProfileChanges.courtId, courtId)),
    ]);
    return { rows, total: total.value };
  },
};
