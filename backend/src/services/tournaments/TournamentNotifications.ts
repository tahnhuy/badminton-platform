import { and, eq, inArray, isNull } from 'drizzle-orm';
import { tournamentRegistrations, tournamentTeamPlayers, tournaments } from '../../db/schema/tournaments';
import type { NotificationEvent } from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { notificationService } from '../notifications/NotificationService';

/**
 * Tournament notifications (PRD FR-62, Tech Design §11; TRN-11). Written inside the
 * caller's transaction like every other producer, so they commit with the state change;
 * the dedup key makes retries and concurrent job runs produce one notification.
 */

export const TOURNAMENT_RESOURCE = 'TOURNAMENT';

export type TournamentNotificationType =
  | 'TOURNAMENT_REGISTRATION_CONFIRMED' | 'TOURNAMENT_REGISTRATION_REMOVED' | 'TOURNAMENT_REGISTRATION_REFUNDED'
  | 'TOURNAMENT_REGISTRATION_CLOSED' | 'TOURNAMENT_BRACKET_PUBLISHED' | 'TOURNAMENT_MATCH_RESCHEDULED' | 'TOURNAMENT_MATCH_REMINDER'
  | 'TOURNAMENT_CANCELLED' | 'TOURNAMENT_COMPLETED'
  | 'TOURNAMENT_TEAM_INVITED' | 'TOURNAMENT_TEAM_INVITATION_ACCEPTED' | 'TOURNAMENT_TEAM_INVITATION_DECLINED'
  | 'TOURNAMENT_TEAM_INVITATION_EXPIRED' | 'TOURNAMENT_TEAM_JOINED_BY_LINK';

export interface TournamentNotice {
  recipients: number[];
  type: TournamentNotificationType;
  tournamentId: number;
  title: string;
  content: string;
  /** Identifies the transition; the recipient id is appended. */
  key: string;
}

const vnTime = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
export const formatVnTime = (date: Date) => vnTime.format(date);
export const formatMoney = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;

export async function notifyTournament(tx: TransactionContext, notices: readonly TournamentNotice[]): Promise<void> {
  const events: NotificationEvent[] = [];
  for (const notice of notices) {
    for (const recipientId of new Set(notice.recipients)) {
      events.push({
        recipientId, type: notice.type, title: notice.title.slice(0, 200), content: notice.content.slice(0, 1000),
        resource: { type: TOURNAMENT_RESOURCE, id: notice.tournamentId },
        dedupKey: `trn:${notice.tournamentId}:${notice.key}:${recipientId}`,
      });
    }
  }
  if (events.length > 0) await notificationService.notify(tx, events);
}

/** Players behind registrations: the Singles player, or the active members of a Doubles team. */
export async function playersOfRegistrations(registrationIds: number[], tx: TransactionContext): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  if (registrationIds.length === 0) return result;
  const regs = await tx.select({ id: tournamentRegistrations.id, playerId: tournamentRegistrations.playerId, teamId: tournamentRegistrations.teamId })
    .from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, registrationIds));
  const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
  const members = teamIds.length === 0 ? [] : await tx.select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId })
    .from(tournamentTeamPlayers).where(and(inArray(tournamentTeamPlayers.teamId, teamIds), isNull(tournamentTeamPlayers.leftAt)));
  for (const reg of regs) {
    result.set(reg.id, reg.playerId !== null ? [reg.playerId] : members.filter(m => m.teamId === reg.teamId).map(m => m.playerId));
  }
  return result;
}

/** Every Player with a CONFIRMED registration (both members for Doubles). */
export async function confirmedPlayers(tournamentId: number, tx: TransactionContext): Promise<number[]> {
  const regs = await tx.select({ id: tournamentRegistrations.id }).from(tournamentRegistrations)
    .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), eq(tournamentRegistrations.status, 'CONFIRMED')));
  const map = await playersOfRegistrations(regs.map(r => r.id), tx);
  return [...new Set([...map.values()].flat())];
}

export async function tournamentName(tournamentId: number, tx: TransactionContext): Promise<string> {
  const [row] = await tx.select({ name: tournaments.name }).from(tournaments).where(eq(tournaments.id, tournamentId)).limit(1);
  return row?.name ?? 'Giải đấu';
}
