import { Request, Response, NextFunction } from 'express';
import { bookingService, BookingService } from '../../services/booking/booking.service';
import { FacilityDetailQuery } from '../../validation/booking';

export class FacilityController {
  constructor(private readonly service: BookingService = bookingService) {}

  getFacility = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const query = req.query as unknown as FacilityDetailQuery;
      const result = await this.service.getFacilityDetail(id, query.date);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const facilityController = new FacilityController();
