import { Request, Response, NextFunction } from 'express';
import { facilityReviewService as service } from '../../services/admin/FacilityReviewService';
export const facilityReviewController = {
  queue() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { page, limit, search, status, target, sort, range, startDate, endDate } = req.query as unknown as {
          sort?: 'newest' | 'oldest';
          page: number;
          limit: number;
          search?: string;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          target?: 'FACILITY' | 'COURT';
          range: 'day' | 'month' | 'year' | 'custom';
          startDate?: string;
          endDate?: string;
        };
        res.json(await service.list({ range, startDate, endDate, search, status, target, sort }, page, limit));
      } catch (error) { next(error); }
    };
  },
  pendingCount() {
    return async (_req: Request, res: Response, next: NextFunction) => {
      try {
        res.json({ data: { total: await service.pendingCount() } });
      } catch (error) { next(error); }
    };
  },
  decide(approve: boolean, kind: 'ONBOARDING' | 'ADDRESS_CHANGE' | 'COURT_DELETION', court = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const facilityId = Number(req.params.facilityId ?? req.params.id);
        const reviewId = Number(req.params.reviewId ?? req.body.reviewId);
        res.json({ data: await service.decide(req.user!.id, facilityId, reviewId, approve, kind, req.body.reason, court ? Number(req.params.courtId) : undefined) });
      } catch (error) { next(error); }
    };
  },
  history(court = false) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try { res.json(await service.history(Number(req.params.facilityId ?? req.params.id), Number(req.query.page), Number(req.query.limit), court ? Number(req.params.courtId) : undefined)); } catch (error) { next(error); }
    };
  },
};
