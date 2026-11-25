import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.middleware';
import { ownerIdParams, ownerPage } from '../../validation/owner';
import { facilityHandoverService as service } from '../../services/owner/FacilityHandoverService';

const text = z.string().trim().min(10).max(5000);
function respond(operation: (req: Request) => Promise<unknown>, status = 200) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(status).json({ data: await operation(req) }); } catch (error) { next(error); }
  };
}
export const ownerHandoverRoutes = Router();
ownerHandoverRoutes.get('/', validate({ query: ownerPage }), respond(req => service.list(req.user!.id, Number(req.query.page), Number(req.query.limit))));
ownerHandoverRoutes.post('/', validate({ body: z.object({ facilityId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), evidence: text }).strict() }), respond(req => service.request(req.user!.id, req.body.facilityId, req.body.evidence), 201));
ownerHandoverRoutes.get('/:id/preview', validate({ params: ownerIdParams }), respond(req => service.preview(req.user!.id, Number(req.params.id))));
ownerHandoverRoutes.post('/:id/confirm', validate({ params: ownerIdParams, body: z.object({ acknowledged: z.literal(true), snapshot: z.record(z.string(), z.unknown()) }).strict() }), respond(req => service.confirm(req.user!.id, Number(req.params.id), req.body.snapshot)));

export const adminHandoverRoutes = Router();
adminHandoverRoutes.get('/', validate({ query: ownerPage }), respond(req => service.list(null, Number(req.query.page), Number(req.query.limit))));
adminHandoverRoutes.post('/:id/decision', validate({ params: ownerIdParams, body: z.object({ approve: z.boolean(), reason: text }).strict() }), respond(req => service.decide(req.user!.id, Number(req.params.id), req.body.approve, req.body.reason)));
