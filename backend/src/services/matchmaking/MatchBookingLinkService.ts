import { AppError, NotFoundError } from '../../errors/AppError';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { matchmakingNotifications } from './matchmaking-notifications';
import { runLocked } from './RecruitmentLifecycleService';
import { addMinutes, dateTimeToInstant } from './matchmaking-time.util';

const matchNotFound = () => new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');
const invalidBooking = (message = 'Booking không hợp lệ cho kèo này') =>
  new AppError('MATCH_BOOKING_INVALID', 409, message);
const alreadyLinked = () => new AppError('MATCH_BOOKING_ALREADY_LINKED', 409, 'Booking đã được liên kết với trận khác');
const notPendingCourt = () => new AppError('MATCH_NOT_PENDING_COURT', 409, 'Trận không ở trạng thái chờ sân');

interface RequestWindow {
  startAt: Date;
  durationMinutes: number;
}

function bookingInterval(booking: { bookingDate: string; startTime: string; endTime: string }) {
  return {
    start: dateTimeToInstant(booking.bookingDate, booking.startTime),
    end: dateTimeToInstant(booking.bookingDate, booking.endTime),
  };
}

function matchesRequestWindow(booking: { bookingDate: string; startTime: string; endTime: string }, request: RequestWindow): boolean {
  const interval = bookingInterval(booking);
  return interval.start.getTime() === request.startAt.getTime()
    && interval.end.getTime() === addMinutes(request.startAt, request.durationMinutes).getTime();
}

export class MatchBookingLinkService {
  /**
   * MM-07/MM-19: the host links a paid booking to a PENDING_COURT Match.
   * Lock order follows Matchmaking Tech Design §24.7.3 (users → request → Match
   * → Booking): the booking row is taken only after the Match is locked.
   */
  async linkBooking(actorId: number, matchId: number, bookingId: number) {
    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId);
    if (!link) throw matchNotFound();

    return runLocked(link.requestId, [actorId], async (tx, ctx) => {
      const request = ctx.request;
      if (request.playerId !== actorId) throw matchNotFound();
      if (!ctx.matchId || ctx.matchId !== matchId) throw matchNotFound();

      const match = await matchModule.lockMatch(matchId, tx);
      if (!match) throw matchNotFound();

      // Same-Match same-booking replay returns the current state (200).
      if (match.status === 'CONFIRMED' && match.bookingId === bookingId) {
        return {
          matchId,
          status: match.status,
          bookingId,
          courtId: match.courtId,
          scheduledAt: match.scheduledAt,
        };
      }
      if (match.status !== 'PENDING_COURT') throw notPendingCourt();
      if (match.bookingId && match.bookingId !== bookingId) throw alreadyLinked();

      const lockedBooking = await bookingRepository.lockBookingById(bookingId, tx);
      if (!lockedBooking) throw invalidBooking('Không tìm thấy booking');
      if (lockedBooking.playerId !== actorId) throw invalidBooking('Booking không thuộc chủ kèo');
      if (lockedBooking.status !== 'CONFIRMED') throw invalidBooking('Booking chưa được thanh toán hoặc không còn hiệu lực');

      const detail = await bookingRepository.findBookingById(bookingId, tx);
      if (!detail || detail.payment?.status !== 'SUCCESS') throw invalidBooking('Booking chưa được thanh toán');
      const tournament = await bookingRepository.findTournamentContextByBookingId(bookingId, tx);
      if (tournament) throw invalidBooking('Không thể dùng booking của giải đấu cho kèo giao lưu');

      const linked = await matchmakingRepository.findBookingsLinkedToOtherMatch(bookingId, tx);
      if (linked && linked.id !== matchId) throw alreadyLinked();

      const interval = bookingInterval(lockedBooking);
      if (interval.start.getTime() <= Date.now()) throw invalidBooking('Booking đã bắt đầu hoặc ở quá khứ');
      if (!matchesRequestWindow(lockedBooking, request)) {
        throw invalidBooking('Booking phải đúng ngày, giờ bắt đầu và thời lượng của kèo');
      }

      const updated = await matchModule.linkBooking({
        matchId,
        bookingId,
        courtId: lockedBooking.courtId,
        scheduledAt: interval.start,
      }, tx);
      if (!updated) throw notPendingCourt();

      await matchmakingRepository.linkRecruitmentBooking(request.id, bookingId, actorId, tx);
      await matchmakingNotifications.courtUpdated(
        tx,
        request.id,
        bookingId,
        ctx.accepted.map((member: { playerId: number }) => member.playerId),
        actorId,
      );

      return {
        matchId,
        status: 'CONFIRMED',
        bookingId,
        courtId: lockedBooking.courtId,
        scheduledAt: interval.start,
      };
    });
  }

  /**
   * Booking picker data for the host. Only paid CONFIRMED bookings of the host are
   * listed; each carries `eligible` + `reason` so the UI can disable invalid rows
   * instead of silently hiding every option.
   */
  async listCandidates(actorId: number, matchId: number) {
    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId);
    if (!link) throw matchNotFound();
    const request = await matchmakingRepository.findRequestById(link.requestId);
    if (!request || request.playerId !== actorId) throw matchNotFound();

    const { items } = await bookingRepository.findBookingsForPlayer(actorId, {
      status: 'CONFIRMED',
      timeScope: 'UPCOMING',
      page: 1,
      limit: 100,
    });
    const links = await bookingRepository.findMatchesByBookingIds(items.map((item: { id: number }) => item.id));
    const linkedByBooking = new Map<number | null, { id: number }>();
    for (const row of links as { id: number; bookingId: number | null }[]) linkedByBooking.set(row.bookingId, row);

    return {
      items: items.map((row: any) => {
        const interval = bookingInterval(row);
        const linked = linkedByBooking.get(row.id);
        let reason: string | null = null;
        if (linked && linked.id !== matchId) reason = 'ALREADY_LINKED';
        else if (row.paymentStatus !== 'SUCCESS') reason = 'NOT_PAID';
        else if (interval.start.getTime() <= Date.now()) reason = 'PAST';
        else if (!matchesRequestWindow(row, request)) reason = 'WRONG_WINDOW';
        return {
          id: row.id,
          bookingCode: row.bookingCode,
          bookingDate: row.bookingDate,
          startTime: row.startTime,
          endTime: row.endTime,
          totalAmount: Number(row.totalAmount),
          status: row.status,
          court: { id: row.courtId, name: row.courtName },
          facility: { id: row.facilityId, name: row.facilityName },
          eligible: reason === null,
          reason,
        };
      }),
    };
  }
}

export const matchBookingLinkService = new MatchBookingLinkService();
