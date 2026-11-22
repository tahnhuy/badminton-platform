import 'dotenv/config';
import { and, eq, sql } from 'drizzle-orm';
import {
  db,
  pool,
  users,
  playerProfiles,
  courtOwnerProfiles,
  skillLevels,
  facilities,
  courts,
  courtPricings,
  posts,
  matchmakingRequests,
  matchmakingMatches,
  matchPlayers,
  matches,
  matchmakingInvitations,
} from './index';
import { hashPassword } from '../utils/password';
import { bookingService } from '../services/booking/booking.service';
import { bookingRepository } from '../repositories/booking/BookingRepository';
import { paymentService } from '../services/payments/payment.service';
import { walletService } from '../services/payments/WalletService';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const PASSWORD = 'Password@123';
const HOST = 'split.demo.host@example.com';
const MEMBER_A = 'split.demo.member.a@example.com';
const MEMBER_B = 'split.demo.member.b@example.com';
const OWNER = 'split.demo.owner@example.com';
const FACILITY = 'Split Booking Demo Arena';

const MATCH_A = 'DEMO — chia tiền';
const MATCH_B = 'DEMO — thiếu ví';
const MATCH_C = 'DEMO — liên kết booking';

interface MatchFixture {
  requestId: number;
  matchId: number;
  startAt: Date;
  bookingId: number | null;
}

async function ensureUser(executor: any, email: string, role: 'PLAYER' | 'COURT_OWNER', fullName: string) {
  const passwordHash = await hashPassword(PASSWORD);
  await executor.insert(users).values({ email, passwordHash, role, status: 'ACTIVE' }).onConflictDoNothing({ target: users.email });
  const [user] = await executor.select().from(users).where(eq(users.email, email));
  if (user.role !== role || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new Error(`Seed account unavailable: ${email}`);
  }
  if (role === 'PLAYER') {
    const [level] = await executor.select().from(skillLevels).where(eq(skillLevels.code, 'AVERAGE'));
    if (!level) throw new Error('Run npm run db:migrate first: AVERAGE skill level is required');
    await executor.insert(playerProfiles).values({ userId: user.id, fullName, skillLevelId: level.id })
      .onConflictDoNothing({ target: playerProfiles.userId });
  } else {
    await executor.insert(courtOwnerProfiles).values({ userId: user.id, businessName: 'Split Demo Owner', phone: '0909000111' })
      .onConflictDoNothing({ target: courtOwnerProfiles.userId });
  }
  return user;
}

async function ensureCourt(executor: any, ownerId: number) {
  let [facility] = await executor.select().from(facilities)
    .where(and(eq(facilities.ownerId, ownerId), eq(facilities.name, FACILITY)));
  if (!facility) {
    [facility] = await executor.insert(facilities).values({
      ownerId,
      name: FACILITY,
      description: 'Cụm sân dành cho bài test thủ công đặt sân sau chốt kèo.',
      phone: '0909000111',
      status: 'ACTIVE',
      address: '99 Đường Demo, Phường Bến Nghé, Quận 1',
      ward: 'Bến Nghé',
      district: 'Quận 1',
      city: 'Hồ Chí Minh',
      latitude: '10.7769',
      longitude: '106.7009',
      openingTime: '06:00:00',
      closingTime: '22:00:00',
    }).returning();
  }
  let [court] = await executor.select().from(courts)
    .where(and(eq(courts.facilityId, facility.id), eq(courts.name, 'Sân Demo 1')));
  if (!court) {
    [court] = await executor.insert(courts).values({ facilityId: facility.id, name: 'Sân Demo 1', status: 'ACTIVE' }).returning();
  }
  const [pricing] = await executor.select().from(courtPricings).where(eq(courtPricings.courtId, court.id));
  if (!pricing) {
    await executor.insert(courtPricings).values({
      courtId: court.id,
      startTime: '06:00:00',
      endTime: '22:00:00',
      price: '120000',
      validFrom: '2020-01-01',
    });
  }
  return { facility, court };
}

