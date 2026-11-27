import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../index';
import { tournamentMatches, tournamentRegistrations, tournaments } from '../../schema/tournaments';
import { matches } from '../../schema/matchmaking';
import { tournamentService } from '../../../services/tournaments/TournamentService';
import { tournamentRegistrationService } from '../../../services/tournaments/TournamentRegistrationService';
import { tournamentTeamService } from '../../../services/tournaments/TournamentTeamService';
import { tournamentBracketService } from '../../../services/tournaments/TournamentBracketService';
import { tournamentMatchService } from '../../../services/tournaments/TournamentMatchService';
import { tournamentShareService } from '../../../services/tournaments/TournamentShareService';
import { tournamentScheduleService } from '../../../services/tournaments/TournamentScheduleService';
import type { ResultInput } from '../../../services/tournaments/TournamentMatchService';
import { EMPTY_WALLET_KEY, MAIN_PLAYER_KEY } from '../data/people';
import { ensureFunds } from '../lib/funds';
import { at, stampAt, ts } from '../lib/stamp';
import type { SeedContext, SeedPlayer } from '../context';

/**
 * Tournaments in every status through the real services. Creating a tournament does not check
 * past dates; only "open" needs a future registration end. A past tournament is therefore
 * created with a temporary future registration end, filled through real registrations and
 * payments, closed, then given its real (past) dates BEFORE the draw so the real scheduler lays
 * the bracket out on those days; matches are played and the tournament completed through the
 * real services (fees, Organizer credit, ranking points and skill-rating replay included).
 */
type Kind = 'SINGLES' | 'DOUBLES';
interface Spec {
  key: string; name: string; organizer: SeedPlayer; type: Kind; fee: number; limit: number; description: string; venue: string;
  createdAt: Date; regStart: Date; regEnd: Date; start: Date; end: Date;
  minLevelId?: number | null; maxLevelId?: number | null;
}

const VIEW = (player: SeedPlayer) => ({ id: player.id, role: 'PLAYER' as const });
const MATCH_MINUTES = 45;

