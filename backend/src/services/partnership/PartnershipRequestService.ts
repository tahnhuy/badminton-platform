import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, users } from '../../db';
import { AppError, ConflictError, NotFoundError } from '../../errors/AppError';
import { partnershipRequestRepository as repo, OPEN_STATUSES, type OwnerRequestView } from '../../repositories/partnership/PartnershipRequestRepository';
import { adminUserService } from '../admin/AdminUserService';
import { emailOutboxService } from '../email/EmailOutboxService';
import { notifyAdmins } from '../notifications/admin-notifications';
import { env } from '../../shared/config/env';
import { systemConfig } from '../../shared/config/system-config';
import { logger } from '../../shared/logging/logger';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type {
  ownerRequestApproveBodySchema, ownerRequestBodySchema, ownerRequestListQuerySchema, OwnerRequestStatus,
} from '../../validation/partnership';

type SubmitInput = z.infer<typeof ownerRequestBodySchema>;

/**
 * Court Owner partnership requests (docs/features/court-owner/partnership-request/tech-design.md).
 * PENDING → CONTACTED; PENDING | CONTACTED → APPROVED (account created) | REJECTED (reason). Final
 * states never change. Transitions are conditional updates, so concurrent Admins cannot both win.
 */
export class PartnershipRequestService {
  async isEnabled(): Promise<boolean> {
    return systemConfig.isOwnerPartnershipEnabled();
  }

  async submit(input: SubmitInput, ip: string | undefined): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new AppError('OWNER_REQUEST_DISABLED', 503, 'SmashPro tạm ngừng nhận yêu cầu hợp tác');
    }
    // Honeypot: answer like a success and store nothing.
    if (input.website && input.website.trim() !== '') {
      logger.warn('Owner partnership request rejected by honeypot', { code: 'OWNER_REQUEST_HONEYPOT' });
      return;
    }
    // One role per account: the email of an existing account cannot become a Court Owner (PRD §6.1).
    const [account] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (account) {
      throw new AppError('OWNER_REQUEST_EMAIL_HAS_ACCOUNT', 409, 'Email này đã có tài khoản SmashPro', [
        { field: 'email', code: 'OWNER_REQUEST_EMAIL_HAS_ACCOUNT', message: 'Email này đã có tài khoản SmashPro. Tài khoản chủ sân cần một email khác.' },
      ]);
    }

    await db.transaction(async tx => {
      const id = await repo.insertIfNoOpen(tx, {
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        facilityName: input.facilityName,
        addressLine: input.addressLine,
        district: input.district,
        city: input.city,
        expectedCourts: input.expectedCourts,
        note: input.note ?? null,
        submittedIp: ip?.slice(0, 45) ?? null,
      });
      // The email already has an open request: same answer, no second request or email.
      if (id === null) return;
      await notifyAdmins(tx, {
        type: 'ADMIN_OWNER_REQUEST_CREATED',
        title: 'Yêu cầu hợp tác mới',
        content: `${input.facilityName} – ${input.contactName} (${input.city})`,
        resource: { type: 'ADMIN_OWNER_REQUEST', id },
        dedupKey: `owner-request:created:${id}`,
      });
      await emailOutboxService.enqueue(tx, {
        to: input.email,
        template: 'OWNER_REQUEST_RECEIVED',
        data: { contactName: input.contactName, facilityName: input.facilityName },
        idempotencyKey: `owner-request:received:${id}`,
      });
    });
  }

  async list(query: z.infer<typeof ownerRequestListQuerySchema>) {
    const [{ rows, total }, counts] = await Promise.all([repo.list(query), repo.countsByStatus()]);
    return {
      data: rows,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), counts },
    };
  }

  async pendingCount(): Promise<number> {
    return (await repo.countsByStatus()).PENDING;
  }

  async get(id: number): Promise<OwnerRequestView> {
    const view = await repo.findView(db, id);
    if (!view) throw new NotFoundError('Không tìm thấy yêu cầu hợp tác', 'OWNER_REQUEST_NOT_FOUND');
    return view;
  }

  async saveNote(id: number, adminNote: string): Promise<OwnerRequestView> {
    return this.transition(id, OPEN_STATUSES, { adminNote: adminNote === '' ? null : adminNote });
  }

  async markContacted(id: number): Promise<OwnerRequestView> {
    return this.transition(id, ['PENDING'], { status: 'CONTACTED' });
  }

  async reject(adminId: number, id: number, reason: string): Promise<OwnerRequestView> {
    return db.transaction(async tx => {
      const request = await this.lockOpen(tx, id);
      await repo.updateIfStatus(tx, id, OPEN_STATUSES, {
        status: 'REJECTED', rejectReason: reason, processedBy: adminId, processedAt: new Date(),
      });
      await emailOutboxService.enqueue(tx, {
        to: request.email,
        template: 'OWNER_REQUEST_REJECTED',
        data: { contactName: request.contactName, facilityName: request.facilityName, reason },
        idempotencyKey: `owner-request:rejected:${id}`,
      });
      return (await repo.findView(tx, id))!;
    });
  }

  async approve(adminId: number, id: number, input: z.infer<typeof ownerRequestApproveBodySchema>): Promise<OwnerRequestView> {
    return db.transaction(async tx => {
      const request = await this.lockOpen(tx, id);
      const account = await adminUserService.createCourtOwnerInTx(tx, {
        email: request.email, businessName: input.businessName, phone: input.phone,
      });
      await repo.updateIfStatus(tx, id, OPEN_STATUSES, {
        status: 'APPROVED', createdUserId: account.id, processedBy: adminId, processedAt: new Date(),
      });
      const actionUrl = `${env.APP_PUBLIC_URL.replace(/\/+$/, '')}/forgot-password?email=${encodeURIComponent(account.email)}`;
      await emailOutboxService.enqueue(tx, {
        to: account.email,
        template: 'OWNER_ACCOUNT_CREATED',
        data: { contactName: request.contactName, facilityName: request.facilityName, accountEmail: account.email, actionUrl },
        idempotencyKey: `owner-request:approved:${id}`,
      });
      return (await repo.findView(tx, id))!;
    });
  }

  /** Row lock; the request must exist and still be open. */
  private async lockOpen(tx: TransactionContext, id: number) {
    const request = await repo.lockById(tx, id);
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu hợp tác', 'OWNER_REQUEST_NOT_FOUND');
    if (!OPEN_STATUSES.includes(request.status as OwnerRequestStatus)) throw invalidState(request.status);
    return request;
  }

  private async transition(id: number, from: OwnerRequestStatus[], values: Parameters<typeof repo.updateIfStatus>[3]): Promise<OwnerRequestView> {
    return db.transaction(async tx => {
      const applied = await repo.updateIfStatus(tx, id, from, values);
      const view = await repo.findView(tx, id);
      if (!view) throw new NotFoundError('Không tìm thấy yêu cầu hợp tác', 'OWNER_REQUEST_NOT_FOUND');
      if (!applied) throw invalidState(view.status);
      return view;
    });
  }
}

function invalidState(status: string): ConflictError {
  return new ConflictError(`Yêu cầu đang ở trạng thái ${status}, không thể thực hiện thao tác này`, 'OWNER_REQUEST_INVALID_STATE');
}

export const partnershipRequestService = new PartnershipRequestService();
