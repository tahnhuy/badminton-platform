import type { ConfigDomain } from './types/config';

export type ConfigGroupKind = 'pair' | 'mode-number' | 'toggle-number' | 'skill';

export interface ConfigGroupDefinition {
  id: string;
  domain: ConfigDomain;
  kind: ConfigGroupKind;
  title: string;
  description: string;
  keys: string[];
}

/**
 * Keys never shown on the config page. PLAYER_SKILL_ADJUSTMENT_ENABLED is read-only
 * on the server since AUTH-33 (2026-11-22) and must not appear as a toggle.
 */
export const HIDDEN_CONFIG_KEYS: ReadonlySet<string> = new Set(['PLAYER_SKILL_ADJUSTMENT_ENABLED']);

export const CONFIG_GROUPS: ConfigGroupDefinition[] = [
  {
    id: 'booking-duration',
    domain: 'booking',
    kind: 'pair',
    title: 'Thời lượng đặt sân',
    description: 'Khoảng thời gian hợp lệ cho mỗi lượt đặt sân. Thời lượng tối thiểu không được lớn hơn tối đa.',
    keys: ['BOOKING_MIN_DURATION_MINUTES', 'BOOKING_MAX_DURATION_MINUTES'],
  },
  {
    id: 'booking-active-limit',
    domain: 'booking',
    kind: 'mode-number',
    title: 'Giới hạn lượt đặt sân',
    description: 'Chọn cách giới hạn số lượt đặt sân đang hoạt động của mỗi người.',
    keys: ['BOOKING_ACTIVE_LIMIT_MODE', 'BOOKING_MAX_ACTIVE_PER_PLAYER'],
  },
  {
    id: 'player-cancel-booking',
    domain: 'booking',
    kind: 'toggle-number',
    title: 'Người chơi tự huỷ đặt sân',
    description: 'Cho phép người chơi tự huỷ lượt đặt sân và quy định hạn huỷ trước giờ bắt đầu.',
    keys: ['PLAYER_CAN_CANCEL_BOOKING', 'PLAYER_CANCELLATION_DEADLINE_MINUTES'],
  },
  {
    id: 'owner-cancel-booking',
    domain: 'booking',
    kind: 'toggle-number',
    title: 'Chủ sân huỷ đặt sân',
    description: 'Cho phép chủ sân huỷ lượt đặt sân và quy định hạn huỷ trước giờ bắt đầu.',
    keys: ['OWNER_CAN_CANCEL_BOOKING', 'OWNER_CANCELLATION_DEADLINE_MINUTES'],
  },
  {
    id: 'refund',
    domain: 'refund',
    kind: 'toggle-number',
    title: 'Hoàn tiền',
    description: 'Bật hoặc tắt quy trình hoàn tiền và quy định thời gian xử lý tối đa.',
    keys: ['REFUND_ENABLED', 'REFUND_PROCESSING_TIMEOUT_MINUTES'],
  },
  {
    id: 'matchmaking-group-slots',
    domain: 'matchmaking',
    kind: 'pair',
    title: 'Số chỗ của kèo nhóm',
    description: 'Số chỗ tối thiểu và tối đa của một kèo nhóm. Tối thiểu không được lớn hơn tối đa.',
    keys: ['MATCHMAKING_GROUP_MIN_SLOTS', 'MATCHMAKING_GROUP_MAX_SLOTS'],
  },
  {
    id: 'auth-player-session',
    domain: 'auth',
    kind: 'pair',
    title: 'Phiên người chơi',
    description: 'Thời gian chờ và thời hạn tuyệt đối của phiên đăng nhập người chơi.',
    keys: ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER'],
  },
  {
    id: 'auth-owner-session',
    domain: 'auth',
    kind: 'pair',
    title: 'Phiên chủ sân',
    description: 'Thời gian chờ và thời hạn tuyệt đối của phiên đăng nhập chủ sân.',
    keys: ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER'],
  },
  {
    id: 'auth-admin-session',
    domain: 'auth',
    kind: 'pair',
    title: 'Phiên quản trị viên',
    description: 'Thời gian chờ và thời hạn tuyệt đối của phiên đăng nhập quản trị viên.',
    keys: ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN'],
  },
  {
    id: 'skill-adjustment',
    domain: 'player-skill-adjustment',
    kind: 'skill',
    title: 'Tự động điều chỉnh trình độ',
    description: 'Số liệu, ngưỡng và thời gian chờ của cơ chế điều chỉnh trình độ từ đánh giá. Cơ chế này đang tắt cố định; trình độ ban đầu lấy từ khảo sát khi đăng ký.',
    keys: [
      'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS',
      'PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES',
      'PLAYER_SKILL_ADJUSTMENT_THRESHOLD',
      'PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS',
    ],
  },
];

export function groupKeys(group: ConfigGroupDefinition): Set<string> {
  return new Set(group.keys);
}
