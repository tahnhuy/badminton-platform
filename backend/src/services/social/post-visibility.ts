import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { posts } from '../../db/schema/social';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { recruitmentPort } from '../matchmaking/RecruitmentService';

// Social Tech Design §7.3: the single visibility rule used by feed, detail, comments,
// reactions and media. canView(post, viewer): authenticated Player; not deleted and not
// hidden; and published, or the viewer is the host/author, or the viewer has a PENDING
// (not expired) or ACCEPTED membership row on the post's recruitment (Matchmaking §24.9).
// Callers answer an unavailable post with 404 SOCIAL_POST_NOT_FOUND without the reason.

export interface SocialViewer {
  id: number;
  role: string;
}

type Reader = TransactionContext | typeof db;

export interface PostVisibilityRow {
  id: number;
  type: string;
  authorId: number;
  publishedAt: Date | null;
  deletedAt: Date | null;
  hiddenAt: Date | null;
}

export const postVisibility = {
  /** Applies canView to already-loaded rows; one batched recruitment read for unpublished ones. */
  async filterVisible(rows: readonly PostVisibilityRow[], viewer: SocialViewer, reader: Reader = db): Promise<Set<number>> {
    const visible = new Set<number>();
    if (viewer.role !== 'PLAYER') return visible;
    const needMembership: number[] = [];
    for (const row of rows) {
      if (row.deletedAt || row.hiddenAt) continue;
      if (row.publishedAt || row.authorId === viewer.id) visible.add(row.id);
      else if (row.type === 'MATCH_FINDING') needMembership.push(row.id);
    }
    if (needMembership.length > 0) {
      const projections = await recruitmentPort.getCardProjection(needMembership, viewer.id, reader as TransactionContext);
      for (const postId of needMembership) {
        const relation = projections.get(postId)?.viewerRelation;
        if (relation === 'HOST' || relation === 'ACCEPTED' || relation === 'PENDING') visible.add(postId);
      }
    }
    return visible;
  },

  async visiblePostIds(postIds: readonly number[], viewer: SocialViewer, reader: Reader = db): Promise<Set<number>> {
    if (postIds.length === 0 || viewer.role !== 'PLAYER') return new Set();
    const rows = await (reader as typeof db)
      .select({
        id: posts.id,
        type: posts.type,
        authorId: posts.authorId,
        publishedAt: posts.publishedAt,
        deletedAt: posts.deletedAt,
        hiddenAt: posts.hiddenAt,
      })
      .from(posts)
      .where(inArray(posts.id, [...postIds]));
    return this.filterVisible(rows, viewer, reader);
  },
};
