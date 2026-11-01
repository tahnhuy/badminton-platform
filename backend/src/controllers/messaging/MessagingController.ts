import { Request, Response, NextFunction } from 'express';
import { messagingService } from '../../services/messaging/MessagingService';
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

export class MessagingController {
  async searchPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, limit } = playerSearchQuerySchema.parse(req.query);
      const data = await messagingService.searchPlayers(req.user!.id, q, limit);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async listConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = conversationListQuerySchema.parse(req.query);
      const result = await messagingService.listConversations(req.user!.id, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getUnreadSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await messagingService.getUnreadSummary(req.user!.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async getConversationDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const data = await messagingService.getConversationDetail(req.user!.id, id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async openOrCreateDirectConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = createDirectConversationBodySchema.parse(req.body);
      const { conversation, created } = await messagingService.openOrCreateDirectConversation(
        req.user!.id,
        playerId
      );
      res.status(created ? 201 : 200).json({ data: conversation });
    } catch (err) {
      next(err);
    }
  }

  async createGroupConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, memberIds } = createGroupConversationBodySchema.parse(req.body);
      const data = await messagingService.createGroupConversation(req.user!.id, title, memberIds);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async addGroupMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const { memberIds } = addGroupMembersBodySchema.parse(req.body);
      const data = await messagingService.addGroupMembers(req.user!.id, id, memberIds);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async leaveGroupConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      await messagingService.leaveGroupConversation(req.user!.id, id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async listBlocks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await messagingService.listBlocks(req.user!.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async blockPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = blockPlayerBodySchema.parse(req.body);
      await messagingService.blockPlayer(req.user!.id, playerId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  async unblockPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerId } = blockPlayerParamSchema.parse(req.params);
      await messagingService.unblockPlayer(req.user!.id, playerId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const messagingController = new MessagingController();

