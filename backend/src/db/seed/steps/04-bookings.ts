import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../index';
import { bookings, payments } from '../../schema/bookings';
import { bookingService } from '../../../services/booking/booking.service';
import { bookingStateService } from '../../../services/booking/booking-state.service';
import { paymentService } from '../../../services/payments/payment.service';
import { refundService } from '../../../services/payments/RefundService';
import { ownerSlotBlockService } from '../../../services/owner/OwnerSlotBlockService';
import { DEMO_FACILITIES } from '../data/facilities';
import { EMPTY_WALLET_KEY, MAIN_PLAYER_KEY } from '../data/people';
import { withConfig } from '../lib/config';
import { ensureFunds } from '../lib/funds';
import { stampAt, ts } from '../lib/stamp';
import type { SeedContext, SeedFacility, SeedPlayer } from '../context';

/**
 * ~150 bookings from 45 days ago to 7 days ahead (BOOKING_ADVANCE_WINDOW_DAYS), executed in
 * creation-time order through the real booking, wallet-payment, cancellation and refund
 * services. Past bookings use the same persistence path as createBooking minus its
 * "not in the past" and advance-window guards, then the real state sweep completes them.
 */
type Outcome = 'PLAYED' | 'EXPIRED' | 'UPCOMING' | 'CANCELLED_BY_PLAYER' | 'CANCELLED_BY_OWNER';

interface Plan {
  player: SeedPlayer;
  facility: SeedFacility;
  courtId: number;
  dayOffset: number;
  date: string;
  start: string;
  duration: number;
  amount: number;
  createdAt: Date;
  outcome: Outcome;
  cancelAt?: Date;
}

