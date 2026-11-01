import { z } from 'zod';

// Notifications Tech Design (NTF-03). Pagination follows conventions.md (page/limit + meta).
const page = z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);

export const listNotificationsQuerySchema = z.object({
  page,
  limit,
  isRead: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
});

export const unreadNotificationsQuerySchema = z.object({ page, limit });

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
