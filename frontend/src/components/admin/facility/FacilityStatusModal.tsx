import React, { useState } from 'react';
import type { Facility, FacilityStatus } from '../../../types/facility';

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          maxWidth: 520,
          width: '100%',
          padding: 24,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: isSuspending ? '#FFDAD6' : '#EBF9F1',
              color: isSuspending ? '#BA1A1A' : '#006B2C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isSuspending ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isSuspending ? 'Xác nhận Tạm đình chỉ cơ sở' : 'Thẩm định lại & Kích hoạt cơ sở'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              {facility.name} ({facility.facilityCode})
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {isSuspending ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Lý do tạm đình chỉ *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: '100%',
                    height: 40,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="PCCC_EXPIRED">Hết hạn hoặc chưa nghiệm thu PCCC</option>
                  <option value="LIGHTING_STANDARD_FAILED">Độ rọi sáng dưới tiêu chuẩn BWF (&lt; 300 Lux)</option>
                  <option value="TOS_VIOLATION">Vi phạm điều khoản vận hành SmashPro TOS</option>
                  <option value="DISPUTE_INVESTIGATION">Đang giải quyết khiếu nại tranh chấp giải đấu / cọc</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Ghi chú nội bộ Admin
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập chi tiết biên bản kiểm tra hoặc mã ticket liên quan..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid #D0D5DD',
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div
                style={{
                  backgroundColor: '#FFF8F7',
                  border: '1px solid #FFDAD6',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 20,
                  fontSize: 12,
                  color: '#93000A',
                }}
              >
                <strong>Lưu ý SLA:</strong> Cơ sở sẽ tạm dừng mở bán ca đặt sân mới trên app Player. Các ca đã nạp cọc Escrow hợp lệ vẫn được giữ nguyên.
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>
              <p style={{ margin: '0 0 12px' }}>
                Bạn đang thực hiện phê duyệt thẩm định lại cho <strong>{facility.name}</strong>.
              </p>
              <div
                style={{
                  backgroundColor: '#F7FFF2',
                  border: '1px solid #D0E1FB',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  color: '#006B2C',
                }}
              >
                <strong>Hiệu lực:</strong> Khi chuyển sang trạng thái <strong>ACTIVE</strong>, tất cả các sân trực thuộc (trừ các sân tự hủy) sẽ ngay lập tức được mở bán trở lại trên toàn hệ thống SmashPro.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid #D0D5DD',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: isSuspending ? '#BA1A1A' : '#006B2C',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {isSubmitting ? 'Đang xử lý...' : isSuspending ? 'Xác nhận đình chỉ' : 'Xác nhận mở lại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
