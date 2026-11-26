import { userRepository, UserRepository, UserFilterOptions, UserWithProfile, CreateUserData, UserStatsData, RawUser } from '../../repositories/user/UserRepository';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../../errors/AppError';
import { hashPassword } from '../../utils/password';
import { isPasswordPolicySatisfied } from '../../validation/auth';
import { authService } from '../auth/AuthService';
import { messagingWsHub } from '../messaging/MessagingWsHub';
import { notifyAdminsBestEffort } from '../notifications/admin-notifications';
import { adminAuditRepository } from '../../repositories/admin/AdminAuditRepository';
import { generateTemporaryPassword } from '../auth/temporary-password';
import { emailOutboxService } from '../email/EmailOutboxService';
import crypto from 'crypto';
import { db } from '../../db';
import { logger } from '../../shared/logging/logger';

export interface UserListResult {
  data: UserWithProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: UserStatsData;
}

export interface CreateUserDTO {
  email: string;
  password: string;
  /** No PLAYER: Players come only from self-registration with the skill survey (AUTH-33). */
  role: 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  businessName?: string;
  phone?: string;
}

export class AdminUserService {
  constructor(private readonly userRepo: UserRepository = userRepository) {}

  async listUsers(options: UserFilterOptions): Promise<UserListResult> {
    const { users, total, stats } = await this.userRepo.findUsers(options);
    const totalPages = options.limit > 0 ? Math.ceil(total / options.limit) : 0;

    return {
      data: users,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
      },
      stats,
    };
  }

  async getUserById(id: number): Promise<{ data: UserWithProfile }> {
    const user = await this.userRepo.findUserById(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`, 'USER_NOT_FOUND');
    }

    return {
      data: user,
    };
  }

  async createUser(dto: CreateUserDTO, actorAdminId?: number): Promise<{ data: UserWithProfile }> {
    const existing = await this.userRepo.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Email đã tồn tại trong hệ thống', 'USER_EMAIL_EXISTS');
    }

    if (!isPasswordPolicySatisfied(dto.password, dto.email)) {
      throw new AppError(
        'AUTH_PASSWORD_POLICY_VIOLATION',
        400,
        'Password does not satisfy policy requirements',
        [{ field: 'password', code: 'AUTH_PASSWORD_POLICY_VIOLATION' }]
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const created = await this.userRepo.createUser({
      email: dto.email,
      passwordHash,
      role: dto.role,
      status: dto.status || 'ACTIVE',
      // An Admin chooses the initial password, so a Court Owner must change it on first sign-in.
      mustChangePassword: dto.role === 'COURT_OWNER',
      businessName: dto.businessName,
      phone: dto.phone,
    });

    if (created.role === 'ADMIN') {
      await notifyAdminsBestEffort({
        type: 'ADMIN_SECURITY_EVENT',
        title: 'Tài khoản Admin mới được tạo',
        content: `Tài khoản Admin ${created.email} (#${created.id}) vừa được tạo.`,
        resource: { type: 'ADMIN_USER', id: created.id },
        dedupKey: `admin-security:account-created:${created.id}`,
        excludeUserIds: actorAdminId === undefined ? [] : [actorAdminId],
      });
    }

    return {
      data: created,
    };
  }

  async updateUserStatus(
    targetUserId: number,
    newStatus: string,
    actorAdminId: number
  ): Promise<{ data: UserWithProfile }> {
    const targetUser = await this.userRepo.findRawUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    if (targetUser.deletedAt !== null) {
      throw new ConflictError('Cannot change status of a soft-deleted user');
    }

    // Business Rule: Admins cannot deactivate another Admin account or themselves
    if (newStatus === 'SUSPENDED' || newStatus === 'DEACTIVATED') {
      if (targetUser.role === 'ADMIN' || targetUserId === actorAdminId) {
        throw new ForbiddenError(
          'Admins cannot deactivate another admin account or themselves',
          'AUTH_FORBIDDEN_ROLE'
        );
      }
    }

    const updatedUser = await this.userRepo.updateStatus(targetUserId, newStatus);
    if (newStatus !== 'ACTIVE') {
      messagingWsHub.closeByUserId(targetUserId, 'User account status restricted');
    }
    if (!updatedUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    return {
      data: updatedUser,
    };
  }

  private async filterProtectedTargets(
    targetUserIds: number[],
    actorAdminId: number
  ): Promise<number[]> {
    const rows = await this.userRepo.findRolesByIds(targetUserIds);
    const adminIds = new Set(
      rows.filter((row) => row.role === 'ADMIN').map((row) => row.id)
    );
    return targetUserIds.filter((id) => id !== actorAdminId && !adminIds.has(id));
  }

  async bulkUpdateStatus(
    targetUserIds: number[],
    newStatus: string,
    actorAdminId: number
  ): Promise<{ affectedCount: number }> {
    if (targetUserIds.length === 0) return { affectedCount: 0 };

    // Business Rule: Admins cannot deactivate another Admin account or themselves
    let eligibleIds = targetUserIds;
    if (newStatus === 'SUSPENDED' || newStatus === 'DEACTIVATED') {
      eligibleIds = await this.filterProtectedTargets(targetUserIds, actorAdminId);
    }

    if (eligibleIds.length === 0) return { affectedCount: 0 };

    const count = await this.userRepo.bulkUpdateStatus(eligibleIds, newStatus);
    if (newStatus !== 'ACTIVE') {
      eligibleIds.forEach((id) => messagingWsHub.closeByUserId(id, 'User account status restricted'));
    }
    return { affectedCount: count };
  }

  async softDeleteUser(targetUserId: number, actorAdminId: number): Promise<void> {
    const targetUser = await this.userRepo.findRawUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    // Business Rule: Admins cannot soft-delete another Admin account or themselves
    if (targetUser.role === 'ADMIN' || targetUserId === actorAdminId) {
      throw new ForbiddenError(
        'Admins cannot soft-delete another admin account or themselves',
        'AUTH_FORBIDDEN_ROLE'
      );
    }

    // Idempotency: If already soft-deleted, do not throw, return cleanly
    if (targetUser.deletedAt !== null) {
      return;
    }

    await this.userRepo.softDelete(targetUserId);
    messagingWsHub.closeByUserId(targetUserId, 'User account deleted');
  }

  async bulkSoftDelete(
    targetUserIds: number[],
    actorAdminId: number
  ): Promise<{ affectedCount: number }> {
    if (targetUserIds.length === 0) return { affectedCount: 0 };

    // Business Rule: Admins cannot soft-delete another Admin account or themselves
    const eligibleIds = await this.filterProtectedTargets(targetUserIds, actorAdminId);
    if (eligibleIds.length === 0) return { affectedCount: 0 };

    const count = await this.userRepo.bulkSoftDelete(eligibleIds);
    eligibleIds.forEach((id) => messagingWsHub.closeByUserId(id, 'User account deleted'));
    return { affectedCount: count };
  }

  async setUserPassword(
    targetUserId: number,
    reason: string,
    actorAdminId: number,
  ): Promise<{ data: UserWithProfile; temporaryPassword: string }> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new AppError('VALIDATION_FAILED', 400, 'A reason is required', [
        { field: 'reason', code: 'VALIDATION_FAILED' },
      ]);
    }

    const targetUser = await this.userRepo.findRawUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    let temporaryPassword = '';
    temporaryPassword = await this.resetPasswordWithAuditFailure(temporaryPassword, targetUser, targetUserId, actorAdminId, trimmedReason);

    await adminAuditRepository.record({
      adminId: actorAdminId,
      targetUserId,
      action: 'ADMIN_RESET_PASSWORD',
      reason: trimmedReason,
      result: 'SUCCESS',
    });

    try {
      await emailOutboxService.enqueue(db, {
        to: targetUser.email,
        template: 'ADMIN_PASSWORD_RESET',
        data: { adminEmail: undefined },
        idempotencyKey: `admin-password-reset:${targetUserId}:${crypto.randomUUID()}`,
      });
      emailOutboxService.processSoon();
    } catch (error) {
      // The password is already reset; a mail failure must not hide that from the Admin.
      logger.error('Admin password reset notification could not be queued', {
        targetUserId,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (targetUser.role === 'ADMIN') {
      await notifyAdminsBestEffort({
        type: 'ADMIN_SECURITY_EVENT',
        title: 'Mật khẩu Admin vừa được đặt lại',
        content: `Mật khẩu của tài khoản Admin ${targetUser.email} (#${targetUser.id}) vừa được đặt lại.`,
        resource: { type: 'ADMIN_USER', id: targetUser.id },
        dedupKey: `admin-security:password-reset:${targetUser.id}:${Math.floor(Date.now() / 60000)}`,
        excludeUserIds: actorAdminId === undefined ? [] : [actorAdminId],
      });
    }

    const updatedUser = await this.userRepo.findUserById(targetUserId);
    if (!updatedUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    return { data: updatedUser, temporaryPassword };
  }

  private async resetPasswordWithAuditFailure(
    temporaryPassword: string,
    targetUser: RawUser,
    targetUserId: number,
    actorAdminId: number,
    trimmedReason: string,
  ) {
    try {
      do {
        temporaryPassword = generateTemporaryPassword();
      } while (!isPasswordPolicySatisfied(temporaryPassword, targetUser.email));

      // Auth-owned behavior: apply the password policy, set must_change_password,
      // revoke every session, clear the lockout and invalidate old reset tokens.
      await authService.adminSetPassword(targetUserId, temporaryPassword);
    } catch (error) {
      // Recording the failure must not replace the original error.
      try {
        await adminAuditRepository.record({
          adminId: actorAdminId,
          targetUserId,
          action: 'ADMIN_RESET_PASSWORD',
          reason: trimmedReason,
          result: 'FAILED',
        });
      } catch (auditError) {
        logger.error('Admin password reset failure could not be audited', {
          targetUserId,
          message: auditError instanceof Error ? auditError.message : String(auditError),
        });
      }
      throw error;
    }
    return temporaryPassword;
  }
}

export const adminUserService = new AdminUserService();
