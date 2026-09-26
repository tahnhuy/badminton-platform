export interface PaymentInitiation {
  paymentId: number;
  amount: string;
  redirectUrl: string;
}

export interface CreateBookingPaymentInput {
  bookingId: number;
  actorId: number;
}

export interface CreateRegistrationPaymentInput {
  registrationId: number;
  actorId: number;
}

export interface RefundPaymentInput {
  paymentId: number;
  reason: string;
}

export interface PaymentService {
  createBookingPayment(input: CreateBookingPaymentInput): Promise<PaymentInitiation>;
  createRegistrationPayment(input: CreateRegistrationPaymentInput): Promise<PaymentInitiation>;
  refundPayment(input: RefundPaymentInput): Promise<void>;
}
