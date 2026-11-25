import { ApiError } from '@/shared/api/http-client';
import { formatVnd } from '@/features/wallet/services/wallet-api';
import type { MatchType, ScheduleWarningCode, SkillLevelRef, Tournament, TournamentStatus } from './types';

/** Vietnamese labels, dates in Asia/Ho_Chi_Minh, error messages (TRN-07/08). */

export const TZ = 'Asia/Ho_Chi_Minh';
const VN_OFFSET = '+07:00';

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'Bản nháp',
  OPEN_FOR_REGISTRATION: 'Đang mở đăng ký',
  REGISTRATION_CLOSED: 'Đã đóng đăng ký',
  READY: 'Đã bốc thăm',
  IN_PROGRESS: 'Đang diễn ra',
  COMPLETED: 'Đã kết thúc',
  CANCELLED: 'Đã huỷ',
};

export const matchTypeLabel = (type: MatchType) => (type === 'SINGLES' ? 'Đơn' : 'Đôi');
export const unitLabel = (type: MatchType) => (type === 'SINGLES' ? 'VĐV' : 'đội');
export const feeLabel = (fee: number) => (fee === 0 ? 'Miễn phí' : formatVnd(fee));
export const money = formatVnd;

export function levelRange(min: SkillLevelRef | null, max: SkillLevelRef | null): string {
  if (!min && !max) return 'Mọi trình độ';
  if (!min) return `Đến ${max!.name}`;
  if (!max) return `Từ ${min.name}`;
  return min.id === max.id ? min.name : `${min.name} – ${max.name}`;
}

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, ...options });
const weekdayDate = fmt({ weekday: 'short', day: '2-digit', month: '2-digit' });
const fullDate = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });

export const formatTime = (iso: string) => time.format(new Date(iso));
export const formatDay = (iso: string) => weekdayDate.format(new Date(iso));
export const formatDate = (iso: string) => fullDate.format(new Date(iso));
export const formatDateTime = (iso: string) => `${weekdayDate.format(new Date(iso))} · ${time.format(new Date(iso))}`;

/** `YYYY-MM-DD` of the instant in Vietnam. */
export function vnDateKey(iso: string): string {
  const parts = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Minutes after local midnight in Vietnam. */
export function vnMinutes(iso: string): number {
  const [h, m] = formatTime(iso).split(':').map(Number);
  return h * 60 + m;
}

/** ISO → value of `<input type="datetime-local">` in Vietnam time. */
export function toLocalInput(iso: string): string {
  return `${vnDateKey(iso)}T${formatTime(iso)}`;
}

/** Value of `<input type="datetime-local">` (Vietnam time) → ISO with offset. */
export function fromLocalInput(value: string): string {
  return new Date(`${value}:00${VN_OFFSET}`).toISOString();
}

export const minutesToHHmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function roundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return 'Chung kết';
  if (fromEnd === 1) return 'Bán kết';
  if (fromEnd === 2) return 'Tứ kết';
  return `Vòng ${2 ** (fromEnd + 1)}`;
}

export const WARNING_LABEL: Record<ScheduleWarningCode, string> = {
  COURT_OVERLAP: 'Trùng sân với trận khác',
  PARTICIPANT_OVERLAP: 'VĐV có hai trận trùng giờ',
  REST_TOO_SHORT: 'VĐV nghỉ chưa đủ thời gian tối thiểu',
  BEFORE_FEEDER: 'Bắt đầu trước khi trận trước kết thúc',
  OUTSIDE_DAILY_WINDOW: 'Ngoài khung giờ thi đấu trong ngày',
  OUTSIDE_TOURNAMENT_DATES: 'Ngoài thời gian của giải',
};

