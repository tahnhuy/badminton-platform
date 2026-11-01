import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  conversations,
  conversationMembers,
  messages,
  mediaFiles,
  messageAttachments,
  messageReactions,
  messageHides,
  userBlocks,
  userPresence,
  conversationTyping,
} from '../../db';
import type { DbExecutor } from '../auth/AuthRepository';

export interface PlayerDisplayDto {
  id: number;
  fullName: string;
  avatarUrl: string | null;
  skillLevel: { id: number; code: string; name: string; rank: number } | null;
  isActive: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface ConversationMemberDto extends PlayerDisplayDto {
  state: 'ACTIVE' | 'LEFT';
  lastReadSeq: number;
  joinedAt: string;
}

export type MessageReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

export interface MessageAttachmentDto {
  id: number;
  mediaId: number;
  kind: 'IMAGE' | 'FILE';
  mimeType: string;
  byteSize: number;
  originalName: string | null;
  position: number;
  url: string;
}

export interface MessageReactionSummaryDto {
  type: MessageReactionType;
  count: number;
  reactedByMe: boolean;
}

export interface ParentMessageSnippetDto {
  id: number;
  seq: number;
  senderId: number;
  senderName: string;
  body: string | null;
  hasAttachments: boolean;
  isRecalled: boolean;
}

export interface MessageDto {
  id: number;
  conversationId: number;
  seq: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl: string | null;
  parentId: number | null;
  parentMessage: ParentMessageSnippetDto | null;
  body: string | null;
  clientMessageId: string;
  reactionVersion: number;
  editedAt: string | null;
  deletedAt: string | null;
  deletedByUserId: number | null;
  attachments: MessageAttachmentDto[];
  reactions: MessageReactionSummaryDto[];
  createdAt: string;
}

export const messagingRepository = {
  async isBlockedEitherWay(userAId: number, userBId: number, executor: DbExecutor = db): Promise<boolean> {
    if (userAId === userBId) return false;
    const rows = await executor
      .select({ blockerId: userBlocks.blockerId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, userAId), eq(userBlocks.blockedId, userBId)),
          and(eq(userBlocks.blockerId, userBId), eq(userBlocks.blockedId, userAId))
        )
      )
      .limit(1);
    return rows.length > 0;
  },

  async findBlockedPairUserIds(actorId: number, targetIds: number[], executor: DbExecutor = db): Promise<Set<number>> {
    if (targetIds.length === 0) return new Set();
    const rows = await executor
      .select({ blockerId: userBlocks.blockerId, blockedId: userBlocks.blockedId })
      .from(userBlocks)
      .where(
        or(
          and(eq(userBlocks.blockerId, actorId), inArray(userBlocks.blockedId, targetIds)),
          and(inArray(userBlocks.blockerId, targetIds), eq(userBlocks.blockedId, actorId))
        )
      );
    const blocked = new Set<number>();
    for (const r of rows) {
      blocked.add(r.blockerId === actorId ? r.blockedId : r.blockerId);
    }
    return blocked;
  },

  async lockUsersAscending(userIds: number[], tx: DbExecutor): Promise<void> {
    const uniqueSorted = Array.from(new Set(userIds)).sort((a, b) => a - b);
    for (const uid of uniqueSorted) {
      await tx.execute(sql`SELECT id FROM users WHERE id = ${uid} FOR UPDATE`);
    }
  },

  async lockConversation(conversationId: number, tx: DbExecutor) {
    const res = await tx.execute(
      sql`SELECT id, type, title, created_by, is_locked, status, dissolved_at, direct_user_low_id, direct_user_high_id, last_seq, activity_version, last_message_at, created_at FROM conversations WHERE id = ${conversationId} AND status = 'ACTIVE' FOR UPDATE`
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: Number(row.id),
      type: String(row.type) as 'DIRECT' | 'GROUP',
      title: row.title ? String(row.title) : null,
      createdBy: row.created_by !== null ? Number(row.created_by) : null,
      isLocked: Boolean(row.is_locked),
      status: String(row.status) as 'ACTIVE' | 'DISSOLVED',
      lastSeq: Number(row.last_seq ?? 0),
      activityVersion: Number(row.activity_version ?? 0),
    };
  },

  async findPlayersByIds(userIds: number[], executor: DbExecutor = db): Promise<Map<number, PlayerDisplayDto & { role: string }>> {
    if (userIds.length === 0) return new Map();
    const rows = await executor
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
        skillId: skillLevels.id,
        skillCode: skillLevels.code,
        skillName: skillLevels.name,
        skillRank: skillLevels.rank,
        lastSeenAt: userPresence.lastSeenAt,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .leftJoin(userPresence, eq(userPresence.userId, users.id))
      .where(inArray(users.id, userIds));

    const map = new Map<number, PlayerDisplayDto & { role: string }>();
    const nowMs = Date.now();
    for (const r of rows) {
      const isActive = r.deletedAt === null && r.status === 'ACTIVE';
      const seenMs = r.lastSeenAt ? new Date(r.lastSeenAt).getTime() : 0;
      map.set(r.id, {
        id: r.id,
        role: r.role,
        fullName: isActive ? r.fullName || `Người chơi #${r.id}` : 'Tài khoản không khả dụng',
        avatarUrl: isActive ? r.avatarUrl ?? null : null,
        skillLevel:
          isActive && r.skillId
            ? { id: r.skillId, code: r.skillCode!, name: r.skillName!, rank: r.skillRank! }
            : null,
        isActive,
        isOnline: isActive && seenMs > 0 && nowMs - seenMs <= 60_000,
        lastSeenAt: isActive && r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
      });
    }
    return map;
  },

  async searchPlayers(actorId: number, query: string, limit: number): Promise<PlayerDisplayDto[]> {
    const trimmed = query.trim();
    const pattern = `%${trimmed}%`;
    const rows = await db
      .select({
        id: users.id,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
        skillId: skillLevels.id,
        skillCode: skillLevels.code,
        skillName: skillLevels.name,
        skillRank: skillLevels.rank,
      })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(
        and(
          eq(users.role, 'PLAYER'),
          eq(users.status, 'ACTIVE'),
          isNull(users.deletedAt),
          ne(users.id, actorId),
          trimmed ? sql`${playerProfiles.fullName} ILIKE ${pattern}` : sql`true`,
          sql`NOT EXISTS (
            SELECT 1 FROM user_blocks ub
            WHERE (ub.blocker_id = ${actorId} AND ub.blocked_id = ${users.id})
               OR (ub.blocker_id = ${users.id} AND ub.blocked_id = ${actorId})
          )`
        )
      )
      .orderBy(asc(playerProfiles.fullName), asc(users.id))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      avatarUrl: r.avatarUrl ?? null,
      skillLevel: r.skillId
        ? { id: r.skillId, code: r.skillCode!, name: r.skillName!, rank: r.skillRank! }
        : null,
      isActive: true,
    }));
  },

  async getConversationWithMembers(conversationId: number, executor: DbExecutor = db) {
    const [conv] = await executor
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.status, 'ACTIVE')));
    if (!conv) return null;

    const memberRows = await executor
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId))
      .orderBy(asc(conversationMembers.joinedAt), asc(conversationMembers.userId));

    return { conversation: conv, members: memberRows };
  },

  async getUnreadSummary(actorId: number): Promise<number> {
    const res = await db.execute(sql`
      SELECT COALESCE(SUM(sub.unread_count), 0)::int AS total_unread
      FROM (
        SELECT COUNT(m.id) AS unread_count
        FROM conversation_members cm
        INNER JOIN conversations c
          ON c.id = cm.conversation_id
         AND c.status = 'ACTIVE'
        INNER JOIN messages m
          ON m.conversation_id = cm.conversation_id
         AND m.seq > cm.last_read_seq
         AND m.sender_id <> ${actorId}
        WHERE cm.user_id = ${actorId}
          AND cm.state = 'ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM message_hides mh
            WHERE mh.message_id = m.id
              AND mh.user_id = ${actorId}
          )
        GROUP BY cm.conversation_id
      ) sub
    `);
    return Number(res.rows[0]?.total_unread ?? 0);
  },

  async listBlocks(blockerId: number) {
    const rows = await db
      .select({
        blockedId: userBlocks.blockedId,
        createdAt: userBlocks.createdAt,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(userBlocks)
      .innerJoin(users, eq(users.id, userBlocks.blockedId))
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(eq(userBlocks.blockerId, blockerId))
      .orderBy(desc(userBlocks.createdAt), asc(userBlocks.blockedId));

    return rows.map((r) => ({
      playerId: r.blockedId,
      fullName: r.fullName || `Người chơi #${r.blockedId}`,
      avatarUrl: r.avatarUrl ?? null,
      blockedAt: r.createdAt.toISOString(),
    }));
  },

  async upsertHeartbeatWithThrottle(
    userId: number,
    now: Date = new Date()
  ): Promise<{ lastSeenAt: Date; updated: boolean }> {
    const [existing] = await db
      .select({ lastSeenAt: userPresence.lastSeenAt })
      .from(userPresence)
      .where(eq(userPresence.userId, userId))
      .limit(1);

    if (existing && now.getTime() - existing.lastSeenAt.getTime() <= 15_000) {
      return { lastSeenAt: existing.lastSeenAt, updated: false };
    }

    await db
      .insert(userPresence)
      .values({ userId, lastSeenAt: now })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: { lastSeenAt: now },
      });

    return { lastSeenAt: now, updated: true };
  },

  async upsertTypingWithThrottle(
    conversationId: number,
    userId: number,
    tx: DbExecutor,
    now: Date = new Date()
  ): Promise<{ expiresAt: Date; updated: boolean }> {
    await tx.execute(sql`DELETE FROM conversation_typing WHERE expires_at <= ${now}`);

    const [existing] = await tx
      .select({ expiresAt: conversationTyping.expiresAt })
      .from(conversationTyping)
      .where(
        and(
          eq(conversationTyping.conversationId, conversationId),
          eq(conversationTyping.userId, userId)
        )
      )
      .limit(1);

    if (existing && existing.expiresAt.getTime() >= now.getTime() + 3_000) {
      return { expiresAt: existing.expiresAt, updated: false };
    }

    const expiresAt = new Date(now.getTime() + 6_000);
    await tx
      .insert(conversationTyping)
      .values({ conversationId, userId, expiresAt })
      .onConflictDoUpdate({
        target: [conversationTyping.conversationId, conversationTyping.userId],
        set: { expiresAt },
      });

    return { expiresAt, updated: true };
  },

  async getConversationPresenceAndTyping(
    actorId: number,
    conversationId: number,
    conversationType: 'DIRECT' | 'GROUP',
    activeMemberIds: number[],
    executor: DbExecutor = db
  ): Promise<{
    presence: Array<{ userId: number; lastSeenAt: string; isOnline: boolean }>;
    typing: Array<{ userId: number; expiresAt: string }>;
  }> {
    const otherActiveIds = activeMemberIds.filter((id) => id !== actorId);
    if (otherActiveIds.length === 0) {
      return { presence: [], typing: [] };
    }

    const blockedSet = await this.findBlockedPairUserIds(actorId, otherActiveIds, executor);
    const presenceCandidateIds = otherActiveIds.filter((id) => !blockedSet.has(id));
    const typingCandidateIds =
      conversationType === 'DIRECT'
        ? otherActiveIds.filter((id) => !blockedSet.has(id))
        : otherActiveIds;

    const nowMs = Date.now();
    const now = new Date(nowMs);

    const presenceRows =
      presenceCandidateIds.length > 0
        ? await executor
            .select({
              userId: userPresence.userId,
              lastSeenAt: userPresence.lastSeenAt,
            })
            .from(userPresence)
            .where(inArray(userPresence.userId, presenceCandidateIds))
        : [];

    const typingRows =
      typingCandidateIds.length > 0
        ? await executor
            .select({
              userId: conversationTyping.userId,
              expiresAt: conversationTyping.expiresAt,
            })
            .from(conversationTyping)
            .where(
              and(
                eq(conversationTyping.conversationId, conversationId),
                inArray(conversationTyping.userId, typingCandidateIds),
                sql`${conversationTyping.expiresAt} > ${now}`
              )
            )
        : [];

    return {
      presence: presenceRows.map((r) => ({
        userId: r.userId,
        lastSeenAt: r.lastSeenAt.toISOString(),
        isOnline: nowMs - r.lastSeenAt.getTime() <= 60_000,
      })),
      typing: typingRows.map((r) => ({
        userId: r.userId,
        expiresAt: r.expiresAt.toISOString(),
      })),
    };
  },

  async buildReactionSummariesByMessageIds(
    messageIds: number[],
    actorId: number,
    executor: DbExecutor = db
  ): Promise<Map<number, MessageReactionSummaryDto[]>> {
    const map = new Map<number, MessageReactionSummaryDto[]>();
    if (messageIds.length === 0) {
      return map;
    }

    const rows = await executor
      .select({
        messageId: messageReactions.messageId,
        userId: messageReactions.userId,
        type: messageReactions.type,
      })
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, messageIds))
      .orderBy(asc(messageReactions.messageId), asc(messageReactions.type));

    const grouped = new Map<number, Map<MessageReactionType, { count: number; reactedByMe: boolean }>>();
    for (const row of rows) {
      const rType = row.type as MessageReactionType;
      let typeMap = grouped.get(row.messageId);
      if (!typeMap) {
        typeMap = new Map();
        grouped.set(row.messageId, typeMap);
      }
      const cur = typeMap.get(rType) || { count: 0, reactedByMe: false };
      cur.count += 1;
      if (row.userId === actorId) {
        cur.reactedByMe = true;
      }
      typeMap.set(rType, cur);
    }

    for (const msgId of messageIds) {
      const typeMap = grouped.get(msgId);
      if (!typeMap) {
        map.set(msgId, []);
        continue;
      }
      const list: MessageReactionSummaryDto[] = [];
      for (const [type, info] of typeMap.entries()) {
        list.push({ type, count: info.count, reactedByMe: info.reactedByMe });
      }
      map.set(msgId, list);
    }

    return map;
  },

  async enrichMessageRows(
    msgRows: Array<typeof messages.$inferSelect>,
    actorId: number,
    executor: DbExecutor = db
  ): Promise<MessageDto[]> {
    if (msgRows.length === 0) {
      return [];
    }

    const msgIds = msgRows.map((m) => m.id);
    const parentIds = Array.from(
      new Set(msgRows.map((m) => m.parentId).filter((pid): pid is number => pid !== null))
    );

    const parentRows =
      parentIds.length > 0
        ? await executor.select().from(messages).where(inArray(messages.id, parentIds))
        : [];
    const parentMap = new Map(parentRows.map((p) => [p.id, p]));

    const senderIds = Array.from(
      new Set([...msgRows.map((m) => m.senderId), ...parentRows.map((p) => p.senderId)])
    );

    const senderRows = await executor
      .select({
        userId: users.id,
        fullName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(inArray(users.id, senderIds));

    const senderMap = new Map(
      senderRows.map((s) => [
        s.userId,
        {
          fullName: s.fullName || `Người chơi #${s.userId}`,
          avatarUrl: s.avatarUrl ?? null,
        },
      ])
    );

    const allAttachmentMsgIds = Array.from(new Set([...msgIds, ...parentIds]));
    const attachmentRows = await executor
      .select({
        id: messageAttachments.id,
        messageId: messageAttachments.messageId,
        mediaId: messageAttachments.mediaId,
        position: messageAttachments.position,
        kind: mediaFiles.kind,
        mimeType: mediaFiles.mimeType,
        byteSize: mediaFiles.byteSize,
        originalName: mediaFiles.originalName,
      })
      .from(messageAttachments)
      .innerJoin(mediaFiles, eq(mediaFiles.id, messageAttachments.mediaId))
      .where(inArray(messageAttachments.messageId, allAttachmentMsgIds))
      .orderBy(asc(messageAttachments.messageId), asc(messageAttachments.position));

    const attachmentMap = new Map<number, MessageAttachmentDto[]>();
    for (const a of attachmentRows) {
      const list = attachmentMap.get(a.messageId) || [];
      list.push({
        id: a.id,
        mediaId: a.mediaId,
        kind: a.kind as 'IMAGE' | 'FILE',
        mimeType: a.mimeType,
        byteSize: a.byteSize,
        originalName: a.originalName ?? null,
        position: a.position,
        url: `/api/v1/media/${a.mediaId}`,
      });
      attachmentMap.set(a.messageId, list);
    }

    const reactionsMap = await this.buildReactionSummariesByMessageIds(msgIds, actorId, executor);

    return msgRows.map((m) => {
      const sender = senderMap.get(m.senderId) || {
        fullName: `Người chơi #${m.senderId}`,
        avatarUrl: null,
      };
      const isRecalled = m.deletedAt !== null;

      let parentMessage: ParentMessageSnippetDto | null = null;
      if (m.parentId !== null) {
        const pRow = parentMap.get(m.parentId);
        if (pRow) {
          const pSender = senderMap.get(pRow.senderId) || {
            fullName: `Người chơi #${pRow.senderId}`,
            avatarUrl: null,
          };
          const pRecalled = pRow.deletedAt !== null;
          const pAttachments = attachmentMap.get(pRow.id) || [];
          parentMessage = {
            id: pRow.id,
            seq: pRow.seq,
            senderId: pRow.senderId,
            senderName: pSender.fullName,
            body: pRecalled ? null : pRow.body ? pRow.body.slice(0, 140) : null,
            hasAttachments: pRecalled ? false : pAttachments.length > 0,
            isRecalled: pRecalled,
          };
        }
      }

      return {
        id: m.id,
        conversationId: m.conversationId,
        seq: m.seq,
        senderId: m.senderId,
        senderName: sender.fullName,
        senderAvatarUrl: sender.avatarUrl,
        parentId: m.parentId ?? null,
        parentMessage,
        body: isRecalled ? null : m.body ?? null,
        clientMessageId: m.clientMessageId,
        reactionVersion: m.reactionVersion,
        editedAt: m.editedAt ? m.editedAt.toISOString() : null,
        deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
        deletedByUserId: m.deletedByUserId ?? null,
        attachments: isRecalled ? [] : attachmentMap.get(m.id) || [],
        reactions: isRecalled ? [] : reactionsMap.get(m.id) || [],
        createdAt: m.createdAt.toISOString(),
      };
    });
  },
};
