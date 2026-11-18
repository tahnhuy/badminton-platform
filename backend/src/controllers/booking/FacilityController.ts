import { Request, Response, NextFunction } from 'express';
import { bookingService, BookingService } from '../../services/booking/booking.service';
import { CourtSearchQuery, FacilityDetailQuery } from '../../validation/booking';

export class FacilityController {
  constructor(private readonly service: BookingService = bookingService) {}

  searchFacilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as CourtSearchQuery;
      const result = await this.service.searchFacilities(query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

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
