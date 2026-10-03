import { bookingRepository } from '../../repositories/booking/BookingRepository';

export const BOOKING_STATE_BATCH_SIZE = 200;

export interface BookingStateSweepResult {
  expired: number;
  started: number;
  completed: number;
}

export class BookingStateService {
  async runOnce(batchSize: number = BOOKING_STATE_BATCH_SIZE): Promise<BookingStateSweepResult> {
    const expired = await bookingRepository.expireDueBookings(batchSize);
    const started = await bookingRepository.advanceConfirmedToInProgress(batchSize);
    const completed = await bookingRepository.advanceInProgressToCompleted(batchSize);
    return { expired, started, completed };
  }
}

export const bookingStateService = new BookingStateService();
