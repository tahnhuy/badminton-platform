import { bookingService } from '../booking/booking.service';

/**
 * CO-05: Owner cancellation. Eligibility (ownership, status, tournament system
 * booking exclusion, start time and the OWNER_* policy) lives in the shared
 * Booking cancellation transaction so the booking state, its refund intent, the
 * linked Match cancellation job and the Player notification commit atomically.
 */
export const ownerBookingCancellationService = {
  async cancel(ownerId: number, bookingId: number, reason: string) {
    const result = await bookingService.cancelBookingAsOwner(ownerId, bookingId, reason);
    return { id: result.id, status: result.status, refundStatus: result.refundStatus };
  },
};
