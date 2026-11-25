import { db } from '../../db';
import { and, eq } from 'drizzle-orm';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentConfig } from '../../shared/config/tournament-config';
import type { TransactionContext } from '../../contracts/TransactionContext';
import {
  tournamentRepository, type SkillLevelRef, type TournamentRow, type NewTournamentRow,
} from '../../repositories/tournaments/TournamentRepository';
import type {
  CreateTournamentInput, ListTournamentsQuery, MyTournamentsQuery, UpdateTournamentInput,
} from '../../validation/tournaments';
import {
  checkEligibility, lockedFields, ORGANIZER_CANCELLABLE, TERMINAL_STATUSES, validateTournamentFields,
  type IneligibleReason, type TournamentFields, type TournamentStatus,
} from './rules';
import { tournamentFeeService } from './TournamentFeeService';
import { tournamentTeamService } from './TournamentTeamService';
import { confirmedPlayers, notifyTournament } from './TournamentNotifications';
import { tournamentChatService } from './TournamentChatService';
import { tournamentShareService } from './TournamentShareService';
import { tournamentRankingService } from './TournamentRankingService';
import { skillRatingService } from './SkillRatingService';
import { conversationMembers } from '../../db/schema/messaging';

/** Tournament Tech Design §2.1, §3.1, §6, §8 (TRN-02). */

export interface TournamentViewer {
  id: number;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
}

export interface TournamentView {
  id: number;
  name: string;
  description: string | null;
  format: string;
  matchType: 'SINGLES' | 'DOUBLES';
  competitionType: string;
  status: TournamentStatus;
  participantLimit: number;
  confirmedCount: number;
  slotsLeft: number;
  entryFee: number;
  minSkillLevel: SkillLevelRef | null;
  maxSkillLevel: SkillLevelRef | null;
  venueNote: string | null;
  registrationStart: string;
  registrationEnd: string;
  tournamentStart: string;
  tournamentEnd: string;
  schedule: { courtCount: number; matchDurationMinutes: number; minRestMinutes: number; dailyStartTime: string; dailyEndTime: string };
  organizer: { id: number; fullName: string; avatarUrl: string | null } | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
}

export interface TournamentDetailView extends TournamentView {
  conversationId: number | null;
  viewer: {
    isOrganizer: boolean;
    registrationId: number | null;
    eligible: boolean;
    ineligibleReason: IneligibleReason | 'ORGANIZER' | 'NOT_PLAYER' | 'NOT_SIGNED_IN' | null;
    /** Organizer or top-4 Player of a COMPLETED tournament who has not shared yet (TRN-16). */
    canShare: boolean;
    sharedPostId: number | null;
  };
}

const AUTO_CANCEL_REASON = 'Không đủ người tham gia khi đóng đăng ký';

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the Organizer can manage this tournament'),
  invalidState: (status: string) => new AppError('TOURNAMENT_INVALID_STATE', 409, `Action not allowed while the tournament is ${status}`),
  versionConflict: () => new AppError('TOURNAMENT_VERSION_CONFLICT', 409, 'The tournament was changed by someone else; reload and try again'),
  disabled: () => new AppError('TOURNAMENT_DISABLED', 409, 'Tournaments are temporarily unavailable'),
};

const hhmm = (value: string) => value.slice(0, 5);
const iso = (value: Date | null) => (value ? value.toISOString() : null);

function toFields(row: TournamentRow): TournamentFields {
  return {
    name: row.name,
    description: row.description,
    matchType: row.matchType as 'SINGLES' | 'DOUBLES',
    participantLimit: row.participantLimit,
    entryFee: Number(row.entryFee),
    minSkillLevelId: row.minSkillLevelId,
    maxSkillLevelId: row.maxSkillLevelId,
    venueNote: row.venueNote,
    registrationStart: row.registrationStart,
    registrationEnd: row.registrationEnd,
    tournamentStart: row.tournamentStart,
    tournamentEnd: row.tournamentEnd,
    courtCount: row.courtCount,
    matchDurationMinutes: row.matchDurationMinutes,
    minRestMinutes: row.minRestMinutes,
    dailyStartTime: hhmm(row.dailyStartTime),
    dailyEndTime: hhmm(row.dailyEndTime),
  };
}

