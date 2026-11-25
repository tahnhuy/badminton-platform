import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, facilities, courts, courtPricings, facilityHandovers, users } from '../../db';
import { AppError } from '../../errors/AppError';

function fail(code: string, message: string, status = 409): never { throw new AppError(code, status, message); }
const imported = (source: string | null) => source === 'GOOGLE_PLACES_IMPORT' || source === 'DEMO_SEED';

export const facilityHandoverService = {
  async list(ownerId: number | null, page: number, limit: number) {
    const rows = await db.select({ handover: facilityHandovers, facilityName: facilities.name })
      .from(facilityHandovers).innerJoin(facilities, eq(facilities.id, facilityHandovers.facilityId))
      .where(ownerId === null ? undefined : eq(facilityHandovers.ownerId, ownerId))
      .orderBy(desc(facilityHandovers.id)).limit(limit + 1).offset((page - 1) * limit);
    return { data: rows.slice(0, limit), hasMore: rows.length > limit, page };
  },
  async request(ownerId: number, facilityId: number, evidence: string) {
    return db.transaction(async tx => {
      const [facility] = await tx.select().from(facilities).where(eq(facilities.id, facilityId)).for('update');
      if (!facility || facility.deletedAt || !imported(facility.dataSource) || facility.confirmedAt) fail('HANDOVER_NOT_AVAILABLE', 'Cơ sở không thuộc dữ liệu nhập chưa xác nhận.', 404);
      // The database unique index is the final guard; check all open attempts under the facility lock.
      const attempts = await tx.select().from(facilityHandovers).where(eq(facilityHandovers.facilityId, facilityId));
      if (attempts.some(row => row.status === 'PENDING' || row.status === 'APPROVED')) fail('HANDOVER_ALREADY_PENDING', 'Cơ sở đang có yêu cầu tiếp nhận.');
      const [row] = await tx.insert(facilityHandovers).values({ facilityId, ownerId, previousOwnerId: facility.ownerId, evidence }).returning();
      return row;
    });
  },
  async decide(adminId: number, id: number, approve: boolean, reason: string) {
    return db.transaction(async tx => {
      const [attempt] = await tx.select().from(facilityHandovers).where(eq(facilityHandovers.id, id));
      if (!attempt) fail('HANDOVER_NOT_FOUND', 'Không tìm thấy yêu cầu.', 404);
      const [facility] = await tx.select().from(facilities).where(eq(facilities.id, attempt.facilityId)).for('update');
      const [current] = await tx.select().from(facilityHandovers).where(eq(facilityHandovers.id, id)).for('update');
      if (current!.status !== 'PENDING') fail('HANDOVER_ALREADY_REVIEWED', 'Yêu cầu đã được xử lý.');
      if (!facility || facility.deletedAt || facility.confirmedAt || !imported(facility.dataSource) || facility.ownerId !== attempt.previousOwnerId) fail('HANDOVER_STALE', 'Thông tin cơ sở đã thay đổi.');
      const [owner] = await tx.select().from(users).where(eq(users.id, attempt.ownerId)).for('update');
      if (approve && (!owner || owner.deletedAt || owner.status !== 'ACTIVE' || owner.role !== 'COURT_OWNER' || owner.email === 'imported.venues@smashpro.vn')) fail('HANDOVER_OWNER_INVALID', 'Tài khoản tiếp nhận không hợp lệ.');
      if (approve) await tx.update(facilities).set({ ownerId: attempt.ownerId, updatedAt: new Date() }).where(eq(facilities.id, facility.id));
      const [row] = await tx.update(facilityHandovers).set({ status: approve ? 'APPROVED' : 'REJECTED', reason, reviewedBy: adminId, reviewedAt: new Date() }).where(eq(facilityHandovers.id, id)).returning();
      return row;
    });
  },
  async preview(ownerId: number, id: number) {
    const [attempt] = await db.select().from(facilityHandovers).where(and(eq(facilityHandovers.id, id), eq(facilityHandovers.ownerId, ownerId)));
    if (!attempt || attempt.status !== 'APPROVED') fail('HANDOVER_NOT_APPROVED', 'Yêu cầu chưa được duyệt.', 404);
    const [facility] = await db.select().from(facilities).where(and(eq(facilities.id, attempt.facilityId), eq(facilities.ownerId, ownerId), isNull(facilities.deletedAt)));
    if (!facility) fail('HANDOVER_STALE', 'Thông tin cơ sở đã thay đổi.');
    const inventory = await db.select().from(courts).where(and(eq(courts.facilityId, facility.id), isNull(courts.deletedAt))).orderBy(courts.id);
    const pricing = await Promise.all(inventory.map(async court => ({ ...court, pricing: await db.select().from(courtPricings).where(eq(courtPricings.courtId, court.id)).orderBy(courtPricings.id) })));
    return { facility, courts: pricing };
  },
  async confirm(ownerId: number, id: number, snapshot: unknown) {
    return db.transaction(async tx => {
      const [attempt] = await tx.select().from(facilityHandovers).where(and(eq(facilityHandovers.id, id), eq(facilityHandovers.ownerId, ownerId)));
      if (!attempt) fail('HANDOVER_NOT_FOUND', 'Không tìm thấy yêu cầu.', 404);
      const [facility] = await tx.select().from(facilities).where(eq(facilities.id, attempt.facilityId)).for('update');
      const [current] = await tx.select().from(facilityHandovers).where(eq(facilityHandovers.id, id)).for('update');
      if (current!.status !== 'APPROVED' || !facility || facility.deletedAt || facility.ownerId !== ownerId || facility.confirmedAt) fail('HANDOVER_STALE', 'Yêu cầu hoặc cơ sở đã thay đổi.');
      const inventory = await tx.select().from(courts).where(and(eq(courts.facilityId, facility.id), isNull(courts.deletedAt))).orderBy(courts.id).for('update');
      if (!inventory.length) fail('HANDOVER_INVENTORY_REQUIRED', 'Cần ít nhất một sân để xác nhận.');
      const detailed = await Promise.all(inventory.map(async court => ({ ...court, pricing: await tx.select().from(courtPricings).where(eq(courtPricings.courtId, court.id)).orderBy(courtPricings.id).for('update') })));
      if (detailed.some(court => court.status === 'ACTIVE' && !court.pricing.some(p => Number(p.price) > 0 && (p.validTo === null || p.validTo >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }))))) fail('HANDOVER_PRICING_REQUIRED', 'Mỗi sân ACTIVE cần giá còn hiệu lực hoặc trong tương lai.');
      const actual = { facility, courts: detailed };
      // The Owner acknowledges the exact inventory and prices shown; concurrent edits require a fresh preview.
      const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
      if (stable(snapshot) !== stable(actual)) fail('HANDOVER_SNAPSHOT_CHANGED', 'Dữ liệu đã thay đổi. Vui lòng tải lại và kiểm tra giá, sân, giờ hoạt động.');
      const now = new Date();
      await tx.update(facilities).set({ confirmedAt: now, confirmedBy: ownerId, updatedAt: now }).where(eq(facilities.id, facility.id));
      for (const court of inventory) await tx.update(courts).set({ confirmedAt: now, confirmedBy: ownerId, updatedAt: now }).where(eq(courts.id, court.id));
      const [row] = await tx.update(facilityHandovers).set({ status: 'CONFIRMED', confirmedAt: now }).where(eq(facilityHandovers.id, id)).returning();
      return row;
    });
  },
};
