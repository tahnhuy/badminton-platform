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
    <section className="dashboard-card min-w-0 rounded-2xl border border-border bg-card p-4.5 shadow-sm dashboard-shortcuts flex flex-col" aria-label="Điều hướng nhanh">
      <header className="dashboard-card-header mb-3 flex flex-col items-start justify-between gap-4 md:flex-row [&_h2]:text-base [&_h2]:font-extrabold [&_p]:mt-1 [&_p]:text-sm [&_p]:text-muted-foreground">
        <div>
          <h2>Điều hướng nhanh</h2>
          <p>Mở khu vực quản trị tương ứng để xử lý công việc.</p>
        </div>
      </header>
      <nav className="dashboard-shortcut-list flex flex-col gap-2">
        {LINKS.map(link => (
          <Link key={link.to} to={link.to} className="dashboard-shortcut-link flex items-center gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-sm font-semibold text-foreground no-underline transition-colors hover:bg-primary/10 hover:text-primary" data-testid="quick-link">
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
};
