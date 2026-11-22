import { NextFunction, Request, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { z } from 'zod';
import { AppError } from '../errors/AppError';

export const DASHBOARD_RANGES = ['day', 'month', 'year', 'custom'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('month'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const recentActivitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(20).default(10),
});

function isDashboardRange(value: unknown): value is DashboardRange {
  return typeof value === 'string' && (DASHBOARD_RANGES as readonly string[]).includes(value);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Dashboard range failures use the feature error code from Tech Design §9.4 while every
 * other query validation failure keeps the global `VALIDATION_FAILED` shape.
 */
export function validateDashboardQuery(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const range = req.query.range;
      if (range !== undefined && !isDashboardRange(range)) {
        throw new AppError(
          'ADMIN_DASHBOARD_INVALID_RANGE',
          400,
          'Invalid dashboard range',
          [{ field: 'range', code: 'invalid_range' }],
        );
      }

      if (range === 'custom') {
        const startDate = queryString(req.query.startDate);
        const endDate = queryString(req.query.endDate);
        if (!isIsoDate(startDate) || !isIsoDate(endDate) || endDate <= startDate) {
          throw new AppError(
            'ADMIN_DASHBOARD_INVALID_RANGE',
            400,
            'A custom range requires startDate and endDate, and endDate must be after startDate',
            [{ field: 'startDate', code: 'invalid_custom_range' }],
          );
        }
      }

      const parsed = await schema.parseAsync(req.query);
      Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
      next();
    } catch (err) {
      next(err);
    }
  };
}
