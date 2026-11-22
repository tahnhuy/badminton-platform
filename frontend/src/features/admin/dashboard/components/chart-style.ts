import type { CSSProperties } from 'react';

export function chartWidth(percent: number): CSSProperties { return { width: `${percent}%` }; }
export function chartColor(color: string): CSSProperties { return { backgroundColor: color }; }
export function chartPosition(x: number, y: number): CSSProperties { return { left: x, top: y }; }
export function heatmapColor(intensity: number): CSSProperties {
  return intensity === 0 ? {} : { backgroundColor: `color-mix(in srgb, var(--primary) ${intensity * 100}%, transparent)` };
}
