import React from 'react';
import { UsersIcon } from '../../../components/common/Icons';

interface UserMetricCardsProps {
  totalUsers?: number;
  activeCount?: number;
  suspendedCount?: number;
  deactivatedCount?: number;
}

export const UserMetricCards: React.FC<UserMetricCardsProps> = ({
  totalUsers = 10,
  activeCount = 8,
  suspendedCount = 1,
  deactivatedCount = 1,
}) => {
  const activePercentage = totalUsers > 0 ? ((activeCount / totalUsers) * 100).toFixed(1) : '100.0';

  return (
    <div className="metric-cards-grid">
      {/* Card 1: Total Users */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            TỔNG NGƯỜI DÙNG
          </span>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UsersIcon size={20} color="var(--color-brand)" />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
              }}
            >
              {totalUsers.toLocaleString('vi-VN')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-green)',
                color: 'var(--color-brand)',
              }}
            >
              +12.4%
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 8,
            }}
          >
            Tổng tài khoản trên hệ thống
          </div>
        </div>
      </div>

      {/* Card 2: Active Accounts */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            TÀI KHOẢN HOẠT ĐỘNG
          </span>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: 'rgba(85, 129, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: 'var(--color-warning)',
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
              }}
            >
              {activeCount.toLocaleString('vi-VN')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-blue)',
                color: 'var(--text-secondary)',
              }}
            >
              {activePercentage}%
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 8,
            }}
          >
            Trạng thái ACTIVE bình thường
          </div>
        </div>
      </div>

      {/* Card 3: Suspended Accounts */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            ĐANG TẠM ĐÌNH CHỈ
          </span>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 218, 214, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-danger)',
              fontWeight: 700,
            }}
          >
            !
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                color: 'var(--color-danger)',
              }}
            >
              {suspendedCount.toLocaleString('vi-VN')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: 'rgba(255, 218, 214, 0.6)',
                color: 'var(--color-danger)',
              }}
            >
              Cần rà soát
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 8,
            }}
          >
            Tài khoản bị tạm khóa / đình chỉ
          </div>
        </div>
      </div>

      {/* Card 4: Deactivated / Soft-deleted */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}
          >
            ĐÃ VÔ HIỆU HÓA
          </span>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontWeight: 700,
            }}
          >
            ✕
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.025em',
                color: 'var(--text-primary)',
              }}
            >
              {deactivatedCount.toLocaleString('vi-VN')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 9999,
                backgroundColor: 'var(--bg-tag-blue)',
                color: 'var(--text-secondary)',
              }}
            >
              Soft-deleted
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 8,
            }}
          >
            Đã vô hiệu hóa hoặc xóa mềm
          </div>
        </div>
      </div>
    </div>
  );
};
