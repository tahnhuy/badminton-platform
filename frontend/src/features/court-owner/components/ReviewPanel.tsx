import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Pager, ResourceState, Status } from './OwnerUi';

import type { Review, Meta } from '../types/owner';
export function ReviewPanel({ path }: { path: string }) {
  const [page, setPage] = useState(1);
  const resource = useOwnerResource<{ data: Review[]; meta: Meta }>(`${path}?page=${page}&limit=10`, true);
  return <ContentPanel title="Lịch sử duyệt" icon={ClipboardCheck}><ResourceState {...resource} retry={resource.reload}>
    {resource.data?.data.length === 0 && <p>Chưa có hồ sơ duyệt.</p>}
    {resource.data?.data.map(review => <article key={review.id} className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm [&_p]:leading-6"><strong>{review.kind === 'ADDRESS_CHANGE' ? 'Đề xuất địa chỉ' : 'Hồ sơ cơ sở/sân'}</strong> <Status value={review.status} />
      <p>Gửi lúc: {new Date(review.submittedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>
      {review.rejectionReason && <p>Lý do từ chối: {review.rejectionReason}</p>}
      {!!review.submittedValues.address && <p>Địa chỉ gửi duyệt: {String(review.submittedValues.address)}</p>}
    </article>)}
    {resource.data && <Pager page={page} pages={resource.data.meta.totalPages} setPage={setPage} />}
  </ResourceState></ContentPanel>;
}
