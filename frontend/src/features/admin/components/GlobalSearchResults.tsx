import React, { useMemo } from 'react';
import { UsersIcon, CourtIcon, TournamentIcon, ReportIcon } from '../../../components/common/Icons';
import type { GlobalSearchResult } from '../services/adminGlobalSearchService';

interface GlobalSearchResultsProps {
  isLoading: boolean;
  results: GlobalSearchResult;
  query: string;
  onSelectResult: (path: string) => void;
}

const getRoleBadgeStyle = (role: string) => {
  switch (role) {
    case 'ADMIN':
      return { bg: '#EAE8FD', text: '#5B44E6', label: 'Admin' };
    case 'COURT_OWNER':
      return { bg: '#D0E1FB', text: '#004A77', label: 'Chủ sân' };
    default:
      return { bg: '#EAF5EC', text: '#006B2C', label: 'VĐV' };
  }
};

const CategoryHeader: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div
    style={{
      padding: '6px 14px',
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-secondary)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      backgroundColor: 'var(--bg-app)',
    }}
  >
    {icon}
    <span>{label}</span>
  </div>
);

export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
  isLoading,
  results,
  query,
  onSelectResult,
}) => {
  const totalResultsCount = useMemo(
    () =>
      results.users.length +
      results.facilities.length +
      results.tournaments.length +
      results.reports.length,
    [results]
  );

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        <div style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid rgba(0,107,44,0.2)', borderTopColor: 'var(--color-brand)', borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginBottom: 8 }} />
        <div>Đang tìm kiếm trên toàn hệ thống...</div>
      </div>
    );
  }

  if (totalResultsCount === 0) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🔍</div>
        Không tìm thấy kết quả nào cho "<strong>{query}</strong>"
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {results.users.length > 0 && (
        <div>
          <CategoryHeader icon={<UsersIcon size={13} color="var(--text-secondary)" />} label={`Người dùng (${results.users.length})`} />
          {results.users.map((u) => {
            const roleBadge = getRoleBadgeStyle(u.role);
            return (
              <div
                key={`user-${u.id}`}
                onClick={() => onSelectResult('/admin/users')}
                style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid rgba(189, 202, 186, 0.15)', transition: 'background-color 0.12s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {u.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.email}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: roleBadge.bg, color: roleBadge.text, flexShrink: 0 }}>
                  {roleBadge.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {results.facilities.length > 0 && (
        <div>
          <CategoryHeader icon={<CourtIcon size={13} color="var(--text-secondary)" />} label={`Cơ sở & Sân (${results.facilities.length})`} />
          {results.facilities.map((f) => (
            <div
              key={`facility-${f.id}`}
              onClick={() => onSelectResult('/admin/courts')}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid rgba(189, 202, 186, 0.15)', transition: 'background-color 0.12s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.address}, {f.city}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--bg-tag-blue)', color: 'var(--text-primary)', flexShrink: 0 }}>
                {f.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {results.tournaments.length > 0 && (
        <div>
          <CategoryHeader icon={<TournamentIcon size={13} color="var(--text-secondary)" />} label={`Giải đấu (${results.tournaments.length})`} />
          {results.tournaments.map((t) => (
            <div
              key={`tournament-${t.id}`}
              onClick={() => onSelectResult('/admin/tournaments')}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid rgba(189, 202, 186, 0.15)', transition: 'background-color 0.12s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Thể thức: {t.format}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: 'var(--bg-tag-green)', color: 'var(--color-brand)', flexShrink: 0 }}>
                {t.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {results.reports.length > 0 && (
        <div>
          <CategoryHeader icon={<ReportIcon size={13} color="var(--text-secondary)" />} label={`Báo cáo & Khiếu nại (${results.reports.length})`} />
          {results.reports.map((r) => (
            <div
              key={`report-${r.id}`}
              onClick={() => onSelectResult('/admin/reports')}
              style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid rgba(189, 202, 186, 0.15)', transition: 'background-color 0.12s ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Mã lý do: {r.reasonCode}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.description || 'Không có mô tả'}
                </div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#FDECEE', color: 'var(--color-danger)', flexShrink: 0 }}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
