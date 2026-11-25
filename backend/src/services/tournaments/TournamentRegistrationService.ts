import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { tournamentRegistrations, tournamentTeamPlayers, tournamentTeams } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentConfig } from '../../shared/config/tournament-config';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import { checkEligibility } from './rules';
import { tournamentFeeService } from './TournamentFeeService';
import type { TournamentViewer } from './TournamentService';
import { formatMoney, notifyTournament, playersOfRegistrations } from './TournamentNotifications';
import { tournamentChatService } from './TournamentChatService';

/** Singles registration, withdrawal, Organizer removal, participant list (Tech Design §3.2, §5, TRN-03). */

type RegistrationRow = typeof tournamentRegistrations.$inferSelect;

export interface RegistrationView {
  id: number;
  tournamentId: number;
  registrationType: 'SINGLES' | 'DOUBLES';
  status: string;
  paidAmount: number;
  registeredAt: string;
  refundedAt: string | null;
}

export interface ParticipantView {
  registrationId: number;
  seedNo: number | null;
  registeredAt: string;
  players: Array<{ id: number; fullName: string; avatarUrl: string | null; skillLevel: { code: string; name: string; rank: number } | null }>;
  teamName: string | null;
}

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  registrationNotFound: () => new NotFoundError('Registration not found', 'TOURNAMENT_REGISTRATION_NOT_FOUND'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Not allowed for this registration'),
  closed: () => new AppError('TOURNAMENT_REGISTRATION_CLOSED', 409, 'Registration is not open'),
  invalidState: (status: string) => new AppError('TOURNAMENT_INVALID_STATE', 409, `Action not allowed while the tournament is ${status}`),
  full: () => new AppError('TOURNAMENT_FULL', 409, 'The tournament has no slots left'),
  duplicate: () => new AppError('TOURNAMENT_ALREADY_REGISTERED', 409, 'Already registered for this tournament'),
  organizer: () => new AppError('TOURNAMENT_ORGANIZER_CANNOT_PLAY', 409, 'The Organizer cannot register in their own tournament'),
  teamRequired: () => new AppError('TOURNAMENT_TEAM_REQUIRED', 409, 'Doubles tournaments are entered by a team'),
  disabled: () => new AppError('TOURNAMENT_DISABLED', 409, 'Tournaments are temporarily unavailable'),
};

function toView(row: RegistrationRow): RegistrationView {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    registrationType: row.registrationType as 'SINGLES' | 'DOUBLES',
    status: row.status,
    paidAmount: Number(row.paidAmount),
    registeredAt: row.registeredAt.toISOString(),
    refundedAt: row.refundedAt ? row.refundedAt.toISOString() : null,
  };
}

export class TournamentRegistrationService {
  private async lockVisible(id: number, viewer: TournamentViewer, tx: TransactionContext): Promise<TournamentRow> {
    const row = await tournamentRepository.findById(id, tx, { lock: true });
    if (!row || (row.status === 'DRAFT' && row.creatorId !== viewer.id)) throw err.notFound();
    return row;
  }

