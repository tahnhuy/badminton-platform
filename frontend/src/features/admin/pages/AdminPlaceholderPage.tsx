import React from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';

interface AdminPlaceholderPageProps {
  title: string;
  description?: string;
  badge?: string;
}

export const AdminPlaceholderPage: React.FC<AdminPlaceholderPageProps> = ({
  title,
  description = 'Tính năng đang được phát triển trong các giai đoạn tiếp theo của hệ thống Badminton SmashPro.',
  badge = 'Đang phát triển',
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  return (
    <div className="admin-layout">
      {/* Fixed / Off-canvas Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main
          style={{
            padding: '96px 20px 48px',
            maxWidth: 1600,
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}
        >
          {/* Header Title */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  {title}
                </h1>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 9999,
                    backgroundColor: '#D0E1FB',
                    color: '#004A77',
                  }}
                >
                  {badge}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
                {description}
              </p>
            </div>
          </div>

          {/* Blank Placeholder Canvas Container */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 16,
              border: '1px dashed rgba(189, 202, 186, 0.8)',
              padding: '80px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: 'var(--bg-tag-green)',
                color: 'var(--color-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                marginBottom: 16,
              }}
            >
              🏸
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              {title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 480, margin: 0, lineHeight: 1.5 }}>
              Trang trắng cho mục <strong>{title}</strong>. Nội dung chi tiết và nghiệp vụ tương ứng sẽ được tích hợp theo các tác vụ tiếp theo.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};
