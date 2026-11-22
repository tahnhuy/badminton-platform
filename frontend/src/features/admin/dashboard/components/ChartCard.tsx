import React from 'react';

interface ChartCardProps {
  title: string;
  description: string;
  testId?: string;
  isEmpty?: boolean;
  emptyText?: string;
  footnote?: string;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  description,
  testId,
  isEmpty = false,
  emptyText = 'Chưa có dữ liệu trong khoảng thời gian này.',
  footnote,
  children,
}) => {
  return (
    <section className="dashboard-card min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm dashboard-mini-chart-card flex min-w-0 flex-col" data-testid={testId}>
      <header className="dashboard-card-header mb-3 flex flex-col items-start justify-between gap-4 md:flex-row [&_h2]:text-base [&_h2]:font-extrabold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="dashboard-mini-chart-body flex min-h-42.5 flex-col justify-center gap-2.5">
        {isEmpty ? <div className="dashboard-mini-chart-empty flex min-h-37.5 items-center justify-center rounded-lg bg-muted p-4 text-center text-sm font-semibold text-muted-foreground">{emptyText}</div> : children}
      </div>

      {footnote && !isEmpty && <p className="dashboard-mini-chart-footnote mt-2.5 text-xs leading-5 text-muted-foreground">{footnote}</p>}
    </section>
  );
};
