import { httpClient } from '../../shared/api/http-client';

export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  role: SystemRole;
  requiresPasswordChange: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  withdrawalPin: string;
  withdrawalPinConfirm: string;
  previousChallengeId?: string;
  skillSurvey: SkillSurveySubmission;
}

export interface RegistrationChallenge {
  challengeId: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface ResetAuthorization {
  resetToken: string;
  expiresAt: string;
}

/** Answer value per question id: option code (CHOICE), 0–3 (SKILL) or boolean (BOOLEAN). */
export type SurveyAnswerValue = string | number | boolean;
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export interface SkillSurveySubmission {
  version: number;
  answers: SurveyAnswers;
}

/** Public survey definition (`GET /api/v1/auth/skill-survey`): wording only, no scoring data. */
export interface SkillSurveyQuestion {
  id: string;
  type: 'CHOICE' | 'SKILL' | 'BOOLEAN';
  text: string;
  description?: string;
  /** CHOICE codes are strings; BOOLEAN codes are JSON booleans. SKILL questions use `skillScale`. */
  options?: { code: string | boolean; label: string }[];
  hiddenWhen?: { questionId: string; optionCode: string | boolean };
}

export interface SkillSurvey {
  version: number;
  steps: { title: string; questionIds: string[] }[];
  skillScale: { value: number; label: string }[];
  questions: SkillSurveyQuestion[];
}

export interface SkillLevelRef {
  code: string;
  name: string;
  rank: number;
}

export type SurveyCriterion = 'K' | 'R' | 'X' | 'P' | 'A' | 'T';

/** Server-computed survey result (Auth Tech Design "Registration skill survey"). */
export interface SkillSurveyResult {
  version: number;
  nominalSkillLevel: SkillLevelRef;
  skillLevel: SkillLevelRef;
  isSkillTentative: boolean;
  finalScore: number;
  components: Record<SurveyCriterion, number>;
  appliedGuardrails: ('G1_BOTTLENECK' | 'G2_EXPERIENCE_CAP')[];
  guardrails: { code: 'G1_BOTTLENECK' | 'G2_EXPERIENCE_CAP'; cap: SkillLevelRef; criterion?: 'K' | 'R' | 'P' }[];
  strengths: { criterion: 'K' | 'R' | 'P' | 'X'; score: number }[];
  areaToImprove: { criterion: 'K' | 'R' | 'P'; score: number };
}

export interface VerifyRegistrationResponse {
  data: AuthUser;
  meta: { skillSurveyResult: SkillSurveyResult };
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  /** Present only for a voluntary change after the email OTP verification. */
  resetToken?: string;
}

export interface SkillLevel {
  code: string;
  name: string;
  rank: number;
  description: string | null;
}

export const authApi = {
  /** Starts registration; no session until `verifyRegistration`. */
  async register(payload: RegisterPayload): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyRegistration(payload: { challengeId: string; otp: string }): Promise<VerifyRegistrationResponse> {
    return httpClient<VerifyRegistrationResponse>('/api/v1/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resendRegistrationOtp(payload: { challengeId: string }): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/register/resend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async forgotPassword(payload: { email: string }): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyPasswordReset(payload: { challengeId: string; otp: string }): Promise<{ data: ResetAuthorization }> {
    return httpClient<{ data: ResetAuthorization }>('/api/v1/auth/password/reset/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resendPasswordResetOtp(payload: { challengeId: string }): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/password/reset/resend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resetPassword(payload: { resetToken: string; newPassword: string }): Promise<void> {
    return httpClient<void>('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getWithdrawalPinStatus(): Promise<{ data: { hasPin: boolean; lockedUntil: string | null } }> {
    return httpClient('/api/v1/wallet/withdrawal-pin');
  },

  async signIn(payload: SignInPayload): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async signOut(): Promise<void> {
    return httpClient<void>('/api/v1/auth/logout', {
      method: 'POST',
    });
  },

  async me(): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/me');
  },

  async requestPasswordChangeOtp(): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/password/change/request', {
      method: 'POST',
    });
  },

  async verifyPasswordChangeOtp(payload: { challengeId: string; otp: string }): Promise<{ data: ResetAuthorization }> {
    return httpClient<{ data: ResetAuthorization }>('/api/v1/auth/password/change/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resendPasswordChangeOtp(payload: { challengeId: string }): Promise<{ data: RegistrationChallenge }> {
    return httpClient<{ data: RegistrationChallenge }>('/api/v1/auth/password/change/resend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async changePassword(payload: ChangePasswordPayload): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Active registration survey; `503 AUTH_SKILL_SURVEY_UNAVAILABLE` when none is active. */
  async getSkillSurvey(signal?: AbortSignal): Promise<{ data: SkillSurvey }> {
    return httpClient<{ data: SkillSurvey }>('/api/v1/auth/skill-survey', { signal });
  },

  /** Own saved survey result; `404 PLAYER_SKILL_SURVEY_NOT_FOUND` when the Player has none. */
  async getOwnSkillSurvey(signal?: AbortSignal): Promise<{ data: SkillSurveyResult }> {
    return httpClient<{ data: SkillSurveyResult }>('/api/v1/players/me/skill-survey', { signal });
  },

  /** Level catalog with descriptions; the result screen's ladder shows them. */
  async listSkillLevels(signal?: AbortSignal): Promise<{ data: SkillLevel[] }> {
    return httpClient<{ data: SkillLevel[] }>('/api/v1/skill-levels', { signal });
  },
};
