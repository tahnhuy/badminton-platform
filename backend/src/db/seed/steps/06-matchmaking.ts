import { eq, sql } from 'drizzle-orm';
import { db } from '../../index';
import { matches, matchmakingInvitations, matchmakingMatches, matchmakingRequests } from '../../schema/matchmaking';
import { socialPostService } from '../../../services/social/SocialPostService';
import { matchInvitationService } from '../../../services/matchmaking/MatchInvitationService';
import { applicationService } from '../../../services/matchmaking/ApplicationService';
import { recruitmentLifecycleService } from '../../../services/matchmaking/RecruitmentLifecycleService';
import { matchmakingExpiryService } from '../../../services/matchmaking/MatchmakingExpiryService';
import { matchBookingSplitService } from '../../../services/matchmaking/MatchBookingSplitService';
import { messagingService } from '../../../services/messaging/MessagingService';
import { MAIN_PLAYER_KEY } from '../data/people';
import { ensureFunds } from '../lib/funds';
import { uuidFor } from '../lib/ids';
import { at, stampAt, ts } from '../lib/stamp';
import type { SeedContext, SeedPlayer } from '../context';

/**
 * Matchmaking through the real services. Recruitments are only accepted in the future, so a
 * PAST match is created at a "shadow" start (01:00 tomorrow, when every venue is closed and no
 * schedule can conflict), filled and closed by the real services, then moved to its real start
 * and handed to the real scheduler (MatchmakingExpiryService), which starts and completes it.
 * Upcoming recruitments use their real dates.
 */
type MatchType = 'SINGLES' | 'DOUBLES' | 'GROUP';
interface Spec { key: string; host: SeedPlayer; type: MatchType; start: Date; postedAt: Date; members: SeedPlayer[]; title: string; venue: Venue | null }
interface Venue { name: string; district: string; address: string }

const VENUES: Venue[] = [
  { name: 'CLB Cầu Lông Phúc Thịnh Quận 7', district: 'Quận 7', address: '18D Huỳnh Tấn Phát' },
  { name: 'Sân Cầu Lông Tân Bình Pro', district: 'Tân Bình', address: '102 Cộng Hòa' },
  { name: 'CLB Cầu Lông Hoàng Thành Quận 10', district: 'Quận 10', address: '245 Thành Thái' },
  { name: 'Nhà thi đấu Rạch Miễu', district: 'Phú Nhuận', address: '1 Hoa Phượng' },
];
const TITLES: Record<MatchType, string[]> = {
  SINGLES: ['Tìm bạn đánh đơn buổi tối', 'Đơn giao lưu nhẹ nhàng', 'Cần 1 bạn đánh đơn trình trung bình'],
  DOUBLES: ['Đôi giao lưu sau giờ làm', 'Ghép đôi tối cuối tuần', 'Tìm 3 bạn đánh đôi vui vẻ'],
  GROUP: ['Giao lưu nhóm cuối tuần', 'Nhóm đánh xoay vòng buổi sáng', 'Kèo đông người · ai cũng được vào sân'],
};
const CAPACITY: Record<MatchType, number> = { SINGLES: 2, DOUBLES: 4, GROUP: 6 };
const DURATION: Record<MatchType, number> = { SINGLES: 90, DOUBLES: 90, GROUP: 120 };
const APPLICATION_TIMEOUT_MIN = 1440;
const INVITATION_TIMEOUT_MIN = 15;

