import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  conversations,
  conversationMembers,
  messages,
  userBlocks,
} from '../../db';
import { AppError } from '../../errors/AppError';
import { messagingConfig } from '../../shared/config/messaging-config';
import {
  messagingRepository,
  type ConversationMemberDto,
  type PlayerDisplayDto,
} from '../../repositories/messaging/MessagingRepository';
import type { BlockPort } from '../../contracts/BlockPort';
import type { DbExecutor } from '../../repositories/auth/AuthRepository';

export interface ConversationDto {
  id: number;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  createdBy: number | null;
  lastSeq: number;
  activityVersion: number;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  canSend: boolean;
  sendDisabledReason: string | null;
  counterpart: PlayerDisplayDto | null;
  members: ConversationMemberDto[];
  lastMessage: {
    id: number;
    seq: number;
    senderId: number;
    body: string | null;
    createdAt: string;
  } | null;
}

export class MessagingService implements BlockPort {
  async isBlockedEitherWay(userAId: number, userBId: number): Promise<boolean> {
    return messagingRepository.isBlockedEitherWay(userAId, userBId);
  }

  async requireEnabled() {
    const cfg = await messagingConfig.get();
    if (!cfg.enabled) {
      throw new AppError('MESSAGING_DISABLED', 409, 'Messaging is temporarily unavailable');
    }
    return cfg;
  }

  async searchPlayers(actorId: number, query: string, limit: number): Promise<PlayerDisplayDto[]> {
    return messagingRepository.searchPlayers(actorId, query, limit);
  }

  async getUnreadSummary(actorId: number): Promise<{ totalUnread: number }> {
    const totalUnread = await messagingRepository.getUnreadSummary(actorId);
    return { totalUnread };
  }

  async getConversationAccess(actorId: number, conversationId: number, executor: DbExecutor = db) {
    const found = await messagingRepository.getConversationWithMembers(conversationId, executor);
    if (!found) {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
    }
    const myMembership = found.members.find((m) => m.userId === actorId);
    if (!myMembership || myMembership.state !== 'ACTIVE') {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
    }
    return { conversation: found.conversation, members: found.members, myMembership };
  }

