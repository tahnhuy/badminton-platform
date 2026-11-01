import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  conversations,
  conversationMembers,
  messages,
  userBlocks,
  userPresence,
  matchmakingInvitations,
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
      sql`SELECT id, type, title, created_by, direct_user_low_id, direct_user_high_id, last_seq, activity_version, last_message_at, created_at FROM conversations WHERE id = ${conversationId} FOR UPDATE`
    );
    return res.rows[0] as Record<string, unknown> | undefined;
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
      .where(eq(conversations.id, conversationId));
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
        INNER JOIN messages m
          ON m.conversation_id = cm.conversation_id
         AND m.seq > cm.last_read_seq
         AND m.sender_id <> ${actorId}
        WHERE cm.user_id = ${actorId}
          AND cm.state = 'ACTIVE'
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

  async closePendingInvitationsBetween(userAId: number, userBId: number, tx: DbExecutor): Promise<void> {
    const pendingRows = await tx
      .select({ id: matchmakingInvitations.id })
      .from(matchmakingInvitations)
      .where(
        and(
          eq(matchmakingInvitations.status, 'PENDING'),
          or(
            and(
              eq(matchmakingInvitations.inviterId, userAId),
              eq(matchmakingInvitations.inviteeId, userBId)
            ),
            and(
              eq(matchmakingInvitations.inviterId, userBId),
              eq(matchmakingInvitations.inviteeId, userAId)
            )
          )
        )
      )
      .orderBy(asc(matchmakingInvitations.id));

    if (pendingRows.length === 0) return;
    const ids = pendingRows.map((r) => r.id);
    for (const id of ids) {
      await tx.execute(sql`SELECT id FROM matchmaking_invitations WHERE id = ${id} FOR UPDATE`);
    }
    const now = new Date();
    await tx
      .update(matchmakingInvitations)
      .set({ status: 'DECLINED', respondedAt: now, updatedAt: now })
      .where(and(inArray(matchmakingInvitations.id, ids), eq(matchmakingInvitations.status, 'PENDING')));
  },
};

