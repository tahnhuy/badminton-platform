import { db } from '../../db';
import { privateMediaService } from '../media/PrivateMediaService';
import { courtProfileRepository } from '../../repositories/facility/CourtProfileRepository';
import { courtStandardRepository as repo } from '../../repositories/facility/CourtStandardRepository';
import { AppError } from '../../errors/AppError';
import { ownerConflict, ownerMissing, paginated } from '../owner/owner-errors';
import { notifyAdmins } from '../notifications/admin-notifications';
import { cleanNotificationReason, notifyCourtOwner } from '../notifications/owner-notifications';
import type { UploadedImage } from '../../contracts/PrivateMediaService';

export interface StandardClaimInput {
  standardCode: string;
  issuer: string;
  referenceNo: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

function invalid(message: string): never {
  throw new AppError('VALIDATION_FAILED', 400, message);
}

export const courtStandardService = {
  catalog() {
    return repo.catalog();
  },

  async submit(ownerId: number, courtId: number, input: StandardClaimInput, files: readonly UploadedImage[]) {
    if (files.length === 0) invalid('Cần ít nhất một ảnh bằng chứng');
    const standard = await repo.standard(input.standardCode);
    if (!standard || !standard.isActive) invalid('Tiêu chuẩn không tồn tại hoặc đã tắt');
    if (standard.requiresExpiry && !input.expiresAt) invalid('Tiêu chuẩn này bắt buộc có ngày hết hạn');
    if (input.issuedAt && input.expiresAt && input.issuedAt > input.expiresAt) invalid('Ngày hết hạn phải sau ngày cấp');

    return privateMediaService.transaction(async (tx) => {
      const owned = await courtProfileRepository.findOwned(ownerId, courtId, tx, true);
      if (!owned) ownerMissing('COURT');
      const court = owned.court;
      if (!court.surfaceBrand || !court.surfaceModel) {
        invalid('Cần khai báo thương hiệu và dòng sản phẩm mặt sân trước khi nộp tiêu chuẩn');
      }

      await repo.invalidateExpired(courtId, input.standardCode, tx);
      if (await repo.hasOutstanding(courtId, input.standardCode, tx)) {
        ownerConflict('STANDARD_CLAIM_ALREADY_ACTIVE', 'Đã có hồ sơ đang chờ duyệt hoặc còn hiệu lực cho tiêu chuẩn này');
      }

      const stored = await privateMediaService.storeImages(files, ownerId, tx, {
        invalidImageCode: 'COURT_STANDARD_IMAGE_INVALID',
      });
      const claim = await repo.insertClaim({
        courtId,
        standardCode: input.standardCode,
        status: 'PENDING',
        submittedBy: ownerId,
        surfaceBrand: court.surfaceBrand,
        surfaceModel: court.surfaceModel,
        issuer: input.issuer,
        referenceNo: input.referenceNo,
        issuedAt: input.issuedAt || null,
        expiresAt: input.expiresAt || null,
      }, tx);
      await repo.insertEvidence(
        stored.map((media, index) => ({ claimId: claim.id, mediaId: media.id, position: index + 1 })),
        tx
      );
      await notifyAdmins(tx, {
        type: 'ADMIN_STANDARD_CLAIM_SUBMITTED',
        title: 'Hồ sơ tiêu chuẩn mặt sân chờ duyệt',
        content: `Sân "${court.name}" (${owned.facility.name}) vừa gửi hồ sơ ${standard.name}.`,
        resource: { type: 'ADMIN_STANDARD_CLAIM', id: claim.id },
        dedupKey: `admin-standard-claim:${claim.id}`,
      });
      return {
        id: claim.id,
        status: claim.status,
        standardCode: claim.standardCode,
        evidenceMediaIds: stored.map(media => media.id),
      };
    });
  },

  async ownerHistory(ownerId: number, courtId: number, page: number, limit: number) {
    if (!await courtProfileRepository.findOwned(ownerId, courtId)) ownerMissing('COURT');
    const { rows, total } = await repo.claimsForCourt(courtId, page, limit);
    return paginated(rows, total, page, limit);
  },

  async listAdmin(status: string | undefined, page: number, limit: number) {
    const { rows, total } = await repo.listAdmin(status, page, limit);
    return paginated(rows, total, page, limit);
  },

  async decide(adminId: number, claimId: number, approve: boolean, reason?: string) {
    return db.transaction(async (tx) => {
      const claim = await repo.lockClaim(claimId, tx);
      if (!claim) throw new AppError('STANDARD_CLAIM_NOT_FOUND', 404, 'Hồ sơ tiêu chuẩn không tồn tại');
      if (claim.status !== 'PENDING') ownerConflict('STANDARD_CLAIM_NOT_PENDING', 'Hồ sơ đã được xử lý');
      if (!approve && !reason?.trim()) invalid('Cần lý do từ chối');
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (approve && claim.expiresAt && claim.expiresAt < today) invalid('Hồ sơ đã hết hạn, không thể duyệt');
      const decided = await repo.decide(claimId, adminId, approve, reason?.trim() ?? null, tx);
      const context = await repo.claimContext(claimId, tx);
      if (context) {
        const cleanReason = cleanNotificationReason(reason);
        await notifyCourtOwner(tx, context.courtId, context.ownerId, {
          type: approve ? 'OWNER_STANDARD_APPROVED' : 'OWNER_STANDARD_REJECTED',
          title: approve ? 'Tiêu chuẩn mặt sân đã được duyệt' : 'Hồ sơ tiêu chuẩn bị từ chối',
          content: `Hồ sơ tiêu chuẩn của sân "${context.courtName}" (${context.facilityName}) ${approve ? 'đã được duyệt.' : `bị từ chối${cleanReason ? `: ${cleanReason}` : '.'}`}`,
          resource: { type: 'OWNER_COURT', id: context.courtId },
          dedupKey: `owner-standard-claim:${claimId}`,
        });
      }
      return decided;
    });
  },

  verifiedForCourts(courtIds: number[]) {
    return repo.verifiedForCourts(courtIds);
  },
};
