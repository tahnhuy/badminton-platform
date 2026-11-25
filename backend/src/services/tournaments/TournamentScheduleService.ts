import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { matches } from '../../db/schema/matchmaking';
import { tournamentMatches } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import { generateSchedule, type ScheduleMatchInput } from './schedule/scheduleGenerator';
import { findScheduleConflicts, type ScheduleWarning } from './schedule/conflicts';
import type { TournamentViewer } from './TournamentService';
import { formatVnTime, notifyTournament, playersOfRegistrations, type TournamentNotice } from './TournamentNotifications';

interface Slot { matchId: number; at: Date; court: string | null; reg1: number | null; reg2: number | null; roundIndex: number }

/**
 * Automatic scheduling, manual edits and the public schedule (Tournament Tech Design §3.4,
 * §7.3, §7.4 — TRN-05). Matches never link to platform Courts/Bookings: court labels are
 * free text on the Organizer's virtual courts.
 */

type Executor = typeof db | TransactionContext;
const MINUTE = 60_000;
const ROUND_TO = 5 * MINUTE;

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  matchNotFound: () => new NotFoundError('Match not found', 'TOURNAMENT_MATCH_NOT_FOUND'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the Organizer can change the schedule'),
  invalidState: (status: string) => new AppError('TOURNAMENT_INVALID_STATE', 409, `Action not allowed while the tournament is ${status}`),
  locked: () => new AppError('TOURNAMENT_MATCH_LOCKED', 409, 'A started or finished match cannot be moved'),
  versionConflict: () => new AppError('TOURNAMENT_VERSION_CONFLICT', 409, 'The tournament was changed by someone else; reload and try again'),
};

const SCHEDULABLE: readonly string[] = ['READY', 'IN_PROGRESS'];
const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

interface ScheduleRow {
  id: number;
  matchId: number;
  roundIndex: number;
  matchIndex: number;
  registration1Id: number | null;
  registration2Id: number | null;
  nextMatchId: number | null;
  resolution: string;
  winnerRegistrationId: number | null;
  courtLabel: string | null;
  status: string;
  scheduledAt: Date;
  startedAt: Date | null;
}

