import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';
import { socialConfig } from '../../shared/config/social-config';
import { notificationService } from '../notifications/NotificationService';
import { socialRepository, CommentRow } from '../../repositories/social/SocialRepository';
import { postVisibility, SocialViewer } from './post-visibility';
import {
  COMMENT_BODY_MAX, assertSocialEnabled, canonicalHash, charLength, clientIdConflict, commentNotFound,
  contentEmpty, contentTooLong, forbidden, interactionNotAllowed, postNotFound, rateLimited, trimOrNull,
} from './social-common';
import { REACTION_TYPES, ReactionType } from '../../validation/social';
import type { TransactionContext } from '../../contracts/TransactionContext';

// SOC-06 (reactions, comments, comment notification) and SOC-07 (Admin hide) —
// Social Tech Design §7.3, §7.5, §8, §9, §13, §15.

export interface CommentDto {
  id: number;
  postId: number;
  body: string;
  author: { id: number; displayName: string | null; avatarUrl: string | null };
  createdAt: Date;
  canDelete: boolean;
}

function commentHash(postId: number, body: string): string {
  return canonicalHash({ v: 1, postId, body });
}

export class SocialInteractionService {
  private async requireVisiblePost(postId: number, viewer: SocialViewer, tx: TransactionContext, mode: 'share' | 'update' = 'share') {
    const post = await socialRepository.lockPost(postId, mode, tx);
    if (!post) throw postNotFound();
    const visible = await postVisibility.filterVisible([post], viewer, tx);
    if (!visible.has(post.id)) throw postNotFound();
    return post;
  }

  /**
   * Visibility is checked first so an unauthorized viewer still gets 404 and cannot learn
   * that a post exists. Only then does the post type reject social interactions.
   */
  private assertInteractive(post: { type: string }): void {
    if (post.type !== 'FREE') throw interactionNotAllowed();
  }

  // ----------------------------------------------------------- reactions

  async setReaction(viewer: SocialViewer, postId: number, type: string) {
    if (!(REACTION_TYPES as readonly string[]).includes(type)) {
      throw new AppError('SOCIAL_REACTION_INVALID', 400, 'Loại cảm xúc không hợp lệ');
    }
    await assertSocialEnabled();
    // users(10, KEY SHARE for the post_reactions.user_id FK) → posts(100) → post_reactions(105);
    // PK upsert converges under concurrency.
    await db.transaction(async tx => {
      await socialRepository.lockUsers([{ id: viewer.id, mode: 'key share' }], tx);
      this.assertInteractive(await this.requireVisiblePost(postId, viewer, tx));
      await socialRepository.upsertReaction(postId, viewer.id, type as ReactionType, tx);
    });
    return { postId, type };
  }

  async removeReaction(viewer: SocialViewer, postId: number) {
    await assertSocialEnabled();
    // posts(100) → post_reactions(105). A DELETE checks no FK on the referencing side.
    await db.transaction(async tx => {
      // Removing an old reaction is cleanup, not a new interaction: keep it available
      // so legacy rows can be cleared without re-enabling reactions on match posts.
      await this.requireVisiblePost(postId, viewer, tx);
      await socialRepository.deleteReaction(postId, viewer.id, tx);
    });
    return { postId, type: null };
  }

  // ------------------------------------------------------------ comments

  private async toDtos(rows: readonly CommentRow[], postAuthorId: number, viewer: SocialViewer): Promise<CommentDto[]> {
    const authors = await socialRepository.findAuthors([...new Set(rows.map(row => row.authorId))]);
    return rows.map(row => {
      const author = authors.find((a: any) => a.id === row.authorId);
      return {
        id: row.id,
        postId: row.postId,
        body: row.body,
        author: { id: row.authorId, displayName: author?.displayName ?? null, avatarUrl: author?.avatarUrl ?? null },
        createdAt: row.createdAt,
        canDelete: viewer.id === row.authorId || viewer.id === postAuthorId,
      };
    });
  }

  async listComments(viewer: SocialViewer, postId: number, page: number, limit: number) {
    const post = await socialRepository.findPost(postId);
    if (!post) throw postNotFound();
    const visible = await postVisibility.filterVisible([post], viewer);
    if (!visible.has(post.id)) throw postNotFound();
    this.assertInteractive(post);
    const { rows, total } = await socialRepository.listComments(postId, page, limit);
    return {
      items: await this.toDtos(rows, post.authorId, viewer),
      meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
    };
  }

