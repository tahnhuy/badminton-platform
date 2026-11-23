import { AdminDialog, AdminDialogFooter } from '../AdminDialog';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import React, { useState } from 'react';
import type { Facility, FacilityStatus } from '../../types/facility';

interface FacilityStatusModalProps {
  isOpen: boolean;
  facility: Facility | null;
  targetStatus: FacilityStatus;
  onClose: () => void;
  onConfirm: (facilityId: number, status: FacilityStatus, reason?: string) => Promise<void>;
}

export const FacilityStatusModal: React.FC<FacilityStatusModalProps> = ({
  isOpen,
  facility,
  targetStatus,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('PCCC_EXPIRED');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !facility) return null;

  const isSuspending = targetStatus === 'SUSPENDED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onConfirm(facility.id, targetStatus, isSuspending ? `${reason}: ${note}` : undefined);
      onClose();
    } catch {
      // Error handled in parent toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return <AdminDialog open={isOpen} onClose={onClose} showClose={false} allowEscape={false} title={isSuspending ? 'Xác nhận Tạm đình chỉ cơ sở' : 'Thẩm định lại & Kích hoạt cơ sở'} description={`${facility.name} (${facility.facilityCode})`}>
    <form onSubmit={handleSubmit} className="space-y-4">{isSuspending ? <>
      <label className="block space-y-2 text-sm font-semibold">Lý do tạm đình chỉ *<Select value={reason} onChange={setReason} options={[
        { value: 'PCCC_EXPIRED', label: 'Hết hạn hoặc chưa nghiệm thu PCCC' },
        { value: 'LIGHTING_STANDARD_FAILED', label: 'Độ rọi sáng dưới tiêu chuẩn BWF (< 300 Lux)' },
        { value: 'TOS_VIOLATION', label: 'Vi phạm điều khoản vận hành SmashPro TOS' },
        { value: 'DISPUTE_INVESTIGATION', label: 'Đang giải quyết khiếu nại tranh chấp giải đấu / cọc' },
      ]} />
      </label>
      <label className="block space-y-2 text-sm font-semibold">Ghi chú nội bộ Admin<Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Nhập chi tiết biên bản kiểm tra hoặc mã ticket liên quan..." rows={3} />
      </label>
      <Alert variant="warning">Cơ sở tạm dừng nhận đặt sân mới. Các booking đã xác nhận giữ nguyên, không tự hủy hoặc hoàn tiền.</Alert>
    </> : <>
      <p className="text-sm">Bạn đang thực hiện phê duyệt thẩm định lại cho <strong>{facility.name}</strong>.</p>
      <Alert>Cơ sở trở lại ACTIVE. Khả năng đặt sân vẫn phụ thuộc trạng thái từng sân, giờ mở cửa và cấu hình giá hiện có.</Alert>
    </>}
      <AdminDialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</Button>
        <Button type="submit" variant={isSuspending ? 'danger' : 'brand'} disabled={isSubmitting}>{isSubmitting ? 'Đang xử lý...' : isSuspending ? 'Xác nhận đình chỉ' : 'Xác nhận mở lại'}</Button>
      </AdminDialogFooter>
    </form>
  </AdminDialog>;
};
