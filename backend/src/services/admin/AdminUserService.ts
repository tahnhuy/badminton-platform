import { userRepository, UserRepository, UserFilterOptions, UserWithProfile, CreateUserData, UserStatsData } from '../../repositories/UserRepository';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '../../errors/AppError';
import { hashPassword } from '../../utils/password';

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
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  fullName?: string;
  skillLevelId?: number;
  avatarUrl?: string;
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

  async createUser(dto: CreateUserDTO): Promise<{ data: UserWithProfile }> {
    const existing = await this.userRepo.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Email đã tồn tại trong hệ thống', 'USER_EMAIL_EXISTS');
    }

    if (!dto.password || dto.password.length < 6) {
      throw new ValidationError('Mật khẩu tối thiểu 6 ký tự');
    }

    const passwordHash = await hashPassword(dto.password);
    const created = await this.userRepo.createUser({
      email: dto.email,
      passwordHash,
      role: dto.role,
      status: dto.status || 'ACTIVE',
      fullName: dto.fullName,
      skillLevelId: dto.skillLevelId,
      avatarUrl: dto.avatarUrl,
      businessName: dto.businessName,
      phone: dto.phone,
    });

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
    return { affectedCount: count };
  }

  async setUserPassword(
    targetUserId: number,
    newPassword: string
  ): Promise<{ data: UserWithProfile }> {
    const targetUser = await this.userRepo.findRawUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await this.userRepo.updatePassword(targetUserId, passwordHash);
    if (!updatedUser) {
      throw new NotFoundError(`User with id ${targetUserId} not found`, 'USER_NOT_FOUND');
    }

    return {
      data: updatedUser,
    };
  }
}

export const adminUserService = new AdminUserService();
