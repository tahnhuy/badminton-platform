import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon } from '../../../components/common/Icons';
import { useNotifications } from '../notifications-context';
import { notificationTypeLabel, relativeTime } from '../utils';
import '../notifications.css';

export function NotificationsMenu() {
  const { unreadCount, recent, loading, error, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void refresh();
  };

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div className="notif-menu" ref={rootRef}>
      <button
        type="button"
        className={`notif-bell${open ? ' is-open' : ''}`}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Thông báo"
        onClick={toggle}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && <span className="notif-badge" aria-hidden="true">{badge}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Thông báo" ref={panelRef}>
          <div className="notif-panel-head">
            <strong>Thông báo</strong>
            <Link to="/notifications" onClick={() => setOpen(false)}>Xem tất cả</Link>
          </div>

          {error && <p className="notif-panel-state" role="alert">{error}</p>}
          {!error && loading && recent.length === 0 && <p className="notif-panel-state">Đang tải…</p>}
          {!error && !loading && recent.length === 0 && (
            <p className="notif-panel-state">Chưa có thông báo nào.</p>
          )}

          {recent.length > 0 && (
            <ul className="notif-panel-list">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/notifications/${item.id}`}
                    className={`notif-panel-item${item.isRead ? '' : ' is-unread'}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="notif-panel-meta">
                      <span className="notif-type">{notificationTypeLabel(item.type)}</span>
                      <span>{relativeTime(item.createdAt)}</span>
                    </span>
                    <span className="notif-panel-title">{item.title}</span>
                    <span className="notif-panel-content">{item.content}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link className="notif-panel-footer" to="/notifications" onClick={() => setOpen(false)}>
            Mở trang thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
