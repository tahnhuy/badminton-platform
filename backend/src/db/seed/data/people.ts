/**
 * Demo community. Every account shares the demo password (see seed/index.ts) and the
 * withdrawal PIN `123456`; e-mails are verified. `joinedDaysAgo` spreads sign-ups so the
 * Admin dashboard has a growth curve.
 */
/**
 * Shared demo credentials (owner decision 2026-11-27). `123456` is below the sign-up password
 * policy; it works because the seed writes the hash directly and sign-in does not re-check
 * the policy. Never use these on a production database.
 */
export const DEMO_PASSWORD = '123456';
export const DEMO_WITHDRAWAL_PIN = '123456';

export type LevelCode = 'BEGINNER' | 'WEAK' | 'AVERAGE_MINUS' | 'AVERAGE' | 'AVERAGE_PLUS' | 'GOOD' | 'EXCELLENT';

export interface DemoPlayer {
  key: string;
  email: string;
  fullName: string;
  level: LevelCode;
  phone: string;
  joinedDaysAgo: number;
  avatarUrl?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  /** Starting wallet top-up in VND (0 = empty wallet). */
  topUp: number;
}

/** The owner's own demo account: takes part in every flow. */
export const MAIN_PLAYER_KEY = 'main';

const roster: Array<[string, LevelCode]> = [
  ['Nguyễn Văn Nam', 'AVERAGE'], ['Trần Thị Hương', 'AVERAGE_MINUS'], ['Lê Hoàng An', 'AVERAGE_PLUS'],
  ['Phạm Minh Đức', 'GOOD'], ['Võ Thu Hà', 'AVERAGE'], ['Đặng Quốc Bảo', 'EXCELLENT'],
  ['Bùi Gia Huy', 'AVERAGE_PLUS'], ['Hoàng Ngọc Mai', 'WEAK'], ['Phan Thanh Tùng', 'AVERAGE'],
  ['Huỳnh Kim Ngân', 'AVERAGE_MINUS'], ['Đỗ Tuấn Kiệt', 'GOOD'], ['Ngô Phương Linh', 'BEGINNER'],
  ['Dương Hải Đăng', 'AVERAGE'], ['Lý Minh Châu', 'AVERAGE_PLUS'], ['Trịnh Văn Khôi', 'AVERAGE_MINUS'],
  ['Mai Thảo Vy', 'WEAK'], ['Vũ Đức Thắng', 'GOOD'], ['Tạ Hồng Nhung', 'AVERAGE'],
  ['Châu Gia Bảo', 'EXCELLENT'], ['Lâm Thanh Trúc', 'AVERAGE_MINUS'], ['Hồ Quang Vinh', 'AVERAGE_PLUS'],
  ['Kiều Anh Thư', 'BEGINNER'], ['Tôn Thất Phúc', 'AVERAGE'], ['La Bảo Ngọc', 'WEAK'],
  ['Quách Minh Khang', 'GOOD'], ['Đinh Thị Yến', 'AVERAGE_MINUS'], ['Cao Văn Lực', 'AVERAGE'],
  ['Lưu Diệu Linh', 'AVERAGE_PLUS'], ['Thái Hoàng Long', 'EXCELLENT'], ['Nguyễn Khánh Vân', 'WEAK'],
  ['Trương Đình Nguyên', 'AVERAGE'], ['Phùng Ngọc Hân', 'BEGINNER'], ['Doãn Chí Thanh', 'AVERAGE_MINUS'],
  ['Âu Mỹ Duyên', 'AVERAGE_PLUS'], ['Lạc Thành Đạt', 'GOOD'], ['Mạc Thị Lan', 'WEAK'],
  ['Ông Văn Hậu', 'BEGINNER'], ['Bạch Tuyết Nhi', 'AVERAGE'], ['Giang Minh Trí', 'AVERAGE_MINUS'],
];

const AVATARS = ['/images/avatar_player1-56586a.png', '/images/avatar_player2-4a0be7.png', '/images/avatar_player3-7ca715.png'];

export const DEMO_PLAYERS: DemoPlayer[] = [
  {
    key: MAIN_PLAYER_KEY,
    email: 'chatok111111@gmail.com',
    fullName: 'Đặng Ngọc Tài',
    level: 'AVERAGE',
    phone: '0909111111',
    joinedDaysAgo: 100,
    avatarUrl: AVATARS[0],
    topUp: 3_000_000,
  },
  ...roster.map(([fullName, level], index): DemoPlayer => {
    const n = index + 1;
    const key = `player${String(n).padStart(2, '0')}`;
    return {
      key,
      email: `${key}@smashpro.vn`,
      fullName,
      level,
      phone: `09${String(10_000_000 + n * 137_911).slice(0, 8)}`,
      joinedDaysAgo: 95 - ((n * 7) % 90),
      avatarUrl: n <= 2 ? AVATARS[n] : undefined,
      // player37: empty wallet; player39: suspended account (special cases for demo).
      status: n === 39 ? 'SUSPENDED' : 'ACTIVE',
      topUp: n === 37 ? 0 : 1_000_000 + (n % 4) * 500_000,
    };
  }),
];

/** `court_owner_profiles` stores only the business name and phone (no personal name/avatar). */
export interface DemoOwner {
  key: string;
  email: string;
  businessName: string;
  phone: string;
  joinedDaysAgo: number;
}

export const DEMO_OWNERS: DemoOwner[] = [
  { key: 'owner1', email: 'owner1@smashpro.vn', businessName: 'CLB Cầu Lông Phúc Thịnh', phone: '0901234567', joinedDaysAgo: 150 },
  { key: 'owner2', email: 'owner2@smashpro.vn', businessName: 'Sân Cầu Lông Tân Bình Pro', phone: '0912345678', joinedDaysAgo: 140 },
  { key: 'owner3', email: 'owner3@smashpro.vn', businessName: 'CLB Cầu Lông Hoàng Thành', phone: '0987654321', joinedDaysAgo: 130 },
  // Newly registered owner: one facility waiting for approval, one rejected.
  { key: 'owner4', email: 'owner4@smashpro.vn', businessName: 'Sân Cầu Lông Thanh Đa', phone: '0938765432', joinedDaysAgo: 6 },
];

export const DEMO_ADMIN = { email: 'admin@smashpro.vn', joinedDaysAgo: 160 };