  private async findRegistration(tournamentId: number, registrationId: number, tx: TransactionContext): Promise<RegistrationRow> {
    const [row] = await tx.select().from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.id, registrationId), eq(tournamentRegistrations.tournamentId, tournamentId)))
      .limit(1).for('update');
    if (!row) throw err.registrationNotFound();
    return row;
  }

  /** Singles registration with the fee debited in the same transaction (PRD FR-10, FR-11). */
  async registerSingles(actor: TournamentViewer, tournamentId: number): Promise<RegistrationView> {
    if (!(await tournamentConfig.get()).enabled) throw err.disabled();
    return db.transaction(async tx => {
      const t = await this.lockVisible(tournamentId, actor, tx);
      if (!this.isWindowOpen(t)) throw err.closed();
      if (t.creatorId === actor.id) throw err.organizer();
      if (t.matchType !== 'SINGLES') throw err.teamRequired();

      const rank = await tournamentRepository.findPlayerRank(actor.id, tx);
      if (rank === null) throw err.forbidden();
      const levels = await tournamentRepository.listSkillLevels(tx);
      const rankOf = (levelId: number | null) => (levelId === null ? null : levels.find(l => l.id === levelId)?.rank ?? null);
      const bounds = { minRank: rankOf(t.minSkillLevelId), maxRank: rankOf(t.maxSkillLevelId) };
      const reason = checkEligibility(bounds, rank);
      if (reason) {
        throw new AppError('TOURNAMENT_NOT_ELIGIBLE', 403, 'Skill level outside the tournament range', [
          { field: 'skillLevel', code: reason, minRank: bounds.minRank, maxRank: bounds.maxRank, playerRank: rank },
        ]);
      }
      // Every read inside the transaction uses `tx`: a second pool connection while holding the
      // tournament lock can exhaust the pool under load (review finding, TRN-03).
      if (await tournamentRepository.findViewerRegistration(t.id, actor.id, tx)) throw err.duplicate();
      if ((await tournamentRepository.countConfirmed(t.id, tx)) >= t.participantLimit) throw err.full();

      const fee = Number(t.entryFee);
      const [row] = await tx.insert(tournamentRegistrations).values({
        tournamentId: t.id,
        playerId: actor.id,
        registrationType: 'SINGLES',
        status: 'CONFIRMED',
        paidAmount: fee.toFixed(2),
        payerId: actor.id,
        registeredAt: new Date(),
      }).returning();
      await tournamentFeeService.charge({ registrationId: row.id, tournamentId: t.id, tournamentName: t.name, payerId: actor.id, amount: fee }, tx);
      await notifyTournament(tx, [{
        recipients: [actor.id], type: 'TOURNAMENT_REGISTRATION_CONFIRMED', tournamentId: t.id, key: `reg:${row.id}`,
        title: 'Đăng ký giải thành công', content: `Bạn đã đăng ký ${t.name}${fee > 0 ? ` (đã trừ ${formatMoney(fee)} từ ví)` : ''}.`,
      }]);
      return toView(row);
    }).catch(error => {
      // A concurrent duplicate is stopped by uq_tournament_singles_player.
      const pg = error as { constraint?: string; cause?: { constraint?: string } };
      if ((pg.constraint ?? pg.cause?.constraint) === 'uq_tournament_singles_player') throw err.duplicate();
      throw error;
    });
  }

  /** Player (Singles) or captain (Doubles) withdraws while registration is open; 100% refund. */
  async withdraw(actor: TournamentViewer, tournamentId: number, registrationId: number): Promise<RegistrationView> {
    return db.transaction(async tx => {
      const t = await this.lockVisible(tournamentId, actor, tx);
      const reg = await this.findRegistration(t.id, registrationId, tx);
      const isOwner = reg.registrationType === 'SINGLES'
        ? reg.playerId === actor.id
        : (await tx.select({ id: tournamentTeams.id }).from(tournamentTeams)
          .where(and(eq(tournamentTeams.id, reg.teamId!), eq(tournamentTeams.captainId, actor.id))).limit(1)).length > 0;
      if (!isOwner) throw err.forbidden();
      if (reg.status !== 'CONFIRMED') throw err.registrationNotFound();
      // Same window as registering: no withdrawal once `registration_end` passed, even before the job closes it.
      if (t.status !== 'OPEN_FOR_REGISTRATION' || Date.now() >= t.registrationEnd.getTime()) throw err.closed();
      const [updated] = await tx.update(tournamentRegistrations)
        .set({ status: 'CANCELLED', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(tournamentRegistrations.id, reg.id)).returning();
      const players = (await playersOfRegistrations([reg.id], tx)).get(reg.id) ?? [];
      await this.afterLeave(reg, tx);
      await tournamentFeeService.refund(reg, 'rút đăng ký', tx);
      const paid = Number(reg.paidAmount);
      await notifyTournament(tx, [{
        recipients: players.filter(p => p !== actor.id), type: 'TOURNAMENT_REGISTRATION_REFUNDED', tournamentId: t.id, key: `withdrawn:${reg.id}`,
        title: 'Đội đã rút khỏi giải', content: `Đội trưởng đã rút đăng ký của đội khỏi ${t.name}. Bạn có thể lập hoặc vào đội khác.`,
      }, ...(paid > 0 ? [{
        recipients: [reg.payerId ?? actor.id], type: 'TOURNAMENT_REGISTRATION_REFUNDED' as const, tournamentId: t.id, key: `refund-withdraw:${reg.id}`,
        title: 'Đã hoàn lệ phí giải', content: `${formatMoney(paid)} lệ phí ${t.name} đã được hoàn về ví của bạn.`,
      }] : [])]);
      return toView({ ...updated, refundedAt: (await this.reload(reg.id, tx)).refundedAt });
    });
  }

  /** Organizer removes a registration with a reason before the draw; 100% refund (PRD FR-13). */
  async remove(actor: TournamentViewer, tournamentId: number, registrationId: number, reason: string): Promise<RegistrationView> {
    return db.transaction(async tx => {
      const t = await this.lockVisible(tournamentId, actor, tx);
      if (t.creatorId !== actor.id) throw new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the Organizer can remove participants');
      if (t.status !== 'OPEN_FOR_REGISTRATION' && t.status !== 'REGISTRATION_CLOSED') throw err.invalidState(t.status);
      const reg = await this.findRegistration(t.id, registrationId, tx);
      if (reg.status !== 'CONFIRMED') throw err.registrationNotFound();
      const [updated] = await tx.update(tournamentRegistrations)
        .set({ status: 'REMOVED', removedReason: reason, removedBy: actor.id, seedNo: null, updatedAt: new Date() })
        .where(eq(tournamentRegistrations.id, reg.id)).returning();
      const players = (await playersOfRegistrations([reg.id], tx)).get(reg.id) ?? [];
      await this.afterLeave(reg, tx);
      if (reg.seedNo !== null) await this.renumberSeeds(t.id, tx);
      await tournamentChatService.removeMembers(t.id, players, tx);
      await tournamentFeeService.refund(reg, 'bị loại khỏi giải', tx);
      const paid = Number(reg.paidAmount);
      await notifyTournament(tx, [{
        recipients: players, type: 'TOURNAMENT_REGISTRATION_REMOVED', tournamentId: t.id, key: `removed:${reg.id}`,
        title: 'Bạn đã bị loại khỏi giải',
        content: `Organizer đã loại ${reg.teamId ? 'đội của bạn' : 'bạn'} khỏi ${t.name}. Lý do: ${reason}.${paid > 0 ? ` ${formatMoney(paid)} lệ phí đã được hoàn về ví ${reg.teamId ? 'của đội trưởng' : 'của bạn'}.` : ''}`,
      }]);
      return toView({ ...updated, refundedAt: (await this.reload(reg.id, tx)).refundedAt });
    });
  }

  private isWindowOpen(t: TournamentRow): boolean {
    const now = Date.now();
    return t.status === 'OPEN_FOR_REGISTRATION' && now >= t.registrationStart.getTime() && now < t.registrationEnd.getTime();
  }

  private async reload(id: number, tx: TransactionContext): Promise<RegistrationRow> {
    const [row] = await tx.select().from(tournamentRegistrations).where(eq(tournamentRegistrations.id, id));
    return row;
  }

  /** A withdrawn or removed team is disbanded and its members become free (Tech Design §4.2). */
  private async afterLeave(reg: RegistrationRow, tx: TransactionContext): Promise<void> {
    if (reg.teamId === null) return;
    const now = new Date();
    await tx.update(tournamentTeams).set({ status: 'DISBANDED', inviteTokenHash: null, updatedAt: now }).where(eq(tournamentTeams.id, reg.teamId));
    await tx.update(tournamentTeamPlayers).set({ leftAt: now, updatedAt: now })
      .where(and(eq(tournamentTeamPlayers.teamId, reg.teamId), sql`${tournamentTeamPlayers.leftAt} IS NULL`));
  }

  /** Remaining seeds become 1..k in their previous order (Tech Design §2.2). */
  private async renumberSeeds(tournamentId: number, tx: TransactionContext): Promise<void> {
    const seeded = await tx.select({ id: tournamentRegistrations.id }).from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), isNotNull(tournamentRegistrations.seedNo)))
      .orderBy(asc(tournamentRegistrations.seedNo));
    // Two passes avoid transient conflicts on uq_tournament_registration_seed_no.
    for (const [index, row] of seeded.entries()) {
      await tx.update(tournamentRegistrations).set({ seedNo: 1000 + index }).where(eq(tournamentRegistrations.id, row.id));
    }
    for (const [index, row] of seeded.entries()) {
      await tx.update(tournamentRegistrations).set({ seedNo: index + 1 }).where(eq(tournamentRegistrations.id, row.id));
    }
  }

  /** Confirmed participants (public for non-DRAFT tournaments); never contact data. */
  async participants(viewer: TournamentViewer | null, tournamentId: number): Promise<ParticipantView[]> {
    const t = await tournamentRepository.findById(tournamentId);
    if (!t || (t.status === 'DRAFT' && t.creatorId !== viewer?.id && viewer?.role !== 'ADMIN')) throw err.notFound();
    const regs = await db.select().from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.tournamentId, t.id), eq(tournamentRegistrations.status, 'CONFIRMED')))
      .orderBy(sql`${tournamentRegistrations.seedNo} ASC NULLS LAST`, asc(tournamentRegistrations.registeredAt), asc(tournamentRegistrations.id));
    const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
    const members = teamIds.length === 0 ? [] : await db.select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId, role: tournamentTeamPlayers.role })
      .from(tournamentTeamPlayers)
      .where(and(inArray(tournamentTeamPlayers.teamId, teamIds), sql`${tournamentTeamPlayers.leftAt} IS NULL`));
    const teams = teamIds.length === 0 ? [] : await db.select({ id: tournamentTeams.id, name: tournamentTeams.name }).from(tournamentTeams).where(inArray(tournamentTeams.id, teamIds));
    const playerIds = [...regs.map(r => r.playerId).filter((id): id is number => id !== null), ...members.map(m => m.playerId)];
    const profiles = playerIds.length === 0 ? [] : await db.select({
      id: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl,
      code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank,
    }).from(playerProfiles).leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(inArray(playerProfiles.userId, playerIds));
    // A missing profile or level must not break the public list (review finding, TRN-03).
    const profile = (id: number) => {
      const p = profiles.find(x => x.id === id);
      return {
        id,
        fullName: p?.fullName ?? 'Người chơi',
        avatarUrl: p?.avatarUrl ?? null,
        skillLevel: p?.code ? { code: p.code, name: p.name!, rank: p.rank! } : null,
      };
    };
    return regs.map(reg => ({
      registrationId: reg.id,
      seedNo: reg.seedNo,
      registeredAt: reg.registeredAt.toISOString(),
      teamName: reg.teamId === null ? null : teams.find(team => team.id === reg.teamId)?.name ?? null,
      players: reg.playerId !== null
        ? [profile(reg.playerId)]
        : members.filter(m => m.teamId === reg.teamId).sort((a, b) => (a.role === 'CAPTAIN' ? -1 : b.role === 'CAPTAIN' ? 1 : 0)).map(m => profile(m.playerId)),
    }));
  }
}

export const tournamentRegistrationService = new TournamentRegistrationService();