export async function seedMatchmaking(ctx: SeedContext): Promise<void> {
  const { clock, random } = ctx;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const blocker = ctx.players.get('player36')!;
  const community = [...ctx.players.values()].filter(p => p.active && p.key !== MAIN_PLAYER_KEY && p.id !== blocker.id);
  const [lowest, highest] = await levelBounds();

  // ---------------------------------------------------------------- past matches (completed)
  const past: Spec[] = [];
  const mainDays = new Set([-38, -29, -22, -15, -9, -5]);
  for (let day = -42; day <= -2; day += 2) {
    const type: MatchType = random.pick(['SINGLES', 'DOUBLES', 'DOUBLES', 'GROUP']);
    const start = clock.at(day, random.pick(['06:00', '18:00', '19:30', '20:00']));
    const postedAt = new Date(start.getTime() - random.int(2, 5) * 86_400_000);
    const withMain = mainDays.has(day) || mainDays.has(day + 1);
    const pool = community.filter(p => p.joinedAt.getTime() < postedAt.getTime() - 3_600_000);
    const people = random.sample(pool, CAPACITY[type] + (withMain ? -1 : 0));
    const everyone = withMain && main.joinedAt.getTime() < postedAt.getTime() ? [main, ...people] : random.sample(pool, CAPACITY[type]);
    if (everyone.length < CAPACITY[type]) continue;
    const [host, ...members] = random.chance(0.5) ? everyone : [everyone[1], everyone[0], ...everyone.slice(2)];
    past.push({ key: `past-${day}`, host, type, start, postedAt, members, title: random.pick(TITLES[type]), venue: random.pick(VENUES) });
  }

  const shadow = clock.at(1, '01:00');
  let completed = 0;
  for (const spec of past) {
    const ids = await createRecruitment(ctx, spec, shadow, lowest, highest);
    // Members joined over the following days; the host closed the roster the day before.
    const closeAt = new Date(Math.min(spec.start.getTime() - 12 * 3_600_000, spec.postedAt.getTime() + 2 * 86_400_000));
    for (const [n, member] of spec.members.entries()) {
      const joinAt = new Date(spec.postedAt.getTime() + (n + 1) * (closeAt.getTime() - spec.postedAt.getTime()) / (spec.members.length + 1));
      await join(ctx, spec, ids.requestId, member, joinAt, n % 2 === 0 ? 'INVITE' : 'APPLY', true);
    }
    await closeRoster(spec.host.id, ids.requestId, closeAt);
    await moveToRealStart(ids.requestId, spec.start, DURATION[spec.type]);
    const completedAt = new Date(spec.start.getTime() + DURATION[spec.type] * 60_000);
    // The real scheduler starts and completes the match (started_at/completed_at from start_at).
    await stampAt(completedAt, () => matchmakingExpiryService.runOnce());
    const [link] = await db.select({ matchId: matchmakingMatches.matchId }).from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, ids.requestId));
    const [match] = await db.select({ status: matches.status }).from(matches).where(eq(matches.id, link.matchId));
    if (match.status !== 'COMPLETED') throw new Error(`Past match ${spec.key}: status ${match.status}, expected COMPLETED`);
    await db.update(matches).set({ updatedAt: completedAt }).where(eq(matches.id, link.matchId));
    ctx.completedMatches.push({ matchId: link.matchId, playerIds: [spec.host.id, ...spec.members.map(m => m.id)], completedAt });
    completed += 1;
  }

  // ---------------------------------------------------------------- upcoming recruitments
  const pick = (exclude: SeedPlayer[]) => random.pick(community.filter(p => !exclude.includes(p)));
  const created: string[] = [];

  // 1. The main account hosts a Doubles game in 2 days: one member in, one application waiting.
  {
    const spec: Spec = { key: 'up-main-doubles', host: main, type: 'DOUBLES', start: clock.at(2, '19:00'), postedAt: clock.at(-1, '21:00'), members: [], title: 'Đôi tối thứ 7 · còn 2 suất', venue: VENUES[0] };
    const ids = await createRecruitment(ctx, spec, spec.start, lowest, highest);
    await joinFirst(ctx, spec, ids.requestId, community, clock.at(-1, '21:40'), 'INVITE', true);
    await joinFirst(ctx, spec, ids.requestId, community, clock.minutesFromNow(-180), 'APPLY', false);
    created.push('kèo đôi của tài khoản demo (1 đã vào, 1 đơn chờ duyệt)');
  }
  // 2. A Group game the main account joined: roster closed, group chat running.
  {
    const host = ctx.players.get('player03')!;
    const spec: Spec = { key: 'up-group', host, type: 'GROUP', start: clock.at(3, '18:00'), postedAt: clock.at(-3, '08:00'), members: [], title: 'Giao lưu nhóm chiều thứ 2 · Tân Bình', venue: VENUES[1] };
    const ids = await createRecruitment(ctx, spec, spec.start, lowest, highest);
    await join(ctx, spec, ids.requestId, main, clock.at(-3, '09:15'), 'APPLY', true);
    for (let n = 0; n < 3; n += 1) await joinFirst(ctx, spec, ids.requestId, community.filter(p => p !== host), clock.at(-2, `1${n}:00`), n % 2 ? 'APPLY' : 'INVITE', true);
    await closeRoster(host.id, ids.requestId, clock.at(-1, '08:00'));
    const chat = await stampAt(clock.at(-1, '08:05'), () => recruitmentLifecycleService.createGroupChat(host.id, ids.requestId)) as { conversationId?: number; id?: number };
    const conversationId = chat.conversationId ?? chat.id!;
    const lines: Array<[SeedPlayer, string, string]> = [
      [host, 'Chào cả nhóm! Mình đã chốt danh sách, nhớ có mặt trước 15 phút nhé.', '08:10'],
      [main, 'Ok bạn, mình mang theo cầu.', '08:30'],
      [host, 'Tiền sân chia đều, mình gửi số tài khoản sau buổi chơi nha.', '09:00'],
    ];
    for (const [n, [from, text, hhmm]] of lines.entries()) {
      await stampAt(clock.at(-1, hhmm), () => messagingService.sendMessage(from.id, conversationId, { text, parentId: null, clientMessageId: uuidFor(`mm-chat-${n}`), images: [], files: [] }));
    }
    await db.execute(sql`UPDATE conversations c SET created_at = ${await at('conversations', 'created_at', clock.at(-1, '08:05'))},
      last_message_at = (SELECT MAX(created_at) FROM messages m WHERE m.conversation_id = c.id) WHERE c.id = ${conversationId}`);
    await db.execute(sql`UPDATE conversation_members cm SET joined_at = ${await at('conversation_members', 'joined_at', clock.at(-1, '08:05'))},
      updated_at = ${await at('conversation_members', 'updated_at', clock.at(-1, '09:00'))},
      first_sent_at = (SELECT MIN(created_at) FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.sender_id = cm.user_id),
      last_read_seq = CASE WHEN cm.user_id = ${main.id} THEN GREATEST(0, (SELECT last_seq FROM conversations c WHERE c.id = cm.conversation_id) - 1)
        ELSE (SELECT last_seq FROM conversations c WHERE c.id = cm.conversation_id) END
      WHERE cm.conversation_id = ${conversationId}`);
    created.push('kèo nhóm đã chốt có nhóm chat (tài khoản demo là thành viên)');
  }
  // 3. An open Singles recruitment nobody joined yet.
  {
    const host = ctx.players.get('player10')!;
    await createRecruitment(ctx, { key: 'up-singles', host, type: 'SINGLES', start: clock.at(4, '06:00'), postedAt: clock.minutesFromNow(-120), members: [], title: 'Đơn sáng sớm · Quận 10', venue: VENUES[2] }, clock.at(4, '06:00'), lowest, highest);
    created.push('kèo đơn đang mở');
  }
  // 4. A cancelled recruitment.
  {
    const host = ctx.players.get('player05')!;
    const spec: Spec = { key: 'up-cancelled', host, type: 'DOUBLES', start: clock.at(5, '20:00'), postedAt: clock.at(-2, '19:00'), members: [], title: 'Đôi tối thứ 4 (đã huỷ)', venue: VENUES[3] };
    const ids = await createRecruitment(ctx, spec, spec.start, lowest, highest);
    await stampAt(clock.at(-1, '12:00'), () => recruitmentLifecycleService.cancel(host.id, ids.requestId, 'KEEP'));
    created.push('kèo đã huỷ');
  }
  // 5. Split court booking: the main account hosts, everyone pays an equal share from the wallet.
  {
    const spec: Spec = { key: 'up-split', host: main, type: 'DOUBLES', start: clock.at(6, '19:00'), postedAt: clock.at(-2, '20:00'), members: [], title: 'Đôi chia tiền sân · Phúc Thịnh', venue: null };
    const ids = await createRecruitment(ctx, spec, spec.start, lowest, highest);
    const joined: SeedPlayer[] = [];
    for (let n = 0; n < 3; n += 1) joined.push(await joinFirst(ctx, spec, ids.requestId, community.filter(p => !joined.includes(p)), clock.at(-2, `2${n + 1}:00`), 'INVITE', true));
    await closeRoster(main.id, ids.requestId, clock.at(-1, '07:30'));
    const [link] = await db.select({ matchId: matchmakingMatches.matchId }).from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, ids.requestId));
    const bookAt = clock.at(-1, '08:00');
    for (const p of [main, ...joined]) await ensureFunds(p.id, 100_000, bookAt, p.joinedAt);
    const venue = ctx.facilities[0];
    let booked = false;
    for (const courtId of venue.courtIds) {
      try {
        await stampAt(bookAt, () => matchBookingSplitService.placeBooking(main.id, link.matchId, courtId));
        booked = true;
        break;
      } catch (error) {
        if (!(error instanceof Error) || !/BOOKING_SLOT_UNAVAILABLE|slot|occupied/i.test(`${(error as { code?: string }).code ?? ''} ${error.message}`)) throw error;
      }
    }
    if (!booked) throw new Error('Split booking: no free court at the planned time');
    const [withBooking] = await db.select({ bookingId: matchmakingRequests.bookingId }).from(matchmakingRequests).where(eq(matchmakingRequests.id, ids.requestId));
    if (!withBooking.bookingId) throw new Error('Split booking: recruitment has no booking after placeBooking');
    const shares = await db.execute(sql`SELECT COUNT(*) AS n FROM booking_cost_shares WHERE booking_id = ${withBooking.bookingId} AND status = 'PAID'`);
    if (Number((shares.rows[0] as { n: string }).n) !== 4) throw new Error('Split booking: expected 4 paid cost shares');
    await db.execute(sql`UPDATE matches SET updated_at = ${ts(bookAt)} WHERE id = ${link.matchId}`);
    await db.execute(sql`UPDATE matchmaking_requests SET updated_at = ${ts(bookAt)} WHERE id = ${ids.requestId}`);
    created.push('kèo đặt sân chia tiền (4 người, mỗi người trả phần của mình)');
  }
  ctx.log(`Ghép trận: ${completed} trận đã đấu; sắp tới: ${created.join('; ')}`);
}

