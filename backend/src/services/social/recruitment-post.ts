import { eq } from 'drizzle-orm';
import { posts } from '../../db/schema/social';
import type { TransactionContext } from '../../contracts/TransactionContext';

// Social-owned writes/reads of POSTS used by Matchmaking during the MM-21 → MM-23
// transition. The legacy `POST /matchmaking-requests` endpoint creates the recruitment's
// unpublished MATCH_FINDING post exactly like the §24.11 backfill (published_at NULL,
// creation_hash NULL). MM-23/SOC-04 replace this with the canonical `POST /posts` flow,
// which removes the legacy endpoint (Tech Design §24.9).

/** Inserts an unpublished match-finding post (rank 100, new row) in the caller transaction. */
export async function insertLegacyRecruitmentPost(authorId: number, tx: TransactionContext): Promise<number> {
  const [row] = await tx
    .insert(posts)
    .values({ authorId, type: 'MATCH_FINDING', publishedAt: null })
    .returning({ id: posts.id });
  return row.id;
}

/** PostContentPort-style read used by Apply acceptance (§24.5 step 3). */
export async function isPostPublished(postId: number, tx: TransactionContext): Promise<boolean> {
  const [row] = await tx.select({ publishedAt: posts.publishedAt }).from(posts).where(eq(posts.id, postId)).limit(1);
  return Boolean(row?.publishedAt);
}
