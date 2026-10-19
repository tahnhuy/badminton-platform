import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import { DataTable, type ColumnDef } from '../../../components/common/DataTable';
import { ratingsService } from '../services/ratingsService';
import { StarRatingDisplay } from '../components/StarRating';
import { ratingErrorMessage } from '../utils/messages';
import type { UserRatingRow } from '../types/ratings';

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export function RatingsGivenPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRatingRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await ratingsService.getGivenRatings(user.id, page, 20);
      if (version !== requestVersion.current) return;
      setRows(result.data);
      setMeta(result.meta);
    } catch (reason) {
      if (version === requestVersion.current) setError(ratingErrorMessage(reason, 'Không thể tải lịch sử đánh giá.'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  const columns: ColumnDef<UserRatingRow>[] = [
    {
      key: 'target',
      header: 'Người được đánh giá',
      render: (row) => row.ratedPlayerFullName ?? `Người chơi #${row.ratedPlayerId}`,
    },
    {
      key: 'match',
      header: 'Trận',
      render: (row) => <span>Trận #{row.matchId}</span>,
    },
    {
      key: 'skill',
      header: 'Kỹ năng',
      render: (row) => <StarRatingDisplay value={row.skillRating} label="Kỹ năng" />,
    },
    {
      key: 'attitude',
      header: 'Thái độ',
      render: (row) => <StarRatingDisplay value={row.attitudeRating} label="Thái độ" />,
    },
    {
      key: 'comment',
      header: 'Nhận xét',
      render: (row) => row.comment ?? '—',
    },
    {
      key: 'createdAt',
      header: 'Thời gian',
      render: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <section className="rating-page">
      <Link to="/">← Trang chủ</Link>
      <header className="rating-page-heading"><span className="rating-badge">Lịch sử của bạn</span><h1>Đánh giá đã gửi</h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Danh sách đánh giá bạn đã gửi. Đánh giá đã gửi không thể chỉnh sửa hoặc xóa.
      </p></header>

      {loading && <p>Đang tải...</p>}
      {error && (
        <div role="alert" style={{ color: 'var(--color-danger)' }}>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <DataTable
            data={rows}
            columns={columns}
            keyExtractor={(row) => row.id}
            emptyState={<p>Bạn chưa gửi đánh giá nào.</p>}
          />
          {meta.totalPages > 1 && (
            <nav aria-label="Trang đánh giá đã gửi" className="rating-pagination">
              <button className="rating-button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Trước
              </button>
              <span> {page}/{meta.totalPages} </span>
              <button className="rating-button" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>
                Sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