function toColumns(fields: Partial<TournamentFields>): Partial<NewTournamentRow> {
  const { entryFee, ...rest } = fields;
  return { ...rest, ...(entryFee !== undefined ? { entryFee: String(entryFee) } : {}) };
}

function fieldProblemsError(problems: Array<{ field: string; code: string }>): AppError {
  return new AppError('VALIDATION_FAILED', 400, 'Invalid tournament settings', problems);
}

export class TournamentService {
  private levelCache: SkillLevelRef[] | null = null;

  private async levels(): Promise<SkillLevelRef[]> {
    this.levelCache ??= await tournamentRepository.listSkillLevels();
    return this.levelCache;
  }

  private async assertEnabled(): Promise<void> {
    if (!(await tournamentConfig.get()).enabled) throw err.disabled();
  }

  private isOrganizer(row: TournamentRow, viewer?: TournamentViewer | null): boolean {
    return Boolean(viewer && viewer.role === 'PLAYER' && row.creatorId === viewer.id);
  }

  /** DRAFT is hidden (404) from everyone but its Organizer and Admins (Tech Design §8). */
  private assertVisible(row: TournamentRow | null, viewer?: TournamentViewer | null): TournamentRow {
    if (!row) throw err.notFound();
    if (row.status === 'DRAFT' && !this.isOrganizer(row, viewer) && viewer?.role !== 'ADMIN') throw err.notFound();
    return row;
  }

  private async validate(fields: TournamentFields): Promise<void> {
    const ranks = new Map((await this.levels()).map(level => [level.id, level.rank]));
    const problems = validateTournamentFields(fields, ranks);
    if (problems.length > 0) throw fieldProblemsError(problems);
  }

