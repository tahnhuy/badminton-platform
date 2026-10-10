import type { SkillLevel } from '../types/matchmaking';


const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface RequestFormValues {
  matchType: 'SINGLES' | 'DOUBLES';
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  minSkillLevelId: number | '';
  maxSkillLevelId: number | '';
  area: string;
}

export type RequestFormErrors = Partial<Record<keyof RequestFormValues, string>>;

function isRealCalendarDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function todayInAppTimezone(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function validateRequestForm(
  values: RequestFormValues,
  skillLevels: SkillLevel[],
  now: Date = new Date()
): RequestFormErrors {
  const errors: RequestFormErrors = {};

  // Date
  if (!values.preferredDate) {
    errors.preferredDate = 'Vui lòng chọn ngày chơi.';
  } else if (!isRealCalendarDate(values.preferredDate)) {
    errors.preferredDate = 'Ngày không hợp lệ, phải theo định dạng YYYY-MM-DD.';
  } else if (values.preferredDate < todayInAppTimezone(now)) {
    errors.preferredDate = 'Ngày chơi phải từ hôm nay trở đi.';
  }

  // Start time
  if (!values.preferredStartTime) {
    errors.preferredStartTime = 'Vui lòng chọn giờ bắt đầu.';
  } else if (!TIME_REGEX.test(values.preferredStartTime)) {
    errors.preferredStartTime = 'Giờ không hợp lệ, phải theo định dạng HH:mm (00:00–23:59).';
  }

  // End time
  if (!values.preferredEndTime) {
    errors.preferredEndTime = 'Vui lòng chọn giờ kết thúc.';
  } else if (!TIME_REGEX.test(values.preferredEndTime)) {
    errors.preferredEndTime = 'Giờ không hợp lệ, phải theo định dạng HH:mm (00:00–23:59).';
  } else if (
    TIME_REGEX.test(values.preferredStartTime) &&
    timeToMinutes(values.preferredEndTime) <= timeToMinutes(values.preferredStartTime)
  ) {
    errors.preferredEndTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
  }

  // Duration and configured minimum lead time are validated by the server.
  // Do not reject otherwise valid input using stale client-side defaults.

  // Skill range
  if (values.minSkillLevelId === '') {
    errors.minSkillLevelId = 'Vui lòng chọn trình độ tối thiểu.';
  }
  if (values.maxSkillLevelId === '') {
    errors.maxSkillLevelId = 'Vui lòng chọn trình độ tối đa.';
  }
  if (values.minSkillLevelId !== '' && values.maxSkillLevelId !== '') {
    const min = skillLevels.find((level) => level.id === values.minSkillLevelId);
    const max = skillLevels.find((level) => level.id === values.maxSkillLevelId);
    if (min && max && min.rank > max.rank) {
      errors.maxSkillLevelId = 'Trình độ tối đa phải cao hơn hoặc bằng trình độ tối thiểu.';
    }
  }

  // Area
  if (!values.area.trim()) {
    errors.area = 'Vui lòng nhập khu vực (tỉnh/quận).';
  } else if (values.area.trim().length > 200) {
    errors.area = 'Khu vực quá dài (tối đa 200 ký tự).';
  }

  return errors;
}

export function hasErrors(errors: RequestFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}
