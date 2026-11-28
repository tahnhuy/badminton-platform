import { useState } from 'react';
import { PhoneCall, UserPlus, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { isOpenOwnerRequest, OWNER_REQUEST_STATUS_LABELS, type OwnerRequest } from '@/features/partnership/partnership-api';
import { formatDateTime, STATUS_BADGE } from './partnership-format';

interface DetailProps {
  request: OwnerRequest;
  busy: boolean;
  onClose: () => void;
  onSaveNote: (note: string) => void;
  onContact: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export function StatusBadge({ status }: { status: OwnerRequest['status'] }) {
  const badge = STATUS_BADGE[status];
  return <Badge variant={badge.variant} className={badge.className}>{OWNER_REQUEST_STATUS_LABELS[status]}</Badge>;
}

/** Request detail beside the table (PRD §6.2 step 3). Final requests are read-only. Key it by id + updatedAt. */
export function PartnershipRequestDetail({ request, busy, onClose, onSaveNote, onContact, onApprove, onReject }: DetailProps) {
  const [note, setNote] = useState(request.adminNote ?? '');
  const open = isOpenOwnerRequest(request.status);
  const noteChanged = note.trim() !== (request.adminNote ?? '').trim();

  return <ContentPanel className="lg:sticky lg:top-24">
    <div data-slot="owner-request-detail" className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight">{request.facilityName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Gửi lúc {formatDateTime(request.createdAt)}</p>
      </div>
      <div className="flex items-center gap-2"><StatusBadge status={request.status} />
        <Button type="button" variant="ghost" size="icon" aria-label="Đóng chi tiết" onClick={onClose}><X aria-hidden="true" /></Button>
      </div>
    </div>

    <div>
      <DetailRow label="Người liên hệ" value={request.contactName} />
      <DetailRow label="Email" value={request.email} />
      <DetailRow label="Số điện thoại" value={<a className="text-primary underline" href={`tel:${request.phone}`}>{request.phone}</a>} />
      <DetailRow label="Địa chỉ" value={`${request.addressLine}, ${request.district}, ${request.city}`} />
      <DetailRow label="Số sân dự kiến" value={request.expectedCourts} />
      <DetailRow label="Ghi chú của người gửi" value={<span className="whitespace-pre-wrap">{request.note || '—'}</span>} />
      <DetailRow label="Địa chỉ IP" value={request.submittedIp ?? '—'} />
      {request.processedAt && <DetailRow label="Xử lý bởi" value={`${request.processedBy?.email ?? '—'} · ${formatDateTime(request.processedAt)}`} />}
      {request.createdUser && <DetailRow label="Tài khoản đã tạo" value={`${request.createdUser.email} (#${request.createdUser.id})`} />}
      {request.rejectReason && <DetailRow label="Lý do từ chối" value={<span className="whitespace-pre-wrap">{request.rejectReason}</span>} />}
    </div>

    <div className="space-y-2">
      <Label htmlFor="owner-request-note" className="text-sm font-semibold">Ghi chú nội bộ</Label>
      <Textarea id="owner-request-note" rows={3} maxLength={2000} value={note} readOnly={!open} disabled={busy}
        onChange={event => setNote(event.target.value)} placeholder={open ? 'Nội dung đã trao đổi qua điện thoại…' : undefined} />
      {open && <div className="flex justify-end"><Button variant="outline" disabled={busy || !noteChanged} onClick={() => onSaveNote(note.trim())}>Lưu ghi chú</Button></div>}
    </div>

    {open && <div className="flex flex-wrap gap-2 border-t border-border pt-4">
      {request.status === 'PENDING' && <Button variant="outline" disabled={busy} onClick={onContact}><PhoneCall aria-hidden="true" />Đánh dấu đã liên hệ</Button>}
      <Button disabled={busy} onClick={onApprove}><UserPlus aria-hidden="true" />Tạo tài khoản chủ sân</Button>
      <Button variant="danger-soft" disabled={busy} onClick={onReject}><XCircle aria-hidden="true" />Từ chối</Button>
    </div>}
  </ContentPanel>;
}
