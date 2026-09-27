export interface ConfirmBookingInput {
  bookingId: number;
  paymentId: number;
}

export interface BookingService {
  confirmBooking(input: ConfirmBookingInput): Promise<void>;
}
