import React from 'react';

export const FacilityComplianceBanner: React.FC = () => {
  return (
    <div
      style={{
        backgroundColor: '#F2F3FF',
        borderRadius: 12,
        padding: 24,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        border: '1px solid #E2E7FF',
      }}
    >
      <div
        style={{
          width: 36,
          height: 38,
          borderRadius: 8,
          backgroundColor: '#006B2C',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>

      <div>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, letterSpacing: '0.01em' }}>
          Quy chuẩn Đình chỉ &amp; Khóa Vận Hành Cơ sở (Chính sách SmashPro Admin SLA v2.4):
        </h4>
        <p style={{ fontSize: 13, lineHeight: '21px', color: 'var(--text-secondary)', margin: 0 }}>
          Trạng thái <strong style={{ color: '#BA1A1A' }}>Đình chỉ cơ sở (SUSPENDED)</strong> sẽ tạm dừng mở bán các ca đặt sân mới trên hệ thống. Các ca đã xác nhận vẫn được giữ nguyên và không tự động hủy hoặc hoàn tiền. Các sân trực thuộc giữ nguyên trạng thái riêng nhưng không phát sinh ca đặt mới trong thời gian cơ sở bị đình chỉ. Khi Admin thẩm định lại và chuyển cơ sở sang <strong style={{ color: '#006B2C' }}>ACTIVE</strong>, các sân chưa bị vô hiệu hóa sẽ mở bán trở lại. Vô hiệu hóa cơ sở sẽ vô hiệu hóa toàn bộ sân trực thuộc và không thể khôi phục trong luồng MVP.
        </p>
      </div>
    </div>
  );
};
