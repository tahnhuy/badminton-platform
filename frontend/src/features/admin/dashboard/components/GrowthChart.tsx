import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import type { DashboardChartPoint } from '../types/dashboard';

function formatShortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

export function GrowthChart({ newUsers, newBookings }: { newUsers: DashboardChartPoint[]; newBookings: DashboardChartPoint[] }) {
  const dates = [...new Set([...newUsers.map(point => point.date), ...newBookings.map(point => point.date)])].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  const data = dates.map(date => ({ date, users: newUsers.find(point => point.date === date)?.count ?? 0, bookings: newBookings.find(point => point.date === date)?.count ?? 0 }));
  const empty = data.every(point => !point.users && !point.bookings);
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" data-testid="growth-chart">
    <header className="mb-3"><h2 className="text-base font-extrabold">Tăng trưởng theo ngày</h2><p className="mt-1 text-sm text-muted-foreground">Người chơi mới và lượt đặt sân trong khoảng thời gian đã chọn.</p></header>
    {empty ? <p className="flex h-70 items-center justify-center text-center text-sm text-muted-foreground">Chưa có dữ liệu tăng trưởng trong khoảng thời gian này.</p> : <div className="h-70 min-w-0" role="img" aria-label="Biểu đồ tăng trưởng người chơi mới và lượt đặt sân theo ngày">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 24, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
          <YAxis allowDecimals={false} domain={[0, 'dataMax']} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
          <Tooltip labelFormatter={value => formatShortDate(String(value))} />
          <Legend />
          <Line dataKey="users" name="Người chơi mới" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} type="linear" isAnimationActive={false} />
          <Line dataKey="bookings" name="Lượt đặt sân" stroke="var(--color-info)" strokeWidth={2.5} dot={{ r: 3 }} type="linear" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>}
  </section>;
}
