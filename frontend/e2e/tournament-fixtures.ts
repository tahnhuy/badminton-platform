import type { Page, Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

/** Stateful fake of `/api/v1/tournaments/7/**` for the TRN-07/08 UI contract tests. */
export const LEVELS = [
  { id: 1, code: 'WEAK', name: 'Yếu', rank: 5 },
  { id: 2, code: 'AVERAGE', name: 'Trung bình', rank: 4 },
  { id: 3, code: 'GOOD', name: 'Khá', rank: 2 },
];
const player = (id: number, fullName: string) => ({ id, fullName, avatarUrl: null });
export const PLAYERS = { a: player(11, 'An Nguyễn'), b: player(12, 'Bình Trần'), c: player(13, 'Cường Lê'), d: player(14, 'Dũng Phạm') };
const slot = (registrationId: number | null, p: { id: number; fullName: string; avatarUrl: null } | null, seedNo: number | null = null) =>
  ({ registrationId, seedNo, teamName: null, players: p ? [p] : [], fromBye: false });

export function tournament(overrides: Record<string, unknown> = {}) {
  return {
    id: 7, name: 'Giải đơn mùa đông 2026', description: 'Thể lệ: loại trực tiếp.', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES',
    competitionType: 'PROFESSIONAL', status: 'OPEN_FOR_REGISTRATION', participantLimit: 8, confirmedCount: 4, slotsLeft: 4, entryFee: 100000,
    minSkillLevel: LEVELS[0], maxSkillLevel: LEVELS[2], venueNote: 'Nhà thi đấu Phú Thọ',
    registrationStart: '2026-11-20T01:00:00.000Z', registrationEnd: '2026-12-01T15:00:00.000Z',
    tournamentStart: '2026-12-05T01:00:00.000Z', tournamentEnd: '2026-12-05T14:00:00.000Z',
    schedule: { courtCount: 2, matchDurationMinutes: 45, minRestMinutes: 15, dailyStartTime: '08:00', dailyEndTime: '21:00' },
    organizer: { id: 99, fullName: 'Ban tổ chức SmashPro', avatarUrl: null }, cancelReason: null, cancelledAt: null, completedAt: null,
    version: 3, createdAt: '2026-11-19T01:00:00.000Z',
    viewer: { isOrganizer: false, registrationId: null, eligible: true, ineligibleReason: null },
    ...overrides,
  };
}

/** 4-player bracket: semi 1 finished (An beat Dũng), semi 2 live (Bình vs Cường), final waiting. */
export function bracket(finalDone = false) {
  const semi1 = {
    id: 101, roundIndex: 0, matchIndex: 0, slot1: slot(1, PLAYERS.a, 1), slot2: slot(4, PLAYERS.d), winnerRegistrationId: 1, resolution: 'WINNER_DECLARED',
    status: 'COMPLETED', scheduledAt: '2026-12-05T01:00:00.000Z', courtLabel: 'Sân 1', startedAt: '2026-12-05T01:00:00.000Z', completedAt: '2026-12-05T01:40:00.000Z',
    sets: [{ setNo: 1, team1Score: 21, team2Score: 15 }, { setNo: 2, team1Score: 21, team2Score: 18 }], nextMatchId: 103,
  };
  const semi2 = {
    id: 102, roundIndex: 0, matchIndex: 1, slot1: slot(2, PLAYERS.b, 2), slot2: slot(3, PLAYERS.c), winnerRegistrationId: finalDone ? 2 : null,
    resolution: finalDone ? 'WINNER_DECLARED' : 'UNRESOLVED', status: finalDone ? 'COMPLETED' : 'IN_PROGRESS', scheduledAt: '2026-12-05T01:00:00.000Z', courtLabel: 'Sân 2',
    startedAt: '2026-12-05T01:02:00.000Z', completedAt: null, sets: finalDone ? [{ setNo: 1, team1Score: 21, team2Score: 10 }, { setNo: 2, team1Score: 21, team2Score: 12 }] : [], nextMatchId: 103,
  };
  const final = {
    id: 103, roundIndex: 1, matchIndex: 0, slot1: slot(1, PLAYERS.a, 1), slot2: finalDone ? slot(2, PLAYERS.b, 2) : slot(null, null),
    winnerRegistrationId: finalDone ? 1 : null, resolution: finalDone ? 'WINNER_DECLARED' : 'UNRESOLVED', status: finalDone ? 'COMPLETED' : 'CONFIRMED',
    scheduledAt: '2026-12-05T02:00:00.000Z', courtLabel: 'Sân 1', startedAt: null, completedAt: null,
    sets: finalDone ? [{ setNo: 1, team1Score: 21, team2Score: 19 }, { setNo: 2, team1Score: 18, team2Score: 21 }, { setNo: 3, team1Score: 21, team2Score: 17 }] : [], nextMatchId: null,
  };
  return { generated: true, totalRounds: 2, drawSeed: 42, rounds: [{ roundIndex: 0, matches: [semi1, semi2] }, { roundIndex: 1, matches: [final] }] };
}

export function scheduleOf(b: ReturnType<typeof bracket>) {
  const matches = b.rounds.flatMap(r => r.matches).map(x => ({
    id: x.id, roundIndex: x.roundIndex, matchIndex: x.matchIndex, registration1Id: x.slot1.registrationId, registration2Id: x.slot2.registrationId,
    winnerRegistrationId: x.winnerRegistrationId, status: x.status, resolution: x.resolution, courtLabel: x.courtLabel, scheduledAt: x.scheduledAt,
    estimatedEndAt: new Date(new Date(x.scheduledAt).getTime() + 45 * 60_000).toISOString(),
  }));
  return { matchDurationMinutes: 45, courtCount: 2, matches, warnings: [] as unknown[] };
}

export const participants = () => [PLAYERS.a, PLAYERS.b, PLAYERS.c, PLAYERS.d].map((p, i) => ({
  registrationId: i + 1, seedNo: i < 2 ? i + 1 : null, registeredAt: '2026-11-21T03:00:00.000Z', teamName: null,
  players: [{ ...p, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4 } }],
}));

