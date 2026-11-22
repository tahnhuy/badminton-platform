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
    <section className="dashboard-card dashboard-mini-chart-card" data-testid={testId}>
      <header className="dashboard-card-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="dashboard-mini-chart-body">
        {isEmpty ? <div className="dashboard-mini-chart-empty">{emptyText}</div> : children}
      </div>

      {footnote && !isEmpty && <p className="dashboard-mini-chart-footnote">{footnote}</p>}
    </section>
  );
};
