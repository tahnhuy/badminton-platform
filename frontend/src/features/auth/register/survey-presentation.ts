import {
  Activity, CalendarDays, Check, GraduationCap, RotateCcw, Target, Trophy, UsersRound, Zap, type LucideIcon,
} from 'lucide-react';
import type { SurveyCriterion } from '../auth-api';

/**
 * Presentation-only mappings for the registration survey (prototype v3). Keyed by
 * question id / option code / step position; every entry has a fallback, so a new
 * survey version with unknown ids still renders with the API wording. No survey
 * text or scoring lives here.
 */

export interface StepCopy { eyebrow: string; heading: string; lead: string; hint: string }

/** Copy around the API step title, keyed by the step's first question id. Unknown steps show the API title only. */
const SURVEY_STEP_COPY: Record<string, StepCopy> = {
  yearsPlaying: { eyebrow: 'Hiểu hành trình của bạn', heading: 'Bạn đã gắn bó với cầu lông thế nào?', lead: 'Vài câu về thời gian chơi và cách bạn học. Không có câu trả lời đúng hay sai.', hint: 'Khởi đầu câu chuyện của bạn' },
  'skill.service': { eyebrow: 'Hiểu cách bạn chơi', heading: 'Bạn tự tin với đường cầu nào?', lead: 'Chọn mô tả gần nhất với cách bạn thường chơi hiện tại.', hint: 'Cách bạn làm chủ đường cầu' },
  rallyConsistency: { eyebrow: 'Nhịp độ trên sân', heading: 'Khi vào trận, bạn trụ được đến đâu?', lead: 'Nghĩ về những buổi chơi gần đây với người cùng trình độ.', hint: 'Nhịp độ trên sân' },
  // No lead: Q16's own API description already says which prizes count.
  tournamentAchievement: { eyebrow: 'Những cột mốc đã qua', heading: 'Thành tích cao nhất của bạn là gì?', lead: '', hint: 'Những cột mốc đã qua' },
};

export const ACCOUNT_STEP = {
  title: 'Tạo tài khoản',
  copy: { eyebrow: 'Bước cuối cùng', heading: 'Tạo tài khoản SmashPro', lead: 'Xem lại câu trả lời, sau đó tạo tài khoản để nhận trình độ ban đầu.', hint: 'Sẵn sàng kết nối' } satisfies StepCopy,
};

export const stepCopy = (step: { title: string; questionIds: string[] }): StepCopy =>
  SURVEY_STEP_COPY[step.questionIds[0] ?? ''] ?? { eyebrow: '', heading: step.title, lead: '', hint: '' };

/** One-line explanation under each skill-scale label, by scale value (shown in the approved prototype v3). */
export const SKILL_SCALE_HINTS: Record<number, string> = {
  0: 'Mình chưa thực hiện được kỹ thuật này',
  1: 'Thực hiện được khi có thời gian chuẩn bị',
  2: 'Đều tay trong các buổi chơi thường ngày',
  3: 'Vẫn chính xác khi đối phương tăng nhịp',
};

export type QuestionVisual = 'timeline' | 'dots' | 'cards' | 'toggle' | 'rally' | 'energy' | 'medals' | 'list';

const QUESTION_VISUALS: Record<string, QuestionVisual> = {
  yearsPlaying: 'timeline',
  frequencyPerWeek: 'dots',
  coaching: 'cards',
  returningAfterBreak: 'toggle',
  rallyConsistency: 'rally',
  stamina: 'energy',
  tournamentAchievement: 'medals',
};

export const questionVisual = (id: string, type: string): QuestionVisual =>
  QUESTION_VISUALS[id] ?? (type === 'BOOLEAN' ? 'toggle' : 'list');

/** Compact label above the timeline node; the full API label stays the accessible name. */
export const TIMELINE_SHORT: Record<string, string> = {
  LESS_THAN_6M: '< 6 th', '6M_TO_1Y': '6 th–1 năm', '1Y_TO_2Y': '1–2 năm', '2Y_TO_4Y': '2–4 năm', '4Y_TO_7Y': '4–7 năm', '7Y_PLUS': '7+ năm',
};

