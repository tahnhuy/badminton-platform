import type { Page, Route } from '@playwright/test';
import { SURVEY_V1 } from './register-ui-fixtures';

/** Intercepted-API helpers for UI contract tests (no backend or database). `handlers` overrides any path. */
export type Role = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
export const account = (role: Role = 'PLAYER', requiresPasswordChange = false) =>
  ({ id: 1, email: 'player@example.com', role, requiresPasswordChange });
export type Account = ReturnType<typeof account>;

export interface MockState {
  user: Account | null; calls: number; meCalls: number; refreshCalls: number;
  changeCalls: number; changeBodies: unknown[]; logoutCalls: number;
}
type Handler = (route: Route, state: MockState) => Promise<void> | void;

export const errorBody = (code: string, details: unknown[] = []) =>
  ({ error: { code, message: 'Internal message must not be displayed', details } });
const meta = { page: 1, limit: 20, total: 0, totalPages: 1 };
const profile = { userId: 1, fullName: 'D01 Player', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null };

export async function mockAuthApi(page: Page, options: { user?: Account | null; login?: Handler; changePassword?: Handler; meDelayMs?: number; handlers?: Record<string, Handler> } = {}) {
  const state: MockState = { user: options.user ?? null, calls: 0, meCalls: 0, refreshCalls: 0, changeCalls: 0, changeBodies: [], logoutCalls: 0 };
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.routeWebSocket('**/api/v1/ws/messaging', ws => ws.close());
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const custom = options.handlers?.[path];
    if (custom) return custom(route, state);
    if (path === '/api/v1/auth/me') {
      state.meCalls++;
      if (state.calls > 0) state.refreshCalls++;
      if (options.meDelayMs) await new Promise(resolve => setTimeout(resolve, options.meDelayMs));
      return state.user ? route.fulfill({ json: { data: state.user } }) : route.fulfill({ status: 401, json: errorBody('AUTH_SESSION_INVALID') });
    }
    if (path === '/api/v1/auth/login') {
      state.calls++;
      if (options.login) return options.login(route, state);
      state.user = account(); return route.fulfill({ json: { data: state.user } });
    }
    if (path === '/api/v1/auth/password/change/request') {
      return route.fulfill({ json: { data: { challengeId: 'change-challenge', expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString() } } });
    }
    if (path === '/api/v1/auth/password/change/verify') {
      return route.fulfill({ json: { data: { resetToken: 'change-reset-token', expiresAt: new Date(Date.now() + 600_000).toISOString() } } });
    }
    if (path === '/api/v1/auth/password/change/resend') {
      return route.fulfill({ json: { data: { challengeId: 'change-challenge', expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString() } } });
    }
    if (path === '/api/v1/auth/password/change') {
      state.changeCalls++; state.changeBodies.push(route.request().postDataJSON());
      if (options.changePassword) return options.changePassword(route, state);
      state.user = state.user && { ...state.user, requiresPasswordChange: false };
      return route.fulfill({ json: { data: state.user } });
    }
    if (path === '/api/v1/auth/logout') { state.logoutCalls++; state.user = null; return route.fulfill({ status: 204 }); }
    if (path === '/api/v1/players/me/skill-rating') return route.fulfill({ json: { data: {
      rating: 55, tentative: true, ratedMatchCount: 0,
      level: { id: 4, name: 'Trung bình', rank: 4 }, band: { min: 45, max: 60 },
      next: { name: 'Trung bình khá', threshold: 63, remaining: 8 },
      previous: { name: 'Trung bình yếu', threshold: 42 }, events: [], changes: [],
    } } });
    if (path === '/api/v1/players/me') return route.fulfill({ json: { data: profile } });
    if (path === '/api/v1/conversations/unread-summary') return route.fulfill({ json: { data: { totalUnread: 0 } } });
    if (path === '/api/v1/admin/facilities/handovers' || path === '/api/v1/owner/facility-handovers') return route.fulfill({ json: { data: { data: [], hasMore: false } } });
    if (path === '/api/v1/admin/users') return route.fulfill({ json: { data: [], pagination: meta, stats: { total: 0, active: 0, suspended: 0, deactivated: 0 } } });
    if (path === '/api/v1/auth/skill-survey') return route.fulfill({ json: { data: SURVEY_V1 } });
    if (path === '/api/v1/skill-levels') return route.fulfill({ json: { data: [profile.skillLevel] } });
    return route.fulfill({ json: { data: [], meta } });
  });
  return state;
}