async function existingMatch(executor: any, hostId: number, marker: string): Promise<MatchFixture | null> {
  const [request] = await executor.select().from(matchmakingRequests)
    .where(and(eq(matchmakingRequests.playerId, hostId), eq(matchmakingRequests.area, marker)))
    .limit(1);
  if (!request) return null;
  const [link] = await executor.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, request.id)).limit(1);
  if (!link) throw new Error(`Demo request ${marker} exists without a Match. Reset the demo database.`);
  const [match] = await executor.select().from(matches).where(eq(matches.id, link.matchId)).limit(1);
  if (!match) throw new Error(`Demo request ${marker} points to a missing Match. Reset the demo database.`);
  return { requestId: request.id, matchId: match.id, startAt: request.startAt, bookingId: request.bookingId };
}

async function createClosedMatch(executor: any, hostId: number, memberId: number, startAt: Date, marker: string): Promise<MatchFixture> {
  const skill = await executor.select().from(skillLevels).where(eq(skillLevels.code, 'AVERAGE'));
  const level = skill[0];
  if (!level) throw new Error('Run npm run db:seed first: skill levels are required');
  return (async (tx: any) => {
    const [post] = await tx.insert(posts).values({
      authorId: hostId,
      type: 'MATCH_FINDING',
      title: `Kèo demo — ${marker}`,
      body: 'Dữ liệu mẫu cho bài test đặt sân sau chốt kèo.',
    }).returning({ id: posts.id });
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(startAt);
    const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(startAt);
    const end = new Date(startAt.getTime() + 60 * 60_000);
    const endTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(end);
    const [request] = await tx.insert(matchmakingRequests).values({
      playerId: hostId,
      postId: post.id,
      matchType: 'SINGLES',
      minSkillLevelId: level.id,
      maxSkillLevelId: level.id,
      preferredDate: date,
      preferredStartTime: time,
      preferredEndTime: endTime,
      area: marker,
      matchDurationMinutes: 60,
      status: 'MATCHED',
      expiresAt: startAt,
      startAt,
      durationMinutes: 60,
      capacity: 2,
      minPlayers: 2,
      companionCount: 0,
      closedEarlyAt: new Date(),
      costNote: '120.000đ/giờ — chia đều cho 2 người.',
    }).returning();
    const [match] = await tx.insert(matches).values({
      matchType: 'SINGLES',
      scheduledAt: startAt,
      bookingDeadlineAt: startAt,
      status: 'PENDING_COURT',
    }).returning();
    await tx.insert(matchmakingMatches).values({
      matchmakingRequestId: request.id,
      matchId: match.id,
      status: 'MATCHED',
      matchedAt: new Date(),
    });
    await tx.insert(matchPlayers).values([
      { matchId: match.id, playerId: hostId, teamNo: 1, status: 'ACTIVE', joinedAt: new Date() },
      { matchId: match.id, playerId: memberId, teamNo: 2, status: 'ACTIVE', joinedAt: new Date() },
    ]);
    await tx.insert(matchmakingInvitations).values({
      requestId: request.id,
      createdBy: hostId,
      playerId: memberId,
      kind: 'INVITE',
      decidedBy: memberId,
      status: 'ACCEPTED',
      expiresAt: startAt,
      respondedAt: new Date(),
    });
    return { requestId: request.id, matchId: match.id, startAt, bookingId: null };
  })(executor);
}

