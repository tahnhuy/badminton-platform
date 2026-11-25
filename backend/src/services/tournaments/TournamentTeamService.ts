import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users, playerProfiles, skillLevels } from '../../db/schema/users';
import { userBlocks } from '../../db/schema/messaging';
import { teamInvitations, tournamentRegistrations, tournamentTeamPlayers, tournamentTeams } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentConfig } from '../../shared/config/tournament-config';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import { checkEligibility, type IneligibleReason } from './rules';
import { tournamentFeeService } from './TournamentFeeService';
import type { RegistrationView } from './TournamentRegistrationService';
import type { TournamentViewer } from './TournamentService';

/**
 * Doubles teams, invitations, invite links and team registration
 * (PRD FR-20…23, Tech Design §2.3, §3.2, §4.2, matrix §4.7–§4.8; TRN-09).
 * Lock order everywhere: tournament row → team row → invitation row.
 */

type TeamRow = typeof tournamentTeams.$inferSelect;
type InvitationRow = typeof teamInvitations.$inferSelect;

export interface TeamMemberView { id: number; fullName: string; avatarUrl: string | null; role: 'CAPTAIN' | 'MEMBER'; skillLevel: { name: string; rank: number } | null }
export interface InvitationView {
  id: number; status: string; expiresAt: string; createdAt: string;
  team: { id: number; name: string; tournamentId: number };
  inviter: { id: number; fullName: string; avatarUrl: string | null };
  invitee: { id: number; fullName: string; avatarUrl: string | null };
}
export interface TeamView {
  id: number; tournamentId: number; name: string; status: string; captainId: number;
  members: TeamMemberView[]; pendingInvitation: InvitationView | null; hasInviteLink: boolean; registrationId: number | null;
}
export interface MyTeamView { team: TeamView | null; invitations: InvitationView[] }
export interface JoinPreview {
  tournament: { id: number; name: string; status: string; entryFee: number; tournamentStart: string };
  team: { id: number; name: string; status: string; captain: { id: number; fullName: string; avatarUrl: string | null } };
  canJoin: boolean;
  reason: 'TEAM_FULL' | 'REGISTRATION_CLOSED' | 'ALREADY_IN_TEAM' | 'ORGANIZER' | 'OWN_TEAM' | 'BLOCKED' | 'NOT_PLAYER' | IneligibleReason | null;
}
export interface InvitablePlayer { id: number; fullName: string; avatarUrl: string | null; skillLevel: { name: string; rank: number } }

