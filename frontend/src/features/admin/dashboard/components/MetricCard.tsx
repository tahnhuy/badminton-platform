import React from 'react';

interface MetricStat {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  stats?: MetricStat[];
  footnote?: string;
  isLoading?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  tone = 'default',
  stats = [],
  footnote,
  isLoading = false,
}) => {
  return (
    <article className="dashboard-metric-card flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4.5 shadow-sm data-[tone=warning]:border-caution/30 data-[tone=danger]:border-destructive/30" data-testid="kpi-card" data-tone={tone}>
      <header className="dashboard-metric-card-header flex items-start justify-between gap-3">
        <span className="dashboard-metric-label text-xs font-bold tracking-wide text-muted-foreground uppercase">{label}</span>
        <span className="dashboard-metric-icon inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">{icon}</span>
      </header>

      {isLoading ? (
        <div className="dashboard-metric-skeleton flex flex-col gap-2.5 py-1.5">
          <div className="h-10 w-3/5 animate-pulse rounded-lg bg-muted" />
          <div className="h-3.5 w-4/5 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : (
        <>
          <strong className="dashboard-metric-value text-3xl leading-tight font-extrabold tracking-tight wrap-anywhere">{value}</strong>
          {stats.length > 0 && (
            <dl className="dashboard-metric-stats m-0 flex flex-wrap gap-x-4.5 gap-y-2.5 [&_div]:flex [&_div]:min-w-22.5 [&_div]:flex-col [&_div]:gap-0.5 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:text-sm [&_dd]:font-bold [&_dd[data-tone=success]]:text-primary [&_dd[data-tone=warning]]:text-caution [&_dd[data-tone=danger]]:text-destructive">
              {stats.map(stat => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd data-tone={stat.tone ?? 'default'}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {footnote && <p className="dashboard-metric-footnote text-xs leading-5 text-muted-foreground">{footnote}</p>}
        </>
      )}
    </article>
  );
};
