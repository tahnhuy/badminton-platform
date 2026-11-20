import { useId, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '../../shared/api/http-client';
import { reportsApi, type ReportTargetType } from '../../features/reports/services/reports-api';
import './report-dialog.css';

const REASONS = [
  { value: 'SPAM', label: 'Spam/quảng cáo không phù hợp' },
  { value: 'HARASSMENT', label: 'Quấy rối, xúc phạm' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Nội dung không phù hợp' },
  { value: 'SCAM', label: 'Lừa đảo' },
  { value: 'PRIVACY_VIOLATION', label: 'Tiết lộ thông tin riêng tư' },
  { value: 'OTHER', label: 'Khác' },
] as const;

const TARGET_LABELS: Record<ReportTargetType, string> = {
  POST: 'bài viết',
  COMMENT: 'bình luận',
  MESSAGE: 'tin nhắn',
};

export function ReportDialog({
  targetType,
  targetId,
  onClose,
  onSubmitted,
}: {
  targetType: ReportTargetType;
  targetId: number;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const reasonId = useId();
  const descriptionId = useId();
  const [reasonCode, setReasonCode] = useState<string>('SPAM');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const trimmed = description.trim();
    if (reasonCode === 'OTHER' && !trimmed) {
      setError('Vui lòng mô tả lý do khi chọn “Khác”.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      await reportsApi.create({
        targetType,
        targetId,
        reasonCode,
        ...(trimmed ? { description: trimmed } : {}),
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Không thể gửi báo cáo. Vui lòng thử lại.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent aria-describedby={undefined}>
        <DialogTitle className="mb-4">Đã gửi báo cáo</DialogTitle>
        <div className="report-dialog-success">
          <p>Báo cáo {TARGET_LABELS[targetType]} đã được gửi tới Admin để kiểm duyệt.</p>
          <p className="report-dialog-note">Nội dung và tệp đính kèm tại thời điểm gửi được lưu làm bằng chứng.</p>
          <div className="report-dialog-actions">
            <button type="button" className="report-dialog-primary" onClick={onClose}>Đóng</button>
          </div>
        </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent closeDisabled={busy} aria-describedby={undefined}>
      <DialogTitle className="mb-4">Báo cáo {TARGET_LABELS[targetType]}</DialogTitle>
      <form className="report-dialog-form" onSubmit={submit}>
        <p className="report-dialog-note">
          Báo cáo gửi tới Admin. Nội dung và tệp đính kèm tại thời điểm gửi được lưu làm bằng chứng.
        </p>

        <div className="report-dialog-field">
          <label htmlFor={reasonId}>Lý do</label>
          <select
            id={reasonId}
            value={reasonCode}
            onChange={event => setReasonCode(event.target.value)}
            disabled={busy}
          >
            {REASONS.map(reason => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
          </select>
        </div>

        <div className="report-dialog-field">
          <label htmlFor={descriptionId}>
            Mô tả {reasonCode === 'OTHER' ? '(bắt buộc)' : '(không bắt buộc)'}
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={event => setDescription(event.target.value)}
            maxLength={2000}
            rows={4}
            disabled={busy}
            placeholder={reasonCode === 'OTHER' ? 'Mô tả chi tiết vấn đề…' : 'Thông tin thêm cho Admin (nếu có)…'}
          />
          <small>{[...description].length}/2000 ký tự</small>
        </div>

        {error && <p className="report-dialog-error" role="alert">{error}</p>}

        <div className="report-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>Hủy</button>
          <button type="submit" className="report-dialog-primary" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi báo cáo'}
          </button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  );
}
