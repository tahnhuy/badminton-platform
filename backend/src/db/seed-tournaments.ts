import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, pool, users, skillLevels, tournaments } from './index';
import { ensureSeedPlayerProfile, type SeedLevelCode } from './seeds/skill-survey-seed';
import { hashPassword } from '../utils/password';
import { walletService } from '../services/payments/WalletService';
import { tournamentService, type TournamentViewer } from '../services/tournaments/TournamentService';
import { tournamentRegistrationService } from '../services/tournaments/TournamentRegistrationService';
import { tournamentBracketService } from '../services/tournaments/TournamentBracketService';
import { tournamentMatchService } from '../services/tournaments/TournamentMatchService';
import { tournamentTeamService } from '../services/tournaments/TournamentTeamService';
import { tournamentRepository } from '../repositories/tournaments/TournamentRepository';

const PASSWORD = 'Password@123';
const DAY = 86_400_000;
const PREFIX = '[DEMO]';
const ORGANIZER_EMAIL = 'tournament.organizer@example.com';
const BROKE_EMAIL = 'tournament.broke@example.com';

interface DemoPlayer {
  email: string;
  fullName: string;
  level: SeedLevelCode;
}

const PLAYERS: DemoPlayer[] = [
  { email: 'tournament.p01@example.com', fullName: 'Trần Quốc Bảo', level: 'EXCELLENT' },
  { email: 'tournament.p02@example.com', fullName: 'Nguyễn Hải Đăng', level: 'GOOD' },
  { email: 'tournament.p03@example.com', fullName: 'Lê Minh Khang', level: 'AVERAGE_PLUS' },
  { email: 'tournament.p04@example.com', fullName: 'Phạm Thu Trang', level: 'AVERAGE' },
  { email: 'tournament.p05@example.com', fullName: 'Võ Hoàng Yến', level: 'AVERAGE_MINUS' },
  { email: 'tournament.p06@example.com', fullName: 'Đặng Tuấn Kiệt', level: 'WEAK' },
  { email: 'tournament.p07@example.com', fullName: 'Bùi Thanh Hà', level: 'BEGINNER' },
  { email: 'tournament.p08@example.com', fullName: 'Hồ Nhật Minh', level: 'AVERAGE' },
  { email: 'tournament.p09@example.com', fullName: 'Đỗ Gia Hân', level: 'AVERAGE_PLUS' },
  { email: 'tournament.p10@example.com', fullName: 'Ngô Quốc Việt', level: 'GOOD' },
  { email: 'tournament.p11@example.com', fullName: 'Dương Thảo Vy', level: 'AVERAGE_MINUS' },
  { email: 'tournament.p12@example.com', fullName: 'Lý Anh Khoa', level: 'WEAK' },
];

const playerByEmail = new Map<string, typeof users.$inferSelect>();
const levelIdByCode = new Map<string, number>();

function player(key: string): typeof users.$inferSelect {
  const index = Number(key.slice(1)) - 1;
  const email = PLAYERS[index]?.email;
  const user = email ? playerByEmail.get(email) : undefined;
  if (!user) throw new Error(`Unknown demo player: ${key}`);
  return user;
}

function viewer(user: typeof users.$inferSelect): TournamentViewer {
  return { id: user.id, role: 'PLAYER' };
}

async function ensureUser(email: string, role: 'PLAYER', fullName: string, level: SeedLevelCode, passwordHash: string) {
  await db.insert(users).values({ email, passwordHash, role, status: 'ACTIVE' }).onConflictDoNothing({ target: users.email });
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || user.role !== role || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new Error(`Seed account unavailable: ${email}`);
  }
  await ensureSeedPlayerProfile(db, { userId: user.id, fullName, levelCode: level });
  return user;
}

async function findTournament(creatorId: number, name: string) {
  const [row] = await db.select().from(tournaments).where(eq(tournaments.name, name)).limit(1);
  if (!row) return null;
  if (row.creatorId !== creatorId) throw new Error(`Tournament name is used by another creator: ${name}`);
  return row;
}

async function currentVersion(id: number): Promise<number> {
  const row = await tournamentRepository.findById(id);
  if (!row) throw new Error(`Tournament ${id} disappeared`);
  return row.version;
}

