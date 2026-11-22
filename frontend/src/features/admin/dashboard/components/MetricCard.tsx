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
    <article className="dashboard-metric-card" data-testid="kpi-card" data-tone={tone}>
      <header className="dashboard-metric-card-header">
        <span className="dashboard-metric-label">{label}</span>
        <span className="dashboard-metric-icon" aria-hidden="true">{icon}</span>
      </header>

      {isLoading ? (
        <div className="dashboard-metric-skeleton">
          <div className="skeleton" style={{ height: 40, width: '55%' }} />
          <div className="skeleton" style={{ height: 14, width: '80%' }} />
        </div>
      ) : (
        <>
          <strong className="dashboard-metric-value">{value}</strong>
          {stats.length > 0 && (
            <dl className="dashboard-metric-stats">
              {stats.map(stat => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd data-tone={stat.tone ?? 'default'}>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {footnote && <p className="dashboard-metric-footnote">{footnote}</p>}
        </>
      )}
    </article>
  );
};
