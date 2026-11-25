import { AuditScrollArea } from '@/components/common/audit-scroll-area';
import { useId, useState, type FormEvent } from 'react';
import { BadgeCheck, FileImage } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Feedback, Status } from './OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { ownerApi } from '../services/owner-api';
import type { Court, Meta, StandardClaim, StandardDefinition } from '../types/owner';

export function CourtStandardPanel({ court }: { court: Court }) {
  const prefix = useId();
  const action = useOwnerAction();
  const catalog = useOwnerResource<{ data: StandardDefinition[] }>('/standards', true);
  const claims = useOwnerResource<{ data: StandardClaim[]; meta: Meta }>(`/courts/${court.id}/standard-claims?page=1&limit=20`, true);
  const [standardCode, setStandardCode] = useState('');
  const effectiveCode = standardCode || catalog.data?.data[0]?.code || '';
  const selected = catalog.data?.data.find(item => item.code === effectiveCode);

  const reload = () => { catalog.reload(); claims.reload(); };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      standardCode: effectiveCode,
      issuer: String(data.get('issuer') ?? '').trim(),
      referenceNo: String(data.get('referenceNo') ?? '').trim(),
      issuedAt: String(data.get('issuedAt') ?? '').trim() || null,
      expiresAt: String(data.get('expiresAt') ?? '').trim() || null,
    };
    const body = new FormData();
    body.set('payload', JSON.stringify(payload));
    for (const file of data.getAll('evidence')) {
      if (file instanceof File && file.size > 0) body.append('evidence', file);
    }
    void action.run(() => ownerApi.upload(`/courts/${court.id}/standard-claims`, body), () => { form.reset(); setStandardCode(''); reload(); });
  }

  return <ContentPanel title="Tiêu chuẩn mặt sân (tùy chọn)" icon={BadgeCheck}>
    <p className="text-sm leading-6 text-muted-foreground">Chỉ khai báo khi sân thật sự đạt chuẩn. Tiêu chuẩn đã được Admin xác minh và còn hạn mới hiển thị công khai, kèm ngày duyệt. Hồ sơ đi qua luồng duyệt riêng, không phải hồ sơ sân.</p>
    {(!court.surfaceBrand || !court.surfaceModel) && <p className="rounded-lg bg-caution-bg p-4 text-sm leading-6 text-caution">Cần khai báo thương hiệu và dòng sản phẩm mặt sân trước khi nộp tiêu chuẩn.</p>}
    {claims.data?.data.length ? <AuditScrollArea label="Hồ sơ tiêu chuẩn mặt sân">{claims.data.data.map(claim => <article key={claim.id} className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><strong>{claim.standardName}</strong><Status value={claim.status} /></div>
      <p>Đơn vị cấp: {claim.issuer} · Số tham chiếu: {claim.referenceNo}</p>
      <p>Hiệu lực: {claim.issuedAt ?? '—'} → {claim.expiresAt ?? 'không thời hạn'}</p>
      {claim.reviewedAt && <p>Duyệt lúc: {new Date(claim.reviewedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</p>}
      {claim.rejectionReason && <p className="text-danger">Lý do từ chối: {claim.rejectionReason}</p>}
      <div className="flex flex-wrap gap-3">{claim.evidenceMediaIds.map(id => <a key={id} className="inline-flex items-center gap-1 text-primary underline" href={`/api/v1/media/${id}`} target="_blank" rel="noreferrer"><FileImage aria-hidden="true" className="size-4" />Bằng chứng #{id}</a>)}</div>
    </article>)}</AuditScrollArea> : <p className="text-sm text-muted-foreground">Chưa có hồ sơ tiêu chuẩn.</p>}
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-4" disabled={action.busy}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'standard'} className="text-sm font-semibold">Tiêu chuẩn</Label><Select id={prefix + 'standard'} name="standardCode" required value={effectiveCode} onChange={setStandardCode} options={(catalog.data?.data ?? []).map(item => ({ value: item.code, label: item.name }))} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'issuer'} className="text-sm font-semibold">Đơn vị cấp</Label><Input id={prefix + 'issuer'} name="issuer" required maxLength={200} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'referenceNo'} className="text-sm font-semibold">Số tham chiếu</Label><Input id={prefix + 'referenceNo'} name="referenceNo" required maxLength={200} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'issuedAt'} className="text-sm font-semibold">Ngày cấp</Label><Input id={prefix + 'issuedAt'} name="issuedAt" type="date" /></div>
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'expiresAt'} className="text-sm font-semibold">Ngày hết hạn{selected?.requiresExpiry ? ' *' : ''}</Label><Input id={prefix + 'expiresAt'} name="expiresAt" type="date" required={selected?.requiresExpiry} /></div>
          <div className="flex flex-col gap-2"><Label htmlFor={prefix + 'evidence'} className="text-sm font-semibold">Ảnh bằng chứng (1–4 ảnh)</Label><Input id={prefix + 'evidence'} name="evidence" type="file" accept="image/jpeg,image/png,image/webp" multiple required /></div>
        </div>
        <Button className="h-11 self-start" type="submit" disabled={!court.surfaceBrand || !court.surfaceModel}>{action.busy ? 'Đang gửi…' : 'Gửi hồ sơ tiêu chuẩn'}</Button>
      </fieldset>
      <Feedback {...action} />
    </form>
  </ContentPanel>;
}
