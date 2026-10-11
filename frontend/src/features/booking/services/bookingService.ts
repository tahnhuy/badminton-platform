import { httpClient } from '../../../shared/api/http-client';
import type {
  BookingDetail,
  CancelBookingResult,
  CourtAvailability,
  CourtSearchParams,
  CourtSearchResponse,
  CreateBookingInput,
  FacilityDetail,
  MyBookingsParams,
  MyBookingsResponse,
} from '../types/booking';

function buildQuery(params: CourtSearchParams): string {
  const query = new URLSearchParams();
  if (params.city) query.set('city', params.city);
  if (params.district) query.set('district', params.district);
  if (params.date) query.set('date', params.date);
  if (params.startTime) query.set('startTime', params.startTime);
  if (params.endTime) query.set('endTime', params.endTime);
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 9));
  return query.toString();
}

export const bookingService = {
  async searchCourts(params: CourtSearchParams): Promise<CourtSearchResponse> {
    return httpClient<CourtSearchResponse>(`/api/v1/courts?${buildQuery(params)}`);
  },

  async getCourtAvailability(
    courtId: number,
    date: string,
    durationMinutes?: number
  ): Promise<CourtAvailability> {
    const query = new URLSearchParams({ date });
    if (durationMinutes) query.set('durationMinutes', String(durationMinutes));
    const response = await httpClient<{ data: CourtAvailability }>(
      `/api/v1/courts/${courtId}/availability?${query.toString()}`
    );
    return response.data;
  },

  async getFacilityDetail(facilityId: number, date?: string): Promise<FacilityDetail> {
    const query = new URLSearchParams();
    if (date) query.set('date', date);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await httpClient<{ data: FacilityDetail }>(
      `/api/v1/facilities/${facilityId}${suffix}`
    );
    return response.data;
  },

  async createBooking(input: CreateBookingInput): Promise<BookingDetail> {
    const response = await httpClient<{ data: BookingDetail }>('/api/v1/bookings', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  async getMyBookings(params: MyBookingsParams): Promise<MyBookingsResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.timeScope) query.set('timeScope', params.timeScope);
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(params.limit ?? 10));
    return httpClient<MyBookingsResponse>(`/api/v1/bookings/my-bookings?${query.toString()}`);
  },

  async getBookingDetail(bookingId: number): Promise<BookingDetail> {
    const response = await httpClient<{ data: BookingDetail }>(`/api/v1/bookings/${bookingId}`);
    return response.data;
  },

  async cancelBooking(bookingId: number): Promise<CancelBookingResult> {
    const response = await httpClient<{ data: CancelBookingResult }>(
      `/api/v1/bookings/${bookingId}/cancel`,
      { method: 'POST' }
    );
    return response.data;
  },
};
