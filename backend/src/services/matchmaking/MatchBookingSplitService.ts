import { AppError, NotFoundError } from '../../errors/AppError';
import { bookingService } from '../booking/booking.service';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { paymentRepository } from '../../repositories/payment/PaymentRepository';
import { walletService } from '../payments/WalletService';
import { ownerEarningService } from '../finance/OwnerEarningService';
import { matchModule } from '../match/match.module';
import { matchmakingNotifications } from './matchmaking-notifications';
import { runLocked, type LockedRecruitment } from './RecruitmentLifecycleService';
import {
  MATCHMAKING_TIMEZONE,
  addMinutes,
  timeToMinutes,
  todayInAppTimezone,
} from './matchmaking-time.util';
import { bookingEvents, type BookingDomainEventType } from '../booking/booking-events';
import { logger } from '../../shared/logging/logger';
import type { TransactionContext } from '../../contracts/TransactionContext';

const matchNotFound = () => new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');
const conflict = (code: string, message: string, details: unknown[] = []) => new AppError(code, 409, message, details);

interface LocalDateTime {
  date: string;
  time: string;
}

interface MatchWindow {
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface SplitMember {
  playerId: number;
  displayName: string;
  isHost: boolean;
}

interface SplitPreviewMember extends SplitMember {
  amount: number;
  sufficient: boolean;
  shortfall: number;
}

interface SplitContext {
  request: any;
  accepted: { id: number; playerId: number }[];
  matchId: number;
  match: any;
}

function localDateTime(instant: Date): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MATCHMAKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function toCents(value: string | number): bigint {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new AppError('MATCH_SPLIT_AMOUNT_INVALID', 500, 'Số tiền sân không hợp lệ');
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function formatCents(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, '0');
  return `${whole}.${fraction}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Display-only equal share (floor to cents); actual cent remainders go to the host. */
function equalShare(totalAmount: string, memberCount: number): number | null {
  if (memberCount <= 0) return null;
  return Number(formatCents(toCents(totalAmount) / BigInt(memberCount)));
}

function requestWindow(request: { startAt: Date; durationMinutes: number }): MatchWindow {
  const start = localDateTime(request.startAt);
  const end = localDateTime(addMinutes(request.startAt, request.durationMinutes));
  if (end.date !== start.date) {
    throw conflict('MATCH_SPLIT_WINDOW_INVALID', 'Kèo vượt qua ngày nên không thể đặt sân trong một lượt');
  }
  return {
    bookingDate: start.date,
    startTime: start.time,
    endTime: end.time,
    durationMinutes: request.durationMinutes,
  };
}

function splitAmounts(totalAmount: string, members: SplitMember[]): Map<number, { amount: string; cents: bigint }> {
  const totalCents = toCents(totalAmount);
  if (members.length === 0) throw conflict('MATCH_SPLIT_NO_MEMBERS', 'Kèo không có thành viên để chia tiền');
  const base = totalCents / BigInt(members.length);
  if (base <= 0n) {
    throw conflict('MATCH_SPLIT_AMOUNT_TOO_SMALL', 'Tổng tiền sân quá nhỏ để chia cho các thành viên');
  }
  const remainder = Number(totalCents % BigInt(members.length));
  const ordered = [...members].sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.playerId - b.playerId;
  });
  const result = new Map<number, { amount: string; cents: bigint }>();
  ordered.forEach((member, index) => {
    const cents = base + (index < remainder ? 1n : 0n);
    result.set(member.playerId, { cents, amount: formatCents(cents) });
  });
  return result;
}

function priceOverWindow(
  interval: { startTime: string; endTime: string; segments: { startTime: string; endTime: string; price: number }[] },
  startMinutes: number,
  durationMinutes: number,
): number {
  const endMinutes = startMinutes + durationMinutes;
  let total = 0;
  for (const segment of interval.segments) {
    const segmentStart = timeToMinutes(segment.startTime);
    const segmentEnd = timeToMinutes(segment.endTime);
    const overlapStart = Math.max(segmentStart, startMinutes);
    const overlapEnd = Math.min(segmentEnd, endMinutes);
    if (overlapEnd <= overlapStart) continue;
    total += segment.price * ((overlapEnd - overlapStart) / 60);
  }
  return round2(total);
}

function intervalCovers(intervals: { startTime: string; endTime: string; segments: { startTime: string; endTime: string; price: number }[] }[],
  startTime: string, endTime: string) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return intervals.find(interval => timeToMinutes(interval.startTime) <= start && timeToMinutes(interval.endTime) >= end) ?? null;
}

export class MatchBookingSplitService {
  private async loadContext(matchId: number): Promise<SplitContext> {
    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId);
    if (!link) throw matchNotFound();
    const request = await matchmakingRepository.findRequestById(link.requestId);
    if (!request) throw matchNotFound();
    const accepted = await matchmakingRepository.findAcceptedInvitees(link.requestId);
    const match = await matchModule.getMatchRow(matchId);
    if (!match) throw matchNotFound();
    return { request, accepted, matchId, match };
  }

  private assertHost(actorId: number, ctx: SplitContext): void {
    if (ctx.request.playerId !== actorId) throw matchNotFound();
  }

  private assertReady(ctx: SplitContext): void {
    if (ctx.request.status !== 'MATCHED' || ctx.match.status !== 'PENDING_COURT' || !ctx.matchId) {
      throw conflict('MATCH_SPLIT_NOT_READY', 'Kèo chưa sẵn sàng để đặt sân');
    }
    if (ctx.request.bookingId || ctx.match.bookingId) {
      throw conflict('MATCH_SPLIT_ALREADY_BOOKED', 'Kèo đã có booking sân');
    }
    if (ctx.request.startAt.getTime() <= Date.now()) {
      throw conflict('MATCH_SPLIT_DEADLINE_PASSED', 'Đã quá giờ chơi, không thể đặt sân');
    }
  }

  private async memberList(ctx: SplitContext): Promise<SplitMember[]> {
    const hostId = Number(ctx.request.playerId);
    const ids = [hostId, ...ctx.accepted.map(row => Number(row.playerId))];
    const unique = [...new Set(ids)].sort((a, b) => a - b);
    const profiles = await matchmakingRepository.findPlayerProfileSummaries(unique);
    const names = new Map<number, string | null>(
      (profiles as { playerId: number; displayName: string | null }[]).map(row => [Number(row.playerId), row.displayName]),
    );
    return unique.map(playerId => ({
      playerId,
      displayName: names.get(playerId) ?? `Người chơi #${playerId}`,
      isHost: playerId === hostId,
    }));
  }

  private async buildPreview(
    actorId: number,
    ctx: SplitContext,
    courtId: number,
    executor: TransactionContext | undefined,
  ) {
    this.assertHost(actorId, ctx);
    this.assertReady(ctx);
    const window = requestWindow(ctx.request);
    const availability = await bookingService.getCourtAvailability(courtId, window.bookingDate, window.durationMinutes);
    const interval = intervalCovers(availability.intervals, window.startTime, window.endTime);
    if (!interval) {
      throw conflict('MATCH_SPLIT_COURT_UNAVAILABLE', 'Sân không còn trống đúng khung giờ của kèo');
    }

    const startMinutes = timeToMinutes(window.startTime);
    const totalAmount = priceOverWindow(interval, startMinutes, window.durationMinutes);
    if (totalAmount <= 0) {
      throw conflict('MATCH_SPLIT_COURT_UNAVAILABLE', 'Khung giờ này chưa có bảng giá');
    }

    const members = await this.memberList(ctx);
    const amounts = splitAmounts(totalAmount.toFixed(2), members);
    const previewMembers: SplitPreviewMember[] = [];
    for (const member of members) {
      const share = amounts.get(member.playerId)!;
      const wallet = await walletService.getWallet(member.playerId, executor);
      const availableCents = toCents(wallet.available);
      const shortfallCents = share.cents > availableCents ? share.cents - availableCents : 0n;
      previewMembers.push({
        ...member,
        amount: Number(share.amount),
        sufficient: shortfallCents === 0n,
        shortfall: Number(formatCents(shortfallCents)),
      });
    }
    const blockedMembers = previewMembers
      .filter(member => !member.sufficient)
      .map(member => ({
        playerId: member.playerId,
        displayName: member.displayName,
        isHost: member.isHost,
        amount: member.amount,
        shortfall: member.shortfall,
      }));

    return {
      court: { id: availability.court.id, name: availability.court.name },
      facility: { id: availability.facility.id, name: availability.facility.name },
      bookingWindow: {
        date: window.bookingDate,
        startTime: window.startTime,
        endTime: window.endTime,
        durationMinutes: window.durationMinutes,
      },
      totalAmount,
      memberCount: members.length,
      shareAmount: equalShare(totalAmount.toFixed(2), members.length),
      members: previewMembers,
      blockedMembers,
      canBook: blockedMembers.length === 0,
    };
  }

  async previewBooking(actorId: number, matchId: number, courtId: number) {
    const ctx = await this.loadContext(matchId);
    return this.buildPreview(actorId, ctx, courtId, undefined);
  }

  private async replayResult(ctx: SplitContext) {
    if (!ctx.request.bookingId) throw conflict('MATCH_SPLIT_NOT_READY', 'Kèo chưa có booking sân');
    const detail = await bookingRepository.findBookingById(ctx.request.bookingId);
    if (!detail) throw matchNotFound();
    const shares = await bookingRepository.findCostSharesByBookingId(ctx.request.bookingId);
    return {
      matchId: ctx.matchId,
      status: ctx.match.status,
      bookingId: ctx.request.bookingId,
      courtId: detail.booking.courtId,
      scheduledAt: ctx.request.startAt,
      totalAmount: Number(detail.booking.totalAmount),
      shareAmount: equalShare(detail.booking.totalAmount, shares.length),
      shares: (shares as any[]).map(row => ({
        playerId: Number(row.playerId),
        amount: Number(row.amount),
        isHost: Boolean(row.isHost),
      })),
    };
  }

  async placeBooking(actorId: number, matchId: number, courtId: number) {
    const initial = await this.loadContext(matchId);
    this.assertHost(actorId, initial);
    if (initial.match.status === 'CONFIRMED' && initial.request.bookingId) {
      return this.replayResult(initial);
    }
    this.assertReady(initial);

    const preview = await this.buildPreview(actorId, initial, courtId, undefined);
    if (!preview.canBook) {
      throw conflict(
        'MATCH_SPLIT_INSUFFICIENT_WALLET',
        'Một số thành viên chưa đủ số dư ví để chia tiền sân',
        preview.blockedMembers,
      );
    }

    const window = requestWindow(initial.request);
    const hold = await bookingService.createMatchHold({
      ownerPlayerId: initial.request.playerId,
      courtId,
      bookingDate: window.bookingDate,
      startTime: window.startTime,
      endTime: window.endTime,
    });

    let outcome: {
      result: any;
      event: BookingDomainEventType | null;
    };
    try {
      outcome = await runLocked(initial.request.id, [], async (tx, locked: LockedRecruitment) => {
        const request = locked.request;
        if (request.playerId !== actorId) throw matchNotFound();
        if (request.status !== 'MATCHED' || !locked.matchId) {
          throw conflict('MATCH_SPLIT_NOT_READY', 'Kèo chưa sẵn sàng để đặt sân');
        }
        if (request.bookingId) throw conflict('MATCH_SPLIT_ALREADY_BOOKED', 'Kèo đã có booking sân');
        if (request.startAt.getTime() <= Date.now()) {
          throw conflict('MATCH_SPLIT_DEADLINE_PASSED', 'Đã quá giờ chơi, không thể đặt sân');
        }

        const match = await matchModule.lockMatch(locked.matchId, tx);
        if (!match || match.status !== 'PENDING_COURT' || match.bookingId) {
          throw conflict('MATCH_NOT_PENDING_COURT', 'Trận không ở trạng thái chờ sân');
        }

        const booking = await bookingRepository.lockBookingById(hold.bookingId, tx);
        if (!booking) throw matchNotFound();
        if (booking.playerId !== actorId) throw matchNotFound();
        if (booking.status !== 'PENDING_PAYMENT' || !booking.expiresAt || booking.expiresAt.getTime() <= Date.now()) {
          throw conflict('MATCH_SPLIT_BOOKING_EXPIRED', 'Thời gian giữ sân đã hết, vui lòng thử lại');
        }

        const hostId = Number(request.playerId);
        const memberIds = [...new Set([hostId, ...locked.accepted.map(row => Number(row.playerId))])].sort((a, b) => a - b);
        const profiles = await matchmakingRepository.findPlayerProfileSummaries(memberIds, tx);
        const names = new Map<number, string | null>(
          (profiles as { playerId: number; displayName: string | null }[]).map(row => [Number(row.playerId), row.displayName]),
        );
        const members: SplitMember[] = memberIds.map(playerId => ({
          playerId,
          displayName: names.get(playerId) ?? `Người chơi #${playerId}`,
          isHost: playerId === hostId,
        }));
        const amounts = splitAmounts(booking.totalAmount, members);

        const blocked: { playerId: number; displayName: string; isHost: boolean; amount: number; shortfall: number }[] = [];
        for (const member of members) {
          const wallet = await walletService.getWallet(member.playerId, tx);
          const share = amounts.get(member.playerId)!;
          const availableCents = toCents(wallet.available);
          if (availableCents < share.cents) {
            blocked.push({
              playerId: member.playerId,
              displayName: member.displayName,
              isHost: member.isHost,
              amount: Number(share.amount),
              shortfall: Number(formatCents(share.cents - availableCents)),
            });
          }
        }
        if (blocked.length > 0) {
          throw conflict(
            'MATCH_SPLIT_INSUFFICIENT_WALLET',
            'Một số thành viên chưa đủ số dư ví để chia tiền sân',
            blocked,
          );
        }

        for (const member of members) {
          const share = amounts.get(member.playerId)!;
          await walletService.debit({
            userId: member.playerId,
            amount: share.amount,
            entryType: 'PAYMENT',
            referenceType: 'BOOKING',
            referenceId: booking.id,
            idempotencyKey: `match-booking-share:${booking.id}:${member.playerId}`,
            description: `Tiền sân kèo #${request.id}`.slice(0, 200),
          }, tx);
        }

        const payment = await paymentRepository.create({
          bookingId: booking.id,
          amount: booking.totalAmount,
          provider: 'WALLET_SPLIT',
          paymentMethod: 'WALLET',
          status: 'SUCCESS',
          transactionId: `SPLIT-${booking.id}`,
          paidAt: new Date(),
        }, tx);

        await bookingRepository.insertCostShares(
          members.map(member => ({
            bookingId: booking.id,
            paymentId: payment.id,
            playerId: member.playerId,
            amount: amounts.get(member.playerId)!.amount,
            isHost: member.isHost,
            status: 'PAID' as const,
            paidAt: new Date(),
          })),
          tx,
        );

        const confirmation = await bookingService.confirmBookingInTransaction(
          { bookingId: booking.id, paymentId: payment.id },
          tx,
        );
        if (confirmation.refundSignal) {
          throw conflict('MATCH_SPLIT_BOOKING_EXPIRED', 'Thời gian giữ sân đã hết, vui lòng thử lại');
        }
        await ownerEarningService.settleBooking(booking.id, tx);

        const linked = await matchModule.linkBooking({
          matchId: locked.matchId,
          bookingId: booking.id,
          courtId: booking.courtId,
          scheduledAt: request.startAt,
        }, tx);
        if (!linked) throw conflict('MATCH_NOT_PENDING_COURT', 'Trận không còn ở trạng thái chờ sân');

        await matchmakingRepository.linkRecruitmentBooking(request.id, booking.id, actorId, tx);
        await matchmakingNotifications.courtUpdated(
          tx,
          request.id,
          booking.id,
          locked.accepted.map(row => Number(row.playerId)),
          hostId,
        );
        await matchmakingNotifications.splitCostShared(
          tx,
          request.id,
          booking.id,
          members.map(member => ({ playerId: member.playerId, amount: amounts.get(member.playerId)!.amount })),
          hostId,
        );

        return {
          result: {
            matchId: locked.matchId,
            bookingId: booking.id,
            status: 'CONFIRMED',
            courtId: booking.courtId,
            scheduledAt: request.startAt,
            totalAmount: Number(booking.totalAmount),
            shareAmount: equalShare(booking.totalAmount, members.length),
            shares: members.map(member => ({
              playerId: member.playerId,
              amount: Number(amounts.get(member.playerId)!.amount),
              isHost: member.isHost,
            })),
          },
          event: confirmation.event as BookingDomainEventType | null,
        };
      });
    } catch (error) {
      await bookingService.releaseMatchHold({
        bookingId: hold.bookingId,
        reason: 'Không thể hoàn tất chia tiền sân',
        notify: false,
      }).catch(releaseError => {
        logger.error('Failed to release split booking hold', {
          bookingId: hold.bookingId,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      });
      throw error;
    }

    if (outcome.event) {
      bookingEvents.publish({ type: outcome.event, bookingId: outcome.result.bookingId });
    }
    return outcome.result;
  }

  async remindTopup(actorId: number, matchId: number, courtId: number, playerIds?: number[]) {
    return runLocked(
      (await this.loadContext(matchId)).request.id,
      [],
      async (tx, locked: LockedRecruitment) => {
        if (locked.request.playerId !== actorId) throw matchNotFound();
        if (locked.request.status !== 'MATCHED' || !locked.matchId) {
          throw conflict('MATCH_SPLIT_NOT_READY', 'Kèo chưa sẵn sàng để đặt sân');
        }
        const ctx: SplitContext = {
          request: locked.request,
          accepted: locked.accepted,
          matchId: locked.matchId,
          match: await matchModule.getMatchRow(locked.matchId, tx),
        };
        if (!ctx.match || ctx.match.status !== 'PENDING_COURT' || ctx.match.bookingId) {
          throw conflict('MATCH_SPLIT_NOT_READY', 'Trận không còn ở trạng thái chờ sân');
        }
        const preview = await this.buildPreview(actorId, ctx, courtId, tx);
        const wanted = playerIds && playerIds.length > 0 ? new Set(playerIds.map(Number)) : null;
        const recipients = preview.blockedMembers
          .filter(member => !wanted || wanted.has(member.playerId))
          .map(member => ({ playerId: member.playerId, shortfall: member.shortfall }));
        if (recipients.length === 0) {
          return { sent: 0, skipped: 0, recipients: [] };
        }
        const emitted = await matchmakingNotifications.splitTopupRequired(
          tx,
          locked.request.id,
          recipients,
          todayInAppTimezone(),
        );
        return { sent: emitted.insertedIds.length, skipped: emitted.duplicateCount, recipients };
      },
    );
  }
}

export const matchBookingSplitService = new MatchBookingSplitService();
