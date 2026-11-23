import type { SurveyAnswers } from '../auth-api';

/**
 * Wizard draft kept in sessionStorage (same tab only) so answers survive a reload
 * (PRD). The password is never part of it. Storage may be unavailable (private
 * mode, quota); the wizard then keeps working in memory.
 */
export const REGISTER_DRAFT_KEY = 'smashpro.registerDraft.v1';

export interface AccountDraft { email: string; fullName: string; phone: string }

export interface RegisterDraft {
  version: number;
  step: number;
  maxStep: number;
  skillIndex: number;
  answers: SurveyAnswers;
  account: AccountDraft;
}

export const EMPTY_ACCOUNT: AccountDraft = { email: '', fullName: '', phone: '' };

const asIndex = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);
const asText = (value: unknown) => (typeof value === 'string' ? value : '');

export function readRegisterDraft(): RegisterDraft | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(REGISTER_DRAFT_KEY) ?? 'null') as Partial<RegisterDraft> | null;
    if (!raw || typeof raw !== 'object' || typeof raw.version !== 'number') return null;
    const account = (raw.account ?? {}) as Partial<AccountDraft>;
    return {
      version: raw.version,
      step: asIndex(raw.step),
      maxStep: asIndex(raw.maxStep),
      skillIndex: asIndex(raw.skillIndex),
      answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
      account: { email: asText(account.email), fullName: asText(account.fullName), phone: asText(account.phone) },
    };
  } catch {
    return null;
  }
}

export function writeRegisterDraft(draft: RegisterDraft) {
  try { sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage unavailable: keep working in memory */ }
}

export function clearRegisterDraft() {
  try { sessionStorage.removeItem(REGISTER_DRAFT_KEY); } catch { /* ignore */ }
}