export async function seedTournaments(ctx: SeedContext): Promise<void> {
  const { clock, random } = ctx;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const p = (key: string) => ctx.players.get(key)!;
  const blocker = p('player36');
  const community = [...ctx.players.values()].filter(x => x.active && x.key !== MAIN_PLAYER_KEY && x.key !== EMPTY_WALLET_KEY && x.id !== blocker.id);
  const pickFor = (spec: Spec, count: number, include: SeedPlayer[] = []) => [
    ...include,
    ...random.sample(community.filter(x => x.id !== spec.organizer.id && !include.includes(x) && x.joinedAt < spec.regStart), count - include.length),
  ];
  const summary: string[] = [];

  // ------------------------------------------------ T1: completed Singles, ~30 days ago (main plays)
  {
    const spec = make('t1', 'Giải đơn mùa thu Phúc Thịnh 2026', p('player02'), 'SINGLES', 100_000, 8, -40, -32, -30, -29);
    const players = pickFor(spec, 8, [main]);
    await runPast(ctx, spec, players.map(x => [x]));
    await share(ctx, spec, clock.at(-29, '21:00'));
    summary.push('T1 đơn đã kết thúc');
  }
  // ------------------------------------------------ T2: completed Doubles, ~12 days ago (main in a team)
  {
    const spec = make('t2', 'Giải đôi giao hữu Tân Bình', p('player06'), 'DOUBLES', 200_000, 8, -24, -15, -13, -12);
    const pool = pickFor(spec, 8, [main]);
    await runPast(ctx, spec, [[pool[0], pool[1]], [pool[2], pool[3]], [pool[4], pool[5]], [pool[6], pool[7]]]);
    summary.push('T2 đôi đã kết thúc');
  }
  // ------------------------------------------------ T8: cancelled after registrations (refunded)
  {
    const spec = make('t8', 'Giải đơn tối thứ 6 (đã huỷ)', p('player11'), 'SINGLES', 80_000, 8, -9, 2, 4, 4);
    const id = await createAndOpen(ctx, spec);
    for (const [n, player] of pickFor(spec, 3).entries()) await registerSingles(ctx, spec, id, player, new Date(spec.regStart.getTime() + (n + 1) * 86_400_000));
    const cancelAt = clock.at(-1, '10:00');
    await stampAt(cancelAt, async () => tournamentService.cancel(VIEW(spec.organizer), id, await version(id), 'Không thuê được sân đúng ngày, xin lỗi mọi người.'));
    await finishTimes(id, cancelAt);
    summary.push('T8 đã huỷ (hoàn phí)');
  }
  // ------------------------------------------------ T3: in progress — round 1 played yesterday
  {
    const spec = make('t3', 'Giải đơn cuối tuần Hoàng Thành', p('player09'), 'SINGLES', 50_000, 8, -10, -4, -1, 1);
    const players = pickFor(spec, 8);
    const id = await prepareDrawn(ctx, spec, players.map(x => [x]));
    // Round 1 was played yesterday; the Organizer moved the remaining rounds to tomorrow.
    const [first] = await db.select({ round: sql<number>`MIN(${tournamentMatches.roundIndex})::int` }).from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const played = await play(ctx, spec, id, clock.now.getTime() - 30 * 60_000, first.round);
    const rest = await db.select({ tmId: tournamentMatches.id, round: tournamentMatches.roundIndex }).from(tournamentMatches)
      .innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(and(eq(tournamentMatches.tournamentId, id), eq(tournamentMatches.resolution, 'UNRESOLVED'), eq(matches.status, 'CONFIRMED')))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex));
    for (const [n, match] of rest.entries()) {
      const slot = clock.at(1, `${String(9 + n).padStart(2, '0')}:00`);
      await stampAt(clock.minutesFromNow(-90), () => tournamentScheduleService.editMatch(VIEW(spec.organizer), id, match.tmId, { courtLabel: 'Sân 1', scheduledAt: slot }));
    }
    // One semi-final is being played right now (started 20 minutes ago) for the live-score demo.
    const [live] = await db.select({ tmId: tournamentMatches.id, matchId: tournamentMatches.matchId }).from(tournamentMatches)
      .where(and(eq(tournamentMatches.tournamentId, id), eq(tournamentMatches.resolution, 'UNRESOLVED'),
        isNotNull(tournamentMatches.registration1Id), isNotNull(tournamentMatches.registration2Id)))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex)).limit(1);
    if (live) {
      const startedAt = clock.minutesFromNow(-20);
      await stampAt(clock.minutesFromNow(-60), () => tournamentScheduleService.editMatch(VIEW(spec.organizer), id, live.tmId, { courtLabel: 'Sân 2', scheduledAt: startedAt }));
      await stampAt(startedAt, () => tournamentMatchService.start(VIEW(spec.organizer), id, live.tmId));
      await db.update(matches).set({ startedAt, updatedAt: startedAt }).where(eq(matches.id, live.matchId));
    }
    summary.push(`T3 đang đấu (${played} trận vòng 1 đã đánh, ${rest.length} trận dời sang ngày mai)`);
  }
  // ------------------------------------------------ T4: READY (drawn), the main account is Organizer
  {
    const spec = make('t4', 'Giải đơn tháng 12 · CLB của Tài', main, 'SINGLES', 0, 8, -8, -1, 2, 3);
    await prepareDrawn(ctx, spec, pickFor(spec, 6).map(x => [x]));
    summary.push('T4 đã bốc thăm (tài khoản demo là Organizer)');
  }
  // ------------------------------------------------ T5: open Singles with fee, main registered
  {
    const spec = make('t5', 'Giải đơn mở rộng Quận 7 · tháng 12', p('player04'), 'SINGLES', 150_000, 16, -5, 4, 6, 7);
    const id = await createAndOpen(ctx, spec);
    for (const [n, player] of pickFor(spec, 6, [main]).entries()) await registerSingles(ctx, spec, id, player, clock.at(-4 + Math.floor(n / 2), `1${n}:30`));
    summary.push('T5 đơn đang mở đăng ký');
  }
  // ------------------------------------------------ T6: open Doubles; teams forming; invitation to main pending
  {
    const spec = make('t6', 'Giải đôi nam nữ Bình Thạnh', p('player08'), 'DOUBLES', 200_000, 8, -6, 5, 7, 8);
    const id = await createAndOpen(ctx, spec);
    const pool = pickFor(spec, 7);
    await registerTeam(ctx, spec, id, pool[0], pool[1], 'Đội Sấm Sét', clock.at(-5, '09:00'), true);
    await registerTeam(ctx, spec, id, pool[2], pool[3], 'Đội Gió Lốc', clock.at(-4, '20:00'), true);
    await registerTeam(ctx, spec, id, pool[4], pool[5], 'Đội Mây Trắng', clock.at(-2, '19:00'), false);
    // A captain invited the main account two hours ago: pending, visible in "Lời mời".
    const invitedAt = clock.minutesFromNow(-120);
    await stampAt(invitedAt, async () => {
      const team = await tournamentTeamService.create(VIEW(pool[6]), id, 'Đội Bình Minh');
      await tournamentTeamService.invite(VIEW(pool[6]), id, team.id, main.id);
    });
    summary.push('T6 đôi đang mở (có đội đang lập, lời mời chờ tài khoản demo)');
  }
  // ------------------------------------------------ T9: open, free Singles
  {
    const spec = make('t9', 'Giải đơn giao lưu miễn phí · Quận 10', p('player13'), 'SINGLES', 0, 16, -3, 6, 8, 8);
    const id = await createAndOpen(ctx, spec);
    for (const [n, player] of pickFor(spec, 4).entries()) await registerSingles(ctx, spec, id, player, clock.at(-2, `${String(8 + n).padStart(2, '0')}:15`));
    summary.push('T9 đơn miễn phí đang mở');
  }
  // ------------------------------------------------ T10: open, skill-restricted (Trung bình yếu – Trung bình khá)
  {
    const [lo, hi] = await levelIds(['AVERAGE_MINUS', 'AVERAGE_PLUS']);
    const spec = { ...make('t10', 'Giải đơn trình Trung bình (giới hạn trình độ)', p('player16'), 'SINGLES', 50_000, 8, -4, 5, 7, 7), minLevelId: lo, maxLevelId: hi };
    const id = await createAndOpen(ctx, spec);
    const eligible = community.filter(x => ['AVERAGE_MINUS', 'AVERAGE', 'AVERAGE_PLUS'].includes(x.level) && x.id !== spec.organizer.id && x.joinedAt < spec.regStart);
    for (const [n, player] of random.sample(eligible, 3).entries()) await registerSingles(ctx, spec, id, player, clock.at(-3 + n, '19:00'));
    summary.push('T10 giới hạn trình độ đang mở');
  }
  // ------------------------------------------------ T11: open but full (2/2)
  {
    const spec = make('t11', 'Giải đơn thách đấu 1-1 (đã đủ người)', p('player17'), 'SINGLES', 0, 2, -3, 3, 5, 5);
    const id = await createAndOpen(ctx, spec);
    for (const [n, player] of pickFor(spec, 2).entries()) await registerSingles(ctx, spec, id, player, clock.at(-2, `1${n}:00`));
    summary.push('T11 đã đủ người');
  }
  // ------------------------------------------------ T12: registration closed, waiting for the draw
  {
    const spec = make('t12', 'Giải đơn cúp CLB Tân Bình (chờ bốc thăm)', p('player18'), 'SINGLES', 100_000, 8, -10, -1, 4, 5);
    const id = await createAndOpen(ctx, spec);
    const span = spec.regEnd.getTime() - spec.regStart.getTime();
    const entrants = pickFor(spec, 6);
    for (const [n, player] of entrants.entries()) await registerSingles(ctx, spec, id, player, new Date(spec.regStart.getTime() + ((n + 1) * span) / 8));
    await stampAt(spec.regEnd, async () => tournamentService.close(VIEW(spec.organizer), id, await version(id)));
    await setRealDates(id, spec);
    await db.execute(sql`UPDATE conversation_members cm SET joined_at = c.created_at, updated_at = c.created_at FROM tournaments t JOIN conversations c ON c.id = t.conversation_id
      WHERE t.id = ${id} AND cm.conversation_id = c.id`);
    summary.push('T12 đã đóng đăng ký, chờ bốc thăm');
  }
  // ------------------------------------------------ T13: open with one entrant (Organizer closes → auto-cancel + refund)
  {
    const spec = make('t13', 'Giải đơn sáng chủ nhật (mới 1 người)', p('player19'), 'SINGLES', 50_000, 8, -2, 3, 5, 5);
    const id = await createAndOpen(ctx, spec);
    await registerSingles(ctx, spec, id, pickFor(spec, 1)[0], clock.at(-1, '07:30'));
    summary.push('T13 mới 1 người (để test đóng đăng ký → tự huỷ)');
  }
  // ------------------------------------------------ T14: open, paid, two entrants (for the Admin cancel + refund test)
  {
    const spec = make('t14', 'Giải đơn tối thứ 3 · Phú Nhuận', p('player20'), 'SINGLES', 50_000, 8, -3, 4, 6, 6);
    const id = await createAndOpen(ctx, spec);
    for (const [n, player] of pickFor(spec, 2).entries()) await registerSingles(ctx, spec, id, player, clock.at(-2, `${String(18 + n).padStart(2, '0')}:00`));
    summary.push('T14 có phí, 2 người (để test Admin huỷ và hoàn phí)');
  }
  // ------------------------------------------------ T7: DRAFT by the main account
  {
    const spec = make('t7', 'Giải đôi Tết 2027 (bản nháp)', main, 'DOUBLES', 100_000, 16, -1, 20, 25, 26);
    await stampAt(spec.createdAt, () => tournamentService.create(VIEW(main), createInput(spec)));
    summary.push('T7 bản nháp của tài khoản demo');
  }

  // Replays rebuild skill_rating_events at every completion: date each event by its tournament.
  await db.execute(sql`UPDATE skill_rating_events e SET created_at = t.completed_at FROM tournaments t WHERE t.id = e.tournament_id AND t.completed_at IS NOT NULL`);
  ctx.log(`Giải đấu: ${summary.join('; ')}`);

  function make(key: string, name: string, organizer: SeedPlayer, type: Kind, fee: number, limit: number,
    regStartDay: number, regEndDay: number, startDay: number, endDay: number): Spec {
    return {
      key, name, organizer, type, fee, limit,
      description: 'Thể thức loại trực tiếp. Mỗi trận 3 set, set 21 điểm. Có giải thưởng cho Vô địch và Á quân. Vui lòng có mặt trước giờ thi đấu 15 phút.',
      venue: random.pick(['CLB Cầu Lông Phúc Thịnh, 18D Huỳnh Tấn Phát, Quận 7', 'Sân Cầu Lông Tân Bình Pro, 102 Cộng Hòa, Tân Bình', 'CLB Cầu Lông Hoàng Thành, 245 Thành Thái, Quận 10']),
      createdAt: clock.at(regStartDay - 1, '20:00'),
      regStart: clock.at(regStartDay, '08:00'), regEnd: clock.at(regEndDay, '20:00'),
      start: clock.at(startDay, '08:00'), end: clock.at(endDay, '18:00'),
    };
  }
}

