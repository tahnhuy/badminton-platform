import { NotFoundError } from '../../errors/AppError';
import { notificationRepository, NotificationRecord } from '../../repositories/notifications/NotificationRepository';
import { notificationResourceResolver, NotificationViewer } from './NotificationResourceResolver';

// NTF-03 read APIs (Notifications Tech Design). The recipient always comes from the
// authenticated session; non-owned and missing ids share 404 NOTIFICATION_NOT_FOUND.

export interface NotificationView {
  id: number;
  type: string;
  title: string;
  content: string;
  resourceType: string | null;
  resourceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  /** Resolved only for GET /notifications/:id (NTF-05); null when unavailable. */
  resourcePath?: string | null;
}

function toView(row: NotificationRecord): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    isRead: row.isRead,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 };
}

function notFound(): NotFoundError {
  return new NotFoundError('Notification not found', 'NOTIFICATION_NOT_FOUND');
}

export class NotificationQueryService {
  async list(recipientId: number, filter: { isRead?: boolean; page: number; limit: number }) {
    const { rows, total } = await notificationRepository.listForRecipient(recipientId, filter);
    return { data: rows.map(toView), meta: pageMeta(filter.page, filter.limit, total) };
  }

  async listUnread(recipientId: number, filter: { page: number; limit: number }) {
    const { rows, total } = await notificationRepository.listForRecipient(recipientId, { ...filter, isRead: false });
    return {
      data: { unreadCount: total, items: rows.map(toView) },
      meta: pageMeta(filter.page, filter.limit, total),
    };
  }

  async get(viewer: NotificationViewer, id: number) {
    const row = await notificationRepository.findForRecipient(viewer.id, id);
    if (!row) throw notFound();
    const resourcePath = await notificationResourceResolver.resolve(viewer, row.resourceType, row.resourceId);
    return { data: { ...toView(row), resourcePath } };
  }

  async markRead(recipientId: number, id: number) {
    const row = await notificationRepository.markReadForRecipient(recipientId, id);
    if (!row) throw notFound();
    return { data: toView(row) };
  }
}

export const notificationQueryService = new NotificationQueryService();
