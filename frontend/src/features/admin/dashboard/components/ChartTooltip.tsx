import React, { useCallback, useRef, useState } from 'react';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export interface TooltipPayload {
  title: string;
  rows: TooltipRow[];
}

interface TooltipState extends TooltipPayload {
  x: number;
  y: number;
}

export function useChartTooltip() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback((event: React.MouseEvent, payload: TooltipPayload) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = Math.min(Math.max(12, event.clientX - rect.left), Math.max(12, rect.width - 12));
    const y = Math.max(8, event.clientY - rect.top);
    setTooltip({ ...payload, x, y });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  return { hostRef, tooltip, showTooltip, hideTooltip };
}

interface ChartTooltipProps {
  tooltip: TooltipState | null;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({ tooltip }) => {
  if (!tooltip) return null;

  return (
    <div
      className="dashboard-chart-tooltip"
      role="tooltip"
      data-testid="chart-tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <strong>{tooltip.title}</strong>
      <div className="dashboard-chart-tooltip-rows">
        {tooltip.rows.map(row => (
          <div className="dashboard-chart-tooltip-row" key={row.label}>
            <span>
              {row.color && <i style={{ backgroundColor: row.color }} />}
              {row.label}
            </span>
            <b>{row.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
};
