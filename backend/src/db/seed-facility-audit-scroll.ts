import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Seed này chỉ dành cho local/demo.');
  const { db, pool, users, facilities, courts, courtProfileChanges, courtOwnerReviews, courtStandards, courtStandardClaims, courtStandardEvidence } = await import('./index');
  const { eq, and, asc } = await import('drizzle-orm');
  const { privateMediaService } = await import('../services/media/PrivateMediaService');
  const sharp = (await import('sharp')).default;
  const marker = '[DEMO SCROLL]';
  try {
    const result = await privateMediaService.transaction(async tx => {
      // Serialize reruns so this seed does not duplicate its own sample history.
      const { sql } = await import('drizzle-orm');
      await tx.execute(sql`SELECT pg_advisory_xact_lock(78423109)`);
      const [owner] = await tx.select().from(users).where(eq(users.email, 'quocbao.tran@phucthinhbadminton.vn'));
      const [admin] = await tx.select().from(users).where(and(eq(users.role, 'ADMIN'), eq(users.status, 'ACTIVE'))).orderBy(asc(users.id));
      if (!owner || !admin) throw new Error('Thiếu Owner yêu cầu hoặc tài khoản Admin đang hoạt động.');
      const [facility] = await tx.select().from(facilities).where(and(eq(facilities.ownerId, owner.id), sql`${facilities.deletedAt} IS NULL`)).orderBy(asc(facilities.id));
      if (!facility) throw new Error('Owner chưa có cơ sở.');
      const [court] = await tx.select().from(courts).where(and(eq(courts.facilityId, facility.id), sql`${courts.deletedAt} IS NULL`)).orderBy(asc(courts.id));
      if (!court) throw new Error('Cơ sở chưa có sân.');
      const existing = await tx.select().from(courtStandardClaims).where(eq(courtStandardClaims.referenceNo, 'DEMO-SCROLL-01'));
      if (existing.length) return { reused: true, facilityId: facility.id, courtId: court.id };

      const image = await sharp(Buffer.from('<svg width="1000" height="600" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e8f5e9"/><text x="80" y="180" font-size="60" fill="#146c43">DEMO SCROLL TEST</text><text x="80" y="280" font-size="32">Sample evidence - NOT a certificate</text></svg>')).png().toBuffer();
      const [media] = await privateMediaService.storeImages([{ buffer: image, mimetype: 'image/png' }], owner.id, tx, { invalidImageCode: 'COURT_STANDARD_IMAGE_INVALID' });
      const now = Date.now();
      const longText = `${marker} Bản ghi mẫu để kiểm tra cuộn ngang và dọc; không phải sự kiện vận hành hoặc chứng nhận thực tế. `.repeat(6);
      for (let i = 1; i <= 12; i++) {
        const suffix = String(i).padStart(2, '0');
        const createdAt = new Date(now - i * 60_000);
        await tx.insert(courtProfileChanges).values([
          { courtId: court.id, actorId: owner.id, changeType: 'PROFILE', beforeValues: { surfaceType: 'PVC', surfaceBrand: 'Demo cũ', surfaceModel: 'Demo cũ', surfaceThicknessMm: '4.0' }, afterValues: { surfaceType: 'PU_ACRYLIC', surfaceBrand: `DEMO ${suffix}`, surfaceModel: longText, surfaceThicknessMm: '4.5' }, reason: `${marker} Thông số mẫu ${suffix}`, createdAt },
          { courtId: court.id, actorId: owner.id, changeType: 'CONDITION', beforeValues: { condition: 'NORMAL', conditionNote: null }, afterValues: { condition: 'NEEDS_MAINTENANCE', conditionNote: longText }, reason: `${marker} Tình trạng mẫu ${suffix}`, createdAt },
        ]);
        // Completed sample reviews do not create pending requests or change current court/facility states.
        for (const target of [{ facilityId: facility.id }, { courtId: court.id }]) {
          await tx.insert(courtOwnerReviews).values({ ...target, kind: 'ONBOARDING', submittedValues: { demo: true, name: `${marker} Hồ sơ ${suffix}`, address: longText }, status: 'REJECTED', submittedBy: owner.id, reviewedBy: admin.id, rejectionReason: `${marker} Hồ sơ minh họa ${suffix}, không phải quyết định thực tế.`, createdAt, reviewedAt: new Date(createdAt.getTime() + 1000) });
        }
        const code = `DEMO_SCROLL_${suffix}`;
        await tx.insert(courtStandards).values({ code, name: `${marker} Tiêu chuẩn minh họa ${suffix} — chỉ dùng kiểm tra giao diện`, isActive: false, requiresExpiry: false }).onConflictDoNothing();
        // Different demo codes respect the one-outstanding-claim-per-court/standard constraint.
        const [claim] = await tx.insert(courtStandardClaims).values({ courtId: court.id, standardCode: code, status: 'PENDING', submittedBy: owner.id, surfaceBrand: `${marker} Thương hiệu mẫu`, surfaceModel: `Mẫu ${suffix}`, issuer: longText, referenceNo: `DEMO-SCROLL-${suffix}`, issuedAt: '2026-01-01', expiresAt: '2027-12-31', createdAt }).returning();
        await tx.insert(courtStandardEvidence).values({ claimId: claim.id, mediaId: media!.id, position: 1 });
      }
      return { reused: false, facilityId: facility.id, courtId: court.id, profileChanges: 24, courtReviews: 12, facilityReviews: 12, pendingStandards: 12 };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
