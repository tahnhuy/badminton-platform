import { db } from '../../db';
import { bookingEvents } from '../booking/booking-events';
import { env } from '../../shared/config/env';
import { paymentRepository, PaymentRecord } from '../../repositories/payment/PaymentRepository';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { bookingService } from '../booking/booking.service';
import { PaymentProviderFactory } from './provider.factory';
import { walletService } from './WalletService';
import { ownerEarningService } from '../finance/OwnerEarningService';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { logger } from '../../shared/logging/logger';
import { PaymentInitiation, CreateBookingPaymentInput } from '../../contracts/PaymentService';

export interface BookingPaymentInitiation extends PaymentInitiation {
  bookingId: number;
  bookingCode: string;
  isMock: boolean;
}

export interface MockPaymentConfirmInput {
  bookingId: number;
  paymentId: number;
  actorId: number;
  simulateFailure?: boolean;
}

export interface MockPaymentConfirmResult {
  success: boolean;
  bookingStatus: string;
  paymentStatus: string;
  transactionId?: string;
  message?: string;
}

export class PaymentService {
  async createBookingPayment(input: CreateBookingPaymentInput & { provider?: string }): Promise<BookingPaymentInitiation> {
    const providerName = (input.provider || env.PAYMENT_PROVIDER).toUpperCase();
    if (providerName === 'WALLET') {
      return this.createWalletBookingPayment(input);
    }
    if (providerName === 'SEPAY') {
      throw new AppError(
        'PAYMENT_PROVIDER_UNSUPPORTED_FOR_BOOKING',
        400,
        'SePay is only available for wallet top-ups; booking payments use WALLET, VNPAY or MOCK',
      );
    }

    return db.transaction(async (tx) => {
      const booking = await bookingRepository.lockBookingById(input.bookingId, tx);
      if (!booking) {
        throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      }

      if (booking.playerId !== input.actorId) {
        throw new ForbiddenError('You are not authorized to pay for this booking', 'BOOKING_NOT_OWNER');
      }

      if (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED') {
        const existingPayment = await paymentRepository.findByBookingId(booking.id, tx);
        if (existingPayment && existingPayment.status === 'SUCCESS') {
          return {
            paymentId: existingPayment.id,
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            amount: String(existingPayment.amount),
            redirectUrl: '',
            isMock: existingPayment.provider === 'MOCK',
          };
        }
        throw new AppError('BOOKING_ALREADY_CONFIRMED', 400, 'Booking has already been confirmed');
      }

      if (booking.status !== 'PENDING_PAYMENT') {
        throw new AppError('BOOKING_NOT_PAYABLE', 400, `Booking is in ${booking.status} status and cannot be paid`);
      }

      if (!booking.expiresAt || booking.expiresAt.getTime() <= Date.now()) {
        throw new AppError('BOOKING_HOLD_EXPIRED', 400, 'Booking payment window has expired');
      }

      let provider = PaymentProviderFactory.getProvider(providerName);

      // Reuse pending payment record if exists
      let payment = await paymentRepository.findByBookingId(booking.id, tx);
      if (!payment || payment.status !== 'PENDING') {
        payment = await paymentRepository.create({
          bookingId: booking.id,
          amount: String(booking.totalAmount),
          provider: provider.name,
          paymentMethod: 'ONLINE',
          status: 'PENDING',
        }, tx);
      }

      provider = PaymentProviderFactory.getProvider(payment.provider);
      const paymentUrl = await provider.createPaymentUrl({
        paymentId: payment.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        amount: Number(payment.amount),
      });

      return {
        paymentId: payment.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        amount: String(payment.amount),
        redirectUrl: paymentUrl || '',
        isMock: provider.name === 'MOCK',
      };
    });
  }

  private async createWalletBookingPayment(input: CreateBookingPaymentInput): Promise<BookingPaymentInitiation> {
    const outcome = await db.transaction(async (tx) => {
      // Notification persistence takes a KEY SHARE lock on the recipient's USERS row.
      // Lock the owner before the Booking (rank 10 → 80) so a concurrent Matchmaking
      // departure (which locks USERS before BOOKING) cannot deadlock with confirmation.
      const ownerId = await bookingRepository.findBookingOwner(input.bookingId, tx);
      if (ownerId) await bookingRepository.lockPlayer(ownerId, tx);
      const booking = await bookingRepository.lockBookingById(input.bookingId, tx);
      if (!booking) throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      if (booking.playerId !== input.actorId) {
        throw new ForbiddenError('You are not authorized to pay for this booking', 'BOOKING_NOT_OWNER');
      }

      const existing = await paymentRepository.findByBookingId(booking.id, tx);
      if (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED') {
        if (existing?.status === 'SUCCESS') {
          return {
            result: {
              paymentId: existing.id,
              bookingId: booking.id,
              bookingCode: booking.bookingCode,
              amount: String(existing.amount),
              redirectUrl: '',
              isMock: false,
            },
            event: null,
          };
        }
        throw new AppError('BOOKING_ALREADY_CONFIRMED', 400, 'Booking has already been confirmed');
      }
      if (booking.status !== 'PENDING_PAYMENT') {
        throw new AppError('BOOKING_NOT_PAYABLE', 409, `Booking is in ${booking.status} status and cannot be paid`);
      }
      if (!booking.expiresAt || booking.expiresAt.getTime() <= Date.now()) {
        throw new AppError('BOOKING_HOLD_EXPIRED', 409, 'Booking payment window has expired');
      }

      const amount = String(booking.totalAmount);
      await walletService.debit({
        userId: booking.playerId,
        amount,
        entryType: 'PAYMENT',
        referenceType: 'BOOKING',
        referenceId: booking.id,
        idempotencyKey: `booking-payment:${booking.id}`,
        description: `Thanh toán booking ${booking.bookingCode}`,
      }, tx);

      const payment = await paymentRepository.create({
        bookingId: booking.id,
        amount,
        provider: 'WALLET',
        paymentMethod: 'WALLET',
        status: 'SUCCESS',
        transactionId: `WALLET-${booking.id}-${Date.now()}`,
        paidAt: new Date(),
      }, tx);

      const confirmation = await bookingService.confirmBookingInTransaction(
        { bookingId: booking.id, paymentId: payment.id },
        tx,
      );
      if (confirmation.refundSignal) {
        await walletService.credit({
          userId: booking.playerId,
          amount,
          entryType: 'REFUND',
          referenceType: 'BOOKING',
          referenceId: booking.id,
          idempotencyKey: `booking-payment-refund:${booking.id}`,
          description: `Hoàn ví booking ${booking.bookingCode}`,
        }, tx);
        await paymentRepository.updateStatus(payment.id, 'REFUNDED', new Date(), tx);
      } else {
        await ownerEarningService.settleBooking(booking.id, tx);
      }

      return {
        result: {
          paymentId: payment.id,
          bookingId: booking.id,
          bookingCode: booking.bookingCode,
          amount,
          redirectUrl: '',
          isMock: false,
        },
        event: confirmation.event,
      };
    });

    if (outcome.event) bookingEvents.publish({ type: outcome.event, bookingId: input.bookingId });
    return outcome.result;
  }

