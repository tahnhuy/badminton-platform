import { Request, Response, NextFunction } from 'express';
import { AppError, UnauthorizedError } from '../../errors/AppError';
import { socialPostService, SocialPostService } from '../../services/social/SocialPostService';
import { socialInteractionService, SocialInteractionService } from '../../services/social/SocialInteractionService';
import type { SocialViewer } from '../../services/social/post-visibility';
import type { UploadedImage } from '../../contracts/PrivateMediaService';
import {
  CommentsQuery, CreateCommentBody, FeedQuery, createPostPayloadSchema, editPostPayloadSchema, parsePayload,
} from '../../validation/social';

// Social routes (Social Tech Design §9). Transport only: parsing, status codes, headers.

function viewerOf(req: Request): SocialViewer {
  if (!req.user) throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
  return { id: req.user.id, role: req.user.role };
}

function uploadedImages(req: Request): UploadedImage[] {
  const files = (req.files as Record<string, Express.Multer.File[]> | undefined)?.images ?? [];
  return files.map(file => ({ buffer: file.buffer, mimetype: file.mimetype }));
}

function idParam(req: Request): number {
  return (req.params as unknown as { id: number }).id;
}

/** Sets Retry-After for SOCIAL_RATE_LIMITED before delegating to the error handler. */
function forward(res: Response, next: NextFunction, err: unknown): void {
  if (err instanceof AppError && err.retryAfterSeconds) res.setHeader('Retry-After', String(err.retryAfterSeconds));
  next(err);
}

export class SocialController {
  constructor(
    private readonly posts: SocialPostService = socialPostService,
    private readonly interactions: SocialInteractionService = socialInteractionService,
  ) {}

  listFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.posts.listFeed(viewerOf(req), req.query as unknown as FeedQuery);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) { forward(res, next, err); }
  };

  getPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await this.posts.getPost(viewerOf(req), idParam(req)) });
    } catch (err) { forward(res, next, err); }
  };

  createPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parsePayload(createPostPayloadSchema, req.body);
      const result = await this.posts.create(viewerOf(req), payload, uploadedImages(req));
      res.status(result.replay ? 200 : 201).json({ data: result.post });
    } catch (err) { forward(res, next, err); }
  };

  editPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payload = parsePayload(editPostPayloadSchema, req.body);
      res.status(200).json({ data: await this.posts.edit(viewerOf(req), idParam(req), payload, uploadedImages(req)) });
    } catch (err) { forward(res, next, err); }
  };

  deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingAction } = req.query as { bookingAction?: 'KEEP' | 'CANCEL' };
      res.status(200).json({ data: await this.posts.delete(viewerOf(req), idParam(req), bookingAction ?? 'KEEP') });
    } catch (err) { forward(res, next, err); }
  };

  setReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.body as { type: string };
      res.status(200).json({ data: await this.interactions.setReaction(viewerOf(req), idParam(req), type) });
    } catch (err) { forward(res, next, err); }
  };

  removeReaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await this.interactions.removeReaction(viewerOf(req), idParam(req)) });
    } catch (err) { forward(res, next, err); }
  };

  listComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = req.query as unknown as CommentsQuery;
      const result = await this.interactions.listComments(viewerOf(req), idParam(req), page, limit);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) { forward(res, next, err); }
  };

  createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateCommentBody;
      const result = await this.interactions.createComment(viewerOf(req), idParam(req), body.body, body.clientRequestId);
      res.status(result.replay ? 200 : 201).json({ data: result.comment });
    } catch (err) { forward(res, next, err); }
  };

  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await this.interactions.deleteComment(viewerOf(req), idParam(req)) });
    } catch (err) { forward(res, next, err); }
  };

  hidePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await this.interactions.hidePost(viewerOf(req).id, idParam(req)) });
    } catch (err) { forward(res, next, err); }
  };

  hideComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({ data: await this.interactions.hideComment(viewerOf(req).id, idParam(req)) });
    } catch (err) { forward(res, next, err); }
  };
}

export const socialController = new SocialController();
