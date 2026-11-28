import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { partnershipRequestService as service } from '../../services/partnership/PartnershipRequestService';
import type {
  ownerRequestApproveBodySchema, ownerRequestBodySchema, ownerRequestListQuerySchema,
  ownerRequestNoteBodySchema, ownerRequestRejectBodySchema,
} from '../../validation/partnership';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const handle = (fn: (req: Request, res: Response) => Promise<void>): Handler => async (req, res, next) => {
  try { await fn(req, res); } catch (error) { next(error); }
};
const idOf = (req: Request) => Number((req.params as { id: string | number }).id);

/** Public form and Admin queue for Court Owner partnership requests (Tech Design §5). */
export const partnershipRequestController = {
  availability: handle(async (_req, res) => {
    res.status(200).json({ data: { enabled: await service.isEnabled() } });
  }),
  submit: handle(async (req, res) => {
    await service.submit(req.body as z.infer<typeof ownerRequestBodySchema>, req.ip);
    res.status(202).json({ data: { received: true } });
  }),
  list: handle(async (req, res) => {
    res.status(200).json(await service.list(req.query as unknown as z.infer<typeof ownerRequestListQuerySchema>));
  }),
  pendingCount: handle(async (_req, res) => {
    res.status(200).json({ data: { count: await service.pendingCount() } });
  }),
  get: handle(async (req, res) => {
    res.status(200).json({ data: await service.get(idOf(req)) });
  }),
  saveNote: handle(async (req, res) => {
    const { adminNote } = req.body as z.infer<typeof ownerRequestNoteBodySchema>;
    res.status(200).json({ data: await service.saveNote(idOf(req), adminNote) });
  }),
  contact: handle(async (req, res) => {
    res.status(200).json({ data: await service.markContacted(idOf(req)) });
  }),
  approve: handle(async (req, res) => {
    res.status(200).json({ data: await service.approve(req.user!.id, idOf(req), req.body as z.infer<typeof ownerRequestApproveBodySchema>) });
  }),
  reject: handle(async (req, res) => {
    const { reason } = req.body as z.infer<typeof ownerRequestRejectBodySchema>;
    res.status(200).json({ data: await service.reject(req.user!.id, idOf(req), reason) });
  }),
};
