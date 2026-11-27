import { eq, sql } from 'drizzle-orm';
import { db } from '../../index';
import { users } from '../../schema/users';
import { partnershipRequestService } from '../../../services/partnership/PartnershipRequestService';
import { at, stampAt } from '../lib/stamp';
import type { SeedContext } from '../context';

/** Email of the Court Owner account created from the APPROVED request (signs in with the demo password). */
export const PARTNERSHIP_OWNER_EMAIL = 'owner.moi@smashpro.vn';

interface DemoRequest {
  email: string;
  contactName: string;
  phone: string;
  facilityName: string;
  addressLine: string;
  district: string;
  city: string;
  expectedCourts: number;
  note?: string;
  sentDay: number;
  sentTime: string;
  outcome: 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED';
  adminNote?: string;
  reason?: string;
}

const REQUESTS: DemoRequest[] = [
  { email: 'lehoang.badminton@smashpro.vn', contactName: 'Lê Văn Hoàng', phone: '0912345601', facilityName: 'Sân cầu lông Hoàng Gia', addressLine: '45 Nguyễn Oanh', district: 'Gò Vấp', city: 'TP. Hồ Chí Minh', expectedCourts: 8, note: 'Sân mới khai trương, có bãi giữ xe ô tô.', sentDay: 0, sentTime: '08:20', outcome: 'PENDING' },
  { email: 'tranmai.sport@smashpro.vn', contactName: 'Trần Thị Mai', phone: '0987654302', facilityName: 'Mai Sport Center', addressLine: '210 Lê Văn Việt', district: 'TP. Thủ Đức', city: 'TP. Hồ Chí Minh', expectedCourts: 5, sentDay: -1, sentTime: '19:45', outcome: 'PENDING' },
  { email: 'phamduc.court@smashpro.vn', contactName: 'Phạm Minh Đức', phone: '0934567803', facilityName: 'CLB Cầu Lông Bình Thạnh', addressLine: '88 Điện Biên Phủ', district: 'Bình Thạnh', city: 'TP. Hồ Chí Minh', expectedCourts: 6, note: 'Muốn đăng ký trước 3 sân, phần còn lại đang sửa.', sentDay: -3, sentTime: '10:10', outcome: 'CONTACTED', adminNote: 'Đã gọi, hẹn khảo sát sân thứ Bảy. Chủ sân cần hướng dẫn đặt bảng giá theo khung giờ.' },
  { email: PARTNERSHIP_OWNER_EMAIL, contactName: 'Võ Thanh Tùng', phone: '0909876504', facilityName: 'Sân cầu lông Thanh Tùng', addressLine: '12 Tô Ký', district: 'Quận 12', city: 'TP. Hồ Chí Minh', expectedCourts: 4, sentDay: -6, sentTime: '14:30', outcome: 'APPROVED', adminNote: 'Đã xác minh giấy phép kinh doanh qua Zalo.' },
  { email: 'nguyenbao.club@smashpro.vn', contactName: 'Nguyễn Gia Bảo', phone: '0978123405', facilityName: 'Bảo Badminton', addressLine: '5 Trần Phú', district: 'Hải Châu', city: 'Đà Nẵng', expectedCourts: 2, sentDay: -9, sentTime: '09:00', outcome: 'REJECTED', reason: 'SmashPro chưa hỗ trợ khu vực Đà Nẵng trong giai đoạn này. Chúng tôi sẽ liên hệ lại khi mở rộng.' },
];

/**
 * Partnership requests in every status, through the real service: the Admin queue has work, and one
 * request became the Court Owner account owner.moi@smashpro.vn (no facility yet, demo password).
 * The service queues e-mails; the seed never sends e-mail, so they are removed afterwards.
 */
export async function seedPartnership(ctx: SeedContext): Promise<void> {
  const { clock } = ctx;
  for (const demo of REQUESTS) {
    const sentAt = clock.at(demo.sentDay, demo.sentTime);
    const { outcome, adminNote, reason } = demo;
    const form = { contactName: demo.contactName, email: demo.email, phone: demo.phone, facilityName: demo.facilityName, addressLine: demo.addressLine, district: demo.district, city: demo.city, expectedCourts: demo.expectedCourts, note: demo.note };
    await stampAt(sentAt, () => partnershipRequestService.submit({ ...form, consent: true, website: '' }, '113.161.0.1'));
    const [{ id }] = (await db.execute(sql`SELECT id FROM owner_partnership_requests WHERE email = ${demo.email}`)).rows as Array<{ id: string }>;
    const requestId = Number(id);
    await db.execute(sql`UPDATE owner_partnership_requests SET created_at = ${await at('owner_partnership_requests', 'created_at', sentAt)}, updated_at = ${await at('owner_partnership_requests', 'updated_at', sentAt)} WHERE id = ${requestId}`);

    if (outcome === 'PENDING') continue;
    const contactedAt = new Date(sentAt.getTime() + 20 * 3_600_000);
    await partnershipRequestService.markContacted(requestId);
    if (adminNote) await partnershipRequestService.saveNote(requestId, adminNote);
    let doneAt = contactedAt;
    if (outcome === 'APPROVED') {
      doneAt = new Date(sentAt.getTime() + 2 * 86_400_000);
      await stampAt(doneAt, () => partnershipRequestService.approve(ctx.adminId, requestId, { businessName: form.facilityName, phone: form.phone }));
      // A demo account signs in with the shared demo password instead of the reset OTP.
      await db.update(users).set({ passwordHash: ctx.passwordHash, mustChangePassword: false, emailVerifiedAt: doneAt, createdAt: doneAt, updatedAt: doneAt })
        .where(eq(users.email, demo.email));
      await db.execute(sql`UPDATE court_owner_profiles SET created_at = ${await at('court_owner_profiles', 'created_at', doneAt)}, updated_at = ${await at('court_owner_profiles', 'updated_at', doneAt)}
        WHERE user_id = (SELECT id FROM users WHERE email = ${demo.email})`);
    } else if (outcome === 'REJECTED') {
      doneAt = new Date(sentAt.getTime() + 86_400_000);
      await partnershipRequestService.reject(ctx.adminId, requestId, reason!);
    }
    await db.execute(sql`UPDATE owner_partnership_requests SET updated_at = ${await at('owner_partnership_requests', 'updated_at', doneAt)},
      processed_at = CASE WHEN processed_at IS NULL THEN NULL ELSE ${await at('owner_partnership_requests', 'processed_at', doneAt)} END WHERE id = ${requestId}`);
  }
  await db.execute(sql`DELETE FROM email_outbox WHERE idempotency_key LIKE 'owner-request:%'`);

  const counts = (await db.execute(sql`SELECT status, COUNT(*) AS n FROM owner_partnership_requests GROUP BY status ORDER BY status`)).rows as Array<{ status: string; n: string }>;
  ctx.log(`Hợp tác chủ sân: ${counts.map(c => `${c.n} ${c.status}`).join(', ')}; tài khoản mới ${PARTNERSHIP_OWNER_EMAIL}`);
}