interface TournamentOptions {
  name: string;
  description: string;
  matchType: 'SINGLES' | 'DOUBLES';
  participantLimit: number;
  entryFee: number;
  minLevel?: string;
  maxLevel?: string;
  draft?: boolean;
  closingSoon?: boolean;
  courtCount?: number;
}

async function createTournament(organizer: TournamentViewer, options: TournamentOptions) {
  const existing = await findTournament(organizer.id, options.name);
  if (existing) {
    console.log(`  = ${options.name} (#${existing.id}, ${existing.status}) — đã có, bỏ qua`);
    return { id: existing.id, created: false };
  }
  const now = Date.now();
  const closing = options.closingSoon === true;
  const view = await tournamentService.create(organizer, {
    name: options.name,
    description: options.description,
    matchType: options.matchType,
    participantLimit: options.participantLimit,
    entryFee: options.entryFee,
    minSkillLevelId: options.minLevel ? levelIdByCode.get(options.minLevel) ?? null : null,
    maxSkillLevelId: options.maxLevel ? levelIdByCode.get(options.maxLevel) ?? null : null,
    venueNote: 'Cụm sân demo — 18D Huỳnh Tấn Phát, P. Tân Thuận Đông, Quận 7',
    registrationStart: new Date(now - 2 * DAY),
    registrationEnd: new Date(now + (closing ? 2 * 3_600_000 : 7 * DAY)),
    tournamentStart: new Date(now + (closing ? DAY : 10 * DAY)),
    tournamentEnd: new Date(now + (closing ? 2 * DAY : 12 * DAY)),
    courtCount: options.courtCount ?? 2,
    matchDurationMinutes: 30,
    minRestMinutes: 10,
    dailyStartTime: '08:00',
    dailyEndTime: '21:00',
  });
  if (!options.draft) await tournamentService.open(organizer, view.id, view.version);
  console.log(`  + ${options.name} (#${view.id})`);
  return { id: view.id, created: true };
}

async function registerSingles(organizer: TournamentViewer, tournamentId: number, keys: string[]) {
  for (const key of keys) await tournamentRegistrationService.registerSingles(viewer(player(key)), tournamentId);
}

async function closeTournament(organizer: TournamentViewer, tournamentId: number) {
  await tournamentService.close(organizer, tournamentId, await currentVersion(tournamentId));
}

async function drawTournament(organizer: TournamentViewer, tournamentId: number) {
  await tournamentBracketService.draw(organizer, tournamentId, await currentVersion(tournamentId));
}

async function moveDatesToPast(tournamentId: number) {
  const now = Date.now();
  await db.update(tournaments).set({
    registrationStart: new Date(now - 14 * DAY),
    registrationEnd: new Date(now - 7 * DAY),
    tournamentStart: new Date(now - 3 * DAY),
    tournamentEnd: new Date(now + DAY),
  }).where(eq(tournaments.id, tournamentId));
}

async function playMatches(organizer: TournamentViewer, tournamentId: number, stopAfter?: number): Promise<number> {
  let played = 0;
  for (;;) {
    const bracket = await tournamentBracketService.bracket(organizer, tournamentId);
    const next = bracket.rounds
      .flatMap(round => round.matches)
      .filter(match => match.slot1.registrationId !== null && match.slot2.registrationId !== null
        && match.winnerRegistrationId === null && match.status !== 'CANCELLED')
      .sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex)[0];
    if (!next) break;
    await tournamentMatchService.start(organizer, tournamentId, next.id);
    await tournamentMatchService.result(organizer, tournamentId, next.id, {
      type: 'SETS',
      sets: [{ team1Score: 21, team2Score: 18 }, { team1Score: 21, team2Score: 15 }],
    });
    played += 1;
    if (stopAfter !== undefined && played >= stopAfter) break;
  }
  return played;
}

async function startNextMatch(organizer: TournamentViewer, tournamentId: number): Promise<number | null> {
  const bracket = await tournamentBracketService.bracket(organizer, tournamentId);
  const next = bracket.rounds
    .flatMap(round => round.matches)
    .filter(match => match.slot1.registrationId !== null && match.slot2.registrationId !== null
      && match.winnerRegistrationId === null && match.status === 'CONFIRMED')
    .sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex)[0];
  if (!next) return null;
  await tournamentMatchService.start(organizer, tournamentId, next.id);
  return next.id;
}

