import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { StateBlock } from '../../booking/components/StateBlocks';
import { notificationsApi } from '../services/notifications-api';
import type { NotificationItem, PageMeta } from '../types';
import { notificationTypeLabel, relativeTime } from '../utils';
import '../notifications.css';

const PAGE_SIZE = 10;

export function NotificationsPage() {
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
    <div className="notif-page">
      <header className="notif-page-head">
        <h1>Thông báo</h1>
        <p>Cập nhật mới nhất về kèo đấu, đặt sân và cộng đồng.</p>
      </header>

      <div className="notif-tabs" role="tablist" aria-label="Lọc thông báo">
        {([['all', 'Tất cả'], ['unread', 'Chưa đọc']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`notif-tab${filter === key ? ' is-active' : ''}`}
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
        <div className="notif-list">
          {items.map((item) => (
            <Link
              key={item.id}
              to={`/notifications/${item.id}`}
              className={`notif-card${item.isRead ? '' : ' is-unread'}`}
            >
              <span className={`notif-card-dot${item.isRead ? ' is-read' : ''}`} aria-hidden="true" />
              <span className="notif-card-body">
                <span className="notif-card-meta">
                  <span className="notif-type">{notificationTypeLabel(item.type)}</span>
                  <span>{relativeTime(item.createdAt)}</span>
                </span>
                <span className="notif-card-title">{item.title}</span>
                <span className="notif-card-content">{item.content}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {status === 'success' && meta && meta.totalPages > 1 && (
        <nav className="notif-pager" aria-label="Phân trang thông báo">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Trước
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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
