import { Request, Response, NextFunction } from 'express';
import { bookingService, BookingService } from '../../services/booking/booking.service';
import { UnauthorizedError } from '../../errors/AppError';
import { CreateBookingBody, MyBookingsQuery } from '../../validation/booking';

export class BookingController {
  constructor(private readonly service: BookingService = bookingService) {}

  private actorId(req: Request): number {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    }
    return req.user.id;
  }

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateBookingBody;
      const booking = await this.service.createBooking(this.actorId(req), body);
      res.status(201).json({ data: booking });
    } catch (err) {
      next(err);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as MyBookingsQuery;
      const result = await this.service.listMyBookings(this.actorId(req), query);
      res.status(200).json({ data: result.items, meta: result.meta });
    } catch (err) {
      next(err);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const booking = await this.service.getBookingDetail(this.actorId(req), id);
      res.status(200).json({ data: booking });
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const result = await this.service.cancelBooking(this.actorId(req), id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const bookingController = new BookingController();