async function levelBounds(): Promise<[number, number]> {
  const rows = await db.execute(sql`SELECT MIN(id) AS lo, MAX(id) AS hi FROM skill_levels`);
  const row = rows.rows[0] as { lo: string; hi: string };
  return [Number(row.lo), Number(row.hi)];
}

async function createRecruitment(ctx: SeedContext, spec: Spec, startAt: Date, lowest: number, highest: number) {
  const draft: Record<string, unknown> = {
    matchType: spec.type, startAt: startAt.toISOString(), minSkillLevelId: lowest, maxSkillLevelId: highest,
    costNote: spec.type === 'SINGLES' ? 'Chia đôi tiền sân.' : 'Dự kiến 60.000–80.000đ/người, chia đều tiền sân.',
    court: spec.venue ? { kind: 'EXTERNAL', name: spec.venue.name, city: 'Hồ Chí Minh', district: spec.venue.district, address: spec.venue.address } : null,
    ...(spec.type === 'GROUP' ? { capacity: CAPACITY.GROUP, minPlayers: 4, companionCount: 0, durationMinutes: DURATION.GROUP } : {}),
  };
  const result = await stampAt(spec.postedAt, () => socialPostService.create({ id: spec.host.id, role: 'PLAYER' }, {
    type: 'MATCH_FINDING', title: spec.title, body: 'Chơi vui, đúng giờ và khởi động kỹ nhé. Ai quan tâm cứ tham gia hoặc nhắn mình!',
    publish: true, clientRequestId: uuidFor(`recruitment-${spec.key}`), recruitment: draft,
  } as never, []));
  const [request] = await db.select({ id: matchmakingRequests.id }).from(matchmakingRequests).where(eq(matchmakingRequests.postId, result.post.id));
  return { postId: result.post.id, requestId: request.id };
}