const OWNER_CANCEL_REASONS = ['Sân cần sửa đèn chiếu sáng đột xuất', 'Trùng lịch giải nội bộ của câu lạc bộ'];
/** Settlements created in the last 2 days use manual review (auto-credit off); step 05 decides the older ones. */
const MANUAL_EARNING_DAYS = 2;

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export async function seedBookings(ctx: SeedContext): Promise<void> {
  const { clock, random } = ctx;
  const venues = ctx.facilities.filter(f => f.status === 'ACTIVE');
  const busy = new Map<string, Array<[number, number]>>();
  const reserve = (courtId: number, date: string, start: number, end: number) => {
    const key = `${courtId}|${date}`;
    const list = busy.get(key) ?? [];
    if (list.some(([s, e]) => start < e && s < end)) return false;
    list.push([start, end]);
    busy.set(key, list);
    return true;
  };

  // Maintenance blocks first: bookings must avoid them (the service rejects blocked slots).
  const blocks = await seedSlotBlocks(ctx, venues, reserve);

  const priceOf = (facility: SeedFacility, start: number, end: number) => {
    const prices = DEMO_FACILITIES.find(f => f.name === facility.name)!.prices;
    return prices.reduce((sum, p) => sum + Math.max(0, Math.min(end, toMin(p.end)) - Math.max(start, toMin(p.start))) * p.price / 60, 0);
  };
  const nowMin = (clock.now.getTime() + 7 * 3_600_000) % 86_400_000 / 60_000;
  const plans: Plan[] = [];
  const upcoming = new Map<number, number>();

  const tryPlan = (input: { player: SeedPlayer; dayOffset: number; outcome: Outcome; start?: string; duration?: number; facility?: SeedFacility; leadHours?: number; cancelAfterHours?: number }): boolean => {
    const facility = input.facility ?? random.pick(venues);
    const duration = input.duration ?? random.pick([60, 60, 90, 90, 120]);
    const open = toMin(facility.openingTime);
    const close = toMin(facility.closingTime);
    let start: number;
    if (input.start) start = toMin(input.start);
    else {
      const evening = random.chance(0.65);
      const from = evening ? Math.max(open, 17 * 60) : open;
      const to = evening ? Math.min(close, 21 * 60) - duration : Math.min(close, 17 * 60) - duration;
      if (to < from) return false;
      start = from + random.int(0, Math.floor((to - from) / 30)) * 30;
    }
    const end = start + duration;
    if (start < open || end > close) return false;
    const date = clock.date(input.dayOffset);
    const startAt = clock.at(input.dayOffset, toHhmm(start));
    const leadMs = (input.leadHours ?? random.int(3, 72)) * 3_600_000;
    let createdAt = new Date(startAt.getTime() - leadMs);
    if (input.outcome !== 'PLAYED' && input.outcome !== 'EXPIRED') {
      // Future bookings were made in the last few days, never "in the future".
      createdAt = new Date(Math.min(createdAt.getTime(), clock.now.getTime() - random.int(1, 72) * 3_600_000));
    }
    if (createdAt.getTime() <= input.player.joinedAt.getTime() + 2 * 3_600_000) return false;
    // BOOKING_MAX_ACTIVE_PER_PLAYER = 5: keep at most 4 future bookings per player (cancelled ones were active too).
    const future = input.outcome === 'UPCOMING' || input.outcome === 'CANCELLED_BY_PLAYER' || input.outcome === 'CANCELLED_BY_OWNER';
    if (future && (upcoming.get(input.player.id) ?? 0) >= 4) return false;
    const court = random.shuffle(facility.courtIds).find(courtId => reserve(courtId, date, start, end));
    if (court === undefined) return false;
    if (future) upcoming.set(input.player.id, (upcoming.get(input.player.id) ?? 0) + 1);
    let cancelAt: Date | undefined;
    if (input.outcome === 'CANCELLED_BY_PLAYER' || input.outcome === 'CANCELLED_BY_OWNER') {
      const latest = Math.min(clock.now.getTime() - 30 * 60_000, startAt.getTime() - 3_600_000);
      cancelAt = new Date(Math.min(latest, createdAt.getTime() + (input.cancelAfterHours ?? random.int(2, 30)) * 3_600_000));
      if (cancelAt.getTime() <= createdAt.getTime()) return false;
    }
    plans.push({
      player: input.player, facility, courtId: court, dayOffset: input.dayOffset, date, start: toHhmm(start), duration,
      amount: priceOf(facility, start, end), createdAt, outcome: input.outcome, cancelAt,
    });
    return true;
  };

  // The main demo account: a regular with history, two upcoming games, one cancellation, one lapsed hold.
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const [f1, f2, f3] = venues;
  for (const [day, venue] of [[-40, f1], [-31, f2], [-24, f1], [-17, f3], [-10, f1], [-3, f2]] as const) {
    tryPlan({ player: main, dayOffset: day, outcome: 'PLAYED', facility: venue, start: '19:00', duration: 120, leadHours: 30 });
  }
  tryPlan({ player: main, dayOffset: -20, outcome: 'EXPIRED', facility: f2, start: '18:00', duration: 60, leadHours: 20 });
  tryPlan({ player: main, dayOffset: 1, outcome: 'UPCOMING', facility: f1, start: '19:00', duration: 120 });
  tryPlan({ player: main, dayOffset: 4, outcome: 'UPCOMING', facility: f2, start: '18:00', duration: 90 });
  tryPlan({ player: main, dayOffset: 3, outcome: 'CANCELLED_BY_PLAYER', facility: f3, start: '20:00', duration: 60, cancelAfterHours: 20 });

  const community = [...ctx.players.values()].filter(p => p.active && p.key !== MAIN_PLAYER_KEY && p.key !== EMPTY_WALLET_KEY);
  const attempt = (outcome: Outcome, dayOffset: number, extra: Partial<Parameters<typeof tryPlan>[0]> = {}) => {
    for (let i = 0; i < 12; i += 1) if (tryPlan({ player: random.pick(community), dayOffset, outcome, ...extra })) return;
  };
  for (let day = -45; day <= -1; day += 1) {
    const weekday = new Date(`${clock.date(day)}T00:00:00Z`).getUTCDay();
    const count = weekday === 0 || weekday === 6 ? random.int(3, 5) : random.int(1, 3);
    for (let i = 0; i < count; i += 1) attempt(random.chance(0.06) ? 'EXPIRED' : 'PLAYED', day);
  }
  // Today: one finished, one being played right now, one later (only when opening hours allow).
  const lastStart = Math.floor((nowMin - 30) / 30) * 30;
  attempt('PLAYED', 0, { facility: f2, start: toHhmm(Math.max(toMin(f2.openingTime), lastStart - 120)), duration: 60, leadHours: 24 });
  attempt('PLAYED', 0, { facility: f1, start: toHhmm(Math.max(toMin(f1.openingTime), lastStart)), duration: 90, leadHours: 24 });
  attempt('UPCOMING', 0, { facility: f3, start: toHhmm(Math.ceil((nowMin + 90) / 30) * 30), duration: 60 });
  for (let day = 1; day <= 7; day += 1) {
    for (let i = 0; i < random.int(3, 5); i += 1) attempt('UPCOMING', day);
  }
  for (let i = 0; i < 5; i += 1) attempt('CANCELLED_BY_PLAYER', random.int(1, 7));
  for (let i = 0; i < 2; i += 1) attempt('CANCELLED_BY_OWNER', random.int(1, 6));

  plans.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const manualFrom = clock.at(-MANUAL_EARNING_DAYS, '00:00').getTime();
  let ownerCancels = 0;
  for (const plan of plans) {
    const paid = plan.outcome !== 'EXPIRED';
    if (paid) await ensureFunds(plan.player.id, plan.amount, plan.createdAt, plan.player.joinedAt);
    const viaPublicApi = plan.dayOffset > 0 || (plan.dayOffset === 0 && plan.outcome !== 'PLAYED' && plan.outcome !== 'EXPIRED');
    // Past paid bookings stay CONFIRMED until the state worker runs and would count against the
    // player's active-booking limit; run the real worker first, as it would have run by then.
    if (viaPublicApi) await bookingStateService.runOnce(500);
    const autoCredit = plan.createdAt.getTime() < manualFrom ? 'true' : 'false';
    const bookingId = await withConfig({ OWNER_EARNING_AUTO_CREDIT_ENABLED: autoCredit }, () => stampAt(plan.createdAt, async () => {
      const id = viaPublicApi
        ? (await bookingService.createBooking(plan.player.id, { courtId: plan.courtId, bookingDate: plan.date, startTime: plan.start, durationMinutes: plan.duration })).id
        : await persistPastBooking(plan);
      if (paid) await paymentService.createBookingPayment({ bookingId: id, actorId: plan.player.id, provider: 'WALLET' });
      return id;
    }));
    const [stored] = await db.select({ total: bookings.totalAmount }).from(bookings).where(eq(bookings.id, bookingId));
    if (Number(stored.total) !== plan.amount) throw new Error(`Booking ${bookingId}: total ${stored.total} ≠ planned ${plan.amount}`);

    if (plan.cancelAt) {
      const cancelAt = plan.cancelAt;
      await stampAt(cancelAt, async () => {
        if (plan.outcome === 'CANCELLED_BY_PLAYER') await bookingService.cancelBooking(plan.player.id, bookingId);
        else await bookingService.cancelBookingAsOwner(plan.facility.ownerId, bookingId, OWNER_CANCEL_REASONS[ownerCancels++ % OWNER_CANCEL_REASONS.length]);
        await refundService.processPending(50);
      });
      // Cancellation and refund UPDATE existing rows with now(): move them to the cancellation time.
      await db.update(bookings).set({ cancelledAt: cancelAt, updatedAt: cancelAt }).where(eq(bookings.id, bookingId));
      await db.update(payments).set({ updatedAt: cancelAt }).where(eq(payments.bookingId, bookingId));
      await db.execute(sql`
        UPDATE payment_refunds r SET created_at = ${ts(cancelAt)}, updated_at = ${ts(cancelAt)},
          claimed_at = CASE WHEN claimed_at IS NULL THEN NULL ELSE ${ts(cancelAt)} END,
          completed_at = CASE WHEN completed_at IS NULL THEN NULL ELSE ${ts(cancelAt)} END
        FROM payments p WHERE p.id = r.payment_id AND p.booking_id = ${bookingId}`);
      await db.execute(sql`UPDATE owner_earning_settlements SET updated_at = ${ts(cancelAt)} WHERE booking_id = ${bookingId}`);
    }
  }

  const swept = await runStateSweep();
  const counts = plans.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.outcome]: (acc[p.outcome] ?? 0) + 1 }), {});
  ctx.log(`Đặt sân: ${plans.length} lượt (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}), ${blocks} khoá bảo trì; chuyển trạng thái ${swept}`);
}

