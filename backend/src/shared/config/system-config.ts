import { clearConfigCache, configDefinitions, loadConfigValues } from './config-registry';

export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

const authKeys = [
  'AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD',
  'AUTH_FAILED_LOGIN_LOCKOUT_MINUTES',
  'AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER',
  'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER',
  'AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER',
  'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER',
  'AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN',
  'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN',
] as const;

export const AUTH_CONFIG_DEFAULTS = {
  AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD: configDefinitions.AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD.defaultValue,
  AUTH_FAILED_LOGIN_LOCKOUT_MINUTES: configDefinitions.AUTH_FAILED_LOGIN_LOCKOUT_MINUTES.defaultValue,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER: configDefinitions.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER.defaultValue,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER: configDefinitions.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER.defaultValue,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER: configDefinitions.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER.defaultValue,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER: configDefinitions.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER.defaultValue,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN: configDefinitions.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN.defaultValue,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN: configDefinitions.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN.defaultValue,
} as const;

export type AuthConfigKey = keyof typeof AUTH_CONFIG_DEFAULTS;

const otpConfigKeys = [
  'OTP_TTL_MINUTES',
  'OTP_MAX_ATTEMPTS',
  'OTP_RESEND_SECONDS',
  'OTP_MAX_SENDS_PER_HOUR',
  'PENDING_REGISTRATION_TTL_MINUTES',
  'RESET_TOKEN_TTL_MINUTES',
] as const;

const emailOutboxConfigKeys = [
  'EMAIL_OUTBOX_MAX_ATTEMPTS',
  'EMAIL_OUTBOX_TICK_MS',
] as const;

export interface OtpConfig {
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpResendSeconds: number;
  otpMaxSendsPerHour: number;
  pendingRegistrationTtlMinutes: number;
  resetTokenTtlMinutes: number;
}

export const systemConfig = {
  clearCache: clearConfigCache,

  async getOtpConfig(): Promise<OtpConfig> {
    const values = await loadConfigValues(otpConfigKeys);
    return {
      otpTtlMinutes: values.OTP_TTL_MINUTES,
      otpMaxAttempts: values.OTP_MAX_ATTEMPTS,
      otpResendSeconds: values.OTP_RESEND_SECONDS,
      otpMaxSendsPerHour: values.OTP_MAX_SENDS_PER_HOUR,
      pendingRegistrationTtlMinutes: values.PENDING_REGISTRATION_TTL_MINUTES,
      resetTokenTtlMinutes: values.RESET_TOKEN_TTL_MINUTES,
    };
  },

  async getEmailOutboxConfig(): Promise<{ maxAttempts: number; tickMs: number }> {
    const values = await loadConfigValues(emailOutboxConfigKeys);
    return {
      maxAttempts: values.EMAIL_OUTBOX_MAX_ATTEMPTS,
      tickMs: values.EMAIL_OUTBOX_TICK_MS,
    };
  },

  async getLockoutThreshold(): Promise<number> {
    const values = await loadConfigValues(['AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD'] as const);
    return values.AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD;
  },

  async getLockoutMinutes(): Promise<number> {
    const values = await loadConfigValues(['AUTH_FAILED_LOGIN_LOCKOUT_MINUTES'] as const);
    return values.AUTH_FAILED_LOGIN_LOCKOUT_MINUTES;
  },

  async getLoginLockoutConfig(): Promise<{ threshold: number; lockoutMinutes: number }> {
    const values = await loadConfigValues([
      'AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD',
      'AUTH_FAILED_LOGIN_LOCKOUT_MINUTES',
    ] as const);
    return {
      threshold: values.AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD,
      lockoutMinutes: values.AUTH_FAILED_LOGIN_LOCKOUT_MINUTES,
    };
  },

  async getSessionTimeouts(role: SystemRole): Promise<{
    idleTimeoutMinutes: number;
    absoluteTimeoutMinutes: number;
  }> {
    const values = await loadConfigValues(authKeys);

    switch (role) {
      case 'ADMIN':
        return {
          idleTimeoutMinutes: values.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN,
          absoluteTimeoutMinutes: values.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN,
        };
      case 'COURT_OWNER':
        return {
          idleTimeoutMinutes: values.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER,
          absoluteTimeoutMinutes: values.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER,
        };
      case 'PLAYER':
      default:
        return {
          idleTimeoutMinutes: values.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER,
          absoluteTimeoutMinutes: values.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER,
        };
    }
  },
};