export class TournamentScheduleService {
  private async rows(tournamentId: number, executor: Executor): Promise<ScheduleRow[]> {
    return executor.select({
      id: tournamentMatches.id, matchId: tournamentMatches.matchId, roundIndex: tournamentMatches.roundIndex,
      matchIndex: tournamentMatches.matchIndex, registration1Id: tournamentMatches.registration1Id,
      registration2Id: tournamentMatches.registration2Id, nextMatchId: tournamentMatches.nextMatchId,
      resolution: tournamentMatches.resolution, winnerRegistrationId: tournamentMatches.winnerRegistrationId,
      courtLabel: tournamentMatches.courtLabel, status: matches.status, scheduledAt: matches.scheduledAt,
      startedAt: matches.startedAt,
    }).from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(eq(tournamentMatches.tournamentId, tournamentId))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex));
  }

  /** A match is fixed once it started, finished, was cancelled or resolved (walkover). */
  private isFixed(row: ScheduleRow): boolean {
    return row.status !== 'CONFIRMED' || row.resolution !== 'UNRESOLVED';
  }

  private fixedState(row: ScheduleRow): 'playing' | 'played' | 'unplayed' {
    if (row.status === 'IN_PROGRESS') return 'playing';
    if (row.startedAt === null && (row.resolution === 'WALKOVER' || row.resolution === 'NONE')) return 'unplayed';
    return 'played';
  }

  private participants(row: ScheduleRow): number[] {
    return [row.registration1Id, row.registration2Id].filter((x): x is number => x !== null);
  }

  private feeders(rows: ScheduleRow[], id: number): number[] {
    return rows.filter(r => r.nextMatchId === id).map(r => r.id);
  }

  /**
   * Schedules every non-fixed match (draw: from the tournament start; re-run: from now
   * rounded up to 5 minutes, never before the start). Overwrites manual edits of matches
   * that have not started (Tech Design §7.3).
   */
  async autoScheduleInTransaction(t: TournamentRow, tx: TransactionContext, _mode: 'draw' | 'rerun'): Promise<void> {
    const rows = await this.rows(t.id, tx);
    if (rows.length === 0) return;
    // Both modes: never in the past (a late draw), aligned to 5 minutes (review, TRN-05).
    const roundUp = (ms: number) => Math.ceil(ms / ROUND_TO) * ROUND_TO;
    const from = new Date(Math.max(roundUp(Date.now()), roundUp(t.tournamentStart.getTime())));
    const inputs: ScheduleMatchInput[] = rows.map(row => ({
      id: row.id,
      roundIndex: row.roundIndex,
      matchIndex: row.matchIndex,
      feederIds: this.feeders(rows, row.id),
      participants: this.participants(row),
      fixed: this.isFixed(row) ? { courtLabel: row.courtLabel, start: row.scheduledAt, state: this.fixedState(row) } : null,
    }));
    const schedule = generateSchedule(inputs, {
      courtCount: t.courtCount,
      durationMinutes: t.matchDurationMinutes,
      restMinutes: t.minRestMinutes,
      dayStartMinutes: minutesOf(t.dailyStartTime),
      dayEndMinutes: minutesOf(t.dailyEndTime),
      from,
    });
    for (const slot of schedule) {
      if (slot.fixed) continue;
      const row = rows.find(r => r.id === slot.id)!;
      await tx.update(matches).set({ scheduledAt: slot.start, updatedAt: new Date() }).where(eq(matches.id, row.matchId));
      await tx.update(tournamentMatches).set({ courtLabel: slot.courtLabel, updatedAt: new Date() }).where(eq(tournamentMatches.id, row.id));
    }
  }

  private async lockOrganizer(actor: TournamentViewer, id: number, tx: TransactionContext): Promise<TournamentRow> {
    const t = await tournamentRepository.findById(id, tx, { lock: true });
    if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
    if (t.creatorId !== actor.id) throw err.forbidden();
    if (!SCHEDULABLE.includes(t.status)) throw err.invalidState(t.status);
    return t;
  }

  /** POST /:id/schedule/auto — re-run for matches not started (version-checked, bumps the version). */
  /** Unplayed, playable matches with their time and court (for change notifications). */
  private async slots(tournamentId: number, tx: TransactionContext): Promise<Slot[]> {
    const rows = await tx.select({
      matchId: tournamentMatches.id, at: matches.scheduledAt, court: tournamentMatches.courtLabel, status: matches.status,
      reg1: tournamentMatches.registration1Id, reg2: tournamentMatches.registration2Id, roundIndex: tournamentMatches.roundIndex,
      resolution: tournamentMatches.resolution,
    }).from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(eq(tournamentMatches.tournamentId, tournamentId));
    return rows.filter(r => r.status === 'CONFIRMED' && r.resolution === 'UNRESOLVED' && r.at !== null)
      .map(r => ({ matchId: r.matchId, at: r.at!, court: r.court, reg1: r.reg1, reg2: r.reg2, roundIndex: r.roundIndex }));
  }

  /**
   * Players of a match whose time or court changed are told once per new slot
   * (PRD FR-62, Tech Design §11: own match, only after READY).
   */
  private async notifyChanges(t: TournamentRow, before: Slot[], tx: TransactionContext): Promise<void> {
    if (t.status !== 'READY' && t.status !== 'IN_PROGRESS') return;
    const after = await this.slots(t.id, tx);
    const changed = after.filter(a => {
      const b = before.find(x => x.matchId === a.matchId);
      return b && (b.at.getTime() !== a.at.getTime() || (b.court ?? '') !== (a.court ?? '')) && a.reg1 !== null && a.reg2 !== null;
    });
    if (changed.length === 0) return;
    const players = await playersOfRegistrations(changed.flatMap(c => [c.reg1!, c.reg2!]), tx);
    const notices: TournamentNotice[] = changed.map(c => ({
      recipients: [...(players.get(c.reg1!) ?? []), ...(players.get(c.reg2!) ?? [])],
      type: 'TOURNAMENT_MATCH_RESCHEDULED', tournamentId: t.id, key: `resched:${c.matchId}:${c.at.getTime()}:${c.court ?? ''}`,
      title: 'Trận đấu của bạn đổi lịch', content: `${t.name}: trận của bạn chuyển sang ${formatVnTime(c.at)} · ${c.court ?? 'chưa xếp sân'}.`,
    }));
    await notifyTournament(tx, notices);
  }

  async rerun(actor: TournamentViewer, id: number, version: number) {
    await db.transaction(async tx => {
      const t = await this.lockOrganizer(actor, id, tx);
      if (t.version !== version) throw err.versionConflict();
      const before = await this.slots(t.id, tx);
      await this.autoScheduleInTransaction(t, tx, 'rerun');
      await this.notifyChanges(t, before, tx);
      await tournamentRepository.update(id, {}, tx);
    });
    return this.schedule(actor, id);
  }

  /** PATCH /:id/matches/:tournamentMatchId/schedule — saves the edit and returns warnings (never blocks). */
  async editMatch(actor: TournamentViewer, id: number, tournamentMatchId: number, input: { courtLabel: string; scheduledAt: Date }) {
    await db.transaction(async tx => {
      const t = await this.lockOrganizer(actor, id, tx);
      const [row] = await tx.select({ matchId: tournamentMatches.matchId, resolution: tournamentMatches.resolution, status: matches.status })
        .from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
        .where(and(eq(tournamentMatches.id, tournamentMatchId), eq(tournamentMatches.tournamentId, t.id))).limit(1);
      if (!row) throw err.matchNotFound();
      if (row.status !== 'CONFIRMED' || row.resolution !== 'UNRESOLVED') throw err.locked();
      const before = await this.slots(t.id, tx);
      await tx.update(matches).set({ scheduledAt: input.scheduledAt, updatedAt: new Date() }).where(eq(matches.id, row.matchId));
      await tx.update(tournamentMatches).set({ courtLabel: input.courtLabel, updatedAt: new Date() }).where(eq(tournamentMatches.id, tournamentMatchId));
      await this.notifyChanges(t, before, tx);
      // A stale screen must not re-run over this edit (review, TRN-05).
      await tournamentRepository.update(t.id, {}, tx);
    });
    const view = await this.schedule(actor, id);
    return {
      match: view.matches.find(m => m.id === tournamentMatchId)!,
      warnings: (view.warnings ?? []).filter(w => w.matchId === tournamentMatchId || w.otherMatchId === tournamentMatchId),
    };
  }

  /** GET /:id/schedule — matches by time; warnings only for the Organizer. */
  async schedule(viewer: TournamentViewer | null, id: number) {
    const t = await tournamentRepository.findById(id);
    if (!t || (t.status === 'DRAFT' && t.creatorId !== viewer?.id && viewer?.role !== 'ADMIN')) throw err.notFound();
    const rows = await this.rows(id, db);
    const d = t.matchDurationMinutes * MINUTE;
    const items = rows
      .map(row => ({
        id: row.id,
        roundIndex: row.roundIndex,
        matchIndex: row.matchIndex,
        registration1Id: row.registration1Id,
        registration2Id: row.registration2Id,
        winnerRegistrationId: row.winnerRegistrationId,
        status: row.status,
        resolution: row.resolution,
        courtLabel: row.courtLabel,
        scheduledAt: row.scheduledAt.toISOString(),
        estimatedEndAt: new Date(row.scheduledAt.getTime() + d).toISOString(),
      }))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || (a.courtLabel ?? '').localeCompare(b.courtLabel ?? '', 'vi', { numeric: true }));
    const isOrganizer = viewer?.role === 'PLAYER' && viewer.id === t.creatorId;
    let warnings: ScheduleWarning[] | undefined;
    if (isOrganizer) {
      warnings = findScheduleConflicts(rows.map(row => ({
        id: row.id, courtLabel: row.courtLabel, start: row.scheduledAt,
        feederIds: this.feeders(rows, row.id), participants: this.participants(row),
      })), {
        durationMinutes: t.matchDurationMinutes, restMinutes: t.minRestMinutes,
        dayStartMinutes: minutesOf(t.dailyStartTime), dayEndMinutes: minutesOf(t.dailyEndTime),
        tournamentStart: t.tournamentStart, tournamentEnd: t.tournamentEnd,
      });
    }
    return { matchDurationMinutes: t.matchDurationMinutes, courtCount: t.courtCount, matches: items, ...(warnings ? { warnings } : {}) };
  }
}

export const tournamentScheduleService = new TournamentScheduleService();
