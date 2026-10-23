import { ownerScheduleService } from '../../services/owner/OwnerScheduleService';
import { ownerSlotBlockService } from '../../services/owner/OwnerSlotBlockService';
import { ownerBookingReadService } from '../../services/owner/OwnerBookingReadService';
import type { OwnerHistoryFilter } from '../../repositories/owner/OwnerBookingReadRepository';
import { Request, Response, NextFunction } from 'express';
import { ownerFacilityService as facilities } from '../../services/owner/OwnerFacilityService';
import { ownerCourtService as courts } from '../../services/owner/OwnerCourtService';
import { ownerPricingService as pricing } from '../../services/owner/OwnerPricingService';

type Operation = (req: Request) => Promise<unknown>;
function respond(operation: Operation, status = 200) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(status).json({ data: await operation(req) }); } catch (error) { next(error); }
  };
}
function page(req: Request) { return req.query as unknown as { page: number; limit: number; status?: string }; }
function collection(operation: Operation) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await operation(req)); } catch (error) { next(error); }
  };
}
export const ownerController = {
  schedule: respond(req => ownerScheduleService.read(req.user!.id, Number(req.params.id), String(req.query.date))),
  block: respond(req => ownerSlotBlockService.create(req.user!.id, Number(req.params.id), req.body), 201),
  unblock: respond(req => ownerSlotBlockService.release(req.user!.id, Number(req.params.id), req.body.blockId)),
  bookingDetail: respond(req => ownerBookingReadService.detail(req.user!.id, Number(req.params.id))),
  bookingHistory: collection(req => ownerBookingReadService.history(req.user!.id, Number(req.params.id), req.query as unknown as OwnerHistoryFilter)),
  facilities: collection(req => { const q = page(req); return facilities.list(req.user!.id, Number(req.query.page), q.limit, q.status); }),
  detail: respond(req => facilities.detail(req.user!.id, Number(req.params.id))),
  createFacility: respond(req => facilities.create(req.user!.id, req.body), 201),
  updateFacility: respond(req => facilities.update(req.user!.id, Number(req.params.id), req.body)),
  resubmitFacility: respond(req => facilities.resubmit(req.user!.id, Number(req.params.id))),
  addressChange: respond(req => facilities.addressChange(req.user!.id, Number(req.params.id), req.body), 201),
  facilityReviews: collection(req => { const q = page(req); return facilities.history(req.user!.id, Number(req.params.id), q.page, q.limit); }),
  createCourt: respond(req => courts.create(req.user!.id, Number(req.params.id), req.body), 201),
  updateCourt: respond(req => courts.update(req.user!.id, Number(req.params.id), req.body)),
  resubmitCourt: respond(req => courts.resubmit(req.user!.id, Number(req.params.id))),
  courtReviews: collection(req => { const q = page(req); return courts.history(req.user!.id, Number(req.params.id), q.page, q.limit); }),
  pricing: respond(req => pricing.list(req.user!.id, Number(req.params.id), req.query.validOn as string | undefined)),
  async savePricing(req: Request, res: Response, next: NextFunction) {
    try { const result = await pricing.save(req.user!.id, Number(req.params.id), req.body); res.status(result.created ? 201 : 200).json({ data: result.data }); } catch (error) { next(error); }
  },
};
