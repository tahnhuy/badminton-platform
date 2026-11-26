import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { posts } from '../../db/schema/social';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { recruitmentPort } from '../matchmaking/RecruitmentService';
import { blockedCounterpartIds } from '../matchmaking/block-port.registry';

// Social Tech Design §7.3: the single visibility rule used by feed, detail, comments,
// reactions and media. canView(post, viewer): authenticated Player; not deleted and not
// hidden; author is not in a block relationship with the viewer; and published, or the
// viewer is the host/author, or the viewer has a PENDING (not expired) or ACCEPTED
// membership row on the post's recruitment (Matchmaking §24.9). A blocked author's
// MATCH_FINDING post stays readable only for that existing membership (2026-11-23).
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
  async filterVisible(
    rows: readonly PostVisibilityRow[],
    viewer: SocialViewer,
    reader: Reader = db,
    knownBlockedAuthors?: ReadonlySet<number>
  ): Promise<Set<number>> {
    const visible = new Set<number>();
    if (viewer.role !== 'PLAYER') return visible;
    const blockedAuthors = knownBlockedAuthors ?? await blockedCounterpartIds(viewer.id, reader as TransactionContext);
    const needMembership: number[] = [];
    collectPublishedVisibility(rows, blockedAuthors, viewer, needMembership, visible);
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

function collectPublishedVisibility(
  rows: readonly PostVisibilityRow[],
  blockedAuthors: ReadonlySet<number>,
  viewer: SocialViewer,
  needMembership: number[],
  visible: Set<number>,
) {
  for (const row of rows) {
    if (row.deletedAt || row.hiddenAt) continue;
    const authorBlocked = blockedAuthors.has(row.authorId);
    if (row.publishedAt || row.authorId === viewer.id) {
      if (authorBlocked) {
        // Existing participants may still open a kèo hosted by a blocked Player.
        if (row.type === 'MATCH_FINDING') needMembership.push(row.id);
        continue;
      }
      visible.add(row.id);
    } else if (row.type === 'MATCH_FINDING') needMembership.push(row.id);
  }
}