function createInput(spec: Spec, temporary?: { regEnd: Date; start: Date; end: Date }) {
  return {
    name: spec.name, description: spec.description, matchType: spec.type, participantLimit: spec.limit, entryFee: spec.fee,
    minSkillLevelId: spec.minLevelId ?? null, maxSkillLevelId: spec.maxLevelId ?? null, venueNote: spec.venue,
    registrationStart: spec.regStart, registrationEnd: (temporary ?? spec).regEnd ?? spec.regEnd,
    tournamentStart: temporary?.start ?? spec.start, tournamentEnd: temporary?.end ?? spec.end,
    courtCount: 2, matchDurationMinutes: MATCH_MINUTES, minRestMinutes: 15, dailyStartTime: '08:00', dailyEndTime: '20:00',
  } as never;
}

async function levelIds(codes: string[]): Promise<number[]> {
  const rows = await db.execute(sql`SELECT id, code FROM skill_levels`);
  const byCode = new Map((rows.rows as Array<{ id: string; code: string }>).map(r => [r.code, Number(r.id)]));
  return codes.map(code => { const id = byCode.get(code); if (!id) throw new Error(`Unknown skill level ${code}`); return id; });
}

async function version(id: number): Promise<number> {
  const [row] = await db.select({ version: tournaments.version }).from(tournaments).where(eq(tournaments.id, id));
  return row.version;
}

