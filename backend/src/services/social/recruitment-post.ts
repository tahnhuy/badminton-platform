import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { posts } from '../../db/schema/social';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { PostContentPort } from '../../contracts/PostContentPort';

// Social-owned writes/reads of POSTS used by Matchmaking (PostContentPort, Matchmaking Tech
// Design §24.2). The legacy `POST /matchmaking-requests` endpoint still creates the
// recruitment's unpublished MATCH_FINDING post exactly like the §24.11 backfill
// (published_at NULL, creation_hash NULL) until the frontend switches to the canonical
// `POST /posts` flow (SOC-04), which removes the legacy endpoint (§24.9).

/** Inserts an unpublished match-finding post (rank 100, new row) in the caller transaction. */
export async function insertLegacyRecruitmentPost(authorId: number, tx: TransactionContext): Promise<number> {
  const [row] = await tx
    .insert(posts)
    .values({ authorId, type: 'MATCH_FINDING', publishedAt: null })
    .returning({ id: posts.id });
  return row.id;
}

/** Apply acceptance recheck (§24.5 step 3): the post is published. */
export async function isPostPublished(postId: number, tx: TransactionContext): Promise<boolean> {
  const [row] = await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, postId)).limit(1);
  return Boolean(row?.publishedAt);
}

/**
 * Batched publication read for the recruitment projection tiers (same Social-owned read as
 * isPostPublished, one query per page).
 */
export async function findPublishedPostIds(postIds: readonly number[], reader: TransactionContext | typeof db = db): Promise<Set<number>> {
  if (postIds.length === 0) return new Set();
  const rows = await (reader as typeof db)
    .select({ id: posts.id })
    .from(posts)
    .where(and(inArray(posts.id, [...postIds]), isNotNull(posts.publishedAt)));
  return new Set(rows.map(row => row.id));
}

export const postContentPort: PostContentPort = {
  async markPublished(postId, at, tx) {
    // Publication is set once and never unset (§24.4 "Publication").
    const [updated] = await tx
      .update(posts)
      .set({ publishedAt: at, updatedAt: at })
      .where(and(eq(posts.id, postId), isNull(posts.publishedAt)))
      .returning({ publishedAt: posts.publishedAt });
    if (updated) return updated.publishedAt;
    const [row] = await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, postId)).limit(1);
    return row?.publishedAt ?? null;
  },
  async isVisible(postId, viewerId, reader) {
    // Lazy import: the visibility rule consumes RecruitmentPort, whose provider uses this port.
    const { postVisibility } = await import('./post-visibility');
    const visible = await postVisibility.visiblePostIds([postId], { id: viewerId, role: 'PLAYER' }, reader ?? db);
    return visible.has(postId);
  },
};