async function completeTournament(organizer: TournamentViewer, tournamentId: number) {
  await tournamentService.complete(organizer, tournamentId, await currentVersion(tournamentId));
}

async function setupDoublesTeam(
  organizer: TournamentViewer,
  tournamentId: number,
  captainKey: string,
  partnerKey: string,
  name: string,
  options: { accept: boolean; register: boolean },
) {
  const captain = viewer(player(captainKey));
  const partner = viewer(player(partnerKey));
  const team = await tournamentTeamService.create(captain, tournamentId, name);
  const invitation = await tournamentTeamService.invite(captain, tournamentId, team.id, partner.id);
  if (options.accept) await tournamentTeamService.accept(partner, invitation.id);
  if (options.register) await tournamentTeamService.register(captain, tournamentId, team.id);
  return team;
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Tournament demo seed is for local development only');
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!raw) throw new Error('DATABASE_URL or DIRECT_URL is required');
  const connection = new URL(raw);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) {
    throw new Error('Tournament demo seed requires a local PostgreSQL database');
  }

  console.log('🌱 Seeding tournament demo data...');
  const passwordHash = await hashPassword(PASSWORD);

  const levelRows = await db.select({ id: skillLevels.id, code: skillLevels.code }).from(skillLevels);
  for (const level of levelRows) levelIdByCode.set(level.code, level.id);

  const organizerUser = await ensureUser(ORGANIZER_EMAIL, 'PLAYER', 'BTC Giải Cầu Lông Demo', 'AVERAGE', passwordHash);
  const organizer = viewer(organizerUser);
  console.log(`  + Organizer: ${ORGANIZER_EMAIL}`);

  for (const demo of PLAYERS) {
    const user = await ensureUser(demo.email, 'PLAYER', demo.fullName, demo.level, passwordHash);
    playerByEmail.set(demo.email, user);
    await walletService.credit({
      userId: user.id,
      amount: '1000000',
      entryType: 'TOP_UP',
      idempotencyKey: `tournament-demo-topup:${demo.email}`,
      description: 'Nạp ví cho dữ liệu demo giải đấu',
    });
  }
  console.log(`  + ${PLAYERS.length} Players demo (ví 1.000.000đ)`);

  const broke = await ensureUser(BROKE_EMAIL, 'PLAYER', 'Nguyễn Ví Rỗng', 'BEGINNER', passwordHash);
  await walletService.getWallet(broke.id);
  console.log(`  + Player ví 0đ: ${BROKE_EMAIL}`);

  const draft = await createTournament(organizer, {
    name: `${PREFIX} Bản nháp — chỉ Organizer thấy`,
    description: 'Giải nháp để kiểm tra quyền xem và màn hình thiết lập của Organizer.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    draft: true,
  });
  if (draft.created) console.log('    → DRAFT: chỉ Organizer/Admin thấy, dùng để test 404 và form thiết lập');

  const openFree = await createTournament(organizer, {
    name: `${PREFIX} Đơn mở — miễn phí`,
    description: 'Giải đơn miễn phí đang mở đăng ký, đã có 3 người. Dùng để test đăng ký/rút và trạng thái đã đăng ký.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
  });
  if (openFree.created) {
    await registerSingles(organizer, openFree.id, ['p04', 'p08', 'p09']);
    console.log('    → OPEN miễn phí: p04, p08, p09 đã đăng ký');
  }

  const openPaid = await createTournament(organizer, {
    name: `${PREFIX} Đơn mở — có lệ phí`,
    description: 'Giải đơn thu 50.000đ, đã có 3 người. Dùng để test trừ ví, hoàn tiền và ví không đủ.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 50_000,
  });
  if (openPaid.created) {
    await registerSingles(organizer, openPaid.id, ['p03', 'p10', 'p11']);
    console.log('    → OPEN có phí: p03, p10, p11 đã đăng ký (đã trừ 50.000đ/người)');
  }

  const restricted = await createTournament(organizer, {
    name: `${PREFIX} Đơn giới hạn trình độ`,
    description: 'Chỉ nhận Trung bình yếu → Trung bình khá (hạng 3–5). Dùng để test chặn trình độ.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    minLevel: 'AVERAGE_MINUS',
    maxLevel: 'AVERAGE_PLUS',
  });
  if (restricted.created) {
    await registerSingles(organizer, restricted.id, ['p04', 'p05', 'p09']);
    console.log('    → Giới hạn trình độ: p04, p05, p09 đã đăng ký; p07/p01 sẽ bị chặn');
  }

  const full = await createTournament(organizer, {
    name: `${PREFIX} Đơn đã đủ người`,
    description: 'Giới hạn 2 người và đã đủ. Dùng để test trạng thái hết chỗ.',
    matchType: 'SINGLES',
    participantLimit: 2,
    entryFee: 0,
  });
  if (full.created) {
    await registerSingles(organizer, full.id, ['p04', 'p08']);
    console.log('    → FULL: p04, p08 đã đăng ký (2/2)');
  }

  const closed = await createTournament(organizer, {
    name: `${PREFIX} Đã đóng đăng ký — chờ bốc thăm`,
    description: 'Đã đóng đăng ký với 6 người, chưa bốc thăm. Dùng để test hạt giống và bốc thăm.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    closingSoon: true,
  });
  if (closed.created) {
    await registerSingles(organizer, closed.id, ['p01', 'p03', 'p04', 'p08', 'p09', 'p10']);
    await closeTournament(organizer, closed.id);
    await moveDatesToPast(closed.id);
    console.log('    → REGISTRATION_CLOSED: 6 người, sẵn sàng bốc thăm');
  }

  const ready = await createTournament(organizer, {
    name: `${PREFIX} Sẵn sàng thi đấu`,
    description: 'Đã bốc thăm, có nhánh đấu và lịch thi đấu, chưa đá trận nào.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    closingSoon: true,
    courtCount: 2,
  });
  if (ready.created) {
    await registerSingles(organizer, ready.id, ['p01', 'p02', 'p03', 'p04', 'p05', 'p08', 'p09', 'p10']);
    await closeTournament(organizer, ready.id);
    await moveDatesToPast(ready.id);
    await drawTournament(organizer, ready.id);
    console.log('    → READY: 8 người, đã bốc thăm và xếp lịch');
  }

  const inProgress = await createTournament(organizer, {
    name: `${PREFIX} Đang thi đấu`,
    description: 'Đã đấu 2 trận vòng 1 và đang có 1 trận diễn ra. Dùng để test nhập tỉ số, sửa kết quả, đi tiếp.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    closingSoon: true,
    courtCount: 2,
  });
  if (inProgress.created) {
    await registerSingles(organizer, inProgress.id, ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p08', 'p10']);
    await closeTournament(organizer, inProgress.id);
    await moveDatesToPast(inProgress.id);
    await drawTournament(organizer, inProgress.id);
    const played = await playMatches(organizer, inProgress.id, 2);
    const liveMatch = await startNextMatch(organizer, inProgress.id);
    console.log(`    → IN_PROGRESS: đã xong ${played} trận, trận đang đấu #${liveMatch ?? '-'}`);
  }

  await seedCompletedAndCancelledSingles(organizer);

  const doublesOpen = await createTournament(organizer, {
    name: `${PREFIX} Đôi — mở đăng ký`,
    description: 'Giải đôi đang mở: có đội đang ghép (lời mời chờ), đội đã đăng ký và đội đủ 2 người chưa đăng ký.',
    matchType: 'DOUBLES',
    participantLimit: 8,
    entryFee: 100_000,
  });
  if (doublesOpen.created) {
    await setupDoublesTeam(organizer, doublesOpen.id, 'p01', 'p02', 'Đôi Sấm Sét', { accept: false, register: false });
    await setupDoublesTeam(organizer, doublesOpen.id, 'p03', 'p04', 'Đôi Bão Tố', { accept: true, register: true });
    await setupDoublesTeam(organizer, doublesOpen.id, 'p05', 'p06', 'Đôi Ánh Sao', { accept: true, register: false });
    console.log('    → ĐÔI mở: p02 có lời mời chờ; p03/p04 đã đăng ký; p05/p06 đủ đội chưa đăng ký');
  }

  const doublesCompleted = await createTournament(organizer, {
    name: `${PREFIX} Đôi — đã hoàn thành`,
    description: 'Giải đôi 4 đội đã hoàn thành: dùng để test bảng xếp hạng Đôi và chia sẻ kết quả.',
    matchType: 'DOUBLES',
    participantLimit: 8,
    entryFee: 100_000,
    closingSoon: true,
    courtCount: 2,
  });
  if (doublesCompleted.created) {
    await setupDoublesTeam(organizer, doublesCompleted.id, 'p01', 'p02', 'Đôi Sấm Sét', { accept: true, register: true });
    await setupDoublesTeam(organizer, doublesCompleted.id, 'p03', 'p04', 'Đôi Bão Tố', { accept: true, register: true });
    await setupDoublesTeam(organizer, doublesCompleted.id, 'p05', 'p06', 'Đôi Ánh Sao', { accept: true, register: true });
    await setupDoublesTeam(organizer, doublesCompleted.id, 'p07', 'p08', 'Đôi Bình Minh', { accept: true, register: true });
    await closeTournament(organizer, doublesCompleted.id);
    await moveDatesToPast(doublesCompleted.id);
    await drawTournament(organizer, doublesCompleted.id);
    const played = await playMatches(organizer, doublesCompleted.id);
    await completeTournament(organizer, doublesCompleted.id);
    console.log(`    → ĐÔI COMPLETED: 4 đội, đã đấu ${played} trận`);
  }

  console.log('\n✅ Tournament demo seed completed.');
  console.log(`🔑 Mật khẩu chung: ${PASSWORD}`);
  console.log(`👑 Organizer: ${ORGANIZER_EMAIL}`);
  console.log(`🪙 Player ví 0đ: ${BROKE_EMAIL}`);
  console.log('📖 Hướng dẫn test: docs/features/tournament/manual-test-guide.md');
}