/** Create + open. Past/near deadlines get a temporary future registration end, restored by `setRealDates`. */
async function createAndOpen(ctx: SeedContext, spec: Spec): Promise<number> {
  const future = spec.regEnd.getTime() > ctx.clock.now.getTime() + 60 * 60_000;
  const temporary = future ? undefined : {
    regEnd: ctx.clock.minutesFromNow(24 * 60), start: ctx.clock.minutesFromNow(25 * 60), end: ctx.clock.minutesFromNow(48 * 60),
  };
  const created = await stampAt(spec.createdAt, () => tournamentService.create(VIEW(spec.organizer), createInput(spec, temporary))) as { id: number };
  await stampAt(new Date(spec.createdAt.getTime() + 30 * 60_000), async () => tournamentService.open(VIEW(spec.organizer), created.id, await version(created.id)));
  return created.id;
}

async function registerSingles(ctx: SeedContext, spec: Spec, id: number, player: SeedPlayer, when: Date): Promise<void> {
  if (spec.fee > 0) await ensureFunds(player.id, spec.fee, when, player.joinedAt);
  await stampAt(when, () => tournamentRegistrationService.registerSingles(VIEW(player), id));
}

/** Captain creates a team, invites the partner who accepts; `register` = captain registers and pays. */
async function registerTeam(ctx: SeedContext, spec: Spec, id: number, captain: SeedPlayer, partner: SeedPlayer, name: string, when: Date, register: boolean): Promise<void> {
  const team = await stampAt(when, () => tournamentTeamService.create(VIEW(captain), id, name));
  // Invite and accept in one stamp: back-dating the invitation first would also move its expiry
  // into the past, and the real service would then refuse the acceptance.
  const invitedAt = new Date(when.getTime() + 10 * 60_000);
  const acceptedAt = new Date(when.getTime() + 60 * 60_000);
  const invitation = await stampAt(invitedAt, async () => {
    const created = await tournamentTeamService.invite(VIEW(captain), id, team.id, partner.id);
    await tournamentTeamService.accept(VIEW(partner), created.id);
    return created;
  });
  await db.execute(sql`UPDATE team_invitations SET responded_at = ${await at('team_invitations', 'responded_at', acceptedAt)}, updated_at = ${await at('team_invitations', 'updated_at', acceptedAt)} WHERE id = ${invitation.id}`);
  await db.execute(sql`UPDATE tournament_team_players SET joined_at = ${await at('tournament_team_players', 'joined_at', acceptedAt)} WHERE team_id = ${team.id} AND player_id = ${partner.id}`);
  if (!register) return;
  const paidAt = new Date(when.getTime() + 90 * 60_000);
  if (spec.fee > 0) await ensureFunds(captain.id, spec.fee, paidAt, captain.joinedAt);
  await stampAt(paidAt, () => tournamentTeamService.register(VIEW(captain), id, team.id));
}

