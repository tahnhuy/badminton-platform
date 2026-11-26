import { useCallback, useEffect, useRef, useState, type SetStateAction, type RefObject, type Dispatch } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { StateBlock } from '../../booking/components/StateBlocks';
import { useNotifications } from '../notifications-context';
import { notificationsApi } from '../services/notifications-api';
import type { NotificationDetail } from '../types';
import { notificationTypeLabel, relativeTime } from '../utils';

export function NotificationDetailPage({ basePath = '/notifications' }: { basePath?: string }) {
  const { id } = useParams();
  const notificationId = Number(id);
  const { markLocallyRead } = useNotifications();
  const [detail, setDetail] = useState<NotificationDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const markedRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      setStatus('error');
      setError('Thông báo không hợp lệ.');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const data = await notificationsApi.detail(notificationId);
      if (requestRef.current !== requestId) return;
      setDetail(data);
      setStatus('success');
      if (!data.isRead && markedRef.current !== data.id) {
        // Opening a notification marks it read; the badge updates without a reload.
        // A mark-read failure never hides the content that was already loaded.
        await markNotificationRead(markedRef, data, requestRef, requestId, setDetail, markLocallyRead);
      }
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải thông báo.');
    }
  }, [notificationId, markLocallyRead]);

  useEffect(() => {
    void load();
    return () => {
      // Ignore responses from a previous notification id or an unmounted page.
      requestRef.current += 1;
    };
  }, [load]);

  return (
    <div className="notif-detail mx-auto flex w-full max-w-3xl flex-col gap-4.5 px-4 pt-5 pb-12 sm:px-6 sm:pt-8 sm:pb-16">
      <Link to={basePath} className="notif-back text-sm font-semibold text-primary">← Danh sách thông báo</Link>

      {status === 'loading' && <StateBlock title="Đang tải thông báo…" description="Vui lòng chờ trong giây lát." />}
      {status === 'error' && error && (
        <StateBlock title="Không tải được thông báo" description={error} actionLabel="Thử lại" onAction={() => void load()} />
      )}

      {status === 'success' && detail && (
        <article className="notif-detail-card flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-6 [&_h1]:text-2xl [&_h1]:font-extrabold">
          <div className="notif-card-meta flex items-center justify-between gap-2.5 text-xs text-muted-foreground">
            <span className="notif-type font-bold tracking-wide text-primary uppercase">{notificationTypeLabel(detail.type)}</span>
            <span>{relativeTime(detail.createdAt)} · {detail.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <h1>{detail.title}</h1>
          <p className="notif-detail-body text-base leading-6 whitespace-pre-wrap">{detail.content}</p>
          <div className="notif-detail-actions flex flex-wrap items-center gap-2.5">
            {detail.resourcePath ? (
              <Link className="notif-cta inline-flex items-center justify-center rounded-lg bg-primary px-4.5 py-2.5 text-sm font-bold text-primary-foreground" to={detail.resourcePath}>Xem chi tiết</Link>
            ) : detail.resourceType ? (
              <span className="notif-unavailable text-sm text-muted-foreground">Nội dung liên quan hiện không còn khả dụng.</span>
            ) : null}
          </div>
        </article>
      )}
    </div>
  );
}

async function markNotificationRead(
  markedRef: RefObject<number | null>,
  data: NotificationDetail,
  requestRef: RefObject<number>,
  requestId: number,
  setDetail: Dispatch<SetStateAction<NotificationDetail | null>>,
  markLocallyRead: (id: number) => void,


) {
  markedRef.current = data.id;
  try {
    const updated = await notificationsApi.markRead(data.id);
    if (requestRef.current === requestId) {
      // Guard against a slower response overwriting a newer notification open.
      setDetail((current) => (
        current && current.id === data.id ? { ...current, isRead: updated.isRead, readAt: updated.readAt } : current
      ));
    }
    markLocallyRead(data.id);
  } catch {
    if (markedRef.current === data.id) markedRef.current = null;
  }
}
