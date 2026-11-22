import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Link } from 'react-router-dom';
import { useNotifications } from '../notifications-context';
import { notificationTypeLabel, relativeTime } from '../utils';

export function NotificationsMenu({ basePath = '/notifications' }: { basePath?: string }) {
  const { unreadCount, recent, loading, error, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) void refresh(); }}>
      <PopoverTrigger asChild>
      <Button variant="ghost" size="icon"
        type="button"
        className={`notif-bell relative shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-accent [&.is-open]:text-primary${open ? ' is-open' : ''}`}
        aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-badge absolute -top-0.5 -right-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-destructive-foreground ring-2 ring-background" aria-hidden="true">{badge}</span>}
      </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0" aria-label="Thông báo">
          <div className="notif-panel-head flex items-center justify-between gap-3 border-b border-border px-4 py-3.5 text-sm [&_a]:text-xs [&_a]:font-semibold [&_a]:text-primary">
            <strong>Thông báo</strong>
            <Link to={basePath} onClick={() => setOpen(false)}>Xem tất cả</Link>
          </div>

          {error && <p className="notif-panel-state px-4 py-5 text-center text-sm text-muted-foreground" role="alert">{error}</p>}
          {!error && loading && recent.length === 0 && <p className="notif-panel-state px-4 py-5 text-center text-sm text-muted-foreground">Đang tải…</p>}
          {!error && !loading && recent.length === 0 && (
            <p className="notif-panel-state px-4 py-5 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
          )}

          {recent.length > 0 && (
            <ul className="notif-panel-list m-0 list-none overflow-y-auto p-1.5">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`${basePath}/${item.id}`}
                    className={`notif-panel-item flex flex-col gap-1 rounded-lg border-l-3 border-transparent px-3 py-2.5 text-foreground no-underline hover:bg-muted focus-visible:bg-muted focus-visible:outline-none [&.is-unread]:border-primary [&.is-unread]:bg-primary/5${item.isRead ? '' : ' is-unread'}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="notif-panel-meta flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="notif-type font-bold tracking-wide text-primary uppercase">{notificationTypeLabel(item.type)}</span>
                      <span>{relativeTime(item.createdAt)}</span>
                    </span>
                    <span className="notif-panel-title truncate text-sm font-bold">{item.title}</span>
                    <span className="notif-panel-content line-clamp-2 text-sm leading-5 text-muted-foreground">{item.content}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link className="notif-panel-footer block border-t border-border px-4 py-3 text-center text-sm font-semibold text-primary" to={basePath} onClick={() => setOpen(false)}>
            Mở trang thông báo
          </Link>
        </PopoverContent>
    </Popover>
  );
}
