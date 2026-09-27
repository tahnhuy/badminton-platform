import { AppError } from '../../shared/http/app-error';
import { logger } from '../../shared/logging/logger';
import { systemConfig, SystemRole } from '../../shared/config/system-config';
import { passwordHasher } from './password-hasher';
import { authRepository } from './auth.repository';
import { isPasswordPolicySatisfied } from './auth.validation';

export interface RegisterDto {
  email: string;
  password: string;
  fullName: string;
  skillLevelCode: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface CreateCourtOwnerDto {
  email: string;
  initialPassword: string;
  businessName: string;
  phone: string;
}

export const authService = {
  /**
   * Registers a new Player and creates an active session.
   */
  async register(input: RegisterDto) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Verify skill level exists in catalog
    const skillLevel = await authRepository.findSkillLevelByCode(input.skillLevelCode);
    if (!skillLevel) {
      throw new AppError('AUTH_INVALID_SKILL_LEVEL', 400, 'Invalid skill level code', [
        { field: 'skillLevelCode', code: 'AUTH_INVALID_SKILL_LEVEL' },
      ]);
    }

    // 2. Check if email is already registered (including soft-deleted)
    const existingUser = await authRepository.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    // 3. Hash password with NFKC + pepper + bcrypt cost 12
    const passwordHash = await passwordHasher.hashPassword(input.password);

    // 4. Create user, profile, and session in transaction
    try {
      const result = await authRepository.registerPlayer({
        email: normalizedEmail,
        passwordHash,
        fullName: input.fullName.trim(),
        skillLevelId: skillLevel.id,
      });

      logger.info('User registered successfully', {
        userId: result.user.id,
        role: 'PLAYER',
      });

      return result;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('users_email_unique')) {
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },

  /**
   * Signs in a user, evaluates lockout rules, and creates a session.
   */
  async login(input: LoginDto) {
    const normalizedEmail = input.email.trim().toLowerCase();

    // 1. Look up user by email
    const user = await authRepository.findUserByEmail(normalizedEmail);

    // 2. Unknown email or soft-deleted account -> dummy verification + 401
    if (!user || user.deletedAt !== null) {
      await passwordHasher.dummyVerify(input.password);
      logger.warn('Failed login attempt', {
        reason: !user ? 'unknown_email' : 'soft_deleted',
      });
      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // 3. Check persistent lockout
    const lockoutConfig = await systemConfig.getLoginLockoutConfig();
    const lockout = await authRepository.getLoginLockout(user.id);
    const now = new Date();

    if (lockout?.lockedUntil && lockout.lockedUntil > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((lockout.lockedUntil.getTime() - now.getTime()) / 1000));
      logger.warn('Login attempt on locked account', {
        userId: user.id,
        reason: 'locked',
        lockedUntil: lockout.lockedUntil.toISOString(),
      });

      const error = new AppError(
        'AUTH_ACCOUNT_LOCKED',
        429,
        'Account is temporarily locked due to multiple failed login attempts',
        [{ lockedUntil: lockout.lockedUntil.toISOString() }]
      );
      (error as any).retryAfterSeconds = retryAfterSeconds;
      throw error;
    }

    // 4. Verify password
    const isPasswordValid = await passwordHasher.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      const updatedLockout = await authRepository.recordFailedLogin(
        user.id,
        lockoutConfig.threshold,
        lockoutConfig.lockoutMinutes
      );

      const isNowLocked = updatedLockout?.lockedUntil && updatedLockout.lockedUntil > now;
      logger.warn('Failed login attempt', {
        userId: user.id,
        reason: 'wrong_password',
        locked: !!isNowLocked,
      });

      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // 5. Correct password -> reset lockout
    await authRepository.resetLoginLockout(user.id);

    // 6. Check account status
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      logger.warn('Login attempt on restricted account', {
        userId: user.id,
        reason: user.status.toLowerCase(),
      });
      throw new AppError('AUTH_ACCOUNT_RESTRICTED', 403, 'Account is suspended or deactivated');
    }

    // 7. Cleanup revoked/expired sessions and create new session (single transaction)
    const { rawToken, session } = await authRepository.createLoginSession(user.id, user.role as SystemRole);

    logger.info('User logged in successfully', {
      userId: user.id,
      role: user.role,
      reason: 'success',
    });

    return {
      user,
      rawToken,
      session,
    };
  },

  /**
   * Signs out a user by revoking the session token.
   */
  async logout(rawToken?: string): Promise<void> {
    if (rawToken) {
      await authRepository.revokeSessionByToken(rawToken);
      logger.info('Session revoked', { trigger: 'sign_out' });
    }
  },

  /**
   * Changes the password for an authenticated user.
   */
  async changePassword(userId: number, input: ChangePasswordDto) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('AUTH_SESSION_INVALID', 401, 'User not found');
    }

    // Verify current password
    const isCurrentValid = await passwordHasher.verifyPassword(input.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new AppError('AUTH_CURRENT_PASSWORD_INCORRECT', 400, 'Current password is incorrect');
    }

    // Hash new password and update
    const newPasswordHash = await passwordHasher.hashPassword(input.newPassword);
    const updatedUser = await authRepository.updateUserPassword(userId, newPasswordHash);

    logger.info('Password changed successfully', { userId });

    return updatedUser;
  },

  /**
   * Admin creates a Court Owner account.
   */
  async createCourtOwnerAccount(input: CreateCourtOwnerDto) {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!isPasswordPolicySatisfied(input.initialPassword, normalizedEmail)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'initialPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const existing = await authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    const passwordHash = await passwordHasher.hashPassword(input.initialPassword);

    try {
      const newUser = await authRepository.createCourtOwnerAccount({
        email: normalizedEmail,
        passwordHash,
        businessName: input.businessName.trim(),
        phone: input.phone.trim(),
      });

      logger.info('Court Owner account created by admin', {
        userId: newUser.id,
        role: 'COURT_OWNER',
      });

      return newUser;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('users_email_unique')) {
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },

  /**
   * Admin sets a user's password, forcing password change on next login.
   */
  async adminSetPassword(userId: number, newPassword: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    if (!isPasswordPolicySatisfied(newPassword, user.email)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'newPassword', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const passwordHash = await passwordHasher.hashPassword(newPassword);
    const updated = await authRepository.adminSetUserPassword(userId, passwordHash);
    if (!updated) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }

    logger.info('Session revoked', { userId, trigger: 'admin_set_password' });

    return updated;
  },

  /**
   * Provisions an Admin account (AUTH-14).
   */
  async createAdminAccount(input: { email: string; password: string }) {
    const normalizedEmail = input.email.trim().toLowerCase();

    if (!isPasswordPolicySatisfied(input.password, normalizedEmail)) {
      throw new AppError('AUTH_PASSWORD_POLICY_VIOLATION', 400, 'Password does not satisfy policy requirements', [
        { field: 'password', code: 'AUTH_PASSWORD_POLICY_VIOLATION' },
      ]);
    }

    const existing = await authRepository.findUserByEmail(normalizedEmail);
    if (existing) {
      throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
    }

    const passwordHash = await passwordHasher.hash(input.password);

    try {
      const newUser = await authRepository.createAdminUser({
        email: normalizedEmail,
        passwordHash,
      });

      logger.info('Admin account provisioned', {
        userId: newUser.id,
        role: 'ADMIN',
      });

      return newUser;
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('users_email_unique')) {
        throw new AppError('AUTH_EMAIL_ALREADY_REGISTERED', 409, 'Email is already registered');
      }
      throw err;
    }
  },
};

