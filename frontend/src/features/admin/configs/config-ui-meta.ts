import type { ConfigDomain, ConfigItem } from './types/config';

export interface ConfigUiMeta {
  label: string;
  description: string;
  unit?: string;
  booleanLabels?: { true: string; false: string };
  optionLabels?: Record<string, string>;
}

export const DOMAIN_DESCRIPTIONS: Record<ConfigDomain, string> = {
  booking: 'Cấu hình đặt sân, huỷ lượt đặt và thời gian thanh toán.',
  tournament: 'Cấu hình tổ chức giải đấu, đăng ký và xử lý trận.',
  team: 'Cấu hình đội thi đấu đôi và lời mời thành viên.',
  matchmaking: 'Cấu hình tìm kèo, ghép trận và giới hạn bài đăng.',
  social: 'Cấu hình bảng tin, bài đăng và bình luận cộng đồng.',
  messaging: 'Cấu hình trò chuyện, nhóm chat và giới hạn tin nhắn.',
  auth: 'Cấu hình đăng nhập, khoá tài khoản và thời hạn phiên.',
  refund: 'Cấu hình xử lý hoàn tiền.',
  report: 'Cấu hình tiếp nhận báo cáo vi phạm.',
  'player-skill-adjustment': 'Cấu hình tự động điều chỉnh trình độ người chơi.',
};

