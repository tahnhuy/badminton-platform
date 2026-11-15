import { Router } from 'express';
import { socialController } from '../../controllers/social/SocialController';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { parsePrivateImages } from '../../middleware/private-image-upload.middleware';
import {
  commentIdParamSchema, commentsQuerySchema, createCommentBodySchema, deletePostQuerySchema,
  feedQuerySchema, postIdParamSchema, reactionBodySchema,
} from '../../validation/social';

// Social Tech Design §9: Player role on every route; CSRF on mutations is global (/api/v1).
const images = parsePrivateImages('images', 'SOCIAL_IMAGE_INVALID', 'payload', 'SOCIAL_IMAGE_LIMIT');

export const postRouter = Router();
postRouter.use(authenticate, requireRole('PLAYER'));
postRouter.get('/', validate({ query: feedQuerySchema }), socialController.listFeed);
postRouter.post('/', images, socialController.createPost);
postRouter.get('/:id', validate({ params: postIdParamSchema }), socialController.getPost);
postRouter.patch('/:id', validate({ params: postIdParamSchema }), images, socialController.editPost);
postRouter.delete('/:id', validate({ params: postIdParamSchema, query: deletePostQuerySchema }), socialController.deletePost);
postRouter.put('/:id/reaction', validate({ params: postIdParamSchema, body: reactionBodySchema }), socialController.setReaction);
postRouter.delete('/:id/reaction', validate({ params: postIdParamSchema }), socialController.removeReaction);
postRouter.get('/:id/comments', validate({ params: postIdParamSchema, query: commentsQuerySchema }), socialController.listComments);
postRouter.post('/:id/comments', validate({ params: postIdParamSchema, body: createCommentBodySchema }), socialController.createComment);

export const commentRouter = Router();
commentRouter.use(authenticate, requireRole('PLAYER'));
commentRouter.delete('/:id', validate({ params: commentIdParamSchema }), socialController.deleteComment);

// SOC-07: Admin-only hide.
export const adminPostRouter = Router();
adminPostRouter.use(authenticate, requireRole('ADMIN'));
adminPostRouter.post('/:id/hide', validate({ params: postIdParamSchema }), socialController.hidePost);

export const adminCommentRouter = Router();
adminCommentRouter.use(authenticate, requireRole('ADMIN'));
adminCommentRouter.post('/:id/hide', validate({ params: commentIdParamSchema }), socialController.hideComment);
