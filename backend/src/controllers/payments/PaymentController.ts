import { Request, Response, NextFunction } from 'express';
import { paymentService, PaymentService } from '../../services/payments/payment.service';
import { walletTopUpService } from '../../services/payments/WalletTopUpService';
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

  sepayCheckout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { action, fields } = await walletTopUpService.buildSepayCheckout(id, this.actorId(req));
      const inputs = Object.entries(fields)
        .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`)
        .join('');
      res.status(200).type('html').send(`<!doctype html><html><body>
<form id="sepay-form" method="POST" action="${escapeHtml(action)}">${inputs}</form>
<script>document.getElementById('sepay-form').submit();</script>
</body></html>`);
    } catch (err) {
      next(err);
    }
  };

  sepayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const secret = req.headers['x-secret-key'];
      await walletTopUpService.handleSepayWebhook(
        (req.body ?? {}) as Record<string, unknown>,
        typeof secret === 'string' ? secret : undefined,
      );
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  sepayBankWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});
      const signature = req.headers['x-sepay-signature'];
      const timestamp = req.headers['x-sepay-timestamp'];
      await walletTopUpService.handleSepayBankWebhook(
        rawBody,
        typeof signature === 'string' ? signature : undefined,
        typeof timestamp === 'string' ? timestamp : undefined,
      );
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  vnpayWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await walletTopUpService.handleWebhook({ ...(req.query as Record<string, unknown>), ...(req.body as Record<string, unknown>) });
      res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
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


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const paymentController = new PaymentController();