/** Invite (host → player, accepted) or Apply (player → host, accepted by the host), dated `when`. */
async function join(ctx: SeedContext, spec: Spec, requestId: number, member: SeedPlayer, when: Date, kind: 'INVITE' | 'APPLY', accept: boolean): Promise<void> {
  const id = await stampAt(when, async () => {
    if (kind === 'INVITE') {
      const invitation = await matchInvitationService.sendInvitation(spec.host.id, requestId, member.id) as { id?: number; invitationId?: number };
      const invitationId = invitation.id ?? invitation.invitationId!;
      if (accept) await matchInvitationService.respond(member.id, invitationId, 'ACCEPTED');
      return invitationId;
    }
    const application = await applicationService.create(member.id, requestId) as { id: number };
    if (accept) await applicationService.decide(spec.host.id, application.id, 'ACCEPTED');
    return application.id;
  });
  // Expiry keeps the configured window from the (back-dated) creation, capped at the start.
  const timeout = (kind === 'INVITE' ? INVITATION_TIMEOUT_MIN : APPLICATION_TIMEOUT_MIN) * 60_000;
  const expiresAt = new Date(Math.min(when.getTime() + timeout, spec.start.getTime()));
  await db.update(matchmakingInvitations).set({ expiresAt }).where(eq(matchmakingInvitations.id, id));
}