/** createBooking's persistence (court/pricing revalidation, overlap and block checks, pricing details) for a past date. */
async function persistPastBooking(plan: Plan): Promise<number> {
  const persist = (bookingService as unknown as { persistBooking(input: Record<string, unknown>): Promise<number> }).persistBooking.bind(bookingService);
  const end = toHhmm(toMin(plan.start) + plan.duration);
  return persist({
    playerId: plan.player.id, courtId: plan.courtId, bookingDate: plan.date, startTime: plan.start, endTime: end,
    durationMinutes: plan.duration, totalAmount: 0, unitPrice: 0, segments: [],
    // Real "now" so the wallet payment window is open; stampAt moves it to the creation time.
    expiresAt: new Date(Date.now() + 10 * 60_000),
    activeLimitMode: 'UNLIMITED', maxActivePerPlayer: 0,
  });
}

/** The real booking-state worker (expire holds, start, complete), then date each transition. */
async function runStateSweep(): Promise<number> {
  let total = 0;
  for (;;) {
    const result = await bookingStateService.runOnce(500);
    const moved = result.expired + result.started + result.completed;
    total += moved;
    if (moved === 0) break;
  }
  const local = (column: string) => sql.raw(`((booking_date + ${column}) - interval '7 hours')`);
  await db.execute(sql`UPDATE bookings SET updated_at = ${local('end_time')} WHERE status = 'COMPLETED'`);
  await db.execute(sql`UPDATE bookings SET updated_at = ${local('start_time')} WHERE status = 'IN_PROGRESS'`);
  await db.execute(sql`UPDATE bookings SET updated_at = expires_at WHERE status = 'EXPIRED'`);
  await db.execute(sql`
    UPDATE notifications n SET created_at = b.expires_at
    FROM bookings b WHERE b.status = 'EXPIRED' AND n.dedup_key = 'booking:' || b.id || ':BOOKING_EXPIRED'`);
  return total;
}

