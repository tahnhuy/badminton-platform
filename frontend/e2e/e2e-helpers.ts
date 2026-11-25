import { randomUUID } from 'node:crypto';
import type { BrowserContext, Locator, Page } from '@playwright/test';

/**
 * Base URL of the real E2E backend. Defaults to the documented port; the isolated
 * run harness (separate ports) sets E2E_API_ORIGIN so the same specs can run without
 * touching a developer server bound to 3000.
 */
export const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'http://localhost:3000';

const api = (path: string) => `${API_ORIGIN}/api/v1${path}`;

export interface CreateUserPayload {
  email?: string;
  password?: string;
  role?: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  mustChangePassword?: boolean;
}

export interface CreatedUser {
  id: string;
  email: string;
  plainPassword: string;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  mustChangePassword: boolean;
}

export async function resetDatabase(): Promise<void> {
  const res = await fetch(api('/test/reset'), {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset test database: ${res.statusText}`);
  }
}

/** Restore registry defaults for system configs (they intentionally survive /test/reset). */
export async function resetSystemConfigs(): Promise<void> {
  const res = await fetch(api('/test/reset-configs'), { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to reset system configs: ${res.statusText}`);
}

export async function createE2EUser(payload: CreateUserPayload = {}): Promise<CreatedUser> {
  const res = await fetch(api('/test/create-user'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create test user: ${errorText}`);
  }

  return res.json();
}

export interface SeededCourt {
  facilityId: number;
  courtId: number;
  ownerId: number;
  ownerEmail: string;
  ownerPassword: string;
}

export async function seedCourt(): Promise<SeededCourt> {
  const res = await fetch(api('/test/seed-court'), {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to seed court fixture: ${res.statusText}`);
  }
  return res.json();
}

/** Pick an option in the shared Radix Select: open the trigger, then click the option by its caller value. */
export async function chooseSelectOption(control: Locator, value: string): Promise<void> {
  await control.click();
  await control.page().locator(`[role="option"][data-value="${value}"]`).click();
}

export interface RegisterPlayerPayload {
  email: string;
  password?: string;
  fullName?: string;
  phone?: string;
  skillSurvey: { version: number; answers: Record<string, unknown> };
}

/** Test-only helper: starts registration, reads the fake-adapter OTP and verifies it. */
export async function registerPlayer(
  request: import('@playwright/test').APIRequestContext,
  payload: RegisterPlayerPayload
) {
  const pending = await request.post('/api/v1/auth/register', {
    data: {
      password: 'ValidPassword123!',
      fullName: 'E2E Player',
      withdrawalPin: '284691',
      withdrawalPinConfirm: '284691',
      ...payload,
    },
  });
  if (pending.status() !== 202) {
    throw new Error(`Registration start failed: ${pending.status()} ${await pending.text()}`);
  }
  const { data } = await pending.json();
  const otpResponse = await request.get(
    `/api/v1/test/latest-otp?email=${encodeURIComponent(payload.email.toLowerCase())}&template=REGISTER_OTP`
  );
  if (!otpResponse.ok()) {
    throw new Error(`No OTP for ${payload.email}: ${otpResponse.status()} ${await otpResponse.text()}`);
  }
  const { otp } = await otpResponse.json();
  return request.post('/api/v1/auth/register/verify', {
    data: { challengeId: data.challengeId, otp },
  });
}

// ---------------------------------------------------------------------------------------------
// Shared real-backend helpers for the demo specs. Absolute URLs keep them working no matter
// which baseURL a context was created with; cookies/CSRF still flow through the context.
// ---------------------------------------------------------------------------------------------

async function csrfToken(context: BrowserContext): Promise<string> {
  return (await context.cookies()).find((cookie) => cookie.name === 'csrf_token')?.value ?? '';
}

export async function apiRequest<T = any>(
  context: BrowserContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken(context);
  const response = await context.request.fetch(api(path), {
    method,
    headers,
    ...(body === undefined ? {} : { data: body }),
  });
  if (!response.ok()) {
    throw new Error(`${method} ${path} -> ${response.status()} ${await response.text()}`);
  }
  if (response.status() === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Raw variant for negative assertions (expected 4xx/409). */
export async function apiRaw(
  context: BrowserContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
) {
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = await csrfToken(context);
  return context.request.fetch(api(path), {
    method,
    headers,
    ...(body === undefined ? {} : { data: body }),
  });
}

/** UI login with the real sign-in form. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
}

/** API login that also installs the session/CSRF cookies into the browser context. */
export async function loginApi(context: BrowserContext, email: string, password: string): Promise<void> {
  const response = await context.request.post(api('/auth/login'), { data: { email, password } });
  if (!response.ok()) throw new Error(`Login failed for ${email}: ${response.status()} ${await response.text()}`);
}

const DEFAULT_SURVEY = {
  version: 1,
  answers: {
    yearsPlaying: '2Y_TO_4Y',
    frequencyPerWeek: 'TWO_TO_THREE',
    coaching: 'SELF_TAUGHT',
    returningAfterBreak: false,
    'skill.service': 2,
    'skill.clear': 2,
    'skill.smash': 2,
    'skill.netPlay': 2,
    'skill.defense': 2,
    'skill.drive': 2,
    'skill.backhand': 1,
    'skill.footwork': 1,
    'skill.doublesPlay': 2,
    rallyConsistency: '15_TO_19',
    stamina: 'THREE_GAMES',
    tournamentAchievement: 'INTERNAL',
  },
};

export interface RegisteredAccount {
  id: number;
  email: string;
  fullName: string;
  password: string;
}

/**
 * Register a real Player (creates the users + player_profiles + wallet rows) and leave the
 * given browser context authenticated. Required for messaging/social, which need a profile.
 */
export async function registerAccount(
  context: BrowserContext,
  payload: { email: string; fullName?: string; password?: string; phone?: string; survey?: RegisterPlayerPayload['skillSurvey'] }
): Promise<RegisteredAccount> {
  const password = payload.password ?? 'ValidPassword123!';
  const fullName = payload.fullName ?? 'E2E Player';
  const start = await context.request.post(api('/auth/register'), {
    data: {
      email: payload.email,
      password,
      fullName,
      phone: payload.phone,
      withdrawalPin: '284691',
      withdrawalPinConfirm: '284691',
      skillSurvey: payload.survey ?? DEFAULT_SURVEY,
    },
  });
  if (start.status() !== 202) throw new Error(`Register start failed: ${start.status()} ${await start.text()}`);
  const { data } = await start.json();
  const otpResponse = await context.request.get(
    api(`/test/latest-otp?email=${encodeURIComponent(payload.email.toLowerCase())}&template=REGISTER_OTP`)
  );
  if (!otpResponse.ok()) throw new Error(`No OTP for ${payload.email}: ${await otpResponse.text()}`);
  const { otp } = await otpResponse.json();
  const verify = await context.request.post(api('/auth/register/verify'), {
    data: { challengeId: data.challengeId, otp },
  });
  if (verify.status() !== 201) throw new Error(`Register verify failed: ${verify.status()} ${await verify.text()}`);
  const body = await verify.json();
  return { id: body.data.id as number, email: payload.email, fullName, password };
}

/** Top up the logged-in context's wallet through the deterministic Mock provider. */
export async function topUpWallet(context: BrowserContext, amount = 500_000): Promise<void> {
  const created = await apiRequest<{ data: { topUpId: number } }>(context, 'POST', '/wallet/top-ups', {
    amount: String(amount),
    provider: 'MOCK',
  });
  await apiRequest(context, 'POST', `/wallet/top-ups/${created.data.topUpId}/mock-confirm`);
}

export async function walletBalance(context: BrowserContext): Promise<number> {
  const wallet = await apiRequest<{ data: { available: string } }>(context, 'GET', '/wallet');
  return Number(wallet.data.available);
}

export async function runJobs(context: BrowserContext): Promise<any> {
  const result = await apiRequest(context, 'POST', '/test/run-jobs');
  return result;
}

export async function skillLevels(context: BrowserContext): Promise<Array<{ id: number; code: string; name: string; rank: number }>> {
  const response = await apiRequest<{ data: Array<{ id: number; code: string; name: string; rank: number }> }>(
    context,
    'GET',
    '/skill-levels'
  );
  return response.data;
}

export interface CreateMatchPostOptions {
  matchType: 'SINGLES' | 'DOUBLES' | 'GROUP';
  startAt: string;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  capacity?: number;
  minPlayers?: number;
  durationMinutes?: number;
  body?: string;
  publish?: boolean;
  court?: { kind: 'EXTERNAL'; name: string; city: string; district: string; address: string };
}

/** Create (and by default publish) a real MATCH_FINDING post; returns its recruitment request id. */
export async function createMatchPost(
  context: BrowserContext,
  options: CreateMatchPostOptions
): Promise<{ requestId: number; postId: number }> {
  const recruitment: Record<string, unknown> = {
    matchType: options.matchType,
    startAt: options.startAt,
    minSkillLevelId: options.minSkillLevelId,
    maxSkillLevelId: options.maxSkillLevelId,
  };
  if (options.matchType === 'GROUP') {
    recruitment.capacity = options.capacity ?? 4;
    recruitment.minPlayers = options.minPlayers ?? 3;
    recruitment.durationMinutes = options.durationMinutes ?? 90;
  }
  if (options.court) recruitment.court = options.court;

  const post = await apiRequest<any>(context, 'POST', '/posts', {
    type: 'MATCH_FINDING',
    body: options.body ?? 'Kèo E2E thật',
    clientRequestId: randomUUID(),
    recruitment,
  });
  const requestId = Number(post.data.recruitment?.requestId);
  if (!requestId) throw new Error(`No requestId in post response: ${JSON.stringify(post.data)}`);
  if (options.publish !== false) {
    await apiRequest(context, 'POST', `/matchmaking-requests/${requestId}/publish`);
  }
  return { requestId, postId: Number(post.data.id) };
}

/** YYYY-MM-DD in Asia/Ho_Chi_Minh, `daysFromNow` days from today. */
export function vnDate(daysFromNow = 0): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(
    new Date(Date.now() + daysFromNow * 86_400_000)
  );
}

/** ISO instant for a VN wall-clock time on `daysFromNow`. */
export function vnIso(daysFromNow: number, time = '10:00'): string {
  return new Date(`${vnDate(daysFromNow)}T${time}:00+07:00`).toISOString();
}

// ---------------------------------------------------------------------------------------------
// Matchmaking lifecycle helpers (real API). Keys/decisions mirror the backend contract.
// ---------------------------------------------------------------------------------------------

export async function applyToRequest(context: BrowserContext, requestId: number): Promise<number> {
  const response = await apiRequest<{ data: { id: number } }>(
    context,
    'POST',
    `/matchmaking-requests/${requestId}/applications`,
    {}
  );
  return response.data.id;
}

export async function decideApplication(
  context: BrowserContext,
  applicationId: number,
  decision: 'ACCEPTED' | 'DECLINED'
): Promise<void> {
  await apiRequest(context, 'PUT', `/matchmaking-applications/${applicationId}`, { decision });
}

export async function invitePlayer(context: BrowserContext, requestId: number, inviteeId: number): Promise<number> {
  const response = await apiRequest<{ data: { id: number } }>(
    context,
    'POST',
    `/matchmaking-requests/${requestId}/invitations`,
    { inviteeId }
  );
  return response.data.id;
}

export async function respondInvitation(
  context: BrowserContext,
  invitationId: number,
  decision: 'ACCEPTED' | 'DECLINED'
): Promise<void> {
  await apiRequest(context, 'PUT', `/matchmaking-invitations/${invitationId}`, { decision });
}

export async function closeRequest(context: BrowserContext, requestId: number): Promise<number> {
  const response = await apiRequest<{ data: { matchId: number } }>(
    context,
    'POST',
    `/matchmaking-requests/${requestId}/close`
  );
  return response.data.matchId;
}

export async function createRequestChat(context: BrowserContext, requestId: number): Promise<number> {
  const response = await apiRequest<{ data: { conversationId: number } }>(
    context,
    'POST',
    `/matchmaking-requests/${requestId}/chat`
  );
  return response.data.conversationId;
}

export async function sendChatMessage(context: BrowserContext, conversationId: number, text: string): Promise<void> {
  await apiRequest(context, 'POST', `/conversations/${conversationId}/messages`, {
    text,
    clientMessageId: randomUUID(),
  });
}

export async function conversationMessages(
  context: BrowserContext,
  conversationId: number
): Promise<Array<{ body: string | null; text?: string | null }>> {
  const response = await apiRequest<{ data: Array<{ body: string | null; text?: string | null }> }>(
    context,
    'GET',
    `/conversations/${conversationId}/messages?limit=50`
  );
  return response.data;
}

export async function notificationTypes(context: BrowserContext): Promise<string[]> {
  const response = await apiRequest<{ data: Array<{ type: string }> }>(context, 'GET', '/notifications?limit=50');
  return response.data.map((row) => row.type);
}