/** Open, register everyone, close, set the real dates and draw (status READY). */
async function prepareDrawn(ctx: SeedContext, spec: Spec, entries: SeedPlayer[][]): Promise<number> {
  const id = await createAndOpen(ctx, spec);
  const span = spec.regEnd.getTime() - spec.regStart.getTime();
  for (const [n, entry] of entries.entries()) {
    const when = new Date(spec.regStart.getTime() + ((n + 1) * span) / (entries.length + 2));
    if (spec.type === 'SINGLES') await registerSingles(ctx, spec, id, entry[0], when);
    else await registerTeam(ctx, spec, id, entry[0], entry[1], `Đội ${['Rồng Xanh', 'Phượng Hoàng', 'Hổ Vằn', 'Đại Bàng', 'Sói Bạc', 'Cá Mập'][n % 6]}`, when, true);
  }
  await stampAt(spec.regEnd, async () => tournamentService.close(VIEW(spec.organizer), id, await version(id)));
  await setRealDates(id, spec);
  await stampAt(new Date(spec.regEnd.getTime() + 2 * 3_600_000), async () => tournamentBracketService.draw(VIEW(spec.organizer), id, await version(id)));
  // The real scheduler never schedules before "now" (from = max(now, tournament start)). Shift the
  // whole generated schedule so it opens at the real start; spacing, courts and rest are kept.
  await db.execute(sql`
    UPDATE matches m SET scheduled_at = m.scheduled_at + (${ts(spec.start)} - first.at)
    FROM tournament_matches tm, (SELECT MIN(m2.scheduled_at) AS at FROM matches m2 JOIN tournament_matches tm2 ON tm2.match_id = m2.id WHERE tm2.tournament_id = ${id}) first
    WHERE tm.match_id = m.id AND tm.tournament_id = ${id} AND m.scheduled_at IS NOT NULL`);
  await db.execute(sql`UPDATE conversation_members cm SET joined_at = c.created_at, updated_at = c.created_at FROM tournaments t JOIN conversations c ON c.id = t.conversation_id
    WHERE t.id = ${id} AND cm.conversation_id = c.id`);
  return id;
}

