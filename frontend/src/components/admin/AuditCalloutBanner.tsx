import React, { useState } from 'react';
import { SyncIcon } from '../common/Icons';

export const AuditCalloutBanner: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSync = () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncMessage('Đã hoàn tất đồng bộ dữ liệu eKYC thành công!');
      setTimeout(() => setSyncMessage(null), 4000);
    }, 1500);
  };

  return (
    <div style={{
      background: 'linear-gradient(90deg, rgba(226, 231, 255, 0.5) 0%, rgba(242, 243, 255, 0.9) 50%, #FFFFFF 100%)',
      borderRadius: 12,
      padding: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 20,
      border: '1px solid rgba(189, 202, 186, 0.3)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Left Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          backgroundColor: '#131B2E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-brand-light)',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0
        }}>
          <SyncIcon size={22} color="#00873A" />
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Đồng bộ dữ liệu định danh VĐV chuẩn BWF
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Hệ thống đang tự động xác thực eKYC dựa trên căn cước công dân và liên đoàn cầu lông Việt Nam mỗi 6 tiếng.
          </div>
          {syncMessage && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-brand)', marginTop: 4 }}>
              ✓ {syncMessage}
            </div>
          )}
        </div>
      </div>

      {/* Right Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          style={{
            padding: '10px 18px',
            backgroundColor: 'var(--bg-tag-uid)',
            color: 'var(--text-primary)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700
          }}
        >
          Xem nhật ký kiểm duyệt
        </button>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          style={{
            padding: '10px 20px',
            backgroundColor: 'var(--color-brand)',
            color: '#FFFFFF',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
        </button>
      </div>
    </div>
  );
};
