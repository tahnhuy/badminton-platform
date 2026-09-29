import { Request, Response, NextFunction } from 'express';
import { bookingService, BookingService } from '../../services/booking/booking.service';
import {
  CourtSearchQuery,
  CourtAvailabilityQuery,
  courtIdParamSchema,
  courtSearchQuerySchema,
  courtAvailabilityQuerySchema,
} from '../../validation/booking';

export { courtIdParamSchema, courtSearchQuerySchema, courtAvailabilityQuerySchema };

export class CourtController {
  constructor(private readonly service: BookingService = bookingService) {}

  searchCourts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as CourtSearchQuery;
      const result = await this.service.searchCourts(query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const query = req.query as unknown as CourtAvailabilityQuery;
      const result = await this.service.getCourtAvailability(
        id,
        query.date,
        query.durationMinutes ?? null
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const courtController = new CourtController();
