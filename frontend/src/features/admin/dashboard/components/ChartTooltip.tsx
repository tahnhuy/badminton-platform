import { chartColor, chartPosition } from './chart-style';
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
      className="dashboard-chart-tooltip pointer-events-none absolute z-20 min-w-32.5 max-w-60 -translate-x-1/2 -translate-y-[115%] rounded-lg bg-foreground/95 px-2.5 py-2 text-xs leading-5 text-background shadow-lg [&>strong]:mb-1.5 [&>strong]:block [&>strong]:text-sm [&>strong]:font-extrabold [&>strong]:whitespace-nowrap"
      role="tooltip"
      data-testid="chart-tooltip"
      style={chartPosition(tooltip.x, tooltip.y)}
    >
      <strong>{tooltip.title}</strong>
      <div className="dashboard-chart-tooltip-rows flex flex-col gap-1">
        {tooltip.rows.map(row => (
          <div className="dashboard-chart-tooltip-row flex items-center justify-between gap-3.5 text-background/80 [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5 [&_i]:inline-block [&_i]:size-2 [&_i]:rounded-full [&_b]:font-bold [&_b]:text-background [&_b]:whitespace-nowrap" key={row.label}>
            <span>
              {row.color && <i style={chartColor(row.color)} />}
              {row.label}
            </span>
            <b>{row.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
};