/** Filled bars (of 4) for sessions per week. */
export const FREQUENCY_BARS: Record<string, number> = { LESS_THAN_1: 0, ONE: 1, TWO_TO_THREE: 3, FOUR_PLUS: 4 };

export const COACHING_ICONS: Record<string, LucideIcon | 'shuttlecock'> = {
  NONE: 'shuttlecock', SELF_TAUGHT: UsersRound, COACH_LESS_THAN_6M: GraduationCap, COACH_6M_PLUS: Target, TALENT_TEAM: Trophy,
};

export const BOOLEAN_ICONS: Record<string, LucideIcon> = { false: Check, true: RotateCcw };

/** Shuttle count (of 6) for rally length; the attacking option adds a bolt. */
export const RALLY_COUNTS: Record<string, number> = {
  LESS_THAN_5: 1, '5_TO_9': 2, '10_TO_14': 3, '15_TO_19': 4, '20_PLUS': 5, '20_PLUS_ATTACKING': 6,
};
export const RALLY_ATTACKING = new Set(['20_PLUS_ATTACKING']);

/** Medal tier 0–4 for the achievement podium. */
export const MEDAL_TIERS: Record<string, number> = {
  NONE: 0, INTERNAL: 1, DISTRICT_OR_STUDENT: 2, PROVINCIAL_MEDAL: 3, NATIONAL_OR_PRO: 4,
};

/** Short row labels in the step ⑤ review; unknown ids use the question text. */
export const REVIEW_LABELS: Record<string, string> = {
  yearsPlaying: 'Thời gian chơi', frequencyPerWeek: 'Buổi mỗi tuần', coaching: 'Học bài bản', returningAfterBreak: 'Quay lại sau nghỉ',
  rallyConsistency: 'Giữ cầu', stamina: 'Thể lực', tournamentAchievement: 'Thành tích',
};

export interface CriterionCopy { name: string; short: string; icon: LucideIcon; strength?: string; improve?: string }

/** Criterion display names are frontend copy (Tech Design); wording per PRD/prototype v3. */
export const CRITERIA: Record<SurveyCriterion, CriterionCopy> = {
  K: { name: 'Kỹ thuật', short: 'Kỹ thuật', icon: Target, strength: 'Nền tảng cho những đường cầu tự tin.', improve: 'Luyện đều các kỹ thuật còn yếu để mở rộng lối chơi.' },
  R: { name: 'Độ ổn định giữ cầu', short: 'Ổn định', icon: Activity, strength: 'Giữ nhịp pha cầu, ít tự đánh hỏng.', improve: 'Tập đánh qua lại bền bỉ, hạn chế lỗi tự đánh hỏng.' },
  X: { name: 'Kinh nghiệm', short: 'Kinh nghiệm', icon: CalendarDays, strength: 'Tích lũy qua từng buổi ra sân.' },
  P: { name: 'Thể lực', short: 'Thể lực', icon: Zap, strength: 'Bền bỉ đến điểm cầu cuối cùng.', improve: 'Bền hơn để tận hưởng trọn vẹn mọi trận đấu.' },
  A: { name: 'Thành tích', short: 'Thành tích', icon: Trophy },
  T: { name: 'Đào tạo', short: 'Đào tạo', icon: GraduationCap },
};

/** Radar axis order (PRD: K, R, X, P, A, T). */
export const RADAR_AXES: SurveyCriterion[] = ['K', 'R', 'X', 'P', 'A', 'T'];

/**
 * G2 wording names the playing time behind the cap ("dưới 6 tháng / 1 năm"). The API
 * returns only the cap level, so the duration is mapped from the cap code of version 1;
 * an unknown cap drops the duration.
 */
export const G2_DURATION_BY_CAP: Record<string, string> = { AVERAGE_MINUS: '6 tháng', AVERAGE: '1 năm' };