async function ensurePaidBooking(hostId: number, courtId: number, startAt: Date) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(startAt);
  const startTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(startAt);
  const { items } = await bookingRepository.findBookingsForPlayer(hostId, {
    status: 'CONFIRMED', timeScope: 'UPCOMING', page: 1, limit: 100,
  });
  const existing = (items as any[]).find(row =>
    row.courtId === courtId
    && row.bookingDate === date
    && row.startTime.slice(0, 5) === startTime
    && row.endTime.slice(0, 5) === '19:00'
    && row.paymentStatus === 'SUCCESS',
  );
  if (existing) return Number(existing.id);

  const booking = await bookingService.createBooking(hostId, {
    courtId,
    bookingDate: date,
    startTime,
    durationMinutes: 60,
  });
  await paymentService.createBookingPayment({ bookingId: booking.id, actorId: hostId, provider: 'WALLET' });
  return booking.id;
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Split booking demo is for local development only');
  const connection = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) {
    throw new Error('Split booking demo requires a local PostgreSQL database');
  }

  const result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(64102821)`);
    const host = await ensureUser(tx, HOST, 'PLAYER', 'Chủ kèo Demo');
    const memberA = await ensureUser(tx, MEMBER_A, 'PLAYER', 'Thành viên A');
    const memberB = await ensureUser(tx, MEMBER_B, 'PLAYER', 'Thành viên B');
    const owner = await ensureUser(tx, OWNER, 'COURT_OWNER', 'Chủ sân Demo');
    const { court } = await ensureCourt(tx, owner.id);

    await walletService.credit({
      userId: host.id, amount: '1000000', entryType: 'TOP_UP',
      idempotencyKey: 'split-demo-topup:host', description: 'Demo split booking',
    }, tx);
    await walletService.credit({
      userId: memberA.id, amount: '500000', entryType: 'TOP_UP',
      idempotencyKey: 'split-demo-topup:member-a', description: 'Demo split booking',
    }, tx);
    await walletService.getWallet(memberB.id, tx);

    const day2 = addDaysToDateString(todayInAppTimezone(), 2);
    const day3 = addDaysToDateString(todayInAppTimezone(), 3);
    const day4 = addDaysToDateString(todayInAppTimezone(), 4);
    const startA = new Date(`${day2}T18:00:00+07:00`);
    const startB = new Date(`${day3}T18:00:00+07:00`);
    const startC = new Date(`${day4}T18:00:00+07:00`);

    const matchA = await existingMatch(tx, host.id, MATCH_A) ?? await createClosedMatch(tx, host.id, memberA.id, startA, MATCH_A);
    const matchB = await existingMatch(tx, host.id, MATCH_B) ?? await createClosedMatch(tx, host.id, memberB.id, startB, MATCH_B);
    const matchC = await existingMatch(tx, host.id, MATCH_C) ?? await createClosedMatch(tx, host.id, memberA.id, startC, MATCH_C);

    return { host, memberA, memberB, owner, court, matchA, matchB, matchC, startC };
  });

  const bookingC = result.matchC.bookingId
    ?? await ensurePaidBooking(result.host.id, result.court.id, result.matchC.startAt);

  console.log(JSON.stringify({
    password: PASSWORD,
    accounts: {
      host: result.host.email,
      memberA: result.memberA.email,
      memberB: result.memberB.email,
      owner: result.owner.email,
    },
    facility: FACILITY,
    court: result.court.name,
    matches: {
      splitSuccess: { matchId: result.matchA.matchId, requestId: result.matchA.requestId, startAt: result.matchA.startAt.toISOString() },
      insufficientWallet: { matchId: result.matchB.matchId, requestId: result.matchB.requestId, startAt: result.matchB.startAt.toISOString() },
      linkExistingBooking: { matchId: result.matchC.matchId, requestId: result.matchC.requestId, bookingId: bookingC, startAt: result.matchC.startAt.toISOString() },
    },
    urls: {
      splitSuccess: `http://localhost:5173/matchmaking/matches/${result.matchA.matchId}`,
      insufficientWallet: `http://localhost:5173/matchmaking/matches/${result.matchB.matchId}`,
      linkExistingBooking: `http://localhost:5173/matchmaking/matches/${result.matchC.matchId}`,
      existingBooking: `http://localhost:5173/bookings/${bookingC}`,
    },
  }, null, 2));
}

seed().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => pool.end());
