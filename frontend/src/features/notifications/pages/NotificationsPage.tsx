import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { StateBlock } from '../../booking/components/StateBlocks';
import { notificationsApi } from '../services/notifications-api';
import type { NotificationItem, PageMeta } from '../types';
import { notificationTypeLabel, relativeTime } from '../utils';

const PAGE_SIZE = 10;

export function NotificationsPage({ basePath = '/notifications' }: { basePath?: string }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async (nextPage: number, nextFilter: 'all' | 'unread') => {
    const requestId = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const response = await notificationsApi.list({
        page: nextPage,
        limit: PAGE_SIZE,
        ...(nextFilter === 'unread' ? { isRead: false } : {}),
      });
      // A fast page/filter switch can resolve out of order; keep the newest request only.
      if (requestRef.current !== requestId) return;
      setItems(response.data);
      setMeta(response.meta);
      setStatus('success');
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải thông báo.');
    }
  }, []);

  useEffect(() => {
    void load(page, filter);
    return () => {
      // Invalidate in-flight requests on unmount so they cannot set state afterwards.
      requestRef.current += 1;
    };
  }, [page, filter, load]);

  const changeFilter = (next: 'all' | 'unread') => {
    setFilter(next);
    setPage(1);
  };

  return (
    <div className="notif-page mx-auto flex w-full max-w-4xl flex-col gap-4.5 px-4 pt-5 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
      <header className="notif-page-head [&_h1]:text-2xl [&_h1]:font-extrabold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
        <h1>Thông báo</h1>
        <p>Cập nhật mới nhất về kèo đấu, đặt sân và cộng đồng.</p>
      </header>

      <div className="notif-tabs flex flex-wrap gap-2" role="tablist" aria-label="Lọc thông báo">
        {([['all', 'Tất cả'], ['unread', 'Chưa đọc']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`notif-tab rounded-full bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground [&.is-active]:bg-primary [&.is-active]:text-primary-foreground${filter === key ? ' is-active' : ''}`}
            onClick={() => changeFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {status === 'loading' && <StateBlock title="Đang tải thông báo…" description="Vui lòng chờ trong giây lát." />}
      {status === 'error' && error && (
        <StateBlock
          title="Không tải được thông báo"
          description={error}
          actionLabel="Thử lại"
          onAction={() => void load(page, filter)}
        />
      )}
      {status === 'success' && items.length === 0 && (
        <StateBlock
          title={filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
          description={filter === 'unread' ? 'Bạn đã đọc hết thông báo hiện có.' : 'Hoạt động mới của bạn sẽ xuất hiện tại đây.'}
        />
      )}
      {status === 'success' && items.length > 0 && (
        <div className="notif-list flex flex-col gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`${basePath}/${item.id}`}
              className={`notif-card flex gap-3.5 rounded-2xl border border-border bg-card p-4 text-foreground no-underline transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring [&.is-unread]:border-l-4 [&.is-unread]:border-l-primary [&.is-unread]:bg-primary/5${item.isRead ? '' : ' is-unread'}`}
            >
              <span className={`notif-card-dot mt-1.5 size-2.5 shrink-0 rounded-full bg-primary [&.is-read]:border [&.is-read]:border-border [&.is-read]:bg-transparent${item.isRead ? ' is-read' : ''}`} aria-hidden="true" />
              <span className="notif-card-body flex min-w-0 flex-1 flex-col gap-1">
                <span className="notif-card-meta flex items-center justify-between gap-2.5 text-xs text-muted-foreground">
                  <span className="notif-type font-bold tracking-wide text-primary uppercase">{notificationTypeLabel(item.type)}</span>
                  <span>{relativeTime(item.createdAt)}</span>
                </span>
                <span className="notif-card-title text-base font-bold">{item.title}</span>
                <span className="notif-card-content text-sm leading-5 text-muted-foreground">{item.content}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {status === 'success' && meta && meta.totalPages > 1 && (
        <nav className="notif-pager flex items-center justify-center gap-3 [&_button]:rounded-lg [&_button]:border [&_button]:border-border [&_button]:bg-card [&_button]:px-3.5 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button:disabled]:opacity-50" aria-label="Phân trang thông báo">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Trước
          </button>
          <span className="text-sm text-muted-foreground">
            Trang {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((value) => Math.min(meta.totalPages, value + 1))}
          >
            Sau
          </button>
        </nav>
      )}
    </div>
  );
}