  private async buildConversationDto(
    actorId: number,
    conv: typeof conversations.$inferSelect,
    memberRows: (typeof conversationMembers.$inferSelect)[],
    enabled: boolean,
    executor: DbExecutor = db
  ): Promise<ConversationDto> {
    const userIds = memberRows.map((m) => m.userId);
    const playerMap = await messagingRepository.findPlayersByIds(userIds, executor);
    const blockedSet = await messagingRepository.findBlockedPairUserIds(actorId, userIds, executor);
    const myMember = memberRows.find((m) => m.userId === actorId)!;

    const activeMemberDtos: ConversationMemberDto[] = memberRows
      .filter((m) => m.state === 'ACTIVE')
      .map((m) => {
        const p = playerMap.get(m.userId);
        const hidePresence = !enabled || (conv.type === 'DIRECT' && blockedSet.has(m.userId));
        return {
          id: m.userId,
          fullName: p?.fullName ?? `Người chơi #${m.userId}`,
          avatarUrl: p?.avatarUrl ?? null,
          skillLevel: p?.skillLevel ?? null,
          isActive: p?.isActive ?? false,
          isOnline: hidePresence ? false : Boolean(p?.isOnline),
          lastSeenAt: hidePresence ? null : p?.lastSeenAt ?? null,
          state: m.state as 'ACTIVE' | 'LEFT',
          lastReadSeq: m.lastReadSeq,
          joinedAt: m.joinedAt.toISOString(),
        };
      });

    let counterpart: PlayerDisplayDto | null = null;
    let canSend = enabled;
    let sendDisabledReason: string | null = enabled ? null : 'MESSAGING_DISABLED';

    if (conv.type === 'DIRECT') {
      const otherId = conv.directUserLowId === actorId ? conv.directUserHighId! : conv.directUserLowId!;
      counterpart = activeMemberDtos.find((m) => m.id === otherId) ?? null;
      if (!counterpart?.isActive || blockedSet.has(otherId)) {
        canSend = false;
        sendDisabledReason = sendDisabledReason ?? 'MESSAGING_ACTION_NOT_AVAILABLE';
      }
    }

    const [lastMsg] = await executor
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(desc(messages.seq))
      .limit(1);

    const unreadRes = await executor.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM messages
      WHERE conversation_id = ${conv.id}
        AND seq > ${myMember.lastReadSeq}
        AND sender_id <> ${actorId}
    `);

    return {
      id: conv.id,
      type: conv.type as 'DIRECT' | 'GROUP',
      title: conv.title,
      createdBy: conv.createdBy,
      lastSeq: conv.lastSeq,
      activityVersion: conv.activityVersion,
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      createdAt: conv.createdAt.toISOString(),
      unreadCount: Number(unreadRes.rows[0]?.cnt ?? 0),
      canSend,
      sendDisabledReason,
      counterpart,
      members: activeMemberDtos,
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            seq: lastMsg.seq,
            senderId: lastMsg.senderId,
            body: lastMsg.body,
            createdAt: lastMsg.createdAt.toISOString(),
          }
        : null,
    };
  }

  async getConversationDetail(actorId: number, conversationId: number): Promise<ConversationDto> {
    const cfg = await messagingConfig.get();
    const { conversation, members } = await this.getConversationAccess(actorId, conversationId);
    return this.buildConversationDto(actorId, conversation, members, cfg.enabled);
  }

  async listConversations(actorId: number, page: number, limit: number) {
    const cfg = await messagingConfig.get();
    const offset = (page - 1) * limit;

    const idRes = await db.execute(sql`
      SELECT c.id, COUNT(*) OVER()::int AS total_count
      FROM conversations c
      INNER JOIN conversation_members cm
        ON cm.conversation_id = c.id
       AND cm.user_id = ${actorId}
       AND cm.state = 'ACTIVE'
      WHERE c.type = 'GROUP' OR c.last_seq > 0 OR c.created_by = ${actorId}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = Number(idRes.rows[0]?.total_count ?? 0);
    const items: ConversationDto[] = [];
    for (const row of idRes.rows) {
      const found = await messagingRepository.getConversationWithMembers(Number(row.id));
      if (found) {
        items.push(await this.buildConversationDto(actorId, found.conversation, found.members, cfg.enabled));
      }
    }

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async openOrCreateDirectConversation(
    actorId: number,
    targetPlayerId: number
  ): Promise<{ conversation: ConversationDto; created: boolean }> {
    const cfg = await this.requireEnabled();
    if (actorId === targetPlayerId) {
      throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
    }

    const lowId = Math.min(actorId, targetPlayerId);
    const highId = Math.max(actorId, targetPlayerId);

    const { convId, created } = await db.transaction(async (tx) => {
      await messagingRepository.lockUsersAscending([actorId, targetPlayerId], tx);
      const players = await messagingRepository.findPlayersByIds([targetPlayerId], tx);
      const target = players.get(targetPlayerId);
      if (!target || target.role !== 'PLAYER' || !target.isActive) {
        throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
      }
      if (await messagingRepository.isBlockedEitherWay(actorId, targetPlayerId, tx)) {
        throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
      }

      const [existing] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.type, 'DIRECT'),
            eq(conversations.directUserLowId, lowId),
            eq(conversations.directUserHighId, highId)
          )
        );
      if (existing) {
        return { convId: existing.id, created: false };
      }

      const [inserted] = await tx
        .insert(conversations)
        .values({
          type: 'DIRECT',
          createdBy: actorId,
          directUserLowId: lowId,
          directUserHighId: highId,
        })
        .returning();

      await tx.insert(conversationMembers).values([
        { conversationId: inserted.id, userId: lowId, state: 'ACTIVE' },
        { conversationId: inserted.id, userId: highId, state: 'ACTIVE' },
      ]);
      return { convId: inserted.id, created: true };
    });

    const found = await messagingRepository.getConversationWithMembers(convId);
    const dto = await this.buildConversationDto(actorId, found!.conversation, found!.members, cfg.enabled);
    return { conversation: dto, created };
  }

  async createGroupConversation(
    actorId: number,
    title: string,
    memberIds: number[]
  ): Promise<ConversationDto> {
    const cfg = await this.requireEnabled();
    const uniqueMemberIds = Array.from(new Set([actorId, ...memberIds]));
    if (uniqueMemberIds.length < 2 || uniqueMemberIds.length > cfg.groupMaxMembers) {
      throw new AppError(
        'VALIDATION_FAILED',
        400,
        `Group must have between 2 and ${cfg.groupMaxMembers} members`
      );
    }

    const otherIds = uniqueMemberIds.filter((id) => id !== actorId);
    const convId = await db.transaction(async (tx) => {
      await messagingRepository.lockUsersAscending(uniqueMemberIds, tx);
      const players = await messagingRepository.findPlayersByIds(otherIds, tx);
      const blockedSet = await messagingRepository.findBlockedPairUserIds(actorId, otherIds, tx);

      for (const uid of otherIds) {
        const p = players.get(uid);
        if (!p || p.role !== 'PLAYER' || !p.isActive || blockedSet.has(uid)) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      }

      const [inserted] = await tx
        .insert(conversations)
        .values({
          type: 'GROUP',
          title: title.trim(),
          createdBy: actorId,
        })
        .returning();

      await tx.insert(conversationMembers).values(
        uniqueMemberIds.map((uid) => ({
          conversationId: inserted.id,
          userId: uid,
          state: 'ACTIVE',
        }))
      );
      return inserted.id;
    });

    const found = await messagingRepository.getConversationWithMembers(convId);
    return this.buildConversationDto(actorId, found!.conversation, found!.members, cfg.enabled);
  }

  async addGroupMembers(
    actorId: number,
    conversationId: number,
    memberIds: number[]
  ): Promise<ConversationDto> {
    const cfg = await this.requireEnabled();
    const targetIds = Array.from(new Set(memberIds.filter((id) => id !== actorId)));
    if (targetIds.length === 0) {
      return this.getConversationDetail(actorId, conversationId);
    }

    await db.transaction(async (tx) => {
      await messagingRepository.lockUsersAscending([actorId, ...targetIds], tx);
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation, members } = await this.getConversationAccess(actorId, conversationId, tx);
      if (conversation.type !== 'GROUP') {
        throw new AppError('MESSAGING_NOT_GROUP', 409, 'Only group conversations support adding members');
      }

      const players = await messagingRepository.findPlayersByIds(targetIds, tx);
      const blockedSet = await messagingRepository.findBlockedPairUserIds(actorId, targetIds, tx);
      for (const uid of targetIds) {
        const p = players.get(uid);
        if (!p || p.role !== 'PLAYER' || !p.isActive || blockedSet.has(uid)) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      }

      const activeIds = new Set(members.filter((m) => m.state === 'ACTIVE').map((m) => m.userId));
      for (const uid of targetIds) activeIds.add(uid);
      if (activeIds.size > cfg.groupMaxMembers) {
        throw new AppError(
          'VALIDATION_FAILED',
          400,
          `Group cannot exceed ${cfg.groupMaxMembers} active members`
        );
      }

      const now = new Date();
      for (const uid of targetIds) {
        const existingMember = members.find((m) => m.userId === uid);
        if (!existingMember) {
          await tx.insert(conversationMembers).values({
            conversationId,
            userId: uid,
            state: 'ACTIVE',
            joinedAt: now,
            updatedAt: now,
          });
        } else if (existingMember.state === 'LEFT') {
          await tx
            .update(conversationMembers)
            .set({ state: 'ACTIVE', updatedAt: now })
            .where(
              and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, uid)
              )
            );
        }
      }
    });

    return this.getConversationDetail(actorId, conversationId);
  }

  async leaveGroupConversation(actorId: number, conversationId: number): Promise<void> {
    await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation } = await this.getConversationAccess(actorId, conversationId, tx);
      if (conversation.type !== 'GROUP') {
        throw new AppError('MESSAGING_NOT_GROUP', 409, 'Only group conversations can be left');
      }
      await tx
        .update(conversationMembers)
        .set({ state: 'LEFT', updatedAt: new Date() })
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, actorId)
          )
        );
    });
  }

  async listBlocks(actorId: number) {
    return messagingRepository.listBlocks(actorId);
  }

  async blockPlayer(actorId: number, targetPlayerId: number): Promise<void> {
    if (actorId === targetPlayerId) {
      throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Cannot block yourself');
    }

    await db.transaction(async (tx) => {
      await messagingRepository.lockUsersAscending([actorId, targetPlayerId], tx);
      const players = await messagingRepository.findPlayersByIds([targetPlayerId], tx);
      const target = players.get(targetPlayerId);
      if (!target || target.role !== 'PLAYER') {
        throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
      }

      await tx
        .insert(userBlocks)
        .values({ blockerId: actorId, blockedId: targetPlayerId })
        .onConflictDoNothing();

      await messagingRepository.closePendingInvitationsBetween(actorId, targetPlayerId, tx);
    });
  }

  async unblockPlayer(actorId: number, targetPlayerId: number): Promise<void> {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, actorId), eq(userBlocks.blockedId, targetPlayerId)));
  }
}

export const messagingService = new MessagingService();

