import { AuditScrollArea } from '@/components/common/audit-scroll-area';
import { useState } from 'react';
import { History } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Pager, ResourceState } from './OwnerUi';
import type { Meta } from '../types/owner';
import { labels } from '../types/labels';

interface ProfileChange {
  id: number;
  changeType: 'PROFILE' | 'CONDITION';
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
  actorEmail: string | null;
}

const profileFields = [
  { key: 'surfaceType', label: 'Vật liệu mặt sân' },
  { key: 'surfaceBrand', label: 'Thương hiệu' },
  { key: 'surfaceModel', label: 'Dòng sản phẩm' },
  { key: 'surfaceThicknessMm', label: 'Độ dày' },
];
const conditionFields = [
  { key: 'condition', label: 'Tình trạng' },
  { key: 'conditionNote', label: 'Ghi chú tình trạng' },
];

function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Chưa khai báo';
  if (typeof value !== 'string' && typeof value !== 'number') return 'Không xác định';
  if (key === 'surfaceType' || key === 'condition') return labels[String(value)] ?? String(value);
  if (key === 'surfaceThicknessMm') {
    const thickness = Number(value);
    return Number.isFinite(thickness) ? `${thickness.toLocaleString('vi-VN')} mm` : 'Không xác định';
  }
  return String(value);
}

export function CourtProfileHistory({ courtId }: { courtId: number }) {
  const [page, setPage] = useState(1);
  const resource = useOwnerResource<{ data: ProfileChange[]; meta: Meta }>(`/courts/${courtId}/profile-changes?page=${page}&limit=10`, true);
  return <ContentPanel title="Lịch sử thông số sân" icon={History}><ResourceState {...resource} retry={resource.reload}>
    {resource.data?.data.length === 0 && <p>Chưa có thay đổi thông số hoặc tình trạng.</p>}
    <AuditScrollArea label="Lịch sử thông số sân">{resource.data?.data.map(change => <article key={change.id} className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <strong>{change.changeType === 'PROFILE' ? 'Thông số mặt sân' : 'Tình trạng'}</strong>
      <p>Thời điểm: {new Date(change.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      <p>Người thực hiện: {change.actorEmail ?? 'Không xác định'}</p>
      {change.reason && <p>Lý do: {change.reason}</p>}
      <p className="mt-2 font-medium">Thông tin sau cập nhật</p>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {(change.changeType === 'PROFILE' ? profileFields : conditionFields).map(({ key, label }) => <div key={key} className={key === 'conditionNote' ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{displayValue(key, change.afterValues[key])}</dd>
        </div>)}
      </dl>
    </article>)}</AuditScrollArea>
    {resource.data && <Pager page={page} pages={resource.data.meta.totalPages} setPage={setPage} />}
  </ResourceState></ContentPanel>;
}
