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
import type { DbExecutor } from '../../repositories/auth/AuthRepository';
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

    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.member_changed',
      { conversationId, actorUserId: actorId, action: 'ADDED', memberIds: targetIds },
      actorId
    );
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
    await messagingWsHub.broadcastConversationEvent(
      conversationId,
      'conversation.member_changed',
      { conversationId, actorUserId: actorId, action: 'LEFT' },
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

      await messagingRepository.closePendingInvitationsBetween(actorId, targetPlayerId, tx);
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

    const contentHash = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          text: trimmedText ?? '',
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
            updatedAt: now,
          })
          .where(eq(conversations.id, conversationId));

        const [insertedMsg] = await tx
          .insert(messages)
          .values({
            conversationId,
            seq: nextSeq,
            senderId: actorId,
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

  async downloadMedia(
    actorId: number,
    mediaId: number
  ): Promise<{
    bytes: Buffer;
    mimeType: string;
    kind: 'IMAGE' | 'FILE';
    originalName: string | null;
  }> {
    const [row] = await db
      .select({
        media: mediaFiles,
        conversationId: messages.conversationId,
      })
      .from(mediaFiles)
      .innerJoin(messageAttachments, eq(messageAttachments.mediaId, mediaFiles.id))
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);

    if (!row) {
      throw new AppError('MESSAGING_CONVERSATION_NOT_FOUND', 404, 'Media not found');
    }

    // Check caller currently has read access (ACTIVE member) to the owning conversation (§7.2)
    await this.getConversationAccess(actorId, row.conversationId);

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

    const conditions = [eq(messages.conversationId, conversationId)];
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
            sql`${messages.seq} > ${params.afterSeq}`
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
      }

      const msgLockRes = await tx.execute(
        sql`SELECT id, seq FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0];
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
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
        .set({ activityVersion: nextActivityVersion, updatedAt: now })
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
      }

      const msgLockRes = await tx.execute(
        sql`SELECT id, seq FROM messages WHERE id = ${messageId} FOR UPDATE`
      );
      const lockedMsg = msgLockRes.rows[0];
      if (!lockedMsg) {
        throw new AppError('MESSAGING_MESSAGE_NOT_FOUND', 404, 'Message not found');
      }

      const nextActivityVersion = lockedConv.activityVersion + 1;
      const now = new Date();

      await tx
        .delete(messageReactions)
        .where(and(eq(messageReactions.messageId, messageId), eq(messageReactions.userId, actorId)));

      await tx
        .update(conversations)
        .set({ activityVersion: nextActivityVersion, updatedAt: now })
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