seed()
  .catch(error => {
    console.error('❌ Tournament demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

async function seedCompletedAndCancelledSingles(organizer: TournamentViewer) {
  const completed = await createTournament(organizer, {
    name: `${PREFIX} Đã hoàn thành`,
    description: 'Giải đơn đã hoàn thành đủ 8 người: có vô địch, điểm xếp hạng, phong độ và nhóm chat.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 0,
    closingSoon: true,
    courtCount: 2,
  });
  if (completed.created) {
    await registerSingles(organizer, completed.id, ['p02', 'p03', 'p04', 'p05', 'p06', 'p08', 'p09', 'p10']);
    await closeTournament(organizer, completed.id);
    await moveDatesToPast(completed.id);
    await drawTournament(organizer, completed.id);
    const played = await playMatches(organizer, completed.id);
    await completeTournament(organizer, completed.id);
    console.log(`    → COMPLETED: đã đấu ${played} trận, đã trao giải và tính điểm`);
  }

  const cancelled = await createTournament(organizer, {
    name: `${PREFIX} Đã huỷ`,
    description: 'Giải thu 50.000đ đã bị huỷ để test trạng thái huỷ và hoàn phí.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 50000,
  });
  if (cancelled.created) {
    await registerSingles(organizer, cancelled.id, ['p04', 'p08', 'p09']);
    await tournamentService.cancel(organizer, cancelled.id, await currentVersion(cancelled.id), 'Demo: sân phải bảo trì đột xuất');
    console.log('    → CANCELLED: 3 người đã được hoàn 50.000đ');
  }

  const closeTooEarly = await createTournament(organizer, {
    name: `${PREFIX} Đóng khi chưa đủ người`,
    description: 'Chỉ có 1 người đăng ký. Dùng để test đóng đăng ký tự huỷ và hoàn phí.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 50000,
  });
  if (closeTooEarly.created) {
    await registerSingles(organizer, closeTooEarly.id, ['p04']);
    console.log('    → OPEN 1 người: đóng đăng ký sẽ tự huỷ và hoàn 50.000đ');
  }

  const adminCancel = await createTournament(organizer, {
    name: `${PREFIX} Admin huỷ và hoàn phí`,
    description: 'Giải có phí đang mở để Admin huỷ từ trang quản trị và kiểm tra hoàn tiền.',
    matchType: 'SINGLES',
    participantLimit: 8,
    entryFee: 50000,
  });
  if (adminCancel.created) {
    await registerSingles(organizer, adminCancel.id, ['p08', 'p09']);
    console.log('    → OPEN có phí: sẵn sàng cho Admin huỷ');
  }
}
