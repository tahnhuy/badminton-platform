import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { messagingController } from '../../controllers/messaging/MessagingController';
import {
  playerSearchQuerySchema,
  conversationListQuerySchema,
  conversationIdParamSchema,
  createDirectConversationBodySchema,
  createGroupConversationBodySchema,
  addGroupMembersBodySchema,
  blockPlayerBodySchema,
  blockPlayerParamSchema,
} from '../../validation/messaging';

const router = Router();
const playerGuard = [authenticate, requireRole('PLAYER')] as const;

// Player search for starting 1-1 or group conversations
router.get(
  '/players/search',
  ...playerGuard,
  validate({ query: playerSearchQuerySchema }),
  (req, res, next) => messagingController.searchPlayers(req, res, next)
);

// Conversation management
router.get(
  '/conversations',
  ...playerGuard,
  validate({ query: conversationListQuerySchema }),
  (req, res, next) => messagingController.listConversations(req, res, next)
);
router.get('/conversations/unread-summary', ...playerGuard, (req, res, next) =>
  messagingController.getUnreadSummary(req, res, next)
);
router.post(
  '/conversations/direct',
  ...playerGuard,
  validate({ body: createDirectConversationBodySchema }),
  (req, res, next) => messagingController.openOrCreateDirectConversation(req, res, next)
);
router.post(
  '/conversations/group',
  ...playerGuard,
  validate({ body: createGroupConversationBodySchema }),
  (req, res, next) => messagingController.createGroupConversation(req, res, next)
);
router.get(
  '/conversations/:id',
  ...playerGuard,
  validate({ params: conversationIdParamSchema }),
  (req, res, next) => messagingController.getConversationDetail(req, res, next)
);
router.post(
  '/conversations/:id/members',
  ...playerGuard,
  validate({ params: conversationIdParamSchema, body: addGroupMembersBodySchema }),
  (req, res, next) => messagingController.addGroupMembers(req, res, next)
);
router.post(
  '/conversations/:id/leave',
  ...playerGuard,
  validate({ params: conversationIdParamSchema }),
  (req, res, next) => messagingController.leaveGroupConversation(req, res, next)
);

// Player block management
router.get('/blocks', ...playerGuard, (req, res, next) =>
  messagingController.listBlocks(req, res, next)
);
router.post(
  '/blocks',
  ...playerGuard,
  validate({ body: blockPlayerBodySchema }),
  (req, res, next) => messagingController.blockPlayer(req, res, next)
);
router.delete(
  '/blocks/:playerId',
  ...playerGuard,
  validate({ params: blockPlayerParamSchema }),
  (req, res, next) => messagingController.unblockPlayer(req, res, next)
);

export default router;
