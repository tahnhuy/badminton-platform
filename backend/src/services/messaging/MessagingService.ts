import crypto from 'crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  db,
  conversations,
  conversationMembers,
  messages,
  mediaFiles,
  messageAttachments,
  messageReactions,
  messageHides,
  userBlocks,
} from '../../db';
import { AppError } from '../../errors/AppError';
import { messagingConfig } from '../../shared/config/messaging-config';
import {
  messagingRepository,
  type ConversationMemberDto,
  type MessageDto,
  type MessageReactionSummaryDto,
  type MessageReactionType,
  type PlayerDisplayDto,
} from '../../repositories/messaging/MessagingRepository';
import type { BlockPort } from '../../contracts/BlockPort';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { DbExecutor } from '../../repositories/auth/AuthRepository';
import { matchmakingBlockPort } from '../matchmaking/MatchmakingBlockPortService';
import { registerBlockPort } from '../matchmaking/block-port.registry';
import { messagingWsHub } from './MessagingWsHub';
import {
  privateMediaStorage,
  MESSAGE_MAX_IMAGES,
} from '../../shared/storage/private-media-storage';
import {
  normalizeMessageImage,
  validateMessageFile,
  type ValidatedAttachment,
} from '../../validation/messaging-files';
import { logger } from '../../shared/logging/logger';

export interface ConversationDto {
  id: number;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  createdBy: number | null;
  isLocked: boolean;
  /** `TOURNAMENT` for system-managed groups (no user management actions). */
  systemKind: string | null;
  status: 'ACTIVE' | 'DISSOLVED';
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
    deletedAt: string | null;
    createdAt: string;
  } | null;
}

/**
 * System-managed groups (Tournament Tech Design §4.3c): membership, title, lock and lifetime
 * belong to the owning module; users — the creator included — cannot change them.
 */
function assertUserManaged(conversation: { systemKind: string | null }): void {
  if (conversation.systemKind !== null) {
    throw new AppError('MESSAGING_SYSTEM_GROUP', 409, 'Nhóm này do hệ thống quản lý');
  }
}

export class MessagingService implements BlockPort {
  async isBlockedEitherWay(userAId: number, userBId: number, tx?: TransactionContext): Promise<boolean> {
    return messagingRepository.isBlockedEitherWay(userAId, userBId, (tx as unknown as DbExecutor) ?? db);
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
    return {
      conversation: found.conversation,
      members: found.members,
      myMembership,
      myMember: myMembership,
    };
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
    } else if (conv.type === 'GROUP' && conv.isLocked && (conv.systemKind !== null || conv.createdBy !== actorId)) {
      canSend = false;
      sendDisabledReason = sendDisabledReason ?? 'MESSAGING_GROUP_LOCKED';
    }

