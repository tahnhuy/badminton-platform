import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';
import { db } from '../../db';
import { tournaments } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { messagingConfig } from '../../shared/config/messaging-config';
import { logger } from '../../shared/logging/logger';
import { tournamentRepository } from '../../repositories/tournaments/TournamentRepository';
import { messagingService } from '../messaging/MessagingService';
import { messagingWsHub } from '../messaging/MessagingWsHub';
import { confirmedPlayers } from './TournamentNotifications';

/**
 * Tournament group chat (PRD FR-72, Tech Design §7.8; TRN-16): a system-managed GROUP with the
 * Organizer and every participant, created after registration closes, read-only once locked.
 */

const CHAT_STATUSES = ['REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED'];
const LOCK_AFTER_COMPLETED_MS = 30 * 86_400_000;

export const tournamentChatService = {
  /** Creates the chat once; a Messaging failure never blocks the tournament (the job retries). */
  async ensureChat(tournamentId: number): Promise<number | null> {
    try {
      if (!(await messagingConfig.get()).enabled) return null;
      return await db.transaction(async tx => {
        const t = await tournamentRepository.findById(tournamentId, tx, { lock: true });
        if (!t || t.conversationId !== null || !CHAT_STATUSES.includes(t.status)) return t?.conversationId ?? null;
        const players = await confirmedPlayers(t.id, tx);
        const { conversationId } = await messagingService.createSystemGroupConversationInTransaction(tx, {
          creatorId: t.creatorId, title: t.name, memberIds: players, systemKind: 'TOURNAMENT',
        });
        await tx.update(tournaments).set({ conversationId }).where(eq(tournaments.id, t.id));
        return conversationId;
      });
    } catch (error) {
      logger.warn('Tournament chat creation failed; the job retries', { tournamentId, message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /** Removed participants leave the chat (inside the removal transaction). */
  async removeMembers(tournamentId: number, userIds: number[], tx: TransactionContext): Promise<void> {
    const [t] = await tx.select({ conversationId: tournaments.conversationId }).from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!t?.conversationId || userIds.length === 0) return;
    const removed = await messagingService.setSystemGroupMemberStateInTransaction(tx, t.conversationId, userIds, 'LEFT');
    if (removed.length > 0) {
      const event = { conversationId: t.conversationId, actorUserId: null, action: 'REMOVED' as const, memberIds: removed };
      setImmediate(() => void messagingWsHub.notifyUsers(removed, 'conversation.member_changed', event));
    }
  },

  /** Read-only for everyone (cancel, or 30 days after completion). */
  async lock(tournamentId: number, tx: TransactionContext): Promise<boolean> {
    const [t] = await tx.select({ conversationId: tournaments.conversationId }).from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!t?.conversationId) return false;
    return messagingService.lockSystemGroupInTransaction(tx, t.conversationId);
  },

  /** Job: retry missing chats and lock chats of tournaments completed ≥ 30 days ago. */
  async sweep(now = new Date()): Promise<{ created: number; locked: number }> {
    let created = 0;
    let locked = 0;
    const missing = await db.select({ id: tournaments.id }).from(tournaments)
      .where(and(isNull(tournaments.conversationId), inArray(tournaments.status, CHAT_STATUSES), isNull(tournaments.deletedAt))).limit(50);
    for (const { id } of missing) if (await this.ensureChat(id)) created += 1;
    const stale = await db.select({ id: tournaments.id }).from(tournaments)
      .where(and(eq(tournaments.status, 'COMPLETED'), isNotNull(tournaments.conversationId),
        lte(tournaments.completedAt, new Date(now.getTime() - LOCK_AFTER_COMPLETED_MS)))).limit(100);
    for (const { id } of stale) if (await db.transaction(tx => this.lock(id, tx))) locked += 1;
    return { created, locked };
  },
};
