import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { StateBlock } from '../../booking/components/StateBlocks';
import { useNotifications } from '../notifications-context';
import { notificationsApi } from '../services/notifications-api';
import type { NotificationDetail } from '../types';
import { notificationTypeLabel, relativeTime } from '../utils';
import '../notifications.css';

export function NotificationDetailPage() {
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
    <div className="notif-detail">
      <Link to="/notifications" className="notif-back">← Danh sách thông báo</Link>

      {status === 'loading' && <StateBlock title="Đang tải thông báo…" description="Vui lòng chờ trong giây lát." />}
      {status === 'error' && error && (
        <StateBlock title="Không tải được thông báo" description={error} actionLabel="Thử lại" onAction={() => void load()} />
      )}

      {status === 'success' && detail && (
        <article className="notif-detail-card">
          <div className="notif-card-meta">
            <span className="notif-type">{notificationTypeLabel(detail.type)}</span>
            <span>{relativeTime(detail.createdAt)} · {detail.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <h1>{detail.title}</h1>
          <p className="notif-detail-body">{detail.content}</p>
          <div className="notif-detail-actions">
            {detail.resourcePath ? (
              <Link className="notif-cta" to={detail.resourcePath}>Xem chi tiết</Link>
            ) : detail.resourceType ? (
              <span className="notif-unavailable">Nội dung liên quan hiện không còn khả dụng.</span>
            ) : null}
          </div>
        </article>
      )}
    </div>
  );
}