async function setRealDates(id: number, spec: Spec): Promise<void> {
  await db.update(tournaments).set({ registrationEnd: spec.regEnd, tournamentStart: spec.start, tournamentEnd: spec.end }).where(eq(tournaments.id, id));
}

/** Full past tournament: drawn, every match played at its scheduled time, completed after the final. */
async function runPast(ctx: SeedContext, spec: Spec, entries: SeedPlayer[][]): Promise<number> {
  const id = await prepareDrawn(ctx, spec, entries);
  await play(ctx, spec, id, Infinity);
  const [last] = await db.select({ completedAt: matches.completedAt }).from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
    .where(and(eq(tournamentMatches.tournamentId, id), isNotNull(matches.completedAt))).orderBy(sql`${matches.completedAt} DESC`).limit(1);
  const completeAt = new Date(last.completedAt!.getTime() + 60 * 60_000);
  await stampAt(completeAt, async () => tournamentService.complete(VIEW(spec.organizer), id, await version(id)));
  await finishTimes(id, completeAt);
  await db.update(tournaments).set({ completedAt: completeAt }).where(eq(tournaments.id, id));
  return id;
}

/** Start + record every playable match whose scheduled end is before `until` (round order). */
async function play(ctx: SeedContext, spec: Spec, id: number, until: number, maxRound = Infinity): Promise<number> {
  let played = 0;
  for (;;) {
    const [next] = await db.select({ tmId: tournamentMatches.id, matchId: tournamentMatches.matchId, scheduledAt: matches.scheduledAt, round: tournamentMatches.roundIndex })
      .from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(and(eq(tournamentMatches.tournamentId, id), eq(tournamentMatches.resolution, 'UNRESOLVED'), eq(matches.status, 'CONFIRMED'),
        isNotNull(tournamentMatches.registration1Id), isNotNull(tournamentMatches.registration2Id)))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex)).limit(1);
    if (!next || !next.scheduledAt || next.round > maxRound) break;
    const startedAt = next.scheduledAt;
    const endedAt = new Date(startedAt.getTime() + MATCH_MINUTES * 60_000);
    if (endedAt.getTime() > until) break;
    await stampAt(startedAt, async () => tournamentMatchService.start(VIEW(spec.organizer), id, next.tmId));
    await stampAt(endedAt, async () => tournamentMatchService.result(VIEW(spec.organizer), id, next.tmId, scoreFor(ctx)));
    await db.update(matches).set({ startedAt, completedAt: endedAt, updatedAt: endedAt }).where(eq(matches.id, next.matchId));
    await db.update(tournamentMatches).set({ updatedAt: endedAt }).where(eq(tournamentMatches.id, next.tmId));
    played += 1;
  }
  return played;
}

