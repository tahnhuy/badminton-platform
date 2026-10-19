import { db } from '../../db';
import { env } from '../../shared/config/env';
import { paymentRepository, PaymentRecord } from '../../repositories/payment/PaymentRepository';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { bookingService } from '../booking/booking.service';
import { PaymentProviderFactory } from './provider.factory';
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
    const bookingResult = await bookingRepository.findBookingById(input.bookingId);
    if (!bookingResult) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    const { booking } = bookingResult;
    if (booking.playerId !== input.actorId) {
      throw new ForbiddenError('You are not authorized to pay for this booking', 'BOOKING_NOT_OWNER');
    }

    if (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED') {
      const existingPayment = await paymentRepository.findByBookingId(booking.id);
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

    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      throw new AppError('BOOKING_HOLD_EXPIRED', 400, 'Booking payment window has expired');
    }

    const providerName = input.provider || env.PAYMENT_PROVIDER;
    const provider = PaymentProviderFactory.getProvider(providerName);

    // Reuse pending payment record if exists
    let payment = await paymentRepository.findByBookingId(booking.id);
    if (!payment || payment.status !== 'PENDING') {
      payment = await paymentRepository.create({
        bookingId: booking.id,
        amount: String(booking.totalAmount),
        provider: provider.name,
        paymentMethod: 'ONLINE',
        status: 'PENDING',
      });
    }

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
  }

  async processMockPaymentConfirm(input: MockPaymentConfirmInput): Promise<MockPaymentConfirmResult> {
    const payment = await paymentRepository.findById(input.paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    }

    if (payment.bookingId !== input.bookingId) {
      throw new AppError('INVALID_PAYMENT', 400, 'Payment does not match the booking');
    }

    const bookingResult = await bookingRepository.findBookingById(input.bookingId);
    if (!bookingResult) {
      throw new NotFoundError('Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (bookingResult.booking.playerId !== input.actorId) {
      throw new ForbiddenError('You are not authorized to pay for this booking', 'BOOKING_NOT_OWNER');
    }

    // Handle intentional simulated failure
    if (input.simulateFailure) {
      await paymentRepository.updateStatus(payment.id, 'FAILED');
      return {
        success: false,
        bookingStatus: bookingResult.booking.status,
        paymentStatus: 'FAILED',
        message: 'Mock payment was simulated as failed',
      };
    }

    // Idempotent: already success
    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        bookingStatus: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        transactionId: payment.transactionId || undefined,
      };
    }

    // Process confirmation via booking service
    const confirmResult = await bookingService.confirmBooking({
      bookingId: input.bookingId,
      paymentId: payment.id,
    });

    const mockTransactionId = `MOCK_TXN_${Date.now()}_${payment.id}`;

    if (confirmResult.refundSignal) {
      // Hold expired or booking cannot be confirmed -> transition payment to REFUNDED
      await paymentRepository.updateStatus(payment.id, 'REFUNDED', new Date());
      await paymentRepository.updateTransactionId(payment.id, mockTransactionId);

      return {
        success: false,
        bookingStatus: confirmResult.status,
        paymentStatus: 'REFUNDED',
        transactionId: mockTransactionId,
        message: 'Booking hold expired before payment was finalized; transaction marked as refunded.',
      };
    }

    // Normal success
    await paymentRepository.updateStatus(payment.id, 'SUCCESS', new Date());
    await paymentRepository.updateTransactionId(payment.id, mockTransactionId);

    logger.info('Mock payment completed successfully', {
      paymentId: payment.id,
      bookingId: input.bookingId,
      transactionId: mockTransactionId,
    });

    return {
      success: true,
      bookingStatus: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      transactionId: mockTransactionId,
    };
  }

  async getPaymentById(paymentId: number, actorId: number, actorRole: string): Promise<PaymentRecord> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new NotFoundError('Payment not found', 'PAYMENT_NOT_FOUND');
    }

    if (actorRole !== 'ADMIN') {
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