  async processMockPaymentConfirm(input: MockPaymentConfirmInput): Promise<MockPaymentConfirmResult> {
    if (env.NODE_ENV === 'production') {
      throw new AppError('PAYMENT_PROVIDER_MOCK_FORBIDDEN', 403, 'Mock payment confirmation is not available in production');
    }
    const outcome = await db.transaction(async (tx) => {
      // Use the same lock order as initiation and booking cancellation: USERS → BOOKING.
      const ownerId = await bookingRepository.findBookingOwner(input.bookingId, tx);
      if (ownerId) await bookingRepository.lockPlayer(ownerId, tx);
      const booking = await bookingRepository.lockBookingById(input.bookingId, tx);
      if (!booking) throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
      if (booking.playerId !== input.actorId) {
        throw new ForbiddenError('You are not authorized to pay for this booking', 'BOOKING_NOT_OWNER');
      }
      const payment = await paymentRepository.lockById(input.paymentId, tx);
      if (!payment) throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
      if (payment.bookingId !== booking.id || payment.provider !== 'MOCK') {
        throw new AppError('INVALID_PAYMENT', 400, 'Payment does not match the booking or provider');
      }
      if (payment.status !== 'PENDING') {
        return { result: {
          success: payment.status === 'SUCCESS',
          bookingStatus: booking.status,
          paymentStatus: payment.status,
          transactionId: payment.transactionId || undefined,
        }, event: null };
      }
      if (input.simulateFailure) {
        await paymentRepository.updateStatus(payment.id, 'FAILED', undefined, tx);
        return { result: {
          success: false, bookingStatus: booking.status, paymentStatus: 'FAILED',
          message: 'Mock payment was simulated as failed',
        }, event: null };
      }
      const confirmation = await bookingService.confirmBookingInTransaction(input, tx);
      const transactionId = `MOCK_TXN_${Date.now()}_${payment.id}`;
      const paymentStatus = confirmation.refundSignal ? 'REFUNDED' : 'SUCCESS';
      await paymentRepository.updateStatus(payment.id, paymentStatus, new Date(), tx);
      await paymentRepository.updateTransactionId(payment.id, transactionId, tx);
      if (!confirmation.refundSignal) {
        await ownerEarningService.settleBooking(booking.id, tx);
      }
      return { result: {
        success: !confirmation.refundSignal,
        bookingStatus: confirmation.status,
        paymentStatus,
        transactionId,
        ...(confirmation.refundSignal ? { message: 'Booking is no longer payable; mock payment refunded.' } : {}),
      }, event: confirmation.event };
    });
    if (outcome.event) bookingEvents.publish({ type: outcome.event, bookingId: input.bookingId });
    return outcome.result;
  }

  async getPaymentById(paymentId: number, actorId: number, actorRole: string): Promise<PaymentRecord> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    }

    if (actorRole !== 'ADMIN') {
      if (!payment.bookingId) {
        throw new ForbiddenError('You do not have permission to view this payment', 'PAYMENT_FORBIDDEN');
      }
      if (payment.bookingId) {
        const bookingResult = await bookingRepository.findBookingById(payment.bookingId);
        if (!bookingResult || bookingResult.booking.playerId !== actorId) {
          throw new ForbiddenError('You do not have permission to view this payment', 'PAYMENT_FORBIDDEN');
        }
      }
    }

    return payment;
  }

  async refundBookingPayment(bookingId: number, reason: string): Promise<void> {
    const payment = await paymentRepository.findByBookingId(bookingId);
    if (payment && payment.status === 'SUCCESS') {
      await paymentRepository.updateStatus(payment.id, 'REFUNDED');
      logger.info('Booking payment marked as REFUNDED', { bookingId, paymentId: payment.id, reason });
    }
  }
}

export const paymentService = new PaymentService();
