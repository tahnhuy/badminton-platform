import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/shared/api/http-client';
import { normalizePhone, phoneField } from '@/features/partnership/partnership-schema';
import { adminOwnerRequestApi, type OwnerRequest } from '@/features/partnership/partnership-api';
import { AdminDialog, AdminDialogFooter } from '../components/AdminDialog';

/** Rendered only while open, keyed by request id, so the fields start from the request. */
interface DialogProps {
  request: OwnerRequest;
  onClose: () => void;
  onDone: (updated: OwnerRequest) => void;
  /** Another Admin processed the request first: reload and close. */
  onStale: () => void;
}

const errorText = (reason: unknown, fallback: string) => {
  if (!(reason instanceof ApiError)) return 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
  if (reason.code === 'USER_EMAIL_EXISTS') return 'Email đã có tài khoản. Yêu cầu vẫn mở, bạn có thể từ chối với lý do phù hợp.';
  if (reason.code === 'VALIDATION_FAILED') return 'Vui lòng kiểm tra lại thông tin đã nhập.';
  return fallback;
};

/** "Tạo tài khoản chủ sân": pre-filled, email read-only, no password field (PRD §6.2 step 4). */
export function ApproveRequestDialog({ request, onClose, onDone, onStale }: DialogProps) {
  const [businessName, setBusinessName] = useState(request.facilityName);
  const [phone, setPhone] = useState(request.phone);
  const [fieldError, setFieldError] = useState<{ businessName?: string; phone?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    const next: typeof fieldError = {};
    const name = businessName.trim();
    if (name.length < 2 || name.length > 150) next.businessName = 'Tên cơ sở từ 2 đến 150 ký tự.';
    const parsedPhone = phoneField.safeParse(phone);
    if (!parsedPhone.success) next.phone = parsedPhone.error.issues[0]?.message;
    setFieldError(next);
    if (next.businessName || next.phone) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminOwnerRequestApi.approve(request.id, { businessName: name, phone: normalizePhone(phone) });
      onDone(result.data);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'OWNER_REQUEST_INVALID_STATE') { onStale(); return; }
      setError(errorText(reason, 'Không thể tạo tài khoản. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return <AdminDialog open onClose={() => { if (!busy) onClose(); }} title="Tạo tài khoản chủ sân" description={request.contactName}>
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="approve-email" className="text-xs font-semibold">Email đăng nhập</Label>
        <Input id="approve-email" value={request.email} readOnly aria-readonly="true" className="bg-muted" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="approve-business" className="text-xs font-semibold">Tên cơ sở kinh doanh *</Label>
        <Input id="approve-business" value={businessName} maxLength={150} onChange={event => setBusinessName(event.target.value)} disabled={busy}
          aria-invalid={fieldError.businessName ? true : undefined} aria-describedby={fieldError.businessName ? 'approve-business-error' : undefined} />
        {fieldError.businessName && <p id="approve-business-error" className="text-sm text-destructive">{fieldError.businessName}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="approve-phone" className="text-xs font-semibold">Số điện thoại *</Label>
        <Input id="approve-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} disabled={busy}
          aria-invalid={fieldError.phone ? true : undefined} aria-describedby={fieldError.phone ? 'approve-phone-error' : undefined} />
        {fieldError.phone && <p id="approve-phone-error" className="text-sm text-destructive">{fieldError.phone}</p>}
      </div>
      <p className="rounded-lg bg-caution-bg p-4 text-sm text-caution">
        Hệ thống không tạo mật khẩu cho bạn xem. Chủ sân nhận email hướng dẫn tự đặt mật khẩu bằng "Quên mật khẩu".
      </p>
      {error && <p className="rounded-lg bg-danger-bg p-3 text-sm text-danger" role="alert">{error}</p>}
    </div>
    <AdminDialogFooter>
      <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
      <Button onClick={() => void confirm()} disabled={busy}>{busy ? 'Đang tạo…' : 'Tạo tài khoản'}</Button>
    </AdminDialogFooter>
  </AdminDialog>;
}

const REASON_MIN = 10;
const REASON_MAX = 500;

/** "Từ chối": the reason is required and is emailed to the requester (PRD §6.2 step 5). */
export function RejectRequestDialog({ request, onClose, onDone, onStale }: DialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const length = reason.trim().length;
  const confirm = async () => {
    if (length < REASON_MIN) { setError(`Lý do cần ít nhất ${REASON_MIN} ký tự.`); return; }
    setBusy(true);
    setError('');
    try {
      const result = await adminOwnerRequestApi.reject(request.id, reason.trim());
      onDone(result.data);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === 'OWNER_REQUEST_INVALID_STATE') { onStale(); return; }
      setError(errorText(reason, 'Không thể từ chối yêu cầu. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return <AdminDialog open onClose={() => { if (!busy) onClose(); }} title="Từ chối yêu cầu hợp tác" description={`${request.facilityName} – ${request.contactName}`}>
    <div className="grid gap-2">
      <Label htmlFor="reject-reason" className="text-sm font-semibold">Lý do từ chối * <span className="font-normal text-muted-foreground">(gửi cho người yêu cầu)</span></Label>
      <Textarea id="reject-reason" rows={4} value={reason} maxLength={REASON_MAX} onChange={event => setReason(event.target.value)} disabled={busy}
        aria-describedby="reject-reason-count" />
      <p id="reject-reason-count" className="text-right text-xs text-muted-foreground">{length}/{REASON_MAX} ký tự, tối thiểu {REASON_MIN}</p>
      {error && <p className="rounded-lg bg-danger-bg p-3 text-sm text-danger" role="alert">{error}</p>}
    </div>
    <AdminDialogFooter>
      <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
      <Button variant="danger" onClick={() => void confirm()} disabled={busy}>{busy ? 'Đang xử lý…' : 'Xác nhận từ chối'}</Button>
    </AdminDialogFooter>
  </AdminDialog>;
}
