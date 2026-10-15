import { useEffect, useState } from 'react';
import { DataTable, type ColumnDef } from '../../../components/common/DataTable';
import { ratingsService } from '../services/ratingsService';
import { ratingErrorMessage } from '../utils/messages';
import type { SkillAdjustmentRow, UserRatingRow } from '../types/ratings';

const PAGE_SIZE = 5;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

interface SectionShellProps {
  title: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  children: React.ReactNode;
}

function SectionShell({ title, loading, error, empty, page, totalPages, onPage, children }: SectionShellProps) {
  return (
    <section aria-label={title} style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 13, margin: '0 0 6px', color: 'var(--text-primary)' }}>{title}</h3>
      {loading && <p style={{ fontSize: 12 }}>Đang tải...</p>}
      {error && <p role="alert" style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</p>}
      {!loading && !error && empty && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Chưa có dữ liệu.</p>}
      {!loading && !error && !empty && (
        <>
          {children}
          {totalPages > 1 && (
            <nav style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <button disabled={page === 1} onClick={() => onPage(page - 1)}>
                Trước
              </button>
              <span>
                {page}/{totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
                Sau
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function RatingListSection({ userId, direction, title }: { userId: number; direction: 'given' | 'received'; title: string }) {
  const [rows, setRows] = useState<UserRatingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const loader = direction === 'given' ? ratingsService.getGivenRatings : ratingsService.getReceivedRatings;
    loader(userId, page, PAGE_SIZE)
      .then((result) => {
        if (active) {
          setRows(result.data);
          setTotal(result.meta.total);
          setTotalPages(result.meta.totalPages);
        }
      })
      .catch((reason) => {
        if (active) setError(ratingErrorMessage(reason, 'Không thể tải đánh giá.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, direction, page]);

  return (
    <SectionShell
      title={`${title} (${total})`}
      loading={loading}
      error={error}
      empty={rows.length === 0}
      page={page}
      totalPages={totalPages}
      onPage={setPage}
    >
      <DataTable data={rows} keyExtractor={row => row.id} columns={[
        { key: 'rater', header: 'Người gửi', render: row => `${row.raterFullName ?? 'Người chơi'} (#${row.raterId})` },
        { key: 'target', header: 'Người nhận', render: row => `${row.ratedPlayerFullName ?? 'Người chơi'} (#${row.ratedPlayerId})` },
        { key: 'match', header: 'Trận', render: row => `#${row.matchId}` },
        { key: 'skill', header: 'Kỹ năng', render: row => `${row.skillRating}/5` },
        { key: 'attitude', header: 'Thái độ', render: row => `${row.attitudeRating}/5` },
        { key: 'comment', header: 'Nhận xét', render: row => row.comment ?? '—' },
        { key: 'time', header: 'Thời gian', render: row => formatDateTime(row.createdAt) },
      ] satisfies ColumnDef<UserRatingRow>[]} />
    </SectionShell>
  );
}

function SkillAdjustmentSection({ userId }: { userId: number }) {
  const [rows, setRows] = useState<SkillAdjustmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    ratingsService
      .getSkillAdjustments(userId, page, PAGE_SIZE)
      .then((result) => {
        if (active) {
          setRows(result.data);
          setTotal(result.meta.total);
          setTotalPages(result.meta.totalPages);
        }
      })
      .catch((reason) => {
        if (active) setError(ratingErrorMessage(reason, 'Không thể tải lịch sử điều chỉnh.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, page]);

  return (
    <SectionShell
      title={`Lịch sử điều chỉnh trình độ (${total})`}
      loading={loading}
      error={error}
      empty={rows.length === 0}
      page={page}
      totalPages={totalPages}
      onPage={setPage}
    >
      <DataTable data={rows} keyExtractor={row => row.id} columns={[
        { key: 'previous', header: 'Trình độ trước', render: row => row.previousSkillLevel.name ?? row.previousSkillLevel.code ?? '—' },
        { key: 'next', header: 'Trình độ mới', render: row => row.newSkillLevel.name ?? row.newSkillLevel.code ?? '—' },
        { key: 'average', header: 'Điểm TB', render: row => row.averageSkillRating.toFixed(2) },
        { key: 'count', header: 'Số đánh giá', render: row => row.ratingsConsidered },
        { key: 'source', header: 'Nguồn', render: row => row.source },
        { key: 'time', header: 'Thời gian', render: row => formatDateTime(row.createdAt) },
      ] satisfies ColumnDef<SkillAdjustmentRow>[]} />
    </SectionShell>
  );
}

export function UserRatingsPanels({ userId }: { userId: number }) {
  return (
    <div>
      <RatingListSection key={`${userId}:given`} userId={userId} direction="given" title="Đánh giá đã cho" />
      <RatingListSection key={`${userId}:received`} userId={userId} direction="received" title="Đánh giá đã nhận" />
      <SkillAdjustmentSection key={userId} userId={userId} />
    </div>
  );
}
