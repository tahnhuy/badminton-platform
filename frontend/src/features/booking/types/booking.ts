export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CourtFacilitySummary {
  id: number;
  name: string;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  phone: string;
  openingTime: string;
  closingTime: string;
}

export interface CourtSummary {
  id: number;
  name: string;
  description: string | null;
  priceFrom: number | null;
  available: boolean;
  facility: CourtFacilitySummary;
}

export interface FreeSegment {
  startTime: string;
  endTime: string;
  price: number;
}

export interface FreeInterval {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  segments: FreeSegment[];
  estimatedPrice: number | null;
}

export interface CourtAvailability {
  date: string;
  durationMinutes: number | null;
  court: {
    id: number;
    name: string;
    description: string | null;
    status: string;
  };
  facility: {
    id: number;
    name: string;
    address: string;
    ward: string | null;
    district: string;
    city: string;
    phone: string;
  };
  openingTime: string;
  closingTime: string;
  intervals: FreeInterval[];
}

export interface CourtSearchParams {
  city?: string;
  district?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

export interface CourtSearchResponse {
  data: CourtSummary[];
  meta: PageMeta;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RefundStatus = 'NONE' | 'PENDING' | 'REFUND_PENDING' | 'REFUNDED' | 'REFUND_FAILED';

export interface BookingSummary {
  id: number;
  bookingCode: string;
  status: BookingStatus;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  unitPrice: number;
  totalAmount: number;
  expiresAt: string | null;
  refundStatus: RefundStatus;
  court: { id: number; name: string };
  facility: {
    id: number;
    name: string;
    address: string;
    ward: string | null;
    district: string;
    city: string;
  };
  createdAt: string;
}

export interface BookingPricingDetail {
  startTime: string;
  endTime: string;
  price: number;
  amount: number;
}

export interface BookingDetail extends BookingSummary {
  pricingDetails: BookingPricingDetail[];
  payment: { id: number; status: string; amount: number; paidAt: string | null } | null;
}

export interface MyBookingsParams {
  status?: BookingStatus;
  timeScope?: 'UPCOMING' | 'PAST' | 'ALL';
  page?: number;
  limit?: number;
}

export interface MyBookingsResponse {
  data: BookingSummary[];
  meta: PageMeta;
}

export interface CancelBookingResult {
  id: number;
  status: BookingStatus;
  refundStatus: RefundStatus;
}

export interface CreateBookingInput {
  courtId: number;
  bookingDate: string;
  startTime: string;
  durationMinutes: number;
}

export interface FacilityCourt {
  id: number;
  name: string;
  description: string | null;
  status: string;
  priceFrom: number | null;
}

export interface FacilityDetail {
  id: number;
  name: string;
  description: string | null;
  phone: string;
  status: string;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  latitude: string;
  longitude: string;
  openingTime: string;
  closingTime: string;
  courts: FacilityCourt[];
}

