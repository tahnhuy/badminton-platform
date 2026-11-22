/** Activity titles always use Vietnam time, including sessions ending the next day. */
export function activityLabel(hostName?: string | null, schedule: {
  startAt?: string | null; durationMinutes?: number | null;
  preferredDate?: string | null; preferredStartTime?: string | null; preferredEndTime?: string | null;
} = {}) {
  const host = hostName?.trim() || 'Chủ kèo';
  const date = (value: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(value);
  const time = (value: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value);
  const start = schedule.startAt ? new Date(schedule.startAt) : null;
  if (start && Number.isFinite(start.getTime())) {
    const end = schedule.durationMinutes != null ? new Date(start.getTime() + schedule.durationMinutes * 60000) : null;
    return `${host} – ${date(start)}, ${time(start)}–${end ? (date(start) === date(end) ? time(end) : `${date(end)}, ${time(end)}`) : 'Chưa rõ giờ kết thúc'}`;
  }
  const day = schedule.preferredDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return `${host} – ${day ? `${day[3]}/${day[2]}/${day[1]}` : 'Chưa có ngày'}, ${schedule.preferredStartTime?.slice(0, 5) || 'Chưa rõ giờ bắt đầu'}–${schedule.preferredEndTime?.slice(0, 5) || 'Chưa rõ giờ kết thúc'}`;
}
