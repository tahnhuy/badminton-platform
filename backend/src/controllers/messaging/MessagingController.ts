import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../../errors/AppError';
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
  messagesHistoryQuerySchema,
  messagesSyncQuerySchema,
  markReadBodySchema,
  messageIdParamSchema,
  mediaIdParamSchema,
  messageReactionBodySchema,
} from '../../validation/messaging';

const sendMessagePayloadSchema = z.object({
  text: z.string().nullable().optional(),
  clientMessageId: z.string().uuid(),
});

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

  async recordHeartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await messagingService.recordHeartbeat(req.user!.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async recordTyping(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const data = await messagingService.recordTyping(req.user!.id, id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);

      let rawPayload: unknown = req.body;
      if (typeof req.body?.payload === 'string') {
        try {
          rawPayload = JSON.parse(req.body.payload);
        } catch {
          throw new AppError('VALIDATION_FAILED', 400, 'Payload JSON không hợp lệ');
        }
      }

      const parsedPayload = sendMessagePayloadSchema.parse(rawPayload);
      const filesMap = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const images = filesMap.images || [];
      const files = filesMap.file || [];

      const { message, created } = await messagingService.sendMessage(req.user!.id, id, {
        text: parsedPayload.text,
        clientMessageId: parsedPayload.clientMessageId,
        images,
        files,
      });

      res.status(created ? 201 : 200).json({ data: message });
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 429) {
        res.setHeader('Retry-After', String((err as any).retryAfterSeconds || 60));
      }
      next(err);
    }
  }

  async listMessagesHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const { beforeSeq, limit } = messagesHistoryQuerySchema.parse(req.query);
      const result = await messagingService.listMessagesHistory(req.user!.id, id, beforeSeq, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async syncConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const params = messagesSyncQuerySchema.parse(req.query);
      const data = await messagingService.syncConversation(req.user!.id, id, params);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async markConversationRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = conversationIdParamSchema.parse(req.params);
      const { seq } = markReadBodySchema.parse(req.body);
      const data = await messagingService.markConversationRead(req.user!.id, id, seq);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async setMessageReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = messageIdParamSchema.parse(req.params);
      const { type } = messageReactionBodySchema.parse(req.body);
      const data = await messagingService.setMessageReaction(req.user!.id, id, type);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async removeMessageReaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = messageIdParamSchema.parse(req.params);
      const data = await messagingService.removeMessageReaction(req.user!.id, id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async downloadMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = mediaIdParamSchema.parse(req.params);
      const { bytes, mimeType, kind, originalName } = await messagingService.downloadMedia(
        req.user!.id,
        id
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      if (kind === 'FILE') {
        const safeName = (originalName || `attachment-${id}`).replace(/["\\]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      } else {
        res.setHeader('Content-Disposition', 'inline');
      }

      res.status(200).send(bytes);
    } catch (err) {
      next(err);
    }
  }
}

export const messagingController = new MessagingController();

