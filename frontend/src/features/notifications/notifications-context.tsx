import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { notificationsApi } from './services/notifications-api';
import type { NotificationItem } from './types';

interface NotificationsContextValue {
  unreadCount: number;
  recent: NotificationItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markLocallyRead: (id: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const POLL_INTERVAL_MS = 30_000;

// C1 baseline: 30-second polling, paused while the tab is hidden, refreshed on focus.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [list, unread] = await Promise.allSettled([
        notificationsApi.list({ page: 1, limit: 5 }),
        notificationsApi.list({ page: 1, limit: 1, isRead: false }),
      ]);
      if (list.status === 'fulfilled') {
        setRecent(list.value.data);
        setError(null);
      }
      if (unread.status === 'fulfilled') {
        setUnreadCount(unread.value.meta.total);
      }
      if (list.status === 'rejected' && unread.status === 'rejected') {
        setError('Không thể tải thông báo.');
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  const markLocallyRead = useCallback((id: number) => {
    setRecent((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));
    window.setTimeout(() => void refresh(), 0);
  }, [refresh]);

  const value = useMemo(
    () => ({ unreadCount, recent, loading, error, refresh, markLocallyRead }),
    [unreadCount, recent, loading, error, refresh, markLocallyRead],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications requires NotificationsProvider');
  return context;
}
