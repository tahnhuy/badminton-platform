import { ownerFacilityRepository as facilities } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerBookingReadRepository as bookings, OwnerBookingRead } from '../../repositories/owner/OwnerBookingReadRepository';
import { ownerPricingRepository as prices } from '../../repositories/owner/OwnerPricingRepository';
import { courtSlotBlockRepository as blocks } from '../../repositories/owner/CourtSlotBlockRepository';
import { bookingConfig } from '../../shared/config/booking-config';
import { addDaysToDateString, todayInAppTimezone, dateTimeToInstant, timeToMinutes, BOOKING_SLOT_STEP_MINUTES } from '../booking/availability.service';
import { ownerMissing } from './owner-errors';
import { playerContact } from './OwnerBookingReadService';

type Facility = NonNullable<Awaited<ReturnType<typeof facilities.find>>>;
type Court = Awaited<ReturnType<typeof facilities.courts>>[number];
type Price = Awaited<ReturnType<typeof prices.list>>[number];
type Block = Awaited<ReturnType<typeof blocks.active>>[number];
interface DayContext { facility: Facility; court: Court; date: string; pricing: Price[]; bookings: OwnerBookingRead[]; blocks: Block[]; bookingEnabled: boolean; advanceDays: number }
export interface OwnerSlot { startTime: string; endTime: string; state: 'FREE' | 'BOOKED' | 'BLOCKED' | 'UNAVAILABLE'; unavailableReasons?: string[]; pricePerHour?: number; bookingId?: number; bookingStatus?: string; bookingKind?: string; player?: ReturnType<typeof playerContact>; tournamentId?: number; matchId?: number | null; blockId?: number; reason?: string }
function clock(minutes: number) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function covers(start: string, end: string, from: number, to: number) { return timeToMinutes(start) < to && timeToMinutes(end) > from; }
function makeSlot(ctx: DayContext, from: number, to: number): OwnerSlot {
  const base = { startTime: clock(from), endTime: clock(to) };
  const booking = ctx.bookings.find(row => covers(row.startTime, row.endTime, from, to));
  if (booking) return { ...base, state: 'BOOKED', bookingId: booking.id, bookingStatus: booking.status, bookingKind: booking.tournamentId ? 'TOURNAMENT' : 'PLAYER', pricePerHour: Number(booking.unitPrice), ...(booking.tournamentId ? { tournamentId: booking.tournamentId, matchId: booking.matchId } : { player: playerContact(booking) }) };
  const block = ctx.blocks.find(row => covers(row.startTime, row.endTime, from, to));
  if (block) return { ...base, state: 'BLOCKED', blockId: block.id, reason: block.reason };
  const price = ctx.pricing.find(row => timeToMinutes(row.startTime) <= from && timeToMinutes(row.endTime) >= to);
  const reasons: string[] = [];
  unavailableSlotReasons(from, ctx, to, reasons, price);
  return { ...base, state: reasons.length ? 'UNAVAILABLE' : 'FREE', ...(reasons.length ? { unavailableReasons: reasons } : {}), ...(price ? { pricePerHour: Number(price.price) } : {}) };
}
function unavailableSlotReasons(
  from: number,
  ctx: DayContext,
  to: number,
  reasons: string[],
  price: { id: number; courtId: number; startTime: string; endTime: string; price: string; validFrom: string; validTo: string | null; pricingTimeRange: string | null; validityRange: string | null; createdAt: Date; updatedAt: Date; } | undefined,
) {
  if (from < timeToMinutes(ctx.facility.openingTime) || to > timeToMinutes(ctx.facility.closingTime)) reasons.push('CLOSED');
  if (!price) reasons.push('NO_PRICING');
  if (ctx.facility.status !== 'ACTIVE' || ctx.facility.deletedAt) reasons.push('FACILITY_INACTIVE');
  if (ctx.court.status !== 'ACTIVE' || ctx.court.deletedAt) reasons.push('COURT_INACTIVE');
  if (dateTimeToInstant(ctx.date, clock(from)).getTime() <= Date.now()) reasons.push('PAST');
  if (ctx.date > addDaysToDateString(todayInAppTimezone(), ctx.advanceDays)) reasons.push('OUTSIDE_BOOKING_WINDOW');
  if (!ctx.bookingEnabled) reasons.push('BOOKING_DISABLED');
}

function slots(ctx: DayContext) {
  const boundaries = new Set<number>([0, 1440]);
  for (let time = 0; time < 1440; time += BOOKING_SLOT_STEP_MINUTES) boundaries.add(time);
  for (const row of [...ctx.pricing, ...ctx.bookings, ...ctx.blocks]) { boundaries.add(timeToMinutes(row.startTime)); boundaries.add(timeToMinutes(row.endTime)); }
  boundaries.add(timeToMinutes(ctx.facility.openingTime)); boundaries.add(timeToMinutes(ctx.facility.closingTime));
  const sorted = [...boundaries].sort((a, b) => a - b);
  const result: OwnerSlot[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const next = makeSlot(ctx, sorted[i], sorted[i + 1]);
    const previous = result.at(-1);
    const identity = (slot: OwnerSlot) => JSON.stringify({ ...slot, startTime: '', endTime: '' });
    if (previous && identity(previous) === identity(next)) previous.endTime = next.endTime;
    else result.push(next);
  }
  return result;
}
export const ownerScheduleService = {
  async read(ownerId: number, facilityId: number, date: string) {
    const facility = await facilities.find(ownerId, facilityId);
    if (!facility) ownerMissing('FACILITY');
    const [courtRows, bookingRows, config] = await Promise.all([facilities.courts(facilityId), bookings.active(ownerId, facilityId, date), bookingConfig.get()]);
    const courts = await Promise.all(courtRows.map(async court => {
      const [pricing, blocked] = await Promise.all([prices.list(court.id, date), blocks.active(court.id, date)]);
      return { courtId: court.id, courtName: court.name, status: court.status, slots: slots({ facility, court, date, pricing, bookings: bookingRows.filter(row => row.courtId === court.id), blocks: blocked, bookingEnabled: config.bookingEnabled, advanceDays: config.advanceWindowDays }) };
    }));
    return { facilityId, date, courts };
  },
};
