import { Request, Response, NextFunction } from 'express';
import { paymentService, PaymentService } from '../../services/payments/payment.service';
import { UnauthorizedError } from '../../errors/AppError';

export class PaymentController {
  constructor(private readonly service: PaymentService = paymentService) {}

  private actorId(req: Request): number {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'AUTH_SESSION_INVALID');
    }
    return req.user.id;
  }

  createBookingPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { provider } = req.body as { provider?: string };
      const result = await this.service.createBookingPayment({
        bookingId: id,
        actorId: this.actorId(req),
        provider,
      });
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  mockConfirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { bookingId, paymentId, simulateFailure } = req.body as {
        bookingId: number;
        paymentId: number;
        simulateFailure?: boolean;
      };
      const result = await this.service.processMockPaymentConfirm({
        bookingId,
        paymentId,
        actorId: this.actorId(req),
        simulateFailure,
      });
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  detail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const user = req.user!;
      const result = await this.service.getPaymentById(id, user.id, user.role);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}

export const paymentController = new PaymentController();
