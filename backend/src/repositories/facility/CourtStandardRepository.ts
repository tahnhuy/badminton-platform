import { and, count, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db, courtStandards, courtStandardClaims, courtStandardEvidence, courts, facilities, users } from '../../db';
import { OwnerExecutor, OwnerTransaction } from '../owner/owner-db';

const vnToday = sql`(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;

async function evidenceByClaim(claimIds: number[], executor: OwnerExecutor = db) {
  if (claimIds.length === 0) return new Map<number, number[]>();
  const rows = await executor
    .select({ claimId: courtStandardEvidence.claimId, mediaId: courtStandardEvidence.mediaId })
    .from(courtStandardEvidence)
    .where(inArray(courtStandardEvidence.claimId, claimIds))
    .orderBy(courtStandardEvidence.claimId, courtStandardEvidence.position);
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.claimId) ?? [];
    list.push(row.mediaId);
    map.set(row.claimId, list);
  }
  return map;
}

export const courtStandardRepository = {
  async catalog(executor: OwnerExecutor = db) {
    return executor.select().from(courtStandards).where(eq(courtStandards.isActive, true)).orderBy(courtStandards.code);
  },

  async standard(code: string, executor: OwnerExecutor = db) {
    const [row] = await executor.select().from(courtStandards).where(eq(courtStandards.code, code));
    return row ?? null;
  },

  async claimsForCourt(courtId: number, page: number, limit: number) {
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: courtStandardClaims.id,
          standardCode: courtStandardClaims.standardCode,
          standardName: courtStandards.name,
          status: courtStandardClaims.status,
          surfaceBrand: courtStandardClaims.surfaceBrand,
          surfaceModel: courtStandardClaims.surfaceModel,
          issuer: courtStandardClaims.issuer,
          referenceNo: courtStandardClaims.referenceNo,
          issuedAt: courtStandardClaims.issuedAt,
          expiresAt: courtStandardClaims.expiresAt,
          rejectionReason: courtStandardClaims.rejectionReason,
          reviewedAt: courtStandardClaims.reviewedAt,
          createdAt: courtStandardClaims.createdAt,
        })
        .from(courtStandardClaims)
        .innerJoin(courtStandards, eq(courtStandards.code, courtStandardClaims.standardCode))
        .where(eq(courtStandardClaims.courtId, courtId))
        .orderBy(desc(courtStandardClaims.createdAt), desc(courtStandardClaims.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() }).from(courtStandardClaims).where(eq(courtStandardClaims.courtId, courtId)),
    ]);
    const evidence = await evidenceByClaim(rows.map(row => row.id));
    return { rows: rows.map(row => ({ ...row, evidenceMediaIds: evidence.get(row.id) ?? [] })), total: total.value };
  },

  async listAdmin(status: string | undefined, page: number, limit: number) {
    const where = status ? eq(courtStandardClaims.status, status) : undefined;
    const [rows, [total]] = await Promise.all([
      db
        .select({
          id: courtStandardClaims.id,
          courtId: courtStandardClaims.courtId,
          courtName: courts.name,
          facilityId: facilities.id,
          facilityName: facilities.name,
          ownerId: facilities.ownerId,
          standardCode: courtStandardClaims.standardCode,
          standardName: courtStandards.name,
          status: courtStandardClaims.status,
          surfaceBrand: courtStandardClaims.surfaceBrand,
          surfaceModel: courtStandardClaims.surfaceModel,
          issuer: courtStandardClaims.issuer,
          referenceNo: courtStandardClaims.referenceNo,
          issuedAt: courtStandardClaims.issuedAt,
          expiresAt: courtStandardClaims.expiresAt,
          rejectionReason: courtStandardClaims.rejectionReason,
          reviewedAt: courtStandardClaims.reviewedAt,
          createdAt: courtStandardClaims.createdAt,
        })
        .from(courtStandardClaims)
        .innerJoin(courtStandards, eq(courtStandards.code, courtStandardClaims.standardCode))
        .innerJoin(courts, eq(courts.id, courtStandardClaims.courtId))
        .innerJoin(facilities, eq(facilities.id, courts.facilityId))
        .where(where)
        .orderBy(desc(courtStandardClaims.createdAt), desc(courtStandardClaims.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() }).from(courtStandardClaims).where(where),
    ]);
    const evidence = await evidenceByClaim(rows.map(row => row.id));
    return { rows: rows.map(row => ({ ...row, evidenceMediaIds: evidence.get(row.id) ?? [] })), total: total.value };
  },

  async lockClaim(id: number, tx: OwnerTransaction) {
    const [row] = await tx.select().from(courtStandardClaims).where(eq(courtStandardClaims.id, id)).for('update');
    return row ?? null;
  },

  async claimContext(claimId: number, executor: OwnerExecutor = db) {
    const [row] = await executor
      .select({
        claimId: courtStandardClaims.id,
        courtId: courtStandardClaims.courtId,
        courtName: courts.name,
        facilityId: facilities.id,
        facilityName: facilities.name,
        ownerId: facilities.ownerId,
        standardCode: courtStandardClaims.standardCode,
      })
      .from(courtStandardClaims)
      .innerJoin(courts, eq(courts.id, courtStandardClaims.courtId))
      .innerJoin(facilities, eq(facilities.id, courts.facilityId))
      .where(eq(courtStandardClaims.id, claimId));
    return row ?? null;
  },

  async insertClaim(input: typeof courtStandardClaims.$inferInsert, tx: OwnerTransaction) {
    const [row] = await tx.insert(courtStandardClaims).values(input).returning();
    return row;
  },

  async insertEvidence(rows: { claimId: number; mediaId: number; position: number }[], tx: OwnerTransaction) {
    if (rows.length === 0) return;
    await tx.insert(courtStandardEvidence).values(rows);
  },

  async decide(id: number, adminId: number, approve: boolean, reason: string | null, tx: OwnerTransaction) {
    const [row] = await tx
      .update(courtStandardClaims)
      .set({
        status: approve ? 'VERIFIED' : 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: approve ? null : reason,
      })
      .where(eq(courtStandardClaims.id, id))
      .returning();
    return row ?? null;
  },

  async invalidateForCourt(courtId: number, tx: OwnerTransaction) {
    await tx
      .update(courtStandardClaims)
      .set({ status: 'INVALIDATED' })
      .where(and(eq(courtStandardClaims.courtId, courtId), inArray(courtStandardClaims.status, ['PENDING', 'VERIFIED'])));
  },

  async invalidateExpired(courtId: number, standardCode: string, tx: OwnerTransaction) {
    await tx
      .update(courtStandardClaims)
      .set({ status: 'INVALIDATED' })
      .where(and(
        eq(courtStandardClaims.courtId, courtId),
        eq(courtStandardClaims.standardCode, standardCode),
        eq(courtStandardClaims.status, 'VERIFIED'),
        // Public display treats expiresAt as valid through that day (>= today), so only
        // strictly earlier dates are expired here.
        lt(courtStandardClaims.expiresAt, vnToday)
      ));
  },

  async hasOutstanding(courtId: number, standardCode: string, executor: OwnerExecutor = db) {
    const [row] = await executor
      .select({ id: courtStandardClaims.id })
      .from(courtStandardClaims)
      .where(and(
        eq(courtStandardClaims.courtId, courtId),
        eq(courtStandardClaims.standardCode, standardCode),
        inArray(courtStandardClaims.status, ['PENDING', 'VERIFIED'])
      ))
      .limit(1);
    return row ?? null;
  },

  /** Public display: only VERIFIED claims that are not expired, with approval date. */
  async verifiedForCourts(courtIds: number[]) {
    if (courtIds.length === 0) return new Map<number, { code: string; name: string; reviewedAt: Date | null }[]>();
    const rows = await db
      .select({
        courtId: courtStandardClaims.courtId,
        code: courtStandardClaims.standardCode,
        name: courtStandards.name,
        reviewedAt: courtStandardClaims.reviewedAt,
      })
      .from(courtStandardClaims)
      .innerJoin(courtStandards, eq(courtStandards.code, courtStandardClaims.standardCode))
      .where(and(
        inArray(courtStandardClaims.courtId, courtIds),
        eq(courtStandardClaims.status, 'VERIFIED'),
        or(isNull(courtStandardClaims.expiresAt), sql`${courtStandardClaims.expiresAt} >= ${vnToday}`)
      ))
      .orderBy(courtStandardClaims.standardCode);
    const map = new Map<number, { code: string; name: string; reviewedAt: Date | null }[]>();
    for (const row of rows) {
      const list = map.get(row.courtId) ?? [];
      list.push({ code: row.code, name: row.name, reviewedAt: row.reviewedAt });
      map.set(row.courtId, list);
    }
    return map;
  },

  async viewerMayReadEvidence(mediaId: number, viewer: { id: number; role: string }) {
    if (viewer.role === 'ADMIN') {
      const [row] = await db.select({ id: courtStandardEvidence.claimId }).from(courtStandardEvidence).where(eq(courtStandardEvidence.mediaId, mediaId)).limit(1);
      return !!row;
    }
    const [row] = await db
      .select({ id: courtStandardEvidence.claimId })
      .from(courtStandardEvidence)
      .innerJoin(courtStandardClaims, eq(courtStandardClaims.id, courtStandardEvidence.claimId))
      .innerJoin(courts, eq(courts.id, courtStandardClaims.courtId))
      .innerJoin(facilities, eq(facilities.id, courts.facilityId))
      .where(and(eq(courtStandardEvidence.mediaId, mediaId), eq(facilities.ownerId, viewer.id)))
      .limit(1);
    return !!row;
  },
};
