import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { db } from '../../db';
import { notificationService } from '../notifications/NotificationService';

export const BOOKING_STATE_BATCH_SIZE = 200;

export interface BookingStateSweepResult {
  expired: number;
  started: number;
  completed: number;
}

export class BookingStateService {
  async runOnce(batchSize: number = BOOKING_STATE_BATCH_SIZE): Promise<BookingStateSweepResult> {
    const expired = await db.transaction(async (tx) => {
      const due = await bookingRepository.findDueExpirations(batchSize, tx);
      await bookingRepository.lockUsersAscending(due.map((row: { playerId: number }) => row.playerId), tx);
      const rows = await bookingRepository.expireBookingsByIds(due.map((row: { id: number }) => row.id), tx);
      if (rows.length > 0) {
        await notificationService.notify(tx, rows.map((row: { id: number; playerId: number }) => ({
          recipientId: row.playerId,
          type: 'BOOKING_EXPIRED',
          title: 'Lịch đặt sân đã hết hạn',
          content: 'Lịch giữ sân đã hết thời gian thanh toán và không còn hiệu lực.',
          resource: { type: 'BOOKING', id: row.id },
          dedupKey: `booking:${row.id}:BOOKING_EXPIRED`,
        })));
      }
      return rows.length;
    });
    const started = await bookingRepository.advanceConfirmedToInProgress(batchSize);
    const completed = await bookingRepository.advanceInProgressToCompleted(batchSize);
    return { expired, started, completed };
  }
}

export const bookingStateService = new BookingStateService();