const CONFIG_UI_META: Record<string, ConfigUiMeta> = {
  BOOKING_ENABLED: {
    label: 'Cho phép đặt sân',
    description: 'Bật hoặc tạm tắt toàn bộ chức năng đặt sân của người chơi.',
    booleanLabels: { true: 'Cho phép đặt sân', false: 'Tạm tắt đặt sân' },
  },
  BOOKING_MIN_DURATION_MINUTES: {
    label: 'Thời lượng đặt sân tối thiểu',
    description: 'Mỗi lượt đặt sân phải dài ít nhất số phút này.',
    unit: 'phút',
  },
  BOOKING_MAX_DURATION_MINUTES: {
    label: 'Thời lượng đặt sân tối đa',
    description: 'Mỗi lượt đặt sân không được dài quá số phút này.',
    unit: 'phút',
  },
  BOOKING_ADVANCE_WINDOW_DAYS: {
    label: 'Số ngày được đặt trước',
    description: 'Người chơi chỉ được đặt sân trong khoảng số ngày này tính từ hôm nay.',
    unit: 'ngày',
  },
  MAINTENANCE_ADVANCE_WINDOW_DAYS: {
    label: 'Số ngày lên lịch bảo trì trước',
    description: 'Chủ sân được tạo lịch bảo trì trong khoảng số ngày này tính từ hôm nay.',
    unit: 'ngày',
  },
  BOOKING_ACTIVE_LIMIT_MODE: {
    label: 'Cách giới hạn lượt đặt sân',
    description: 'Chọn cách hệ thống giới hạn số lượt đặt sân đang hoạt động của mỗi người.',
    optionLabels: {
      LIMITED: 'Giới hạn theo số lượt',
      UNLIMITED: 'Không giới hạn',
    },
  },
  BOOKING_MAX_ACTIVE_PER_PLAYER: {
    label: 'Số lượt đặt sân tối đa mỗi người',
    description: 'Áp dụng khi chọn cách giới hạn theo số lượt.',
    unit: 'lượt',
  },
  PLAYER_CAN_CANCEL_BOOKING: {
    label: 'Người chơi được tự huỷ đặt sân',
    description: 'Cho phép người chơi tự huỷ lượt đặt sân trước giờ bắt đầu.',
    booleanLabels: { true: 'Cho phép tự huỷ', false: 'Không cho tự huỷ' },
  },
  PLAYER_CANCELLATION_DEADLINE_MINUTES: {
    label: 'Hạn huỷ của người chơi',
    description: 'Người chơi phải huỷ trước giờ bắt đầu ít nhất số phút này. 0 nghĩa là được huỷ bất kỳ lúc nào trước giờ bắt đầu.',
    unit: 'phút',
  },
  OWNER_CAN_CANCEL_BOOKING: {
    label: 'Chủ sân được huỷ đặt sân',
    description: 'Cho phép chủ sân huỷ lượt đặt sân của người chơi.',
    booleanLabels: { true: 'Cho phép chủ sân huỷ', false: 'Không cho chủ sân huỷ' },
  },
  OWNER_CANCELLATION_DEADLINE_MINUTES: {
    label: 'Hạn huỷ của chủ sân',
    description: 'Chủ sân phải huỷ trước giờ bắt đầu ít nhất số phút này.',
    unit: 'phút',
  },
  BOOKING_PAYMENT_TIMEOUT_MINUTES: {
    label: 'Thời gian giữ sân chờ thanh toán',
    description: 'Lượt đặt sân chưa thanh toán sẽ hết hạn sau số phút này.',
    unit: 'phút',
  },
  REFUND_ENABLED: {
    label: 'Bật hoàn tiền',
    description: 'Bật hoặc tắt quy trình hoàn tiền tự động.',
    booleanLabels: { true: 'Bật hoàn tiền', false: 'Tắt hoàn tiền' },
  },
  REFUND_PROCESSING_TIMEOUT_MINUTES: {
    label: 'Thời gian xử lý hoàn tiền tối đa',
    description: 'Quá thời gian này, yêu cầu hoàn tiền được đưa sang xử lý lại hoặc xử lý tay.',
    unit: 'phút',
  },
  TOURNAMENT_ENABLED: {
    label: 'Bật giải đấu',
    description: 'Bật hoặc tạm tắt chức năng tổ chức giải đấu.',
    booleanLabels: { true: 'Cho phép tổ chức giải', false: 'Tạm tắt giải đấu' },
  },
  TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT: {
    label: 'Số người tham gia mặc định',
    description: 'Giới hạn người tham gia mặc định khi tạo giải mới.',
    unit: 'người/đội',
  },
  TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES: {
    label: 'Thời gian giữ chỗ đăng ký chờ thanh toán',
    description: 'Đăng ký chưa thanh toán sẽ hết hạn và giải phóng chỗ sau số phút này.',
    unit: 'phút',
  },
  TOURNAMENT_RATING_ENABLED: {
    label: 'Cho phép đánh giá trận giải đấu',
    description: 'Bật hoặc tắt việc người chơi đánh giá trận đấu thuộc giải.',
    booleanLabels: { true: 'Có đánh giá trận giải', false: 'Không đánh giá trận giải' },
  },
  TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES: {
    label: 'Thời gian chờ trước khi xử thua do vắng mặt',
    description: 'Thời gian chờ trước khi trận đấu được xử thắng do đối thủ vắng mặt.',
    unit: 'phút',
  },
  TEAM_INVITATION_TIMEOUT_MINUTES: {
    label: 'Hạn lời mời vào đội',
    description: 'Lời mời vào đội hết hạn sau số phút này nếu chưa được phản hồi.',
    unit: 'phút',
  },
  REPORT_ENABLED: {
    label: 'Bật báo cáo vi phạm',
    description: 'Bật hoặc tắt việc người dùng gửi báo cáo vi phạm.',
    booleanLabels: { true: 'Cho phép gửi báo cáo', false: 'Tắt báo cáo' },
  },
  AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD: {
    label: 'Số lần đăng nhập sai trước khi khoá',
    description: 'Tài khoản bị khoá tạm sau số lần đăng nhập sai liên tiếp này.',
    unit: 'lần',
  },
  AUTH_FAILED_LOGIN_LOCKOUT_MINUTES: {
    label: 'Thời gian khoá tài khoản',
    description: 'Tài khoản tự mở khoá sau số phút này.',
    unit: 'phút',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER: {
    label: 'Thời gian chờ tối đa của phiên người chơi',
    description: 'Phiên người chơi hết hạn nếu không hoạt động trong số phút này.',
    unit: 'phút',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER: {
    label: 'Thời hạn tối đa phiên người chơi',
    description: 'Phiên người chơi luôn hết hạn sau số phút này, kể cả khi đang hoạt động.',
    unit: 'phút',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER: {
    label: 'Thời gian chờ tối đa của phiên chủ sân',
    description: 'Phiên chủ sân hết hạn nếu không hoạt động trong số phút này.',
    unit: 'phút',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER: {
    label: 'Thời hạn tối đa phiên chủ sân',
    description: 'Phiên chủ sân luôn hết hạn sau số phút này, kể cả khi đang hoạt động.',
    unit: 'phút',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN: {
    label: 'Thời gian chờ tối đa của phiên quản trị viên',
    description: 'Phiên quản trị viên hết hạn nếu không hoạt động trong số phút này.',
    unit: 'phút',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN: {
    label: 'Thời hạn tối đa phiên quản trị viên',
    description: 'Phiên quản trị viên luôn hết hạn sau số phút này, kể cả khi đang hoạt động.',
    unit: 'phút',
  },
  PLAYER_SKILL_ADJUSTMENT_ENABLED: {
    label: 'Tự động điều chỉnh trình độ',
    description: 'Bật hoặc tắt việc tự động điều chỉnh trình độ từ các đánh giá gần đây.',
    booleanLabels: { true: 'Bật tự động điều chỉnh', false: 'Tắt tự động điều chỉnh' },
  },
  PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS: {
    label: 'Số đánh giá tối thiểu (legacy)',
    description: 'Số đánh giá gần đây tối thiểu trước khi xét điều chỉnh trình độ.',
    unit: 'đánh giá',
  },
  PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES: {
    label: 'Số trận tối thiểu để xét điều chỉnh',
    description: 'Số trận gần đây tối thiểu trước khi xét điều chỉnh trình độ.',
    unit: 'trận',
  },
  PLAYER_SKILL_ADJUSTMENT_THRESHOLD: {
    label: 'Khoảng cách trình độ tối thiểu',
    description: 'Chênh lệch trình độ tối thiểu để kích hoạt điều chỉnh.',
    unit: 'bậc',
  },
  PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS: {
    label: 'Thời gian chờ giữa 2 lần điều chỉnh',
    description: 'Số ngày tối thiểu giữa hai lần điều chỉnh trình độ của cùng người chơi.',
    unit: 'ngày',
  },
  MATCHMAKING_ENABLED: {
    label: 'Bật tìm kèo',
    description: 'Bật hoặc tắt chức năng tìm kèo, ghép trận.',
    booleanLabels: { true: 'Cho phép tìm kèo', false: 'Tắt tìm kèo' },
  },
  MATCHMAKING_REQUEST_EXPIRATION_MINUTES: {
    label: 'Hạn bài tìm kèo (legacy)',
    description: 'Bài tìm kèo hết hạn sau số phút này. Key legacy, sẽ được thay thế.',
    unit: 'phút',
  },
  MATCHMAKING_MIN_LEAD_TIME_MINUTES: {
    label: 'Thời gian tối thiểu trước giờ bắt đầu',
    description: 'Bài tìm kèo phải được tạo trước giờ bắt đầu ít nhất số phút này.',
    unit: 'phút',
  },
  MATCHMAKING_MATCH_DURATION_MINUTES: {
    label: 'Thời lượng trận mặc định',
    description: 'Thời lượng mặc định khi tạo trận từ kèo.',
    unit: 'phút',
  },
  MATCHMAKING_APPLICATION_TIMEOUT_MINUTES: {
    label: 'Hạn xử lý đơn tham gia',
    description: 'Đơn xin tham gia kèo hết hạn sau số phút này.',
    unit: 'phút',
  },
  MATCHMAKING_INVITATION_TIMEOUT_MINUTES: {
    label: 'Hạn phản hồi lời mời',
    description: 'Lời mời tham gia kèo hết hạn sau số phút này.',
    unit: 'phút',
  },
  MATCHMAKING_GROUP_MIN_SLOTS: {
    label: 'Số chỗ tối thiểu của kèo nhóm',
    description: 'Kèo nhóm phải có ít nhất số chỗ này.',
    unit: 'chỗ',
  },
  MATCHMAKING_GROUP_MAX_SLOTS: {
    label: 'Số chỗ tối đa của kèo nhóm',
    description: 'Kèo nhóm không được vượt quá số chỗ này.',
    unit: 'chỗ',
  },
  MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER: {
    label: 'Số kèo mở tối đa mỗi người',
    description: 'Mỗi người chỉ được mở tối đa số kèo này cùng lúc.',
    unit: 'kèo',
  },
  SOCIAL_FEED_ENABLED: {
    label: 'Bật bảng tin cộng đồng',
    description: 'Bật hoặc tắt bài đăng, cảm xúc và bình luận trên bảng tin.',
    booleanLabels: { true: 'Cho phép đăng bài', false: 'Tắt bảng tin' },
  },
  SOCIAL_FREE_POSTS_PER_DAY: {
    label: 'Số bài miễn phí mỗi ngày',
    description: 'Số bài mỗi người chơi được đăng miễn phí trong một ngày.',
    unit: 'bài/ngày',
  },
  SOCIAL_COMMENTS_PER_MINUTE: {
    label: 'Số bình luận mỗi phút',
    description: 'Giới hạn số bình luận mỗi người chơi gửi trong một phút.',
    unit: 'bình luận/phút',
  },
  MESSAGING_ENABLED: {
    label: 'Bật tin nhắn',
    description: 'Bật hoặc tắt chức năng trò chuyện.',
    booleanLabels: { true: 'Cho phép nhắn tin', false: 'Tắt tin nhắn' },
  },
  MESSAGING_GROUP_MAX_MEMBERS: {
    label: 'Số thành viên tối đa của nhóm',
    description: 'Một nhóm trò chuyện không được vượt quá số thành viên này.',
    unit: 'thành viên',
  },
  MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY: {
    label: 'Số cuộc trò chuyện mới mỗi ngày',
    description: 'Số cuộc trò chuyện 1-1 mới mỗi người được tạo trong một ngày.',
    unit: 'cuộc/ngày',
  },
  MESSAGING_MESSAGES_PER_MINUTE: {
    label: 'Số tin nhắn mỗi phút',
    description: 'Giới hạn số tin nhắn mỗi người gửi trong một phút.',
    unit: 'tin/phút',
  },
};

function humanizeKey(key: string): string {
  return key
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .join(' ');
}

export function getConfigUiMeta(item: ConfigItem): ConfigUiMeta {
  const meta = CONFIG_UI_META[item.configKey];
  if (meta) return meta;
  return {
    label: humanizeKey(item.configKey),
    description: item.description,
    booleanLabels: { true: 'Bật', false: 'Tắt' },
  };
}
