import React, { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export const AdminNotificationLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="admin-layout">
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(value => !value)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        <main style={{
          padding: '96px 20px 48px', display: 'flex', flexDirection: 'column', gap: 24,
          maxWidth: 960, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};
