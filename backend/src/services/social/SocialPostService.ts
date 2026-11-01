import { db } from '../../db';
import { posts } from '../../db/schema/social';
import { ValidationError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';
import { socialConfig } from '../../shared/config/social-config';
import { privateMediaService } from '../media/PrivateMediaService';
import { recruitmentPort } from '../matchmaking/RecruitmentService';
import { socialRepository, PostRow } from '../../repositories/social/SocialRepository';
import { postVisibility, SocialViewer } from './post-visibility';
import {
  POST_BODY_MAX, POST_TITLE_MAX, assertSocialEnabled, canonicalHash, charLength, clientIdConflict,
  contentEmpty, contentTooLong, forbidden, imageLimit, notEditable, postNotFound, rateLimited, sha256Hex, trimOrNull,
} from './social-common';
import { REACTION_TYPES } from '../../validation/social';
import type { CreatePostPayload, EditPostPayload, FeedQuery } from '../../validation/social';
import type { UploadedImage } from '../../contracts/PrivateMediaService';
import type { RecruitmentCardProjection } from '../../contracts/RecruitmentPort';
import type { TransactionContext } from '../../contracts/TransactionContext';

// SOC-03 (free post create/edit/delete) and SOC-05 (feed/detail) — Social Tech Design
// §7.2, §7.3, §7.5, §7.6, §8, §9, §13.

const IMAGE_CODE = { invalidImageCode: 'SOCIAL_IMAGE_INVALID' };
const MAX_IMAGES = 4;

export interface PostCard {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  author: { id: number; displayName: string | null; avatarUrl: string | null; skillLevel: { id: number; name: string } | null };
  isAuthor: boolean;
  publishedAt: Date | null;
  editedAt: Date | null;
  isEdited: boolean;
  createdAt: Date;
  images: { id: number; url: string; position: number }[];
  reactions: { counts: Record<string, number>; total: number; viewerReaction: string | null };
  commentCount: number;
  recruitment: RecruitmentCardProjection | null;
}

function emptyCounts(): Record<string, number> {
  return Object.fromEntries(REACTION_TYPES.map(type => [type, 0]));
}

function projectionFor(projection: RecruitmentCardProjection | undefined): RecruitmentCardProjection | null {
  return projection && projection.access !== 'NONE' ? projection : null;
}

function freeCreationHash(body: string | null, imageHashes: string[]): string {
  // Canonical initial payload (§13): type, trimmed body/title, publish intent, recruitment,
  // ordered image hashes. Free posts have no title, publish intent or recruitment.
  return canonicalHash({ v: 1, type: 'FREE', title: null, body, publish: null, recruitment: null, images: imageHashes });
}

export class SocialPostService {
  // -------------------------------------------------------------- cards

  /** Batched projection of a page (no N+1): authors, images, reactions, comments, recruitment. */
  async buildCards(rows: readonly PostRow[], viewer: SocialViewer, reader: TransactionContext | typeof db = db): Promise<PostCard[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const authorIds = [...new Set(rows.map(row => row.authorId))];
    const matchFindingIds = rows.filter(row => row.type === 'MATCH_FINDING').map(row => row.id);
    const [authors, images, counts, mine, comments, recruitment] = await Promise.all([
      socialRepository.findAuthors(authorIds, reader),
      socialRepository.findActiveImages(ids, reader),
      socialRepository.reactionCounts(ids, reader),
      socialRepository.viewerReactions(ids, viewer.id, reader),
      socialRepository.commentCounts(ids, reader),
      recruitmentPort.getCardProjection(matchFindingIds, viewer.id, reader as TransactionContext),
    ]);
    return rows.map(row => {
      const author = authors.find((a: any) => a.id === row.authorId);
      const reactionCounts = emptyCounts();
      let total = 0;
      for (const c of counts.filter((c: any) => c.postId === row.id)) {
        reactionCounts[c.type] = Number(c.n);
        total += Number(c.n);
      }
      return {
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        author: {
          id: row.authorId,
          displayName: author?.displayName ?? null,
          avatarUrl: author?.avatarUrl ?? null,
          skillLevel: author?.skillLevelId ? { id: author.skillLevelId, name: author.skillName } : null,
        },
        isAuthor: row.authorId === viewer.id,
        publishedAt: row.publishedAt,
        editedAt: row.editedAt,
        isEdited: row.editedAt !== null,
        createdAt: row.createdAt,
        images: images
          .filter((image: any) => image.postId === row.id)
          .map((image: any) => ({ id: image.mediaId, url: `/api/v1/media/${image.mediaId}`, position: image.position })),
        reactions: { counts: reactionCounts, total, viewerReaction: mine.find((m: any) => m.postId === row.id)?.type ?? null },
        commentCount: Number(comments.find((c: any) => c.postId === row.id)?.n ?? 0),
        // Tiered by Matchmaking (§24.9); a NONE tier never reaches a card.
        recruitment: projectionFor(recruitment.get(row.id)),
      };
    });
  }

  // ---------------------------------------------------------- feed/detail

  async listFeed(viewer: SocialViewer, query: FeedQuery) {
    const asOf = query.asOf ? new Date(query.asOf) : new Date();
    const recruitmentFilterActive = Boolean(query.matchType || query.date || query.timeFrom || query.timeTo
      || query.city || query.district || query.skillLevelId !== undefined || query.hasOpenSlots);
    const recruitmentCondition = recruitmentPort.feedFilterSql(posts.id, {
      matchType: query.matchType,
      date: query.date,
      timeFrom: query.timeFrom,
      timeTo: query.timeTo,
      city: query.city,
      district: query.district,
      skillLevelId: query.skillLevelId,
      hasOpenSlots: query.hasOpenSlots,
      includeEnded: query.includeEnded ?? false,
      asOf,
    });
    const { rows, total } = await socialRepository.findFeedPage({
      asOf, type: query.type, recruitmentCondition, recruitmentFilterActive, page: query.page, limit: query.limit,
    });
    const visible = await postVisibility.filterVisible(rows, viewer);
    const cards = await this.buildCards(rows.filter(row => visible.has(row.id)), viewer);
    return {
      items: cards,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: query.limit > 0 ? Math.ceil(total / query.limit) : 0,
        asOf: asOf.toISOString(),
      },
    };
  }

  async getPost(viewer: SocialViewer, postId: number): Promise<PostCard> {
    const row = await socialRepository.findPost(postId);
    if (!row) throw postNotFound();
    const visible = await postVisibility.filterVisible([row], viewer);
    if (!visible.has(row.id)) throw postNotFound();
    const [card] = await this.buildCards([row], viewer);
    return card;
  }

  // ------------------------------------------------------------- create

  async create(viewer: SocialViewer, payload: CreatePostPayload, files: readonly UploadedImage[]): Promise<{ replay: boolean; post: PostCard }> {
    if (payload.type !== 'FREE') {
      // Match-finding posts are created through RecruitmentPort in SOC-04 (not yet delivered).
      throw new ValidationError('Loại bài viết chưa được hỗ trợ', [{ field: 'type', code: 'invalid_value' }]);
    }
    for (const field of ['title', 'publish', 'recruitment'] as const) {
      if (payload[field] !== undefined && payload[field] !== null) {
        throw new ValidationError('Bài viết tự do không có trường này', [{ field, code: 'unrecognized_keys' }]);
      }
    }
    await assertSocialEnabled();
    const body = trimOrNull(payload.body);
    if (body && charLength(body) > POST_BODY_MAX) throw contentTooLong(POST_BODY_MAX);
    if (files.length > MAX_IMAGES) throw imageLimit();
    if (!body && files.length === 0) throw contentEmpty();
    const creationHash = freeCreationHash(body, files.map(file => sha256Hex(file.buffer)));
    const config = await socialConfig.get();

    const outcome = await privateMediaService.transaction(async tx => {
      // users(10) → posts(100) (§24.7.3). Recheck the key after waiting, before quota.
      await socialRepository.lockUser(viewer.id, tx);
      const existing = await socialRepository.findPostByClientRequest(viewer.id, payload.clientRequestId, tx);
      if (existing) {
        const visible = await postVisibility.filterVisible([existing], viewer, tx);
        if (!visible.has(existing.id)) throw postNotFound();
        if (existing.creationHash !== creationHash) throw clientIdConflict();
        return { replay: true, postId: existing.id };
      }
      const quota = await socialRepository.freePostQuota(viewer.id, tx);
      if (quota.used >= config.freePostsPerDay) {
        logger.warn('Social quota rejected', { userId: viewer.id, quotaKey: 'SOCIAL_FREE_POSTS_PER_DAY' });
        throw rateLimited(quota.secondsToReset, `Bạn đã đăng tối đa ${config.freePostsPerDay} bài trong hôm nay`);
      }
      const stored = await privateMediaService.storeImages(files, viewer.id, tx, IMAGE_CODE);
      const postId = await socialRepository.insertPost({
        authorId: viewer.id, type: 'FREE', body, clientRequestId: payload.clientRequestId, creationHash,
      }, tx);
      await socialRepository.insertImages(postId, stored.map((media, index) => ({ mediaId: media.id, position: index + 1 })), tx);
      return { replay: false, postId };
    });
    return { replay: outcome.replay, post: await this.getPost(viewer, outcome.postId) };
  }

  // --------------------------------------------------------------- edit

  async edit(viewer: SocialViewer, postId: number, payload: EditPostPayload, files: readonly UploadedImage[]): Promise<PostCard> {
    await assertSocialEnabled();
    await privateMediaService.transaction(async tx => {
      // users(10) → posts(100) (§24.7.3). New media_files rows reference the editor's USERS
      // row (owner_id FK): take that KEY SHARE lock before the post lock so the implicit FK
      // lock never waits behind a transaction that holds the user and waits for this post
      // (e.g. the same author's comment: users FOR UPDATE → posts FOR SHARE).
      await socialRepository.lockUsers([{ id: viewer.id, mode: 'key share' }], tx);
      const post = await socialRepository.lockPost(postId, 'update', tx);
      await this.authorizeAuthor(post, viewer, tx);
      if (post!.deletedAt || post!.hiddenAt) throw notEditable();

      let title = post!.title;
      if (payload.title !== undefined) {
        if (post!.type !== 'MATCH_FINDING') {
          if (payload.title !== null) throw new ValidationError('Bài viết tự do không có tiêu đề', [{ field: 'title', code: 'unrecognized_keys' }]);
        } else {
          title = trimOrNull(payload.title);
          if (title && charLength(title) > POST_TITLE_MAX) throw contentTooLong(POST_TITLE_MAX);
        }
      }
      const body = payload.body === undefined ? post!.body : trimOrNull(payload.body);
      if (body && charLength(body) > POST_BODY_MAX) throw contentTooLong(POST_BODY_MAX);

      const current = await socialRepository.findActiveImages([postId], tx);
      const currentMedia = current.map((image: any) => image.mediaId as number);
      const keep: number[] = payload.keepImageIds ?? currentMedia;
      if (new Set(keep).size !== keep.length || keep.some(id => !currentMedia.includes(id))) {
        throw new ValidationError('Ảnh giữ lại không thuộc bài viết', [{ field: 'keepImageIds', code: 'invalid_value' }]);
      }
      if (keep.length + files.length > MAX_IMAGES) throw imageLimit();
      if (post!.type === 'FREE' && !body && keep.length + files.length === 0) throw contentEmpty();

      const stored = await privateMediaService.storeImages(files, viewer.id, tx, IMAGE_CODE);
      const desired = [...keep, ...stored.map(media => media.id)].map((mediaId, index) => ({ mediaId, position: index + 1 }));
      // Rows removed or moved are detached (media kept, §13.2); moved/new rows are inserted
      // after the detach so the active-position unique index never conflicts.
      const detach = current.filter((row: any) => !desired.some(d => d.mediaId === row.mediaId && d.position === row.position));
      const insert = desired.filter(d => !current.some((row: any) => row.mediaId === d.mediaId && row.position === d.position));
      const changed = body !== post!.body || title !== post!.title || detach.length > 0 || insert.length > 0;
      if (!changed) return;
      const now = new Date();
      await socialRepository.detachImages(detach.map((row: any) => row.id), now, tx);
      await socialRepository.insertImages(postId, insert, tx);
      // published_at never changes on edit (feed position is kept).
      await socialRepository.updatePostContent(postId, { body, title, editedAt: now }, tx);
    });
    return this.getPost(viewer, postId);
  }

  // ------------------------------------------------------------- delete

  async delete(viewer: SocialViewer, postId: number): Promise<{ id: number; deleted: true }> {
    // Allowed while SOCIAL_FEED_ENABLED is false (§8.10). posts(100) only: setting
    // deleted_at writes no FK column, so no USERS lock is taken implicitly.
    return db.transaction(async tx => {
      const post = await socialRepository.lockPost(postId, 'update', tx);
      await this.authorizeAuthor(post, viewer, tx);
      if (post!.type === 'MATCH_FINDING') {
        // Active-post deletion runs host cancellation (RecruitmentPort.cancelForAuthorDeletion,
        // MM-25) and is delivered by SOC-04; it is not exposed as a success here.
        throw new Error('Match-finding post deletion is delivered with SOC-04 / MM-25');
      }
      if (!post!.deletedAt) await socialRepository.softDeletePost(postId, new Date(), tx);
      return { id: postId, deleted: true as const };
    });
  }

  /** Author-only action: other Players get 403 on a visible post, otherwise 404. */
  private async authorizeAuthor(post: PostRow | null, viewer: SocialViewer, tx: TransactionContext): Promise<void> {
    if (!post) throw postNotFound();
    if (post.authorId === viewer.id && viewer.role === 'PLAYER') return;
    const visible = await postVisibility.filterVisible([post], viewer, tx);
    throw visible.has(post.id) ? forbidden() : postNotFound();
  }
}

export const socialPostService = new SocialPostService();
