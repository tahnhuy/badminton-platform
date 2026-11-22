export interface ConfirmBookingInput {
  bookingId: number;
  paymentId: number;
}

/**
 * Tournament court reservations are system-owned: no payment, no refund, no
 * Player-facing cancel. Their tournament identity is the existing
 * TOURNAMENT_MATCHES → MATCHES.booking_id link (Owner Tech Design §7.7), not a
 * separate BOOKINGS.source column.
 */
export type BookingSource = 'TOURNAMENT';

export interface CreateSystemBookingInput {
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  source: BookingSource;
  /** TOURNAMENT_MATCHES.id (the tournament bracket match being scheduled). */
  sourceId: number;
  actorId: number;
}

export interface ReleaseSystemBookingInput {
  bookingId: number;
  reason: string;
}

export interface SystemBookingResult {
  bookingId: number;
}

export interface BookingService {
  confirmBooking(input: ConfirmBookingInput): Promise<void>;
  createSystemBooking(input: CreateSystemBookingInput): Promise<SystemBookingResult>;
  releaseSystemBooking(input: ReleaseSystemBookingInput): Promise<void>;
}