const ERROR_MESSAGE: Record<string, string> = {
  TOURNAMENT_NOT_FOUND: 'Không tìm thấy giải đấu.',
  TOURNAMENT_FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  TOURNAMENT_INVALID_STATE: 'Trạng thái giải không cho phép thao tác này. Trang đã được tải lại.',
  TOURNAMENT_VERSION_CONFLICT: 'Giải vừa được thay đổi ở nơi khác. Dữ liệu đã được tải lại, hãy thử lại.',
  TOURNAMENT_FIELD_LOCKED: 'Một số thông tin đã bị khoá ở trạng thái hiện tại.',
  TOURNAMENT_REGISTRATION_CLOSED: 'Giải không còn nhận đăng ký.',
  TOURNAMENT_FULL: 'Giải đã đủ người.',
  TOURNAMENT_NOT_ELIGIBLE: 'Trình độ của bạn không nằm trong giới hạn của giải.',
  TOURNAMENT_ORGANIZER_CANNOT_PLAY: 'Organizer không thể đăng ký giải của chính mình.',
  TOURNAMENT_ALREADY_REGISTERED: 'Bạn đã đăng ký giải này.',
  TOURNAMENT_TEAM_REQUIRED: 'Giải đôi cần đăng ký theo đội.',
  TOURNAMENT_REGISTRATION_NOT_FOUND: 'Đăng ký không còn hiệu lực.',
  WALLET_INSUFFICIENT_BALANCE: 'Số dư ví không đủ để trả lệ phí.',
  TOURNAMENT_SEED_INVALID: 'Hạt giống không hợp lệ: số phải liên tục từ 1 và không trùng.',
  TOURNAMENT_BRACKET_ALREADY_GENERATED: 'Giải đã bốc thăm, không thể thay đổi.',
  TOURNAMENT_NOT_ENOUGH_PARTICIPANTS: 'Cần ít nhất 2 người tham gia để bốc thăm.',
  TOURNAMENT_MATCH_NOT_PLAYABLE: 'Trận chưa đủ hai bên.',
  TOURNAMENT_MATCH_LOCKED: 'Trận này không thể thay đổi nữa.',
  TOURNAMENT_RESULT_INVALID: 'Tỉ số không hợp lệ theo luật 21 điểm.',
  TOURNAMENT_CORRECTION_WINDOW_CLOSED: 'Đã quá 48 giờ sau khi kết thúc, không thể sửa kết quả.',
  TOURNAMENT_NOT_FINISHED: 'Chung kết chưa có kết quả.',
  TOURNAMENT_DISABLED: 'Chức năng giải đấu đang tạm tắt.',
  VALIDATION_FAILED: 'Thông tin chưa hợp lệ, kiểm tra lại các trường.',
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGE[error.code] ?? 'Có lỗi xảy ra, vui lòng thử lại.';
  return 'Không kết nối được máy chủ, vui lòng thử lại.';
}

export const FIELD_PROBLEM: Record<string, string> = {
  REGISTRATION_END_BEFORE_START: 'Hạn đăng ký phải sau lúc mở đăng ký.',
  TOURNAMENT_START_BEFORE_REGISTRATION_END: 'Giải phải bắt đầu sau hạn đăng ký.',
  TOURNAMENT_END_BEFORE_START: 'Thời gian kết thúc phải sau lúc bắt đầu.',
  DAILY_WINDOW_EMPTY: 'Giờ kết thúc trong ngày phải sau giờ bắt đầu.',
  MATCH_LONGER_THAN_DAILY_WINDOW: 'Khung giờ trong ngày ngắn hơn một trận.',
  UNKNOWN_SKILL_LEVEL: 'Trình độ không hợp lệ.',
  MAX_LEVEL_BELOW_MIN_LEVEL: 'Trình độ tối đa phải không thấp hơn tối thiểu.',
  VENUE_REQUIRED: 'Cần nhập địa điểm trước khi mở đăng ký.',
  REGISTRATION_END_IN_PAST: 'Hạn đăng ký đã qua.',
  TOURNAMENT_FIELD_LOCKED: 'Đã khoá ở trạng thái hiện tại.',
};

export const isLive = (t: Pick<Tournament, 'status'>) => t.status === 'IN_PROGRESS';