const teamErr = (code: string, message: string, status = 409) => new AppError(code, status, message);
const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  teamNotFound: () => new NotFoundError('Team not found', 'TOURNAMENT_TEAM_NOT_FOUND'),
  invitationNotFound: () => new NotFoundError('Invitation not found', 'TOURNAMENT_TEAM_INVITATION_NOT_FOUND'),
  inviteInvalid: () => new NotFoundError('Invite link is invalid or no longer usable', 'TOURNAMENT_TEAM_INVITE_INVALID'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the team captain can do this'),
  closed: () => new AppError('TOURNAMENT_REGISTRATION_CLOSED', 409, 'Registration is not open'),
  notDoubles: () => teamErr('TOURNAMENT_TEAM_NOT_ALLOWED', 'Teams exist only in Doubles tournaments'),
  organizer: () => new AppError('TOURNAMENT_ORGANIZER_CANNOT_PLAY', 409, 'The Organizer cannot play in their own tournament'),
  alreadyInTeam: () => teamErr('TOURNAMENT_TEAM_ALREADY_IN_TEAM', 'The player already belongs to a team of this tournament'),
  teamFull: () => teamErr('TOURNAMENT_TEAM_FULL', 'The team already has two members'),
  teamNotFull: () => teamErr('TOURNAMENT_TEAM_NOT_FULL', 'A team needs two members to register'),
  teamLocked: () => teamErr('TOURNAMENT_TEAM_LOCKED', 'Membership is locked after the team registered'),
  invitationPending: () => teamErr('TOURNAMENT_TEAM_INVITATION_PENDING', 'The team already has a pending invitation'),
  invitationState: () => teamErr('TOURNAMENT_TEAM_INVITATION_NOT_PENDING', 'The invitation is no longer pending'),
  inviteeInvalid: () => teamErr('TOURNAMENT_TEAM_INVITEE_INVALID', 'This player cannot be invited'),
  duplicate: () => new AppError('TOURNAMENT_ALREADY_REGISTERED', 409, 'The team is already registered'),
  full: () => new AppError('TOURNAMENT_FULL', 409, 'The tournament has no slots left'),
  disabled: () => new AppError('TOURNAMENT_DISABLED', 409, 'Tournaments are temporarily unavailable'),
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const constraintOf = (error: unknown) => {
  const pg = error as { constraint?: string; cause?: { constraint?: string } };
  return pg.constraint ?? pg.cause?.constraint;
};
/** Unique-index races map to the same domain errors as the explicit checks. */
function mapConstraint(error: unknown): never {
  const constraint = constraintOf(error);
  if (constraint === 'uq_tournament_team_player_tournament_active') throw err.alreadyInTeam();
  if (constraint === 'uq_tournament_team_player_active') throw err.alreadyInTeam();
  if (constraint === 'uq_team_invitations_pending_team') throw err.invitationPending();
  if (constraint === 'uq_tournament_doubles_team') throw err.duplicate();
  throw error;
}

export class TournamentTeamService {
  // ------------------------------------------------------------------ helpers

  private isWindowOpen(t: TournamentRow): boolean {
    const now = Date.now();
    return t.status === 'OPEN_FOR_REGISTRATION' && now >= t.registrationStart.getTime() && now < t.registrationEnd.getTime();
  }

  private async lockTournament(id: number, viewer: TournamentViewer, tx: TransactionContext): Promise<TournamentRow> {
    const row = await tournamentRepository.findById(id, tx, { lock: true });
    if (!row || (row.status === 'DRAFT' && row.creatorId !== viewer.id)) throw err.notFound();
    return row;
  }

  private assertTeamWindow(t: TournamentRow): void {
    if (t.matchType !== 'DOUBLES') throw err.notDoubles();
    if (!this.isWindowOpen(t)) throw err.closed();
  }

  private async lockTeam(teamId: number, tournamentId: number, tx: TransactionContext): Promise<TeamRow> {
    const [team] = await tx.select().from(tournamentTeams)
      .where(and(eq(tournamentTeams.id, teamId), eq(tournamentTeams.tournamentId, tournamentId))).limit(1).for('update');
    if (!team || team.status === 'DISBANDED') throw err.teamNotFound();
    return team;
  }

  private async activeMembers(teamId: number, tx: TransactionContext) {
    return tx.select().from(tournamentTeamPlayers)
      .where(and(eq(tournamentTeamPlayers.teamId, teamId), isNull(tournamentTeamPlayers.leftAt)))
      .orderBy(asc(tournamentTeamPlayers.joinedAt), asc(tournamentTeamPlayers.id));
  }

  private async isInTeam(tournamentId: number, playerId: number, tx: TransactionContext): Promise<boolean> {
    const [row] = await tx.select({ id: tournamentTeamPlayers.id }).from(tournamentTeamPlayers)
      .where(and(eq(tournamentTeamPlayers.tournamentId, tournamentId), eq(tournamentTeamPlayers.playerId, playerId), isNull(tournamentTeamPlayers.leftAt)))
      .limit(1);
    return Boolean(row);
  }

  private async isBlocked(a: number, b: number, tx: TransactionContext): Promise<boolean> {
    const [row] = await tx.select({ blockerId: userBlocks.blockerId }).from(userBlocks)
      .where(sql`(${userBlocks.blockerId} = ${a} AND ${userBlocks.blockedId} = ${b}) OR (${userBlocks.blockerId} = ${b} AND ${userBlocks.blockedId} = ${a})`)
      .limit(1);
    return Boolean(row);
  }

  /** Active PLAYER with a skill level inside the range, or the reason why not. */
  private async eligibility(t: TournamentRow, playerId: number, tx: TransactionContext): Promise<IneligibleReason | 'NOT_PLAYER' | 'ORGANIZER' | null> {
    if (t.creatorId === playerId) return 'ORGANIZER';
    const [user] = await tx.select({ role: users.role, status: users.status }).from(users).where(eq(users.id, playerId)).limit(1);
    if (!user || user.role !== 'PLAYER' || user.status !== 'ACTIVE') return 'NOT_PLAYER';
    const rank = await tournamentRepository.findPlayerRank(playerId, tx);
    if (rank === null) return 'NOT_PLAYER';
    const levels = await tournamentRepository.listSkillLevels(tx);
    const rankOf = (levelId: number | null) => (levelId === null ? null : levels.find(l => l.id === levelId)?.rank ?? null);
    return checkEligibility({ minRank: rankOf(t.minSkillLevelId), maxRank: rankOf(t.maxSkillLevelId) }, rank);
  }

  private async assertEligible(t: TournamentRow, playerId: number, tx: TransactionContext): Promise<void> {
    const reason = await this.eligibility(t, playerId, tx);
    if (reason === 'ORGANIZER') throw err.organizer();
    if (reason === 'NOT_PLAYER') throw new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only active Players can join');
    if (reason) throw new AppError('TOURNAMENT_NOT_ELIGIBLE', 403, 'Skill level outside the tournament range', [{ field: 'skillLevel', code: reason, playerId }]);
  }

  /** Adds a member; the partial unique indexes stop concurrent joins (Tech Design §4.2). */
  private async addMember(team: TeamRow, playerId: number, tx: TransactionContext): Promise<void> {
    const members = await this.activeMembers(team.id, tx);
    if (members.length >= 2 || team.status !== 'FORMING') throw err.teamFull();
    if (await this.isInTeam(team.tournamentId, playerId, tx)) throw err.alreadyInTeam();
    const now = new Date();
    await tx.insert(tournamentTeamPlayers).values({ teamId: team.id, tournamentId: team.tournamentId, playerId, role: 'MEMBER', joinedAt: now });
    await tx.update(tournamentTeams).set({ status: 'FULL', updatedAt: now }).where(eq(tournamentTeams.id, team.id));
    // The new member cannot accept other invitations of this tournament any more.
    await tx.update(teamInvitations).set({ status: 'CANCELLED', respondedAt: now, updatedAt: now })
      .where(and(eq(teamInvitations.status, 'PENDING'), sql`(${teamInvitations.teamId} = ${team.id} OR (${teamInvitations.inviteeId} = ${playerId}
        AND ${teamInvitations.teamId} IN (SELECT id FROM tournament_teams WHERE tournament_id = ${team.tournamentId})))`));
  }

  private async disband(team: TeamRow, tx: TransactionContext): Promise<void> {
    const now = new Date();
    await tx.update(tournamentTeams).set({ status: 'DISBANDED', inviteTokenHash: null, updatedAt: now }).where(eq(tournamentTeams.id, team.id));
    await tx.update(tournamentTeamPlayers).set({ leftAt: now, updatedAt: now })
      .where(and(eq(tournamentTeamPlayers.teamId, team.id), isNull(tournamentTeamPlayers.leftAt)));
    await tx.update(teamInvitations).set({ status: 'CANCELLED', respondedAt: now, updatedAt: now })
      .where(and(eq(teamInvitations.teamId, team.id), eq(teamInvitations.status, 'PENDING')));
  }

  private async profiles(ids: number[], executor: TransactionContext | typeof db = db) {
    if (ids.length === 0) return new Map<number, { id: number; fullName: string; avatarUrl: string | null; levelName: string | null; rank: number | null }>();
    const rows = await executor.select({ id: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl, levelName: skillLevels.name, rank: skillLevels.rank })
      .from(playerProfiles).leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(inArray(playerProfiles.userId, [...new Set(ids)]));
    return new Map(rows.map(r => [r.id, r]));
  }

  private async invitationViews(rows: InvitationRow[], executor: TransactionContext | typeof db = db): Promise<InvitationView[]> {
    if (rows.length === 0) return [];
    const teams = await executor.select().from(tournamentTeams).where(inArray(tournamentTeams.id, [...new Set(rows.map(r => r.teamId))]));
    const people = await this.profiles(rows.flatMap(r => [r.inviterId, r.inviteeId]), executor);
    const person = (id: number) => ({ id, fullName: people.get(id)?.fullName ?? 'Người chơi', avatarUrl: people.get(id)?.avatarUrl ?? null });
    return rows.map(r => {
      const team = teams.find(x => x.id === r.teamId)!;
      return {
        id: r.id, status: r.status, expiresAt: r.expiresAt.toISOString(), createdAt: r.createdAt.toISOString(),
        team: { id: team.id, name: team.name, tournamentId: team.tournamentId }, inviter: person(r.inviterId), invitee: person(r.inviteeId),
      };
    });
  }

  private async teamView(team: TeamRow, executor: TransactionContext | typeof db = db): Promise<TeamView> {
    const members = await executor.select().from(tournamentTeamPlayers)
      .where(and(eq(tournamentTeamPlayers.teamId, team.id), isNull(tournamentTeamPlayers.leftAt)))
      .orderBy(asc(tournamentTeamPlayers.joinedAt), asc(tournamentTeamPlayers.id));
    const people = await this.profiles(members.map(m => m.playerId), executor);
    const [pending] = await executor.select().from(teamInvitations)
      .where(and(eq(teamInvitations.teamId, team.id), eq(teamInvitations.status, 'PENDING'))).limit(1);
    const [registration] = await executor.select({ id: tournamentRegistrations.id }).from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.teamId, team.id), eq(tournamentRegistrations.status, 'CONFIRMED'))).limit(1);
    return {
      id: team.id, tournamentId: team.tournamentId, name: team.name, status: team.status, captainId: team.captainId,
      members: members.sort((a, b) => (a.role === 'CAPTAIN' ? -1 : b.role === 'CAPTAIN' ? 1 : 0)).map(m => {
        const p = people.get(m.playerId);
        return { id: m.playerId, fullName: p?.fullName ?? 'Người chơi', avatarUrl: p?.avatarUrl ?? null, role: m.role as 'CAPTAIN' | 'MEMBER', skillLevel: p?.levelName ? { name: p.levelName, rank: p.rank! } : null };
      }),
      pendingInvitation: pending ? (await this.invitationViews([pending], executor))[0] : null,
      hasInviteLink: team.inviteTokenHash !== null,
      registrationId: registration?.id ?? null,
    };
  }

  private async assertEnabled(): Promise<void> {
    if (!(await tournamentConfig.get()).enabled) throw err.disabled();
  }

  // ------------------------------------------------------------------ teams

  /** POST /:id/teams — the creator becomes captain (matrix §4.7). */
  async create(actor: TournamentViewer, tournamentId: number, name: string): Promise<TeamView> {
    await this.assertEnabled();
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      this.assertTeamWindow(t);
      await this.assertEligible(t, actor.id, tx);
      if (await this.isInTeam(t.id, actor.id, tx)) throw err.alreadyInTeam();
      const now = new Date();
      const [team] = await tx.insert(tournamentTeams).values({ tournamentId: t.id, name, captainId: actor.id, status: 'FORMING' }).returning();
      await tx.insert(tournamentTeamPlayers).values({ teamId: team.id, tournamentId: t.id, playerId: actor.id, role: 'CAPTAIN', joinedAt: now });
      // Creating a team ends the creator's own pending invitations of this tournament.
      await tx.update(teamInvitations).set({ status: 'CANCELLED', respondedAt: now, updatedAt: now })
        .where(and(eq(teamInvitations.inviteeId, actor.id), eq(teamInvitations.status, 'PENDING'),
          sql`${teamInvitations.teamId} IN (SELECT id FROM tournament_teams WHERE tournament_id = ${t.id})`));
      return this.teamView(team, tx);
    }).catch(mapConstraint);
  }

  /** GET /:id/teams/mine — own active team and invitations received for this tournament. */
  async mine(actor: TournamentViewer, tournamentId: number): Promise<MyTeamView> {
    const t = await tournamentRepository.findById(tournamentId);
    if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
    const [membership] = await db.select({ teamId: tournamentTeamPlayers.teamId }).from(tournamentTeamPlayers)
      .where(and(eq(tournamentTeamPlayers.tournamentId, t.id), eq(tournamentTeamPlayers.playerId, actor.id), isNull(tournamentTeamPlayers.leftAt))).limit(1);
    const [team] = membership ? await db.select().from(tournamentTeams).where(eq(tournamentTeams.id, membership.teamId)).limit(1) : [];
    const received = await db.select().from(teamInvitations)
      .where(and(eq(teamInvitations.inviteeId, actor.id), eq(teamInvitations.status, 'PENDING'),
        sql`${teamInvitations.expiresAt} > now()`,
        sql`${teamInvitations.teamId} IN (SELECT id FROM tournament_teams WHERE tournament_id = ${t.id})`))
      .orderBy(asc(teamInvitations.createdAt));
    return { team: team ? await this.teamView(team) : null, invitations: await this.invitationViews(received) };
  }

  /** POST /:id/teams/:teamId/leave — a member leaves; the captain leaving disbands the team (Tech Design §4.2). */
  async leave(actor: TournamentViewer, tournamentId: number, teamId: number): Promise<{ disbanded: boolean }> {
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      const team = await this.lockTeam(teamId, t.id, tx);
      if (team.status === 'REGISTERED') throw err.teamLocked();
      const members = await this.activeMembers(team.id, tx);
      const me = members.find(m => m.playerId === actor.id);
      if (!me) throw err.teamNotFound();
      if (me.role === 'CAPTAIN') {
        await this.disband(team, tx);
        return { disbanded: true };
      }
      const now = new Date();
      await tx.update(tournamentTeamPlayers).set({ leftAt: now, updatedAt: now }).where(eq(tournamentTeamPlayers.id, me.id));
      await tx.update(tournamentTeams).set({ status: 'FORMING', updatedAt: now }).where(eq(tournamentTeams.id, team.id));
      return { disbanded: false };
    });
  }

  /** DELETE /:id/teams/:teamId/members/:playerId — the captain removes the partner while forming. */
  async removeMember(actor: TournamentViewer, tournamentId: number, teamId: number, playerId: number): Promise<TeamView> {
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      const team = await this.lockTeam(teamId, t.id, tx);
      if (team.captainId !== actor.id) throw err.forbidden();
      if (team.status === 'REGISTERED') throw err.teamLocked();
      const member = (await this.activeMembers(team.id, tx)).find(m => m.playerId === playerId && m.role === 'MEMBER');
      if (!member) throw err.teamNotFound();
      const now = new Date();
      await tx.update(tournamentTeamPlayers).set({ leftAt: now, updatedAt: now }).where(eq(tournamentTeamPlayers.id, member.id));
      const [updated] = await tx.update(tournamentTeams).set({ status: 'FORMING', updatedAt: now }).where(eq(tournamentTeams.id, team.id)).returning();
      return this.teamView(updated, tx);
    });
  }

  // ------------------------------------------------------------------ invitations

  /** POST /:id/teams/:teamId/invitations — one pending invitation per team (Tech Design §4.2). */
  async invite(actor: TournamentViewer, tournamentId: number, teamId: number, inviteeId: number): Promise<InvitationView> {
    await this.assertEnabled();
    const timeout = (await tournamentConfig.get()).teamInvitationTimeoutMinutes;
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      this.assertTeamWindow(t);
      const team = await this.lockTeam(teamId, t.id, tx);
      if (team.captainId !== actor.id) throw err.forbidden();
      if (team.status !== 'FORMING') throw err.teamFull();
      if (inviteeId === actor.id) throw err.inviteeInvalid();
      const [pending] = await tx.select({ id: teamInvitations.id }).from(teamInvitations)
        .where(and(eq(teamInvitations.teamId, team.id), eq(teamInvitations.status, 'PENDING'))).limit(1);
      if (pending) throw err.invitationPending();
      if (await this.eligibility(t, inviteeId, tx)) throw err.inviteeInvalid();
      if (await this.isInTeam(t.id, inviteeId, tx)) throw err.alreadyInTeam();
      if (await this.isBlocked(actor.id, inviteeId, tx)) throw err.inviteeInvalid();
      const [row] = await tx.insert(teamInvitations).values({
        teamId: team.id, inviterId: actor.id, inviteeId, status: 'PENDING', expiresAt: new Date(Date.now() + timeout * 60_000),
      }).returning();
      return (await this.invitationViews([row], tx))[0];
    }).catch(mapConstraint);
  }

  private async lockInvitation(invitationId: number, actor: TournamentViewer, tx: TransactionContext) {
    const [found] = await tx.select({ teamId: teamInvitations.teamId, tournamentId: tournamentTeams.tournamentId })
      .from(teamInvitations).innerJoin(tournamentTeams, eq(tournamentTeams.id, teamInvitations.teamId))
      .where(eq(teamInvitations.id, invitationId)).limit(1);
    if (!found) throw err.invitationNotFound();
    const t = await this.lockTournament(found.tournamentId, actor, tx);
    const [team] = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.id, found.teamId)).limit(1).for('update');
    const [invitation] = await tx.select().from(teamInvitations).where(eq(teamInvitations.id, invitationId)).limit(1).for('update');
    return { t, team, invitation };
  }

  private async respond(invitation: InvitationRow, status: string, tx: TransactionContext): Promise<InvitationView> {
    const now = new Date();
    const [row] = await tx.update(teamInvitations).set({ status, respondedAt: now, updatedAt: now }).where(eq(teamInvitations.id, invitation.id)).returning();
    return (await this.invitationViews([row], tx))[0];
  }

  /** POST /invitations/:id/accept — the invitee joins the team. */
  async accept(actor: TournamentViewer, invitationId: number): Promise<TeamView> {
    await this.assertEnabled();
    return db.transaction(async tx => {
      const { t, team, invitation } = await this.lockInvitation(invitationId, actor, tx);
      if (invitation.inviteeId !== actor.id) throw err.invitationNotFound();
      if (invitation.status !== 'PENDING' || invitation.expiresAt.getTime() <= Date.now()) throw err.invitationState();
      this.assertTeamWindow(t);
      if (team.status === 'DISBANDED') throw err.invitationState();
      await this.assertEligible(t, actor.id, tx);
      await this.respond(invitation, 'ACCEPTED', tx);
      await this.addMember(team, actor.id, tx);
      const [updated] = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.id, team.id));
      return this.teamView(updated, tx);
    }).catch(mapConstraint);
  }

  /** POST /invitations/:id/decline (invitee) or /cancel (captain). */
  async close(actor: TournamentViewer, invitationId: number, action: 'decline' | 'cancel'): Promise<InvitationView> {
    return db.transaction(async tx => {
      const { invitation } = await this.lockInvitation(invitationId, actor, tx);
      const allowed = action === 'decline' ? invitation.inviteeId === actor.id : invitation.inviterId === actor.id;
      if (!allowed) throw err.invitationNotFound();
      if (invitation.status !== 'PENDING') throw err.invitationState();
      return this.respond(invitation, action === 'decline' ? 'DECLINED' : 'CANCELLED', tx);
    });
  }

  /**
   * GET /:id/invitable-players?q= — name search for the captain (≥ 2 chars, ≤ 20 results):
   * active eligible Players, not the Organizer, not in a team of this tournament, not blocked either way.
   */
  async invitable(actor: TournamentViewer, tournamentId: number, q: string): Promise<InvitablePlayer[]> {
    const t = await tournamentRepository.findById(tournamentId);
    if (!t || t.status === 'DRAFT') throw err.notFound();
    if (t.matchType !== 'DOUBLES') throw err.notDoubles();
    const levels = await tournamentRepository.listSkillLevels();
    const rankOf = (levelId: number | null) => (levelId === null ? null : levels.find(l => l.id === levelId)?.rank ?? null);
    const minRank = rankOf(t.minSkillLevelId);
    const maxRank = rankOf(t.maxSkillLevelId);
    const pattern = `%${q.trim().replace(/[\\%_]/g, c => '\\' + c)}%`;
    const rows = await db.select({ id: users.id, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl, levelName: skillLevels.name, rank: skillLevels.rank })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .innerJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(and(
        eq(users.role, 'PLAYER'), eq(users.status, 'ACTIVE'),
        ne(users.id, actor.id), ne(users.id, t.creatorId),
        sql`${playerProfiles.fullName} ILIKE ${pattern}`,
        minRank === null ? undefined : sql`${skillLevels.rank} >= ${minRank}`,
        maxRank === null ? undefined : sql`${skillLevels.rank} <= ${maxRank}`,
        sql`NOT EXISTS (SELECT 1 FROM tournament_team_players tp WHERE tp.tournament_id = ${t.id} AND tp.player_id = ${users.id} AND tp.left_at IS NULL)`,
        sql`NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = ${actor.id} AND b.blocked_id = ${users.id}) OR (b.blocker_id = ${users.id} AND b.blocked_id = ${actor.id}))`,
      ))
      .orderBy(asc(playerProfiles.fullName), asc(users.id))
      .limit(20);
    return rows.map(r => ({ id: r.id, fullName: r.fullName, avatarUrl: r.avatarUrl, skillLevel: { name: r.levelName, rank: r.rank } }));
  }

  // ------------------------------------------------------------------ invite link

  /** POST /:id/teams/:teamId/invite-link — creates or regenerates; only sha256(token) is stored. */
  async inviteLink(actor: TournamentViewer, tournamentId: number, teamId: number): Promise<{ token: string; path: string }> {
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      this.assertTeamWindow(t);
      const team = await this.lockTeam(teamId, t.id, tx);
      if (team.captainId !== actor.id) throw err.forbidden();
      if (team.status !== 'FORMING') throw err.teamFull();
      const token = randomBytes(24).toString('base64url');
      await tx.update(tournamentTeams).set({ inviteTokenHash: hashToken(token), updatedAt: new Date() }).where(eq(tournamentTeams.id, team.id));
      return { token, path: `/tournaments/join/${token}` };
    });
  }

  private async findTeamByToken(token: string, executor: TransactionContext | typeof db, lock = false): Promise<TeamRow> {
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw err.inviteInvalid();
    const base = executor.select().from(tournamentTeams).where(eq(tournamentTeams.inviteTokenHash, hashToken(token))).limit(1);
    const [team] = lock ? await base.for('update') : await base;
    if (!team || team.status === 'DISBANDED') throw err.inviteInvalid();
    return team;
  }

  /** GET /teams/join/:token — preview with the reason the viewer cannot join, if any. */
  async joinPreview(actor: TournamentViewer, token: string): Promise<JoinPreview> {
    const team = await this.findTeamByToken(token, db);
    const t = await tournamentRepository.findById(team.tournamentId);
    if (!t || t.status === 'DRAFT') throw err.inviteInvalid();
    const captain = (await this.profiles([team.captainId])).get(team.captainId);
    let reason: JoinPreview['reason'] = null;
    if (team.captainId === actor.id) reason = 'OWN_TEAM';
    else if (team.status !== 'FORMING') reason = 'TEAM_FULL';
    else if (!this.isWindowOpen(t)) reason = 'REGISTRATION_CLOSED';
    else {
      const eligibility = await db.transaction(async tx => ({
        reason: await this.eligibility(t, actor.id, tx),
        inTeam: await this.isInTeam(t.id, actor.id, tx),
        blocked: await this.isBlocked(team.captainId, actor.id, tx),
      }));
      if (eligibility.reason === 'ORGANIZER') reason = 'ORGANIZER';
      else if (eligibility.reason && eligibility.reason !== 'NOT_PLAYER') reason = eligibility.reason;
      else if (eligibility.reason === 'NOT_PLAYER') reason = 'NOT_PLAYER';
      else if (eligibility.inTeam) reason = 'ALREADY_IN_TEAM';
      else if (eligibility.blocked) reason = 'BLOCKED';
    }
    return {
      tournament: { id: t.id, name: t.name, status: t.status, entryFee: Number(t.entryFee), tournamentStart: t.tournamentStart.toISOString() },
      team: { id: team.id, name: team.name, status: team.status, captain: { id: team.captainId, fullName: captain?.fullName ?? 'Người chơi', avatarUrl: captain?.avatarUrl ?? null } },
      canJoin: reason === null,
      reason,
    };
  }

  /** POST /teams/join/:token — same checks as accepting, under the tournament and team locks. */
  async join(actor: TournamentViewer, token: string): Promise<TeamView> {
    await this.assertEnabled();
    return db.transaction(async tx => {
      const found = await this.findTeamByToken(token, tx);
      const t = await this.lockTournament(found.tournamentId, actor, tx);
      const team = await this.findTeamByToken(token, tx, true);
      if (!this.isWindowOpen(t) || t.matchType !== 'DOUBLES') throw err.inviteInvalid();
      if (team.status !== 'FORMING') throw err.inviteInvalid();
      if (team.captainId === actor.id) throw err.alreadyInTeam();
      await this.assertEligible(t, actor.id, tx);
      if (await this.isBlocked(team.captainId, actor.id, tx)) throw err.inviteInvalid();
      await this.addMember(team, actor.id, tx);
      const [updated] = await tx.select().from(tournamentTeams).where(eq(tournamentTeams.id, team.id));
      return this.teamView(updated, tx);
    }).catch(mapConstraint);
  }

  // ------------------------------------------------------------------ registration

  /** POST /:id/registrations `{ teamId }` — the captain registers a full team and pays (PRD FR-22). */
  async register(actor: TournamentViewer, tournamentId: number, teamId: number): Promise<RegistrationView> {
    await this.assertEnabled();
    return db.transaction(async tx => {
      const t = await this.lockTournament(tournamentId, actor, tx);
      if (!this.isWindowOpen(t)) throw err.closed();
      if (t.matchType !== 'DOUBLES') throw err.notDoubles();
      const team = await this.lockTeam(teamId, t.id, tx);
      if (team.captainId !== actor.id) throw err.forbidden();
      if (team.status === 'REGISTERED') throw err.duplicate();
      const members = await this.activeMembers(team.id, tx);
      if (team.status !== 'FULL' || members.length !== 2) throw err.teamNotFull();
      for (const member of members) await this.assertEligible(t, member.playerId, tx);
      if ((await tournamentRepository.countConfirmed(t.id, tx)) >= t.participantLimit) throw err.full();

      const fee = Number(t.entryFee);
      const now = new Date();
      const [row] = await tx.insert(tournamentRegistrations).values({
        tournamentId: t.id, teamId: team.id, registrationType: 'DOUBLES', status: 'CONFIRMED',
        paidAmount: fee.toFixed(2), payerId: actor.id, registeredAt: now,
      }).returning();
      await tournamentFeeService.charge({ registrationId: row.id, tournamentId: t.id, tournamentName: t.name, payerId: actor.id, amount: fee }, tx);
      await tx.update(tournamentTeams).set({ status: 'REGISTERED', inviteTokenHash: null, updatedAt: now }).where(eq(tournamentTeams.id, team.id));
      return {
        id: row.id, tournamentId: row.tournamentId, registrationType: 'DOUBLES' as const, status: row.status,
        paidAmount: Number(row.paidAmount), registeredAt: row.registeredAt.toISOString(), refundedAt: null,
      };
    }).catch(mapConstraint);
  }

  // ------------------------------------------------------------------ lifecycle hooks

  /** Pending invitations end when the tournament stops accepting registrations (matrix §4.8). */
  async cancelPendingInvitations(tournamentId: number, tx: TransactionContext): Promise<number> {
    const now = new Date();
    const rows = await tx.update(teamInvitations).set({ status: 'CANCELLED', respondedAt: now, updatedAt: now })
      .where(and(eq(teamInvitations.status, 'PENDING'), sql`${teamInvitations.teamId} IN (SELECT id FROM tournament_teams WHERE tournament_id = ${tournamentId})`))
      .returning({ id: teamInvitations.id });
    return rows.length;
  }

  /** Expired pending invitations become EXPIRED (tournament job, TRN-10). Returns the expired rows. */
  async expireInvitations(now = new Date(), executor: TransactionContext | typeof db = db): Promise<InvitationRow[]> {
    return executor.update(teamInvitations).set({ status: 'EXPIRED', updatedAt: now })
      .where(and(eq(teamInvitations.status, 'PENDING'), lt(teamInvitations.expiresAt, now)))
      .returning();
  }
}

export const tournamentTeamService = new TournamentTeamService();