/** Join with the first candidate the services accept (skill range, schedule and block rules). */
async function joinFirst(ctx: SeedContext, spec: Spec, requestId: number, candidates: SeedPlayer[], when: Date, kind: 'INVITE' | 'APPLY', accept: boolean): Promise<SeedPlayer> {
  for (const candidate of ctx.random.shuffle(candidates)) {
    if (candidate.id === spec.host.id || candidate.joinedAt.getTime() >= when.getTime()) continue;
    try {
      await join(ctx, spec, requestId, candidate, when, kind, accept);
      return candidate;
    } catch (error) {
      if (!/^MATCHMAKING_|^MATCH_/.test((error as { code?: string }).code ?? '')) throw error;
    }
  }
  throw new Error(`No candidate could join ${spec.key}`);
}

/** Host closes the roster ("chốt danh sách"): creates the Match; the request row is UPDATED, so date it too. */
async function closeRoster(hostId: number, requestId: number, when: Date): Promise<void> {
  await stampAt(when, () => recruitmentLifecycleService.close(hostId, requestId));
  await db.update(matchmakingRequests).set({ closedEarlyAt: when, updatedAt: when }).where(eq(matchmakingRequests.id, requestId));
}

/** The roster was filled at the shadow start; move every scheduling column to the real start. */
async function moveToRealStart(requestId: number, start: Date, durationMinutes: number): Promise<void> {
  await db.execute(sql`UPDATE matchmaking_requests SET start_at = ${await at('matchmaking_requests', 'start_at', start)},
    expires_at = ${await at('matchmaking_requests', 'expires_at', start)} WHERE id = ${requestId}`);
  await db.execute(sql`UPDATE matchmaking_invitations SET expires_at = LEAST(expires_at, ${ts(start)}) WHERE request_id = ${requestId}`);
  await db.execute(sql`UPDATE matches SET scheduled_at = ${await at('matches', 'scheduled_at', start)}, booking_deadline_at = ${await at('matches', 'booking_deadline_at', start)}
    WHERE id IN (SELECT match_id FROM matchmaking_matches WHERE matchmaking_request_id = ${requestId})`);
  void durationMinutes;
}
