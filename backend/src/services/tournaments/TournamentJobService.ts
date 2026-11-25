import { and, eq, gt, inArray, isNull, lte, ne, notInArray, or, sql } from 'drizzle-orm';
import { db, pool } from '../../db';
import { matches } from '../../db/schema/matchmaking';
import { tournamentMatches, tournaments } from '../../db/schema/tournaments';
import { AppError } from '../../errors/AppError';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { tournamentService } from './TournamentService';
import { tournamentTeamService } from './TournamentTeamService';
import { formatVnTime, notifyTournament, playersOfRegistrations } from './TournamentNotifications';
import { tournamentRealtime } from './TournamentRealtime';
import { tournamentChatService } from './TournamentChatService';

/**
 * Tournament background steps (Tech Design §10; TRN-10, reminder TRN-11). Every step re-checks
 * its condition under the tournament row lock (or claims rows with a conditional update), so
 * two concurrent runners produce one effect; the advisory lock only avoids duplicate work.
 */

const DAY = 86_400_000;
const AUTO_COMPLETE_AFTER = 3 * DAY;
const AUTO_CANCEL_AFTER = 14 * DAY;
const REMINDER_WINDOW = 30 * 60_000;
const ADVISORY_LOCK_KEY = 7_420_011;
export const AUTO_CANCEL_STALE_REASON = 'Giải không được hoàn tất trong 14 ngày sau ngày kết thúc dự kiến';

export interface TournamentJobResult {
  skipped: boolean;
  closed: number;
  invitationsExpired: number;
  completed: number;
  cancelled: number;
  reminders: number;
  chatsCreated: number;
  chatsLocked: number;
}

type Step = (row: TournamentRow, tx: TransactionContext) => Promise<boolean>;

export class TournamentJobService {
  /** Runs every step once; returns `skipped` when another runner holds the advisory lock. */
  async runOnce(now = new Date()): Promise<TournamentJobResult> {
    const client = await pool.connect();
    try {
      const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [ADVISORY_LOCK_KEY]);
      if (!rows[0].locked) return { skipped: true, closed: 0, invitationsExpired: 0, completed: 0, cancelled: 0, reminders: 0, chatsCreated: 0, chatsLocked: 0 };
      try {
        return { skipped: false, ...(await this.steps(now)) };
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
      }
    } finally {
      client.release();
    }
  }

  /** The steps without the advisory lock (also used by tests to simulate concurrent runners). */
  async steps(now = new Date()) {
    const closed = await this.forEach(
      and(eq(tournaments.status, 'OPEN_FOR_REGISTRATION'), lte(tournaments.registrationEnd, now)),
      async (row, tx) => {
        if (row.status !== 'OPEN_FOR_REGISTRATION' || row.registrationEnd.getTime() > now.getTime()) return false;
        await tournamentService.closeInTransaction(row, tx, null);
        return true;
      },
    );
    const invitationsExpired = (await tournamentTeamService.expireInvitations(now)).length;
    const completed = await this.forEach(
      and(eq(tournaments.status, 'IN_PROGRESS'), lte(tournaments.tournamentEnd, new Date(now.getTime() - AUTO_COMPLETE_AFTER))),
      async (row, tx) => {
        if (row.status !== 'IN_PROGRESS') return false;
        try {
          await tournamentService.completeInTransaction(row, tx, null);
          return true;
        } catch (error) {
          // The final has no result yet: leave it to the Organizer or the 14-day cancel.
          if (error instanceof AppError && error.code === 'TOURNAMENT_NOT_FINISHED') return false;
          throw error;
        }
      },
    );
    const cancelled = await this.forEach(
      and(notInArray(tournaments.status, ['COMPLETED', 'CANCELLED']), lte(tournaments.tournamentEnd, new Date(now.getTime() - AUTO_CANCEL_AFTER))),
      async (row, tx) => {
        if (row.status === 'COMPLETED' || row.status === 'CANCELLED') return false;
        await tournamentService.cancelInTransaction(row, tx, null, AUTO_CANCEL_STALE_REASON);
        return true;
      },
    );
    const reminders = await this.remind(now);
    const chats = await tournamentChatService.sweep(now);
    return { closed, invitationsExpired, completed, cancelled, reminders, chatsCreated: chats.created, chatsLocked: chats.locked };
  }

  /** Locks each candidate tournament in its own transaction and applies `step` after re-reading it. */
  private async forEach(condition: ReturnType<typeof and>, step: Step): Promise<number> {
    const candidates = await db.select({ id: tournaments.id }).from(tournaments)
      .where(and(condition, isNull(tournaments.deletedAt))).orderBy(tournaments.id).limit(100);
    let applied = 0;
    for (const { id } of candidates) {
      const done = await db.transaction(async tx => {
        const row = await tournamentRepository.findById(id, tx, { lock: true });
        return row ? step(row, tx) : false;
      });
      if (done) {
        applied += 1;
        void tournamentRealtime.publish(id, 'STATUS');
      }
    }
    return applied;
  }

  /**
   * Match reminder (Tech Design §10 step 4): playable, not started matches starting within
   * 30 minutes; the conditional update claims each (match, scheduled_at) once, so a later
   * reschedule re-arms it.
   */
  private async remind(now: Date): Promise<number> {
    const until = new Date(now.getTime() + REMINDER_WINDOW);
    return db.transaction(async tx => {
      const due = await tx.select({ id: tournamentMatches.id, scheduledAt: matches.scheduledAt })
        .from(tournamentMatches)
        .innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
        .innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournamentId))
        .where(and(
          inArray(tournaments.status, ['READY', 'IN_PROGRESS']),
          eq(matches.status, 'CONFIRMED'),
          eq(tournamentMatches.resolution, 'UNRESOLVED'),
          sql`${tournamentMatches.registration1Id} IS NOT NULL AND ${tournamentMatches.registration2Id} IS NOT NULL`,
          // Column operators map Dates like the column; raw sql params would shift by the local offset.
          gt(matches.scheduledAt, now), lte(matches.scheduledAt, until),
          sql`${tournamentMatches.reminderSentFor} IS DISTINCT FROM ${matches.scheduledAt}`,
        ));
      let sent = 0;
      for (const item of due) {
        const [claimed] = await tx.update(tournamentMatches).set({ reminderSentFor: item.scheduledAt })
          .where(and(eq(tournamentMatches.id, item.id), or(isNull(tournamentMatches.reminderSentFor), ne(tournamentMatches.reminderSentFor, item.scheduledAt))))
          .returning();
        if (!claimed) continue;
        const [t] = await tx.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, claimed.tournamentId));
        const players = await playersOfRegistrations([claimed.registration1Id!, claimed.registration2Id!], tx);
        await notifyTournament(tx, [{
          recipients: [...players.values()].flat(), type: 'TOURNAMENT_MATCH_REMINDER', tournamentId: claimed.tournamentId,
          key: `remind:${claimed.id}:${item.scheduledAt.getTime()}`,
          title: 'Sắp tới trận của bạn', content: `${t?.name ?? 'Giải đấu'}: trận của bạn bắt đầu lúc ${formatVnTime(item.scheduledAt)} · ${claimed.courtLabel ?? 'chưa xếp sân'}. Có mặt sớm nhé!`,
        }]);
        sent += 1;
      }
      return sent;
    });
  }
}

export const tournamentJobService = new TournamentJobService();