  private async toView(row: TournamentRow, confirmed?: number, organizer?: TournamentView['organizer']): Promise<TournamentView> {
    const levels = await this.levels();
    const level = (id: number | null) => (id === null ? null : levels.find(l => l.id === id) ?? null);
    const confirmedCount = confirmed ?? await tournamentRepository.countConfirmed(row.id);
    const resolvedOrganizer = organizer !== undefined
      ? organizer
      : (await tournamentRepository.findOrganizers([row.creatorId])).get(row.creatorId) ?? null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      format: row.format,
      matchType: row.matchType as 'SINGLES' | 'DOUBLES',
      competitionType: row.competitionType,
      status: row.status as TournamentStatus,
      participantLimit: row.participantLimit,
      confirmedCount,
      slotsLeft: Math.max(0, row.participantLimit - confirmedCount),
      entryFee: Number(row.entryFee),
      minSkillLevel: level(row.minSkillLevelId),
      maxSkillLevel: level(row.maxSkillLevelId),
      venueNote: row.venueNote,
      registrationStart: row.registrationStart.toISOString(),
      registrationEnd: row.registrationEnd.toISOString(),
      tournamentStart: row.tournamentStart.toISOString(),
      tournamentEnd: row.tournamentEnd.toISOString(),
      schedule: {
        courtCount: row.courtCount,
        matchDurationMinutes: row.matchDurationMinutes,
        minRestMinutes: row.minRestMinutes,
        dailyStartTime: hhmm(row.dailyStartTime),
        dailyEndTime: hhmm(row.dailyEndTime),
      },
      organizer: resolvedOrganizer,
      cancelReason: row.cancelReason,
      cancelledAt: iso(row.cancelledAt),
      completedAt: iso(row.completedAt),
      version: row.version,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Runs `work` on the locked tournament after checking existence, Organizer rights and
   * the optimistic version (Tech Design §2.1, §9).
   */
  private async withOrganizerLock<T>(
    actor: TournamentViewer, id: number, version: number,
    work: (row: TournamentRow, tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async tx => {
      const row = this.assertVisible(await tournamentRepository.findById(id, tx, { lock: true }), actor);
      if (!this.isOrganizer(row, actor)) throw err.forbidden();
      if (row.version !== version) throw err.versionConflict();
      return work(row, tx);
    });
  }

  // ------------------------------------------------------------------ commands

  async create(actor: TournamentViewer, input: CreateTournamentInput): Promise<TournamentView> {
    await this.assertEnabled();
    const config = await tournamentConfig.get();
    const fields: TournamentFields = {
      name: input.name,
      description: input.description ?? null,
      matchType: input.matchType,
      participantLimit: input.participantLimit ?? config.defaultParticipantLimit,
      entryFee: input.entryFee,
      minSkillLevelId: input.minSkillLevelId ?? null,
      maxSkillLevelId: input.maxSkillLevelId ?? null,
      venueNote: input.venueNote ?? null,
      registrationStart: input.registrationStart,
      registrationEnd: input.registrationEnd,
      tournamentStart: input.tournamentStart,
      tournamentEnd: input.tournamentEnd,
      courtCount: input.courtCount ?? 2,
      matchDurationMinutes: input.matchDurationMinutes ?? 45,
      minRestMinutes: input.minRestMinutes ?? 15,
      dailyStartTime: input.dailyStartTime ?? '08:00',
      dailyEndTime: input.dailyEndTime ?? '21:00',
    };
    await this.validate(fields);
    const row = await tournamentRepository.insert({
      ...toColumns(fields),
      creatorId: actor.id,
      format: 'SINGLE_ELIMINATION',
      competitionType: 'PROFESSIONAL',
      status: 'DRAFT',
    } as NewTournamentRow);
    return this.toView(row, 0);
  }

  async update(actor: TournamentViewer, id: number, input: UpdateTournamentInput): Promise<TournamentView> {
    await this.assertEnabled();
    await this.levels(); // load outside the transaction: no second pool connection while the row is locked
    const { version, ...patch } = input;
    const row = await this.withOrganizerLock(actor, id, version, async (current, tx) => {
      const status = current.status as TournamentStatus;
      const confirmedCount = await tournamentRepository.countConfirmed(id, tx);
      const currentFields = toFields(current);
      const locked = lockedFields(status, currentFields, patch, { confirmedCount, now: new Date() });
      if (locked.length > 0) {
        throw new AppError('TOURNAMENT_FIELD_LOCKED', 409, 'Some fields cannot be changed in the current state',
          locked.map(field => ({ field, code: 'TOURNAMENT_FIELD_LOCKED' })));
      }
      const merged: TournamentFields = { ...currentFields, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
      await this.validate(merged);
      return tournamentRepository.update(id, toColumns(patch as Partial<TournamentFields>), tx);
    });
    return this.toView(row);
  }

  async open(actor: TournamentViewer, id: number, version: number): Promise<TournamentView> {
    await this.assertEnabled();
    const row = await this.withOrganizerLock(actor, id, version, async (current, tx) => {
      if (current.status !== 'DRAFT') throw err.invalidState(current.status);
      const problems: Array<{ field: string; code: string }> = [];
      if (!current.venueNote?.trim()) problems.push({ field: 'venueNote', code: 'VENUE_REQUIRED' });
      if (current.registrationEnd.getTime() <= Date.now()) problems.push({ field: 'registrationEnd', code: 'REGISTRATION_END_IN_PAST' });
      if (problems.length > 0) throw fieldProblemsError(problems);
      return tournamentRepository.update(id, { status: 'OPEN_FOR_REGISTRATION' }, tx);
    });
    return this.toView(row);
  }

  /**
   * Closes registration (manual, or the tournament job at `registration_end`). With fewer
   * than 2 confirmed registrations the tournament is cancelled instead (matrix §5.3).
   */
  async closeInTransaction(row: TournamentRow, tx: TransactionContext, closedBy: number | null): Promise<TournamentRow> {
    if (row.status !== 'OPEN_FOR_REGISTRATION') throw err.invalidState(row.status);
    const confirmed = await tournamentRepository.countConfirmed(row.id, tx);
    if (confirmed < 2) return this.cancelInTransaction(row, tx, closedBy, AUTO_CANCEL_REASON);
    await tournamentTeamService.cancelPendingInvitations(row.id, tx);
    await notifyTournament(tx, [{
      recipients: await confirmedPlayers(row.id, tx), type: 'TOURNAMENT_REGISTRATION_CLOSED', tournamentId: row.id, key: 'closed',
      title: 'Giải đã đóng đăng ký', content: `${row.name} đã đóng đăng ký. Nhánh đấu và lịch thi đấu sẽ có sau khi bốc thăm.`,
    }]);
    return tournamentRepository.update(row.id, { status: 'REGISTRATION_CLOSED' }, tx);
  }

  async close(actor: TournamentViewer, id: number, version: number): Promise<TournamentView> {
    await this.assertEnabled();
    const row = await this.withOrganizerLock(actor, id, version, (current, tx) => this.closeInTransaction(current, tx, actor.id));
    // After commit: a Messaging failure never blocks closing; the job retries (Tech Design §7.8).
    if (row.status === 'REGISTRATION_CLOSED') await tournamentChatService.ensureChat(row.id);
    return this.toView(row);
  }

  /** Shared cancellation path (Organizer, Admin, automatic): 100% refunds (Tech Design §5). */
  async cancelInTransaction(row: TournamentRow, tx: TransactionContext, cancelledBy: number | null, reason: string | null): Promise<TournamentRow> {
    if (TERMINAL_STATUSES.includes(row.status as TournamentStatus)) throw err.invalidState(row.status);
    await tournamentFeeService.refundAll(row.id, 'giải bị huỷ', tx);
    await tournamentTeamService.cancelPendingInvitations(row.id, tx);
    await tournamentChatService.lock(row.id, tx);
    const fee = Number(row.entryFee);
    await notifyTournament(tx, [{
      recipients: await confirmedPlayers(row.id, tx), type: 'TOURNAMENT_CANCELLED', tournamentId: row.id, key: 'cancelled',
      title: 'Giải đấu đã bị huỷ',
      content: `${row.name} đã bị huỷ${reason ? `: ${reason}` : ''}.${fee > 0 ? ' Lệ phí đã được hoàn 100% về ví của bạn.' : ''}`,
    }]);
    return tournamentRepository.update(row.id, {
      status: 'CANCELLED', cancelReason: reason, cancelledBy, cancelledAt: new Date(),
    }, tx);
  }

  async cancel(actor: TournamentViewer, id: number, version: number, reason?: string): Promise<TournamentView> {
    const row = await this.withOrganizerLock(actor, id, version, async (current, tx) => {
      if (!ORGANIZER_CANCELLABLE.includes(current.status as TournamentStatus)) throw err.invalidState(current.status);
      return this.cancelInTransaction(current, tx, actor.id, reason ?? null);
    });
    return this.toView(row);
  }

  /** Completes an `IN_PROGRESS` tournament whose final has a winner (Tech Design §2.1). */
  async completeInTransaction(row: TournamentRow, tx: TransactionContext, completedBy: number | null): Promise<TournamentRow> {
    if (row.status !== 'IN_PROGRESS') throw err.invalidState(row.status);
    const final = await tournamentRepository.findFinalMatch(row.id, tx);
    const finished = final && final.winnerRegistrationId !== null && ['WINNER_DECLARED', 'RETIRED', 'WALKOVER'].includes(final.resolution);
    if (!finished) throw new AppError('TOURNAMENT_NOT_FINISHED', 409, 'The final has no result yet');
    await tournamentFeeService.creditOrganizer(row, tx);
    await notifyTournament(tx, [{
      recipients: await confirmedPlayers(row.id, tx), type: 'TOURNAMENT_COMPLETED', tournamentId: row.id, key: 'completed',
      title: 'Giải đấu đã kết thúc', content: `${row.name} đã kết thúc. Xem kết quả và nhánh đấu cuối cùng.`,
    }]);
    const completed = await tournamentRepository.update(row.id, { status: 'COMPLETED', completedAt: new Date(), completedBy }, tx);
    // Ranking first: its field strength uses the levels before this tournament's review (TRN-18).
    await tournamentRankingService.writeForTournament(completed, tx, 'completion');
    await skillRatingService.replayInTransaction(tx, { reason: 'TOURNAMENT_RESULT', tournamentId: completed.id });
    return completed;
  }

  async complete(actor: TournamentViewer, id: number, version: number): Promise<TournamentView> {
    const row = await this.withOrganizerLock(actor, id, version, (current, tx) => this.completeInTransaction(current, tx, actor.id));
    return this.toView(row);
  }

  // ------------------------------------------------------------------ reads

  async detail(viewer: TournamentViewer | null, id: number): Promise<TournamentDetailView> {
    const row = this.assertVisible(await tournamentRepository.findById(id), viewer);
    const view = await this.toView(row);
    const isOrganizer = this.isOrganizer(row, viewer);
    let registrationId: number | null = null;
    let ineligibleReason: TournamentDetailView['viewer']['ineligibleReason'] = null;
    if (!viewer) ineligibleReason = 'NOT_SIGNED_IN';
    else if (viewer.role !== 'PLAYER') ineligibleReason = 'NOT_PLAYER';
    else if (isOrganizer) ineligibleReason = 'ORGANIZER';
    else {
      registrationId = (await tournamentRepository.findViewerRegistration(id, viewer.id))?.id ?? null;
      const rank = await tournamentRepository.findPlayerRank(viewer.id);
      ineligibleReason = rank === null ? 'NOT_PLAYER' : checkEligibility({
        minRank: view.minSkillLevel?.rank ?? null, maxRank: view.maxSkillLevel?.rank ?? null,
      }, rank);
    }
    const share = viewer?.role === 'PLAYER'
      ? await tournamentShareService.viewerShare(row.id, row.status, row.creatorId, viewer.id)
      : { canShare: false, sharedPostId: null };
    // The group chat link is given to its active members only (Tech Design §3.4b).
    let conversationId: number | null = null;
    if (viewer?.role === 'PLAYER' && row.conversationId !== null) {
      const [member] = await db.select({ userId: conversationMembers.userId }).from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, row.conversationId), eq(conversationMembers.userId, viewer.id), eq(conversationMembers.state, 'ACTIVE'))).limit(1);
      if (member) conversationId = row.conversationId;
    }
    return { ...view, conversationId, viewer: { isOrganizer, registrationId, eligible: ineligibleReason === null, ineligibleReason, ...share } };
  }

  private async page(rows: TournamentRow[], total: number, page: number, limit: number) {
    const counts = await tournamentRepository.confirmedCounts(rows.map(row => row.id));
    const organizers = await tournamentRepository.findOrganizers(rows.map(row => row.creatorId));
    const items = await Promise.all(rows.map(row => this.toView(row, counts.get(row.id) ?? 0, organizers.get(row.creatorId) ?? null)));
    return { items, meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 } };
  }

  async list(viewer: TournamentViewer | null, query: ListTournamentsQuery) {
    let eligibleRank: number | undefined;
    if (query.eligibleForMe && viewer?.role === 'PLAYER') eligibleRank = (await tournamentRepository.findPlayerRank(viewer.id)) ?? undefined;
    const { rows, total } = await tournamentRepository.list({
      statuses: query.status ? [query.status] : undefined,
      matchType: query.matchType,
      free: query.free,
      eligibleRank,
      from: query.from,
      to: query.to,
      q: query.q,
      page: query.page,
      limit: query.limit,
    });
    return this.page(rows, total, query.page, query.limit);
  }

  async mine(actor: TournamentViewer, query: MyTournamentsQuery) {
    const filter = query.role === 'organized'
      ? { creatorId: actor.id }
      : { ids: query.role === 'registered' ? tournamentRepository.registeredByCondition(actor.id) : tournamentRepository.invitedCondition(actor.id) };
    const { rows, total } = await tournamentRepository.list({ ...filter, page: query.page, limit: query.limit });
    return this.page(rows, total, query.page, query.limit);
  }
}

export const tournamentService = new TournamentService();
