import { httpClient } from '@/shared/api/http-client';
import type {
  Bracket, ListFilters, Page, Participant, Registration, ResultInput, SeedsView, Tournament, TournamentDetail,
  TournamentInput, TournamentScheduleView, Team, MyTeam, TeamInvitation, InvitablePlayer, JoinPreview,
} from './types';

/** `/api/v1/tournaments` (Tournament Tech Design §3). */
const base = '/api/v1/tournaments';
type Envelope<T> = { data: T };
const json = (body: unknown) => ({ body: JSON.stringify(body) });

function query(filters: ListFilters): string {
  const params = new URLSearchParams({ page: String(filters.page), limit: '12' });
  if (filters.status) params.set('status', filters.status);
  if (filters.matchType) params.set('matchType', filters.matchType);
  if (filters.free !== undefined) params.set('free', String(filters.free));
  if (filters.eligibleForMe) params.set('eligibleForMe', 'true');
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  return params.toString();
}

export const tournamentApi = {
  list: (filters: ListFilters) => httpClient<Page<Tournament>>(`${base}?${query(filters)}`),
  mine: (role: 'organized' | 'registered' | 'invited', page = 1) =>
    httpClient<Page<Tournament>>(`${base}/mine?role=${role}&page=${page}&limit=24`),
  detail: async (id: number) => (await httpClient<Envelope<TournamentDetail>>(`${base}/${id}`)).data,
  create: async (input: TournamentInput) => (await httpClient<Envelope<Tournament>>(base, { method: 'POST', ...json(input) })).data,
  update: async (id: number, version: number, changes: Partial<TournamentInput>) =>
    (await httpClient<Envelope<Tournament>>(`${base}/${id}`, { method: 'PATCH', ...json({ version, ...changes }) })).data,
  transition: async (id: number, action: 'open' | 'close' | 'complete', version: number) =>
    (await httpClient<Envelope<Tournament>>(`${base}/${id}/${action}`, { method: 'POST', ...json({ version }) })).data,
  cancel: async (id: number, version: number, reason?: string) =>
    (await httpClient<Envelope<Tournament>>(`${base}/${id}/cancel`, { method: 'POST', ...json({ version, ...(reason ? { reason } : {}) }) })).data,

  participants: async (id: number) => (await httpClient<Envelope<Participant[]>>(`${base}/${id}/registrations`)).data,
  register: async (id: number, teamId?: number) =>
    (await httpClient<Envelope<Registration>>(`${base}/${id}/registrations`, { method: 'POST', ...json(teamId ? { teamId } : {}) })).data,
  withdraw: async (id: number, registrationId: number) =>
    (await httpClient<Envelope<Registration>>(`${base}/${id}/registrations/${registrationId}`, { method: 'DELETE' })).data,
  remove: async (id: number, registrationId: number, reason: string) =>
    (await httpClient<Envelope<Registration>>(`${base}/${id}/registrations/${registrationId}/remove`, { method: 'POST', ...json({ reason }) })).data,

  seeds: async (id: number) => (await httpClient<Envelope<SeedsView>>(`${base}/${id}/seeds`)).data,
  setSeeds: async (id: number, version: number, seeds: Array<{ registrationId: number; seedNo: number }>) =>
    (await httpClient<Envelope<SeedsView>>(`${base}/${id}/seeds`, { method: 'PUT', ...json({ version, seeds }) })).data,
  draw: async (id: number, version: number) =>
    (await httpClient<Envelope<{ status: string; version: number; drawSeed: number }>>(`${base}/${id}/draw`, { method: 'POST', ...json({ version }) })).data,
  bracket: async (id: number) => (await httpClient<Envelope<Bracket>>(`${base}/${id}/bracket`)).data,

  schedule: async (id: number) => (await httpClient<Envelope<TournamentScheduleView>>(`${base}/${id}/schedule`)).data,
  rerunSchedule: async (id: number, version: number) =>
    (await httpClient<Envelope<TournamentScheduleView>>(`${base}/${id}/schedule/auto`, { method: 'POST', ...json({ version }) })).data,
  editMatchSchedule: async (id: number, matchId: number, courtLabel: string, scheduledAt: string) =>
    (await httpClient<Envelope<{ match: TournamentScheduleView['matches'][number]; warnings: TournamentScheduleView['warnings'] }>>(
      `${base}/${id}/matches/${matchId}/schedule`, { method: 'PATCH', ...json({ courtLabel, scheduledAt }) })).data,
  startMatch: async (id: number, matchId: number) =>
    (await httpClient<Envelope<Bracket>>(`${base}/${id}/matches/${matchId}/start`, { method: 'POST', ...json({}) })).data,
  result: async (id: number, matchId: number, input: ResultInput) =>
    (await httpClient<Envelope<Bracket>>(`${base}/${id}/matches/${matchId}/result`, { method: 'PUT', ...json(input) })).data,

  // Doubles teams (TRN-09).
  myTeam: async (id: number) => (await httpClient<Envelope<MyTeam>>(`${base}/${id}/teams/mine`)).data,
  createTeam: async (id: number, name: string) => (await httpClient<Envelope<Team>>(`${base}/${id}/teams`, { method: 'POST', ...json({ name }) })).data,
  invite: async (id: number, teamId: number, inviteeId: number) =>
    (await httpClient<Envelope<TeamInvitation>>(`${base}/${id}/teams/${teamId}/invitations`, { method: 'POST', ...json({ inviteeId }) })).data,
  inviteLink: async (id: number, teamId: number) =>
    (await httpClient<Envelope<{ token: string; path: string }>>(`${base}/${id}/teams/${teamId}/invite-link`, { method: 'POST', ...json({}) })).data,
  leaveTeam: async (id: number, teamId: number) =>
    (await httpClient<Envelope<{ disbanded: boolean }>>(`${base}/${id}/teams/${teamId}/leave`, { method: 'POST', ...json({}) })).data,
  removeMember: async (id: number, teamId: number, playerId: number) =>
    (await httpClient<Envelope<Team>>(`${base}/${id}/teams/${teamId}/members/${playerId}`, { method: 'DELETE' })).data,
  invitable: async (id: number, q: string) =>
    (await httpClient<Envelope<InvitablePlayer[]>>(`${base}/${id}/invitable-players?q=${encodeURIComponent(q)}`)).data,
  respondInvitation: async (invitationId: number, action: 'accept' | 'decline' | 'cancel') =>
    (await httpClient<Envelope<unknown>>(`${base}/invitations/${invitationId}/${action}`, { method: 'POST', ...json({}) })).data,
  joinPreview: async (token: string) => (await httpClient<Envelope<JoinPreview>>(`${base}/teams/join/${encodeURIComponent(token)}`)).data,
  join: async (token: string) => (await httpClient<Envelope<Team>>(`${base}/teams/join/${encodeURIComponent(token)}`, { method: 'POST', ...json({}) })).data,
};
