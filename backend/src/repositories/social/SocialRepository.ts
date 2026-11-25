import { and, asc, count, desc, eq, inArray, isNull, lte, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db';
import { posts, postImages, postReactions, postComments } from '../../db/schema/social';
import { users, playerProfiles, skillLevels } from '../../db/schema/users';

// Social persistence (database-schema.md §13.2). Lock ranks (Matchmaking Tech Design
// §24.7.2): users(10) → posts(100) → post_comments/post_reactions(105).

type Executor = any;
const TZ = 'Asia/Ho_Chi_Minh';

export const postColumns = {
  id: posts.id,
  authorId: posts.authorId,
  type: posts.type,
  title: posts.title,
  body: posts.body,
  background: posts.background,
  tournamentId: posts.tournamentId,
  publishedAt: posts.publishedAt,
  editedAt: posts.editedAt,
  deletedAt: posts.deletedAt,
  hiddenAt: posts.hiddenAt,
  hiddenBy: posts.hiddenBy,
  clientRequestId: posts.clientRequestId,
  creationHash: posts.creationHash,
  createdAt: posts.createdAt,
};
export type PostRow = {
  id: number; authorId: number; type: string; title: string | null; body: string | null;
  publishedAt: Date | null; editedAt: Date | null; deletedAt: Date | null; hiddenAt: Date | null;
  background?: string | null;
  tournamentId?: number | null;
  hiddenBy: number | null;
  clientRequestId: string | null; creationHash: string | null; createdAt: Date;
};

export const commentColumns = {
  id: postComments.id,
  postId: postComments.postId,
  authorId: postComments.authorId,
  body: postComments.body,
  clientRequestId: postComments.clientRequestId,
  creationHash: postComments.creationHash,
  deletedAt: postComments.deletedAt,
  hiddenAt: postComments.hiddenAt,
  createdAt: postComments.createdAt,
};
export type CommentRow = {
  id: number; postId: number; authorId: number; body: string; clientRequestId: string | null;
  creationHash: string; deletedAt: Date | null; hiddenAt: Date | null; createdAt: Date;
};

export interface FeedPageQuery {
  asOf: Date;
  type?: 'FREE' | 'MATCH_FINDING' | 'TOURNAMENT_RESULT';
  /** Condition restricting match-finding posts (RecruitmentPort.feedFilterSql). */
  recruitmentCondition: SQL;
  /** A recruitment-only filter is active: free posts cannot match it. */
  recruitmentFilterActive: boolean;
  /** Optional play-start ordering (Matchmaking discovery); default published_at DESC, id DESC. */
  orderSql?: SQL;
  /** Authors in a block relationship with the viewer (Social exclusion, 2026-11-23). */
  excludeAuthorIds?: readonly number[];
  page: number;
  limit: number;
}

export class SocialRepository {
  // ------------------------------------------------------------------ locks

  /** USERS row of the actor (rank 10), FOR UPDATE (quota serialization). */
  async lockUser(userId: number, tx: Executor): Promise<void> {
    await this.lockUsers([{ id: userId, mode: 'update' }], tx);
  }

  /**
   * Takes every USERS lock (rank 10) a Social mutation needs before any posts(100) /
   * comments(105) lock, in ascending id (§24.7.1 rules 1, 2, 5):
   * - `update`: the actor's quota lock;
   * - `key share`: the lock an FK check to `users` takes implicitly on insert/update
   *   (media_files.owner_id, post_reactions.user_id, deleted_by, hidden_by,
   *   notifications.user_id). Taking it up front means the later FK check waits on nothing.
   * A row requested in both modes is locked once FOR UPDATE.
   */
  async lockUsers(entries: readonly { id: number; mode: 'update' | 'key share' }[], tx: Executor): Promise<void> {
    const modes = new Map<number, 'update' | 'key share'>();
    for (const { id, mode } of entries) {
      if (mode === 'update' || !modes.has(id)) modes.set(id, mode);
    }
    for (const id of [...modes.keys()].sort((a, b) => a - b)) {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for(modes.get(id)!);
    }
  }

  /** POSTS row (rank 100). `share` for comment/reaction writes; `update` for edits/deletes/hides. */
  async lockPost(postId: number, mode: 'share' | 'update', tx: Executor): Promise<PostRow | null> {
    const rows = await tx.select(postColumns).from(posts).where(eq(posts.id, postId)).for(mode === 'share' ? 'share' : 'update');
    return rows[0] ?? null;
  }

  async lockComment(commentId: number, tx: Executor): Promise<CommentRow | null> {
    const rows = await tx.select(commentColumns).from(postComments).where(eq(postComments.id, commentId)).for('update');
    return rows[0] ?? null;
  }

  // ------------------------------------------------------------------ posts

  async findPost(postId: number, executor: Executor = db): Promise<PostRow | null> {
    const rows = await executor.select(postColumns).from(posts).where(eq(posts.id, postId)).limit(1);
    return rows[0] ?? null;
  }

  async findPostByClientRequest(authorId: number, clientRequestId: string, executor: Executor): Promise<PostRow | null> {
    const rows = await executor.select(postColumns).from(posts)
      .where(and(eq(posts.authorId, authorId), eq(posts.clientRequestId, clientRequestId))).limit(1);
    return rows[0] ?? null;
  }

  /**
   * Free posts created since the start of today in Asia/Ho_Chi_Minh (deleted included,
   * Social Tech Design §7.5) and the seconds until the next local midnight.
   */
  async freePostQuota(authorId: number, tx: Executor): Promise<{ used: number; secondsToReset: number }> {
    const result = await tx.execute(sql`
      WITH bounds AS (
        SELECT (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}) AS day_start
      )
      SELECT
        (SELECT count(*)::int FROM posts p, bounds
          WHERE p.author_id = ${authorId} AND p.type = 'FREE' AND p.created_at >= bounds.day_start) AS used,
        (SELECT ceil(extract(epoch FROM (bounds.day_start + interval '1 day') - now()))::int FROM bounds) AS seconds
    `);
    const row = result.rows[0] as { used: number; seconds: number };
    return { used: Number(row.used), secondsToReset: Math.max(1, Number(row.seconds)) };
  }

  async insertPost(values: {
    authorId: number; type: 'FREE'; body: string | null; background?: string | null; clientRequestId: string; creationHash: string;
  }, tx: Executor): Promise<number> {
    const [row] = await tx.insert(posts).values({
      ...values,
      title: null,
      publishedAt: sql`now()`,
    }).returning({ id: posts.id });
    return row.id;
  }

  /** SOC-04: unpublished MATCH_FINDING post (published_at set later by publish, §24.4). */
  async insertMatchFindingPost(values: {
    authorId: number; title: string | null; body: string | null; clientRequestId: string; creationHash: string;
  }, tx: Executor): Promise<number> {
    const [row] = await tx.insert(posts).values({ ...values, type: 'MATCH_FINDING', publishedAt: null }).returning({ id: posts.id });
    return row.id;
  }

  async updatePostContent(postId: number, values: { background?: string | null; body?: string | null; title?: string | null; editedAt: Date }, tx: Executor): Promise<void> {
    await tx.update(posts).set({ ...values, updatedAt: values.editedAt }).where(eq(posts.id, postId));
  }

  async softDeletePost(postId: number, at: Date, tx: Executor): Promise<void> {
    await tx.update(posts).set({ deletedAt: at, updatedAt: at }).where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  }

  async hidePost(postId: number, adminId: number, at: Date, tx: Executor): Promise<void> {
    await tx.update(posts).set({ hiddenAt: at, hiddenBy: adminId, updatedAt: at })
      .where(and(eq(posts.id, postId), isNull(posts.hiddenAt)));
  }

  // ----------------------------------------------------------------- images

  async findActiveImages(postIds: readonly number[], executor: Executor = db) {
    if (postIds.length === 0) return [];
    return executor
      .select({ id: postImages.id, postId: postImages.postId, mediaId: postImages.mediaId, position: postImages.position })
      .from(postImages)
      .where(and(inArray(postImages.postId, [...postIds]), isNull(postImages.detachedAt)))
      .orderBy(asc(postImages.postId), asc(postImages.position));
  }

  async insertImages(postId: number, mediaIds: readonly { mediaId: number; position: number }[], tx: Executor): Promise<void> {
    if (mediaIds.length === 0) return;
    await tx.insert(postImages).values(mediaIds.map(m => ({ postId, mediaId: m.mediaId, position: m.position })));
  }

  async detachImages(imageRowIds: readonly number[], at: Date, tx: Executor): Promise<void> {
    if (imageRowIds.length === 0) return;
    await tx.update(postImages).set({ detachedAt: at }).where(and(inArray(postImages.id, [...imageRowIds]), isNull(postImages.detachedAt)));
  }

  // ------------------------------------------------------------------- feed

  /** Published, not deleted/hidden, published_at ≤ asOf; published_at DESC, id DESC. */
  async findFeedPage(query: FeedPageQuery): Promise<{ rows: PostRow[]; total: number }> {
    const typeCondition = query.recruitmentFilterActive
      ? sql`${posts.type} = 'MATCH_FINDING' AND ${query.recruitmentCondition}`
      : sql`(${posts.type} IN ('FREE', 'TOURNAMENT_RESULT') OR (${posts.type} = 'MATCH_FINDING' AND ${query.recruitmentCondition}))`;
    const where = and(
      sql`${posts.publishedAt} IS NOT NULL`,
      lte(posts.publishedAt, query.asOf),
      isNull(posts.deletedAt),
      isNull(posts.hiddenAt),
      query.type ? eq(posts.type, query.type) : undefined,
      typeCondition,
      query.excludeAuthorIds && query.excludeAuthorIds.length > 0
        ? notInArray(posts.authorId, [...query.excludeAuthorIds])
        : undefined,
    );
    const [rows, totals] = await Promise.all([
      db.select(postColumns).from(posts).where(where)
        .orderBy(...(query.orderSql ? [query.orderSql, asc(posts.id)] : [desc(posts.publishedAt), desc(posts.id)]))
        .limit(query.limit).offset((query.page - 1) * query.limit),
      db.select({ total: count() }).from(posts).where(where),
    ]);
    return { rows: rows as PostRow[], total: Number(totals[0]?.total ?? 0) };
  }

  async findAuthors(userIds: readonly number[], executor: Executor = db) {
    if (userIds.length === 0) return [];
    return executor
      .select({
        id: users.id,
        displayName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
        skillLevelId: skillLevels.id,
        skillName: skillLevels.name,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(inArray(users.id, [...userIds]));
  }

  async reactionCounts(postIds: readonly number[], executor: Executor = db) {
    if (postIds.length === 0) return [];
    return executor
      .select({ postId: postReactions.postId, type: postReactions.type, n: count() })
      .from(postReactions)
      .where(inArray(postReactions.postId, [...postIds]))
      .groupBy(postReactions.postId, postReactions.type);
  }

  async viewerReactions(postIds: readonly number[], viewerId: number, executor: Executor = db) {
    if (postIds.length === 0) return [];
    return executor
      .select({ postId: postReactions.postId, type: postReactions.type })
      .from(postReactions)
      .where(and(inArray(postReactions.postId, [...postIds]), eq(postReactions.userId, viewerId)));
  }

  async commentCounts(postIds: readonly number[], executor: Executor = db) {
    if (postIds.length === 0) return [];
    return executor
      .select({ postId: postComments.postId, n: count() })
      .from(postComments)
      .where(and(inArray(postComments.postId, [...postIds]), isNull(postComments.deletedAt), isNull(postComments.hiddenAt)))
      .groupBy(postComments.postId);
  }

  // -------------------------------------------------------------- reactions

  /** Returns true only when a row was inserted or its type actually changed. */
  async upsertReaction(postId: number, userId: number, type: string, tx: Executor): Promise<boolean> {
    const rows = await tx.insert(postReactions).values({ postId, userId, type })
      .onConflictDoUpdate({
        target: [postReactions.postId, postReactions.userId],
        set: { type, updatedAt: sql`now()` },
        setWhere: sql`${postReactions.type} <> excluded.type`,
      })
      .returning({ userId: postReactions.userId });
    return rows.length > 0;
  }

  async deleteReaction(postId: number, userId: number, tx: Executor): Promise<void> {
    await tx.delete(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.userId, userId)));
  }

  // --------------------------------------------------------------- comments

  async findComment(commentId: number, executor: Executor = db): Promise<CommentRow | null> {
    const rows = await executor.select(commentColumns).from(postComments).where(eq(postComments.id, commentId)).limit(1);
    return rows[0] ?? null;
  }

  async findCommentByClientRequest(authorId: number, clientRequestId: string, executor: Executor): Promise<CommentRow | null> {
    const rows = await executor.select(commentColumns).from(postComments)
      .where(and(eq(postComments.authorId, authorId), eq(postComments.clientRequestId, clientRequestId))).limit(1);
    return rows[0] ?? null;
  }

  /** Comments by the author with created_at > now() − 60 s (deleted included, §7.5). */
  async commentQuota(authorId: number, tx: Executor): Promise<{ used: number; secondsToReset: number }> {
    const result = await tx.execute(sql`
      SELECT count(*)::int AS used,
        ceil(extract(epoch FROM (min(created_at) + interval '60 seconds') - now()))::int AS seconds
      FROM post_comments
      WHERE author_id = ${authorId} AND created_at > now() - interval '60 seconds'
    `);
    const row = result.rows[0] as { used: number; seconds: number | null };
    return { used: Number(row.used), secondsToReset: Math.max(1, Number(row.seconds ?? 1)) };
  }

  async insertComment(values: { postId: number; authorId: number; body: string; clientRequestId: string; creationHash: string }, tx: Executor): Promise<CommentRow> {
    const [row] = await tx.insert(postComments).values(values).returning(commentColumns);
    return row;
  }

  async listComments(postId: number, page: number, limit: number) {
    const where = and(eq(postComments.postId, postId), isNull(postComments.deletedAt), isNull(postComments.hiddenAt));
    const [rows, totals] = await Promise.all([
      db.select(commentColumns).from(postComments).where(where)
        .orderBy(asc(postComments.createdAt), asc(postComments.id))
        .limit(limit).offset((page - 1) * limit),
      db.select({ total: count() }).from(postComments).where(where),
    ]);
    return { rows: rows as CommentRow[], total: Number(totals[0]?.total ?? 0) };
  }

  async softDeleteComment(commentId: number, actorId: number, at: Date, tx: Executor): Promise<void> {
    await tx.update(postComments).set({ deletedAt: at, deletedBy: actorId })
      .where(and(eq(postComments.id, commentId), isNull(postComments.deletedAt)));
  }

  async hideComment(commentId: number, adminId: number, at: Date, tx: Executor): Promise<void> {
    await tx.update(postComments).set({ hiddenAt: at, hiddenBy: adminId })
      .where(and(eq(postComments.id, commentId), isNull(postComments.hiddenAt)));
  }
}

export const socialRepository = new SocialRepository();