export interface Calls { method: string; path: string; body: unknown }
type Handler = (route: Route) => Promise<void> | void;

/** Opens the app with the fake tournament API; `state.detail` / `state.bracket` may be changed by handlers. */
export async function mockTournamentApi(page: Page, options: {
  detail?: ReturnType<typeof tournament>; finalDone?: boolean; available?: string; list?: unknown[]; extra?: Record<string, Handler>;
  /** Signed-in account; `null` = visitor. Defaults to a Player. */
  user?: ReturnType<typeof account> | null;
} = {}) {
  const state = { detail: options.detail ?? tournament(), bracket: bracket(options.finalDone), calls: [] as Calls[] };
  const record = (route: Route) => {
    const req = route.request();
    let body: unknown = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    state.calls.push({ method: req.method(), path: new URL(req.url()).pathname, body });
  };
  const json = (route: Route, data: unknown) => route.fulfill({ json: { data } });
  const base = '/api/v1/tournaments/7';
  const handlers: Record<string, Handler> = {
    '/api/v1/skill-levels': route => json(route, LEVELS),
    '/api/v1/wallet': route => json(route, { balance: options.available ?? '500000.00', held: '0.00', available: options.available ?? '500000.00' }),
    '/api/v1/tournaments': route => {
      record(route);
      if (route.request().method() === 'POST') return json(route, { ...tournament({ id: 9, status: 'DRAFT' }) });
      const data = options.list ?? [tournament(), tournament({ id: 8, name: 'Giải giao hữu cuối tuần', entryFee: 0, status: 'IN_PROGRESS', slotsLeft: 0, confirmedCount: 8 })];
      return route.fulfill({ json: { data, meta: { page: 1, limit: 12, total: data.length, totalPages: 1 } } });
    },
    [base]: route => { record(route); return json(route, state.detail); },
    [`${base}/registrations`]: route => {
      record(route);
      if (route.request().method() === 'POST') {
        state.detail = { ...state.detail, confirmedCount: state.detail.confirmedCount + 1, slotsLeft: state.detail.slotsLeft - 1, viewer: { ...state.detail.viewer, registrationId: 55 } };
        return json(route, { id: 55, tournamentId: 7, registrationType: 'SINGLES', status: 'CONFIRMED', paidAmount: 100000, registeredAt: '2026-11-25T03:00:00.000Z', refundedAt: null });
      }
      return json(route, participants());
    },
    [`${base}/bracket`]: route => json(route, state.bracket),
    [`${base}/schedule`]: route => json(route, scheduleOf(state.bracket)),
    [`${base}/matches/102/result`]: route => {
      record(route);
      state.bracket = bracket(true);
      return json(route, state.bracket);
    },
    [`${base}/matches/103/schedule`]: route => {
      record(route);
      const item = scheduleOf(state.bracket).matches[2];
      return json(route, { match: item, warnings: [] });
    },
    [`${base}/complete`]: route => {
      record(route);
      state.detail = { ...state.detail, status: 'COMPLETED', completedAt: new Date().toISOString(), version: state.detail.version + 1 };
      return json(route, state.detail);
    },
    ...options.extra,
  };
  await mockAuthApi(page, { user: options.user === undefined ? account() : options.user, handlers });
  return state;
}
