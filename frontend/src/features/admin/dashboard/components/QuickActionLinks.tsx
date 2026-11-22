import React from 'react';
import { Link } from 'react-router-dom';
import { CourtIcon, ReportIcon, TournamentIcon, UsersIcon } from '../../../../components/common/Icons';

const LINKS = [
  { to: '/admin/users', label: 'Quản lý người dùng', icon: <UsersIcon size={16} color="var(--color-brand)" /> },
  { to: '/admin/courts', label: 'Cơ sở & sân', icon: <CourtIcon size={16} color="var(--color-info)" /> },
  { to: '/admin/tournaments', label: 'Giải đấu', icon: <TournamentIcon size={16} color="var(--color-info)" /> },
  { to: '/admin/reports', label: 'Báo cáo', icon: <ReportIcon size={16} color="var(--color-danger)" /> },
];

export const QuickActionLinks: React.FC = () => {
  return (
    <section className="dashboard-card dashboard-shortcuts" aria-label="Điều hướng nhanh">
      <header className="dashboard-card-header">
        <div>
          <h2>Điều hướng nhanh</h2>
          <p>Mở khu vực quản trị tương ứng để xử lý công việc.</p>
        </div>
      </header>
      <nav className="dashboard-shortcut-list">
        {LINKS.map(link => (
          <Link key={link.to} to={link.to} className="dashboard-shortcut-link" data-testid="quick-link">
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
};