function scoreFor(ctx: SeedContext): ResultInput {
  const { random } = ctx;
  const loser = () => random.int(8, 19);
  const winnerFirst = random.chance(0.5);
  const set = (firstWins: boolean) => (firstWins ? { team1Score: 21, team2Score: loser() } : { team1Score: loser(), team2Score: 21 });
  const sets = random.chance(0.35)
    ? [set(winnerFirst), set(!winnerFirst), set(winnerFirst)]
    : [set(winnerFirst), set(winnerFirst)];
  return { type: 'SETS', sets };
}

/** Status changes UPDATE the tournament and its registrations with now(): move them to `when`. */
async function finishTimes(id: number, when: Date): Promise<void> {
  await db.execute(sql`UPDATE tournaments SET updated_at = ${ts(when)},
    cancelled_at = CASE WHEN cancelled_at IS NULL THEN NULL ELSE ${await at('tournaments', 'cancelled_at', when)} END WHERE id = ${id}`);
  await db.execute(sql`UPDATE tournament_registrations SET updated_at = GREATEST(registered_at, ${ts(when)}),
    cancelled_at = CASE WHEN cancelled_at IS NULL THEN NULL ELSE ${await at('tournament_registrations', 'cancelled_at', when)} END,
    refunded_at = CASE WHEN refunded_at IS NULL THEN NULL ELSE ${await at('tournament_registrations', 'refunded_at', when)} END
    WHERE tournament_id = ${id}`);
  await db.execute(sql`UPDATE payments p SET updated_at = GREATEST(p.created_at, ${ts(when)}) FROM tournament_registrations r WHERE r.id = p.registration_id AND r.tournament_id = ${id} AND p.status <> 'SUCCESS'`);
  // Refund intents (payment_refunds, keyed by payment) are what Finance reconciliation dates refunds by.
  await db.execute(sql`
    UPDATE payment_refunds pr SET created_at = ${ts(when)}, updated_at = ${ts(when)},
      claimed_at = CASE WHEN pr.claimed_at IS NULL THEN NULL ELSE ${ts(when)} END,
      completed_at = CASE WHEN pr.completed_at IS NULL THEN NULL ELSE ${ts(when)} END
    FROM payments p JOIN tournament_registrations r ON r.id = p.registration_id
    WHERE p.id = pr.payment_id AND r.tournament_id = ${id}`);
}

/** The champion shares the result to the Social feed. */
async function share(ctx: SeedContext, spec: Spec, when: Date): Promise<void> {
  const [champion] = await db.select({ playerId: tournamentRegistrations.playerId }).from(tournamentMatches)
    .innerJoin(tournamentRegistrations, eq(tournamentRegistrations.id, tournamentMatches.winnerRegistrationId))
    .innerJoin(tournaments, eq(tournaments.id, tournamentMatches.tournamentId))
    .where(and(eq(tournaments.name, spec.name), sql`${tournamentMatches.nextMatchId} IS NULL`));
  if (!champion?.playerId) return;
  const [row] = await db.select({ id: tournaments.id }).from(tournaments).where(eq(tournaments.name, spec.name));
  await stampAt(when, () => tournamentShareService.share({ id: champion.playerId!, role: 'PLAYER' }, row.id, 'Vô địch rồi! Cảm ơn ban tổ chức và các đối thủ đã cống hiến những trận đấu tuyệt vời 🏆'));
  void ctx;
}