  async createComment(viewer: SocialViewer, postId: number, rawBody: string, clientRequestId: string) {
    await assertSocialEnabled();
    const body = trimOrNull(rawBody);
    if (!body) throw contentEmpty();
    if (charLength(body) > COMMENT_BODY_MAX) throw contentTooLong(COMMENT_BODY_MAX);
    const creationHash = commentHash(postId, body);
    const config = await socialConfig.get();
    // posts.author_id never changes, so this snapshot names the notification recipient whose
    // USERS row the notifications.user_id FK will KEY SHARE-lock.
    const target = await socialRepository.findPost(postId);

    const outcome = await db.transaction(async tx => {
      // users(10: actor FOR UPDATE, post author KEY SHARE, ascending) → posts(100) →
      // post_comments(105) → notifications. Recheck the key after waiting.
      await socialRepository.lockUsers([
        { id: viewer.id, mode: 'update' },
        ...(target && target.authorId !== viewer.id ? [{ id: target.authorId, mode: 'key share' as const }] : []),
      ], tx);
      const existing = await socialRepository.findCommentByClientRequest(viewer.id, clientRequestId, tx);
      if (existing) {
        // Authorize current access before any replay content or conflict answer.
        const existingPost = await socialRepository.findPost(existing.postId, tx);
        const visible = existingPost ? await postVisibility.filterVisible([existingPost], viewer, tx) : new Set<number>();
        if (!existingPost || !visible.has(existingPost.id)) throw postNotFound();
        this.assertInteractive(existingPost);
        if (existing.creationHash !== creationHash) throw clientIdConflict();
        if (existing.deletedAt || existing.hiddenAt) throw commentNotFound();
        return { replay: true, comment: existing, postAuthorId: existingPost.authorId };
      }
      const post = await this.requireVisiblePost(postId, viewer, tx);
      this.assertInteractive(post);
      if (!target || target.authorId !== post.authorId) throw new Error('posts.author_id changed under a comment');
      const quota = await socialRepository.commentQuota(viewer.id, tx);
      if (quota.used >= config.commentsPerMinute) {
        logger.warn('Social quota rejected', { userId: viewer.id, quotaKey: 'SOCIAL_COMMENTS_PER_MINUTE' });
        throw rateLimited(quota.secondsToReset, `Bạn chỉ có thể bình luận tối đa ${config.commentsPerMinute} lần mỗi phút`);
      }
      const comment = await socialRepository.insertComment({ postId, authorId: viewer.id, body, clientRequestId, creationHash }, tx);
      if (post.authorId !== viewer.id) {
        // §15: SOCIAL_POST_COMMENTED to the post author, same transaction (NTF-02).
        const [commenter] = await socialRepository.findAuthors([viewer.id], tx);
        await notificationService.notify(tx, [{
          recipientId: post.authorId,
          type: 'SOCIAL_POST_COMMENTED',
          title: 'Bình luận mới',
          content: `${commenter?.displayName ?? 'Một người chơi'} đã bình luận về bài viết của bạn`,
          resource: { type: 'POST', id: postId },
          dedupKey: `post-comment:${comment.id}:${post.authorId}`,
        }]);
      }
      return { replay: false, comment, postAuthorId: post.authorId };
    });
    const [dto] = await this.toDtos([outcome.comment], outcome.postAuthorId, viewer);
    return { replay: outcome.replay, comment: dto };
  }

  async deleteComment(viewer: SocialViewer, commentId: number) {
    // Allowed while SOCIAL_FEED_ENABLED is false (§8.10).
    return db.transaction(async tx => {
      const snapshot = await socialRepository.findComment(commentId, tx);
      if (!snapshot) throw commentNotFound();
      // users(10, KEY SHARE for the deleted_by FK) → posts(100) → post_comments(105).
      await socialRepository.lockUsers([{ id: viewer.id, mode: 'key share' }], tx);
      const post = await socialRepository.lockPost(snapshot.postId, 'share', tx);
      const comment = await socialRepository.lockComment(commentId, tx);
      if (!post || !comment) throw commentNotFound();
      const visible = await postVisibility.filterVisible([post], viewer, tx);
      if (!visible.has(post.id) || comment.hiddenAt) throw commentNotFound();
      const allowed = viewer.id === comment.authorId || viewer.id === post.authorId;
      if (comment.deletedAt) {
        if (!allowed) throw commentNotFound();
        return { id: commentId, deleted: true as const };
      }
      if (!allowed) throw forbidden();
      await socialRepository.softDeleteComment(commentId, viewer.id, new Date(), tx);
      return { id: commentId, deleted: true as const };
    });
  }

  // ---------------------------------------------------------- Admin hide

  /**
   * SOC-07: recruitment, Match and booking are never touched. Explicit lock is posts(100);
   * the hidden_by FK KEY SHARE-locks the Admin's USERS row, taken first (rank 10).
   */
  async hidePost(adminId: number, postId: number) {
    return db.transaction(async tx => {
      await socialRepository.lockUsers([{ id: adminId, mode: 'key share' }], tx);
      const post = await socialRepository.lockPost(postId, 'update', tx);
      if (!post) throw postNotFound();
      if (!post.hiddenAt) await socialRepository.hidePost(postId, adminId, new Date(), tx);
      const current = await socialRepository.findPost(postId, tx);
      return { id: postId, hidden: true as const, hiddenAt: current!.hiddenAt };
    });
  }

  /** SOC-07: post_comments(105), with the hidden_by FK's Admin USERS KEY SHARE taken first. */
  async hideComment(adminId: number, commentId: number) {
    return db.transaction(async tx => {
      await socialRepository.lockUsers([{ id: adminId, mode: 'key share' }], tx);
      const comment = await socialRepository.lockComment(commentId, tx);
      if (!comment) throw commentNotFound();
      if (!comment.hiddenAt) await socialRepository.hideComment(commentId, adminId, new Date(), tx);
      const current = await socialRepository.findComment(commentId, tx);
      return { id: commentId, hidden: true as const, hiddenAt: current!.hiddenAt };
    });
  }
}

export const socialInteractionService = new SocialInteractionService();