async function seedSlotBlocks(ctx: SeedContext, venues: SeedFacility[], reserve: (courtId: number, date: string, start: number, end: number) => boolean): Promise<number> {
  const [f1, f2] = venues;
  const maintenanceCourt = f1.allCourtIds.find(id => !f1.courtIds.includes(id));
  const blocks: Array<{ ownerId: number; courtId: number; day: number; start: string; end: string; reason: string }> = [];
  if (maintenanceCourt) {
    for (let day = 0; day <= 3; day += 1) blocks.push({ ownerId: f1.ownerId, courtId: maintenanceCourt, day, start: f1.openingTime, end: f1.closingTime, reason: 'Thay thảm sân mới' });
  }
  blocks.push({ ownerId: f2.ownerId, courtId: f2.courtIds[0], day: 2, start: '12:00', end: '14:00', reason: 'Vệ sinh và đánh bóng sàn gỗ' });
  for (const block of blocks) {
    reserve(block.courtId, ctx.clock.date(block.day), toMin(block.start), toMin(block.end));
    await stampAt(ctx.clock.at(-1, '08:00'), () => ownerSlotBlockService.create(block.ownerId, block.courtId, {
      bookingDate: ctx.clock.date(block.day), startTime: block.start, endTime: block.end, reason: block.reason,
    }));
  }
  return blocks.length;
}

export async function bookingIds(statuses: string[]): Promise<number[]> {
  const rows = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.status, statuses));
  return rows.map(r => r.id);
}