    const [lastMsg] = await executor
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conv.id),
          sql`NOT EXISTS (
            SELECT 1 FROM message_hides mh
            WHERE mh.message_id = ${messages.id}
              AND mh.user_id = ${actorId}
          )`
        )
      )
      .orderBy(desc(messages.seq))
      .limit(1);

    const unreadRes = await executor.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM messages m
      WHERE m.conversation_id = ${conv.id}
        AND m.seq > ${myMember.lastReadSeq}
        AND m.sender_id <> ${actorId}
        AND NOT EXISTS (
          SELECT 1 FROM message_hides mh
          WHERE mh.message_id = m.id
            AND mh.user_id = ${actorId}
        )
    `);

    return {
      id: conv.id,
      type: conv.type as 'DIRECT' | 'GROUP',
      title: conv.title,
      createdBy: conv.createdBy,
      isLocked: conv.isLocked,
      systemKind: conv.systemKind ?? null,
      status: conv.status as 'ACTIVE' | 'DISSOLVED',
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
            body: lastMsg.deletedAt ? null : lastMsg.body,
            deletedAt: lastMsg.deletedAt ? lastMsg.deletedAt.toISOString() : null,
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
      WHERE c.status = 'ACTIVE'
        AND (c.type = 'GROUP' OR c.last_seq > 0 OR c.created_by = ${actorId})
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
    const convId = await db.transaction(async tx => {
      await messagingRepository.lockUsersAscending([...new Set([actorId, ...memberIds])], tx);
      return this.createGroupConversationInTransaction(tx, actorId, title, memberIds);
    });
    const found = await messagingRepository.getConversationWithMembers(convId);
    return this.buildConversationDto(actorId, found!.conversation, found!.members, cfg.enabled);
  }

  /** Caller must hold USERS locks for the creator and every member, in ascending order. */
  async createGroupConversationInTransaction(
    tx: TransactionContext, actorId: number, title: string, memberIds: number[]
  ): Promise<number> {
    const cfg = await this.requireEnabled();
    const uniqueMemberIds = [...new Set([actorId, ...memberIds])];
    if (uniqueMemberIds.length < 2 || uniqueMemberIds.length > cfg.groupMaxMembers) {
      throw new AppError('VALIDATION_FAILED', 400, `Group must have between 2 and ${cfg.groupMaxMembers} members`);
    }
    const otherIds = uniqueMemberIds.filter(id => id !== actorId);
    const players = await messagingRepository.findPlayersByIds(otherIds, tx);
    const blockedSet = await messagingRepository.findBlockedPairUserIds(actorId, otherIds, tx);
    for (const uid of otherIds) {
      const player = players.get(uid);
      if (!player || player.role !== 'PLAYER' || !player.isActive || blockedSet.has(uid)) {
        throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Không thể tạo nhóm với các thành viên hiện tại');
      }
    }
    const [inserted] = await tx.insert(conversations).values({
      type: 'GROUP', title: title.trim(), createdBy: actorId,
    }).returning({ id: conversations.id });
    await tx.insert(conversationMembers).values(uniqueMemberIds.map(userId => ({
      conversationId: inserted.id, userId, state: 'ACTIVE',
    })));
    return inserted.id;
  }

  /**
   * System-managed group (Tournament Tech Design §7.8): not capped by MESSAGING_GROUP_MAX_MEMBERS,
   * locks users in ascending id, and skips (does not fail on) inactive users or users blocked
   * by/blocking the creator. Returns the conversation id and the members actually added.
   */
  async createSystemGroupConversationInTransaction(
    tx: TransactionContext, input: { creatorId: number; title: string; memberIds: number[]; systemKind: 'TOURNAMENT' },
  ): Promise<{ conversationId: number; memberIds: number[] }> {
    const candidates = [...new Set([input.creatorId, ...input.memberIds])];
    await messagingRepository.lockUsersAscending(candidates, tx);
    const otherIds = candidates.filter(id => id !== input.creatorId);
    const players = await messagingRepository.findPlayersByIds(otherIds, tx);
    const blockedSet = await messagingRepository.findBlockedPairUserIds(input.creatorId, otherIds, tx);
    const accepted = [input.creatorId, ...otherIds.filter(uid => {
      const player = players.get(uid);
      return player && player.role === 'PLAYER' && player.isActive && !blockedSet.has(uid);
    })];
    const [inserted] = await tx.insert(conversations).values({
      type: 'GROUP', title: input.title.trim().slice(0, 120), createdBy: input.creatorId, systemKind: input.systemKind,
    }).returning({ id: conversations.id });
    await tx.insert(conversationMembers).values(accepted.map(userId => ({ conversationId: inserted.id, userId, state: 'ACTIVE' })));
    return { conversationId: inserted.id, memberIds: accepted };
  }

  /** Membership/lock changes of a system-managed group, only for the owning module. */
  async setSystemGroupMemberStateInTransaction(tx: TransactionContext, conversationId: number, userIds: number[], state: 'ACTIVE' | 'LEFT'): Promise<number[]> {
    if (userIds.length === 0) return [];
    await messagingRepository.lockConversation(conversationId, tx);
    const changed = await tx.update(conversationMembers).set({ state, updatedAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, conversationId), inArray(conversationMembers.userId, userIds),
        state === 'LEFT' ? eq(conversationMembers.state, 'ACTIVE') : eq(conversationMembers.state, 'LEFT')))
      .returning({ userId: conversationMembers.userId });
    return changed.map(r => r.userId);
  }

  async lockSystemGroupInTransaction(tx: TransactionContext, conversationId: number): Promise<boolean> {
    const locked = await messagingRepository.lockConversation(conversationId, tx);
    if (!locked || locked.isLocked) return false;
    await tx.update(conversations).set({ isLocked: true, activityVersion: locked.activityVersion + 1 }).where(eq(conversations.id, conversationId));
    return true;
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
      assertUserManaged(conversation);
      if (conversation.createdBy !== actorId) {
        throw new AppError('FORBIDDEN', 403, 'Chỉ chủ nhóm mới có quyền thêm thành viên');
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

    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.member_changed',
      { conversationId, actorUserId: actorId, action: 'ADDED', memberIds: targetIds },
      actorId
    );
    return this.getConversationDetail(actorId, conversationId);
  }

  async updateGroupConversation(
    actorId: number,
    conversationId: number,
    input: { title?: string; isLocked?: boolean }
  ): Promise<ConversationDto> {
    await this.requireEnabled();

    const updatedFields = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation } = await this.getConversationAccess(actorId, conversationId, tx);
      if (conversation.type !== 'GROUP') {
        throw new AppError('MESSAGING_NOT_GROUP', 409, 'Only group conversations can be updated');
      }
      assertUserManaged(conversation);
      if (conversation.createdBy !== actorId) {
        throw new AppError('FORBIDDEN', 403, 'Chỉ chủ nhóm mới có quyền chỉnh sửa cài đặt nhóm');
      }

      const nextTitle = input.title !== undefined ? input.title.trim() : conversation.title!;
      const nextLocked = input.isLocked !== undefined ? input.isLocked : conversation.isLocked;
      const nextActivityVersion = lockedConv.activityVersion + 1;

      await tx
        .update(conversations)
        .set({
          title: nextTitle,
          isLocked: nextLocked,
          activityVersion: nextActivityVersion,
        })
        .where(eq(conversations.id, conversationId));

      return { title: nextTitle, isLocked: nextLocked };
    });

    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.updated',
      {
        conversationId,
        actorUserId: actorId,
        title: updatedFields.title,
        isLocked: updatedFields.isLocked,
      },
      actorId
    );

    return this.getConversationDetail(actorId, conversationId);
  }

  async removeGroupMember(
    actorId: number,
    conversationId: number,
    targetUserId: number
  ): Promise<ConversationDto> {
    await this.requireEnabled();
    if (actorId === targetUserId) {
      throw new AppError(
        'MESSAGING_OWNER_CANNOT_LEAVE',
        409,
        'Chủ nhóm không thể tự xóa chính mình khỏi nhóm'
      );
    }

    await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation, members } = await this.getConversationAccess(
        actorId,
        conversationId,
        tx
      );
      if (conversation.type !== 'GROUP') {
        throw new AppError('MESSAGING_NOT_GROUP', 409, 'Only group conversations support removing members');
      }
      assertUserManaged(conversation);
      if (conversation.createdBy !== actorId) {
        throw new AppError('FORBIDDEN', 403, 'Chỉ chủ nhóm mới có quyền xóa thành viên khỏi nhóm');
      }

      const targetMember = members.find((m) => m.userId === targetUserId && m.state === 'ACTIVE');
      if (!targetMember) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Member not found');
      }

      await tx
        .update(conversationMembers)
        .set({ state: 'LEFT', updatedAt: new Date() })
        .where(
          and(
            eq(conversationMembers.conversationId, conversationId),
            eq(conversationMembers.userId, targetUserId)
          )
        );
    });

    const payload = {
      conversationId,
      actorUserId: actorId,
      action: 'REMOVED' as const,
      memberIds: [targetUserId],
    };
    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.member_changed',
      payload,
      actorId
    );
    await messagingWsHub.notifyUsers([targetUserId], 'conversation.member_changed', payload);

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
      assertUserManaged(conversation);
      if (conversation.createdBy === actorId) {
        throw new AppError(
          'MESSAGING_OWNER_CANNOT_LEAVE',
          409,
          'Chủ nhóm không thể rời nhóm; vui lòng giải tán nhóm nếu muốn đóng nhóm'
        );
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
    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.member_changed',
      { conversationId, actorUserId: actorId, action: 'LEFT' },
      actorId
    );
  }

  async dissolveGroupConversation(actorId: number, conversationId: number): Promise<void> {
    await this.requireEnabled();
    const now = new Date();

    await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation } = await this.getConversationAccess(actorId, conversationId, tx);
      if (conversation.type !== 'GROUP') {
        throw new AppError('MESSAGING_NOT_GROUP', 409, 'Only group conversations can be dissolved');
      }
      assertUserManaged(conversation);
      if (conversation.createdBy !== actorId) {
        throw new AppError('FORBIDDEN', 403, 'Chỉ chủ nhóm mới có quyền giải tán nhóm');
      }

      await tx
        .update(conversations)
        .set({
          status: 'DISSOLVED',
          dissolvedAt: now,
          activityVersion: lockedConv.activityVersion + 1,
        })
        .where(eq(conversations.id, conversationId));
    });

    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.dissolved',
      {
        conversationId,
        dissolvedByUserId: actorId,
        dissolvedAt: now.toISOString(),
      },
      actorId
    );
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

      await matchmakingBlockPort.closePendingBetween(actorId, targetPlayerId, tx);
    });
  }

  async unblockPlayer(actorId: number, targetPlayerId: number): Promise<void> {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, actorId), eq(userBlocks.blockedId, targetPlayerId)));
  }

  async recordHeartbeat(actorId: number): Promise<{
    lastSeenAt: string;
    isOnline: boolean;
    updated: boolean;
  }> {
    await this.requireEnabled();
    const { lastSeenAt, updated } = await messagingRepository.upsertHeartbeatWithThrottle(actorId);
    if (updated) {
      await messagingWsHub.broadcastPresenceUpdate(actorId, lastSeenAt, true);
    }
    return {
      lastSeenAt: lastSeenAt.toISOString(),
      isOnline: true,
      updated,
    };
  }

  async recordTyping(
    actorId: number,
    conversationId: number
  ): Promise<{
    conversationId: number;
    expiresAt: string;
    updated: boolean;
  }> {
    await this.requireEnabled();

    const { expiresAt, updated } = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { conversation, members } = await this.getConversationAccess(
        actorId,
        conversationId,
        tx
      );

      if (conversation.type === 'DIRECT') {
        const counterpart = members.find((m) => m.userId !== actorId);
        if (!counterpart) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
        const players = await messagingRepository.findPlayersByIds([counterpart.userId], tx);
        const cp = players.get(counterpart.userId);
        const blocked = await messagingRepository.isBlockedEitherWay(
          actorId,
          counterpart.userId,
          tx
        );
        if (!cp || !cp.isActive || blocked) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      } else if (conversation.type === 'GROUP' && conversation.isLocked && (conversation.systemKind !== null || conversation.createdBy !== actorId)) {
        throw new AppError('MESSAGING_GROUP_LOCKED', 403, 'Nhóm đang khóa gửi tin nhắn');
      }

      return messagingRepository.upsertTypingWithThrottle(conversationId, actorId, tx);
    });

    if (updated) {
      await messagingWsHub.broadcastConversationEvent(
        conversationId,
        'typing.updated',
        {
          conversationId,
          userId: actorId,
          expiresAt: expiresAt.toISOString(),
        },
        actorId
      );
    }

    return {
      conversationId,
      expiresAt: expiresAt.toISOString(),
      updated,
    };
  }

  async sendMessage(
    actorId: number,
    conversationId: number,
    input: {
      text?: string | null;
      parentId?: number | null;
      clientMessageId: string;
      images: Express.Multer.File[];
      files: Express.Multer.File[];
    }
  ): Promise<{ message: MessageDto; created: boolean }> {
    const cfg = await this.requireEnabled();

    const rawText = typeof input.text === 'string' ? input.text.trim() : '';
    const trimmedText = rawText.length > 0 ? rawText : null;
    if (trimmedText && trimmedText.length > 2000) {
      throw new AppError(
        'MESSAGING_CONTENT_TOO_LONG',
        400,
        'Nội dung tin nhắn không được vượt quá 2000 ký tự'
      );
    }

    const images = input.images || [];
    const files = input.files || [];

    if (images.length > 0 && files.length > 0) {
      throw new AppError(
        'MESSAGING_ATTACHMENT_MIXED',
        400,
        'Không thể gửi đồng thời cả ảnh và tệp đính kèm trong một tin nhắn'
      );
    }

    if (images.length > MESSAGE_MAX_IMAGES || files.length > 1) {
      throw new AppError(
        'MESSAGING_ATTACHMENT_LIMIT',
        400,
        'Mỗi tin nhắn chỉ được đính kèm tối đa 4 ảnh hoặc 1 tệp'
      );
    }

    if (!trimmedText && images.length === 0 && files.length === 0) {
      throw new AppError(
        'MESSAGING_CONTENT_EMPTY',
        400,
        'Tin nhắn phải có nội dung văn bản hoặc tệp đính kèm'
      );
    }

    const validatedAttachments: ValidatedAttachment[] = [];
    for (const img of images) {
      validatedAttachments.push(await normalizeMessageImage(img));
    }
    for (const f of files) {
      validatedAttachments.push(await validateMessageFile(f));
    }

    const normalizedParentId = input.parentId ?? null;
    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          text: trimmedText ?? '',
          parentId: normalizedParentId,
          attachments: validatedAttachments.map((a) => ({
            kind: a.kind,
            sha256: a.sha256,
          })),
        })
      )
      .digest('hex');

    // Follow §13.9 step 1: write validated files to private storage before inserting rows
    const writtenStorageKeys: string[] = [];
    try {
      for (const att of validatedAttachments) {
        const key = await privateMediaStorage.writeAtomic(att.bytes, att.extension);
        writtenStorageKeys.push(key);
      }

      const txResult = await db.transaction(async (tx) => {
        // Lock order: USERS -> CONVERSATIONS (Tech Design §7.4)
        await messagingRepository.lockUsersAscending([actorId], tx);
        const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
        if (!lockedConv) {
          throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
        }

        // Check actor still has read/active membership before looking up replay
        const { conversation, members, myMember } = await this.getConversationAccess(
          actorId,
          conversationId,
          tx
        );

        // Replay lookup BEFORE quota checks (MSG-04 requirement 1)
        const [existingMsg] = await tx
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              eq(messages.senderId, actorId),
              eq(messages.clientMessageId, input.clientMessageId)
            )
          )
          .limit(1);

        if (existingMsg) {
          if (existingMsg.contentHash !== contentHash) {
            logger.warn('Message clientMessageId conflict', {
              conversationId,
              senderId: actorId,
              clientMessageId: input.clientMessageId,
            });
            throw new AppError(
              'MESSAGING_CLIENT_ID_CONFLICT',
              409,
              'clientMessageId đã được sử dụng với nội dung khác'
            );
          }
          const [dto] = await messagingRepository.enrichMessageRows([existingMsg], actorId, tx);
          return { message: dto, created: false };
        }

        // Current send permission check (§7.2)
        if (conversation.type === 'DIRECT') {
          const counterpart = members.find((m) => m.userId !== actorId);
          if (!counterpart) {
            throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
          }
          const players = await messagingRepository.findPlayersByIds([counterpart.userId], tx);
          const cp = players.get(counterpart.userId);
          const blocked = await messagingRepository.isBlockedEitherWay(
            actorId,
            counterpart.userId,
            tx
          );
          if (!cp || !cp.isActive || blocked) {
            throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
          }
        } else if (
          conversation.type === 'GROUP' &&
          conversation.isLocked &&
          (conversation.systemKind !== null || conversation.createdBy !== actorId)
        ) {
          throw new AppError('MESSAGING_GROUP_LOCKED', 403, 'Nhóm đang khóa gửi tin nhắn');
        }

        if (normalizedParentId !== null) {
          const [parentMsg] = await tx
            .select()
            .from(messages)
            .where(
              and(
                eq(messages.id, normalizedParentId),
                eq(messages.conversationId, conversationId),
                sql`${messages.deletedAt} IS NULL`,
                sql`NOT EXISTS (
                  SELECT 1 FROM message_hides mh
                  WHERE mh.message_id = ${messages.id}
                    AND mh.user_id = ${actorId}
                )`
              )
            )
            .limit(1);
          if (!parentMsg) {
            throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Parent message not found');
          }
        }

        // Per-minute message rate limit
        const recentCountRes = await tx.execute(sql`
          SELECT COUNT(*)::int AS cnt
          FROM messages
          WHERE sender_id = ${actorId}
            AND created_at >= now() - interval '60 seconds'
        `);
        const recentCount = Number(recentCountRes.rows[0]?.cnt ?? 0);
        if (recentCount >= cfg.messagesPerMinute) {
          logger.warn('Message per-minute rate limit exceeded', { senderId: actorId });
          const err = new AppError(
            'MESSAGING_RATE_LIMITED',
            429,
            'Bạn đang gửi tin nhắn quá nhanh, vui lòng thử lại sau ít phút'
          );
          (err as any).retryAfterSeconds = 60;
          throw err;
        }

        // New direct conversations per day quota (applies only when starting a new direct conversation)
        if (
          conversation.type === 'DIRECT' &&
          myMember.firstSentAt === null &&
          lockedConv.lastSeq === 0
        ) {
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const newDirectRes = await tx.execute(sql`
            SELECT COUNT(*)::int AS cnt
            FROM conversation_members cm
            INNER JOIN conversations c ON c.id = cm.conversation_id
            WHERE cm.user_id = ${actorId}
              AND c.type = 'DIRECT'
              AND cm.first_sent_at >= ${dayStart}
          `);
          const newDirectCount = Number(newDirectRes.rows[0]?.cnt ?? 0);
          if (newDirectCount >= cfg.newDirectConversationsPerDay) {
            logger.warn('New direct conversations per day quota exceeded', { senderId: actorId });
            const err = new AppError(
              'MESSAGING_RATE_LIMITED',
              429,
              'Bạn đã đạt giới hạn bắt đầu cuộc trò chuyện 1-1 mới trong ngày hôm nay'
            );
            (err as any).retryAfterSeconds = 3600;
            throw err;
          }
        }

        const nextSeq = lockedConv.lastSeq + 1;
        const nextActivityVersion = lockedConv.activityVersion + 1;
        const now = new Date();

        await tx
          .update(conversations)
          .set({
            lastSeq: nextSeq,
            activityVersion: nextActivityVersion,
            lastMessageAt: now,
          })
          .where(eq(conversations.id, conversationId));

        const [insertedMsg] = await tx
          .insert(messages)
          .values({
            conversationId,
            seq: nextSeq,
            senderId: actorId,
            parentId: normalizedParentId,
            body: trimmedText,
            clientMessageId: input.clientMessageId,
            contentHash,
            reactionVersion: 0,
            createdAt: now,
          })
          .returning();

        for (let i = 0; i < validatedAttachments.length; i++) {
          const att = validatedAttachments[i];
          const storageKey = writtenStorageKeys[i];
          const [insertedMedia] = await tx
            .insert(mediaFiles)
            .values({
              ownerId: actorId,
              kind: att.kind,
              mimeType: att.mimeType,
              byteSize: att.byteSize,
              sha256: att.sha256,
              storageKey,
              originalName: att.originalName,
              state: 'READY',
              createdAt: now,
            })
            .returning();

          await tx.insert(messageAttachments).values({
            messageId: insertedMsg.id,
            mediaId: insertedMedia.id,
            position: i + 1,
          });
        }

        await tx
          .update(conversationMembers)
          .set({
            lastReadSeq: Math.max(myMember.lastReadSeq, nextSeq),
            firstSentAt: myMember.firstSentAt ?? now,
            updatedAt: now,
          })
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              eq(conversationMembers.userId, actorId)
            )
          );

        const [dto] = await messagingRepository.enrichMessageRows([insertedMsg], actorId, tx);
        return { message: dto, created: true };
      });

      if (!txResult.created) {
        // Replay returned existing message; clean up duplicate disk files written for this retry
        for (const key of writtenStorageKeys) {
          await privateMediaStorage.removeBestEffort(key);
        }
        return txResult;
      }

      await messagingWsHub.broadcastConversationEvent(
        conversationId,
        'message.created',
        txResult.message,
        actorId
      );

      return txResult;
    } catch (err) {
      for (const key of writtenStorageKeys) {
        await privateMediaStorage.removeBestEffort(key);
      }
      throw err;
    }
  }

  async editMessage(actorId: number, messageId: number, newText: string): Promise<MessageDto> {
    await this.requireEnabled();

    const [msgLookup] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msgLookup) {
      throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
    }

    const updatedDto = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(msgLookup.conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }

      const { conversation, members } = await this.getConversationAccess(
        actorId,
        msgLookup.conversationId,
        tx
      );

      if (conversation.type === 'DIRECT') {
        const counterpart = members.find((m) => m.userId !== actorId);
        if (!counterpart) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
        const players = await messagingRepository.findPlayersByIds([counterpart.userId], tx);
        const cp = players.get(counterpart.userId);
        const blocked = await messagingRepository.isBlockedEitherWay(
          actorId,
          counterpart.userId,
          tx
        );
        if (!cp || !cp.isActive || blocked) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      } else if (
        conversation.type === 'GROUP' &&
        conversation.isLocked &&
        (conversation.systemKind !== null || conversation.createdBy !== actorId)
      ) {
        throw new AppError('MESSAGING_GROUP_LOCKED', 403, 'Nhóm đang khóa gửi tin nhắn');
      }

      const msgLockRes = await tx.execute(
        sql`SELECT id, sender_id, deleted_at FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0] as Record<string, unknown> | undefined;
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }

      const hiddenRes = await tx.execute(sql`
        SELECT 1 FROM message_hides WHERE message_id = ${messageId} AND user_id = ${actorId} LIMIT 1
      `);
      if (hiddenRes.rows.length > 0) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }

      if (Number(lockedMsg.sender_id) !== actorId) {
        throw new AppError('FORBIDDEN', 403, 'Chỉ người gửi mới có thể chỉnh sửa tin nhắn này');
      }
      if (lockedMsg.deleted_at !== null) {
        throw new AppError('MESSAGING_MESSAGE_RECALLED', 409, 'Không thể chỉnh sửa tin nhắn đã thu hồi');
      }

      const nextActivityVersion = lockedConv.activityVersion + 1;
      const now = new Date();

      await tx
        .update(conversations)
        .set({ activityVersion: nextActivityVersion })
        .where(eq(conversations.id, msgLookup.conversationId));

      const [updatedMsg] = await tx
        .update(messages)
        .set({
          body: newText.trim(),
          editedAt: now,
          reactionVersion: nextActivityVersion,
        })
        .where(eq(messages.id, messageId))
        .returning();

      const [dto] = await messagingRepository.enrichMessageRows([updatedMsg], actorId, tx);
      return dto;
    });

    await messagingWsHub.broadcastConversationEvent(
      updatedDto.conversationId,
      'message.updated',
      updatedDto,
      actorId
    );

    return updatedDto;
  }

  async recallMessage(actorId: number, messageId: number): Promise<MessageDto> {
    await this.requireEnabled();

    const [msgLookup] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msgLookup) {
      throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
    }

    const recalledDto = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(msgLookup.conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }

      const { conversation } = await this.getConversationAccess(
        actorId,
        msgLookup.conversationId,
        tx
      );

      const msgLockRes = await tx.execute(
        sql`SELECT id, sender_id, deleted_at FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0] as Record<string, unknown> | undefined;
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }

      const isSender = Number(lockedMsg.sender_id) === actorId;
      const isGroupOwner =
        conversation.type === 'GROUP' && conversation.createdBy === actorId;
      if (!isSender && !isGroupOwner) {
        throw new AppError('FORBIDDEN', 403, 'Bạn không có quyền thu hồi tin nhắn này');
      }
      if (lockedMsg.deleted_at !== null) {
        throw new AppError('MESSAGING_MESSAGE_RECALLED', 409, 'Tin nhắn đã được thu hồi trước đó');
      }

      const nextActivityVersion = lockedConv.activityVersion + 1;
      const now = new Date();

      await tx
        .update(conversations)
        .set({ activityVersion: nextActivityVersion })
        .where(eq(conversations.id, msgLookup.conversationId));

      const [updatedMsg] = await tx
        .update(messages)
        .set({
          deletedAt: now,
          deletedByUserId: actorId,
          reactionVersion: nextActivityVersion,
        })
        .where(eq(messages.id, messageId))
        .returning();

      const [dto] = await messagingRepository.enrichMessageRows([updatedMsg], actorId, tx);
      return dto;
    });

    await messagingWsHub.broadcastConversationEvent(
      recalledDto.conversationId,
      'message.recalled',
      recalledDto,
      actorId
    );

    return recalledDto;
  }

  async hideMessageForMe(actorId: number, messageId: number): Promise<void> {
    await this.requireEnabled();

    const [msgLookup] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msgLookup) {
      throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
    }

    await this.getConversationAccess(actorId, msgLookup.conversationId);

    await db
      .insert(messageHides)
      .values({ messageId, userId: actorId })
      .onConflictDoNothing();
  }

  async downloadMedia(
    actorId: number,
    mediaId: number,
    actorRole: string = 'PLAYER'
  ): Promise<{
    bytes: Buffer;
    mimeType: string;
    kind: 'IMAGE' | 'FILE';
    originalName: string | null;
  } | null> {
    const [row] = await db
      .select({
        media: mediaFiles,
        messageId: messages.id,
        conversationId: messages.conversationId,
        deletedAt: messages.deletedAt,
      })
      .from(mediaFiles)
      .innerJoin(messageAttachments, eq(messageAttachments.mediaId, mediaFiles.id))
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);

    if (!row) {
      return null;
    }

    if (actorRole !== 'PLAYER' || row.deletedAt !== null) {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Media not found');
    }

    // Check caller currently has read access (ACTIVE member) to the owning conversation (§7.2)
    await this.getConversationAccess(actorId, row.conversationId);

    const [hidden] = await db
      .select({ messageId: messageHides.messageId })
      .from(messageHides)
      .where(and(eq(messageHides.messageId, row.messageId), eq(messageHides.userId, actorId)))
      .limit(1);
    if (hidden) {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Media not found');
    }

    if (row.media.state === 'MISSING') {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Media not found');
    }

    const bytes = await privateMediaStorage.readBytes(row.media.storageKey);
    if (!bytes) {
      await db
        .update(mediaFiles)
        .set({ state: 'MISSING' })
        .where(eq(mediaFiles.id, mediaId));
      logger.warn('Private media file missing on disk; marked MISSING', { mediaId });
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Media not found');
    }

    return {
      bytes,
      mimeType: row.media.mimeType,
      kind: row.media.kind as 'IMAGE' | 'FILE',
      originalName: row.media.originalName ?? null,
    };
  }

  async listMessagesHistory(
    actorId: number,
    conversationId: number,
    beforeSeq?: number,
    limit = 30
  ): Promise<{
    data: MessageDto[];
    meta: { limit: number; nextBeforeSeq: number | null };
  }> {
    await this.getConversationAccess(actorId, conversationId);

    const conditions = [
      eq(messages.conversationId, conversationId),
      sql`NOT EXISTS (
        SELECT 1 FROM message_hides mh
        WHERE mh.message_id = ${messages.id}
          AND mh.user_id = ${actorId}
      )`,
    ];
    if (beforeSeq !== undefined) {
      conditions.push(sql`${messages.seq} < ${beforeSeq}`);
    }

    const msgRows = await db
      .select()
      .from(messages)
      .where(and(...conditions))
      .orderBy(desc(messages.seq))
      .limit(limit);

    const dtos = await messagingRepository.enrichMessageRows(msgRows, actorId);
    const lastRow = msgRows[msgRows.length - 1];
    const nextBeforeSeq =
      msgRows.length === limit && lastRow && lastRow.seq > 1 ? lastRow.seq : null;

    return {
      data: dtos,
      meta: {
        limit,
        nextBeforeSeq,
      },
    };
  }

  async syncConversation(
    actorId: number,
    conversationId: number,
    params: { afterSeq: number; sinceVersion: number; minLoadedSeq: number }
  ): Promise<{
    messages: MessageDto[];
    nextAfterSeq: number;
    hasMore: boolean;
    changedReactions: Array<{
      messageId: number;
      seq: number;
      reactionVersion: number;
      reactions: MessageReactionSummaryDto[];
    }>;
    nextSinceVersion: number;
    presence?: Array<{ userId: number; lastSeenAt: string; isOnline: boolean }>;
    typing?: Array<{ userId: number; expiresAt: string }>;
  }> {
    const cfg = await messagingConfig.get();

    return db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);

      const { conversation, members } = await this.getConversationAccess(
        actorId,
        conversationId,
        tx
      );

      const rawMsgRows = await tx
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            sql`${messages.seq} > ${params.afterSeq}`,
            sql`NOT EXISTS (
              SELECT 1 FROM message_hides mh
              WHERE mh.message_id = ${messages.id}
                AND mh.user_id = ${actorId}
            )`
          )
        )
        .orderBy(asc(messages.seq))
        .limit(101);

      const hasMore = rawMsgRows.length > 100;
      const pageRows = hasMore ? rawMsgRows.slice(0, 100) : rawMsgRows;
      const nextAfterSeq =
        pageRows.length > 0 ? pageRows[pageRows.length - 1].seq : params.afterSeq;

      const enrichedMessages = await messagingRepository.enrichMessageRows(pageRows, actorId, tx);

      // Changed reaction summaries in [minLoadedSeq, nextAfterSeq] with reaction_version > sinceVersion
      let changedReactions: Array<{
        messageId: number;
        seq: number;
        reactionVersion: number;
        reactions: MessageReactionSummaryDto[];
      }> = [];

      if (nextAfterSeq >= params.minLoadedSeq) {
        const changedMsgRows = await tx
          .select({
            id: messages.id,
            seq: messages.seq,
            reactionVersion: messages.reactionVersion,
          })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, conversationId),
              sql`${messages.seq} >= ${params.minLoadedSeq}`,
              sql`${messages.seq} <= ${nextAfterSeq}`,
              sql`${messages.reactionVersion} > ${params.sinceVersion}`
            )
          )
          .orderBy(asc(messages.seq));

        if (changedMsgRows.length > 0) {
          const reactionMap = await messagingRepository.buildReactionSummariesByMessageIds(
            changedMsgRows.map((m) => m.id),
            actorId,
            tx
          );
          changedReactions = changedMsgRows.map((m) => ({
            messageId: m.id,
            seq: m.seq,
            reactionVersion: m.reactionVersion,
            reactions: reactionMap.get(m.id) || [],
          }));
        }
      }

      const nextSinceVersion = hasMore ? params.sinceVersion : conversation.activityVersion;

      if (!cfg.enabled) {
        return {
          messages: enrichedMessages,
          nextAfterSeq,
          hasMore,
          changedReactions,
          nextSinceVersion,
        };
      }

      const activeMemberIds = members.filter((m) => m.state === 'ACTIVE').map((m) => m.userId);
      const { presence, typing } = await messagingRepository.getConversationPresenceAndTyping(
        actorId,
        conversationId,
        conversation.type as 'DIRECT' | 'GROUP',
        activeMemberIds,
        tx
      );

      return {
        messages: enrichedMessages,
        nextAfterSeq,
        hasMore,
        changedReactions,
        nextSinceVersion,
        presence,
        typing,
      };
    });
  }

  async markConversationRead(
    actorId: number,
    conversationId: number,
    seq: number
  ): Promise<{ conversationId: number; lastReadSeq: number }> {
    const newLastReadSeq = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }
      const { myMember } = await this.getConversationAccess(actorId, conversationId, tx);

      const computed = Math.max(myMember.lastReadSeq, Math.min(seq, lockedConv.lastSeq));
      if (computed !== myMember.lastReadSeq) {
        await tx
          .update(conversationMembers)
          .set({ lastReadSeq: computed, updatedAt: new Date() })
          .where(
            and(
              eq(conversationMembers.conversationId, conversationId),
              eq(conversationMembers.userId, actorId)
            )
          );
      }
      return computed;
    });

    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.read_updated',
      {
        conversationId,
        userId: actorId,
        lastReadSeq: newLastReadSeq,
      },
      actorId
    );

    return { conversationId, lastReadSeq: newLastReadSeq };
  }

  async setMessageReaction(
    actorId: number,
    messageId: number,
    type: MessageReactionType
  ): Promise<{
    messageId: number;
    conversationId: number;
    seq: number;
    reactionVersion: number;
    reactions: MessageReactionSummaryDto[];
  }> {
    await this.requireEnabled();

    // Resolve conversation ID without locking message first (Tech Design §7.5)
    const [msgLookup] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msgLookup) {
      throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
    }

    const result = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(msgLookup.conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }

      const { conversation, members } = await this.getConversationAccess(
        actorId,
        msgLookup.conversationId,
        tx
      );

      if (conversation.type === 'DIRECT') {
        const counterpart = members.find((m) => m.userId !== actorId);
        if (!counterpart) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
        const players = await messagingRepository.findPlayersByIds([counterpart.userId], tx);
        const cp = players.get(counterpart.userId);
        const blocked = await messagingRepository.isBlockedEitherWay(
          actorId,
          counterpart.userId,
          tx
        );
        if (!cp || !cp.isActive || blocked) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      } else if (conversation.type === 'GROUP' && conversation.isLocked && (conversation.systemKind !== null || conversation.createdBy !== actorId)) {
        throw new AppError('MESSAGING_GROUP_LOCKED', 403, 'Nhóm đang khóa gửi tin nhắn');
      }

      const msgLockRes = await tx.execute(
        sql`SELECT id, seq, deleted_at FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0];
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }
      if (lockedMsg.deleted_at !== null) {
        throw new AppError(
          'MESSAGING_MESSAGE_RECALLED',
          409,
          'Không thể thả cảm xúc vào tin nhắn đã thu hồi'
        );
      }

      const nextActivityVersion = lockedConv.activityVersion + 1;
      const now = new Date();

      await tx
        .insert(messageReactions)
        .values({
          messageId,
          userId: actorId,
          type,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [messageReactions.messageId, messageReactions.userId],
          set: { type, updatedAt: now },
        });

      await tx
        .update(conversations)
        .set({ activityVersion: nextActivityVersion })
        .where(eq(conversations.id, msgLookup.conversationId));

      await tx
        .update(messages)
        .set({ reactionVersion: nextActivityVersion })
        .where(eq(messages.id, messageId));

      const reactionMap = await messagingRepository.buildReactionSummariesByMessageIds(
        [messageId],
        actorId,
        tx
      );

      return {
        messageId,
        conversationId: msgLookup.conversationId,
        seq: Number(lockedMsg.seq),
        reactionVersion: nextActivityVersion,
        reactions: reactionMap.get(messageId) || [],
      };
    });

    await messagingWsHub.broadcastConversationEvent(
      result.conversationId,
      'message.reaction_updated',
      result,
      actorId
    );

    return result;
  }

  async removeMessageReaction(
    actorId: number,
    messageId: number
  ): Promise<{
    messageId: number;
    conversationId: number;
    seq: number;
    reactionVersion: number;
    reactions: MessageReactionSummaryDto[];
  }> {
    await this.requireEnabled();

    const [msgLookup] = await db
      .select({ id: messages.id, conversationId: messages.conversationId })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!msgLookup) {
      throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
    }

    const result = await db.transaction(async (tx) => {
      const lockedConv = await messagingRepository.lockConversation(msgLookup.conversationId, tx);
      if (!lockedConv) {
        throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Conversation not found');
      }

      const { conversation, members } = await this.getConversationAccess(
        actorId,
        msgLookup.conversationId,
        tx
      );

      if (conversation.type === 'DIRECT') {
        const counterpart = members.find((m) => m.userId !== actorId);
        if (!counterpart) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
        const players = await messagingRepository.findPlayersByIds([counterpart.userId], tx);
        const cp = players.get(counterpart.userId);
        const blocked = await messagingRepository.isBlockedEitherWay(
          actorId,
          counterpart.userId,
          tx
        );
        if (!cp || !cp.isActive || blocked) {
          throw new AppError('MESSAGING_ACTION_NOT_AVAILABLE', 409, 'Action not available');
        }
      } else if (conversation.type === 'GROUP' && conversation.isLocked && (conversation.systemKind !== null || conversation.createdBy !== actorId)) {
        throw new AppError('MESSAGING_GROUP_LOCKED', 403, 'Nhóm đang khóa gửi tin nhắn');
      }

      const msgLockRes = await tx.execute(
        sql`SELECT id, seq, deleted_at FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0];
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }
      if (lockedMsg.deleted_at !== null) {
        throw new AppError(
          'MESSAGING_MESSAGE_RECALLED',
          409,
          'Không thể thả cảm xúc vào tin nhắn đã thu hồi'
        );
      }

      const nextActivityVersion = lockedConv.activityVersion + 1;
      const now = new Date();

      await tx
        .delete(messageReactions)
        .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, actorId)));

      await tx
        .update(conversations)
        .set({ activityVersion: nextActivityVersion })
        .where(eq(conversations.id, msgLookup.conversationId));

      await tx
        .update(messages)
        .set({ reactionVersion: nextActivityVersion })
        .where(eq(messages.id, messageId));

      const reactionMap = await messagingRepository.buildReactionSummariesByMessageIds(
        [messageId],
        actorId,
        tx
      );

      return {
        messageId,
        conversationId: msgLookup.conversationId,
        seq: Number(lockedMsg.seq),
        reactionVersion: nextActivityVersion,
        reactions: reactionMap.get(messageId) || [],
      };
    });

    await messagingWsHub.broadcastConversationEvent(
      result.conversationId,
      'message.reaction_updated',
      result,
      actorId
    );

    return result;
  }
}

export const messagingService = new MessagingService();
registerBlockPort(messagingService);

