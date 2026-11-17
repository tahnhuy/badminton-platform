export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  content: string;
  resourceType: string | null;
  resourceId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDetail extends NotificationItem {
  resourcePath: string | null;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationList {
  data: NotificationItem[];
  meta: PageMeta;
}

export interface UnreadNotifications {
  data: { unreadCount: number; items: NotificationItem[] };
  meta: PageMeta;
}
