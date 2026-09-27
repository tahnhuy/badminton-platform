import React from 'react';
import type { Facility } from '../../../types/facility';

interface FacilityTableProps {
  facilities: Facility[];
  isLoading: boolean;
  onOpenStatusModal: (facility: Facility, targetStatus: 'ACTIVE' | 'SUSPENDED') => void;
  onDeleteFacility: (facility: Facility) => void;
  filterSummaryText?: string;
}

export const FacilityTable: React.FC<FacilityTableProps> = ({
  facilities,
  isLoading,
  onOpenStatusModal,
  onDeleteFacility,
  filterSummaryText,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'inline-block', width: 36, height: 36, border: '3px solid #E2E7FF', borderTopColor: '#006B2C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>Đang tải danh sách cơ sở...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A0AEC0" strokeWidth="1.5" style={{ margin: '0 auto 12px' }}>
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        </svg>
        <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Không tìm thấy cơ sở nào</h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Vui lòng điều chỉnh hoặc đặt lại bộ lọc tìm kiếm.</p>
      </div>
    );
  }

  return (
    <div className="admin-table-container">
      {/* Table Header Info Bar */}
      <div
        style={{
          padding: '12px 20px',
          backgroundColor: 'rgba(242, 243, 255, 0.6)',
          borderBottom: '1px solid rgba(189, 202, 186, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12.5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-brand)' }} />
          <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>Danh sách đối tác cụm sân</strong>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>
            {filterSummaryText || `Hiển thị ${facilities.length} cụm sân`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-brand)', fontWeight: 600, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Hệ thống đối soát tự động</span>
        </div>
      </div>

      {/* Table Scroll Wrapper */}
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ minWidth: 280 }}>CƠ SỞ / CỤM SÂN</th>
              <th style={{ minWidth: 200 }}>CHỦ SỞ HỮU &amp; LIÊN HỆ</th>
              <th style={{ minWidth: 160 }}>QUY MÔ &amp; LOẠI THẢM</th>
              <th style={{ minWidth: 150 }}>TIÊU CHUẨN BWF</th>
              <th style={{ minWidth: 150 }}>TRẠNG THÁI VẬN HÀNH</th>
              <th style={{ minWidth: 120, textAlign: 'right' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((facility) => {
              const isSuspended = facility.status === 'SUSPENDED' || facility.deletedAt !== null;

              return (
                <tr
                  key={facility.id}
                  style={{
                    backgroundColor: isSuspended ? 'rgba(255, 218, 214, 0.15)' : undefined,
                  }}
                >
                  {/* Col 1: Cơ sở / Cụm sân */}
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {/* Facility Thumbnail Badge */}
                      <div
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 8,
                          backgroundColor: isSuspended ? 'var(--color-danger)' : '#131B2E',
                          color: '#FFFFFF',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          fontSize: 9,
                          fontWeight: 700,
                          textAlign: 'center',
                          padding: 2,
                        }}
                      >
                        {isSuspended ? (
                          <>
                            <span>ĐÌNH</span>
                            <span>CHỈ</span>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.1 }}>{facility.courtStats.totalCourts}</span>
                            <span>SÂN</span>
                          </>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{facility.name}</span>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {facility.facilityCode}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {facility.address}, {facility.city}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Col 2: Chủ sở hữu & Liên hệ */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{facility.owner.name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{facility.owner.phone}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{facility.owner.email}</div>
                    </div>
                  </td>

                  {/* Col 3: Quy mô & Loại thảm */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>
                        {facility.courtStats.totalCourts} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>sân đạt chuẩn</span>
                      </div>
                      <div style={{ display: 'inline-block', width: 'fit-content', backgroundColor: '#E2E7FF', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 500 }}>
                        {facility.courtStats.surfaceSummary}
                      </div>
                    </div>
                  </td>

                  {/* Col 4: Tiêu chuẩn BWF */}
                  <td>
                    {(() => {
                      const grade = facility.grade || '';
                      const isGrade1 = grade.includes('Grade 1');
                      const isGrade2 = grade.includes('Grade 2');
                      const label = isGrade1
                        ? 'BWF Grade 1 Hub'
                        : isGrade2
                          ? 'BWF Grade 2'
                          : 'Tiêu chuẩn phong trào';
                      const bg = isGrade1 ? '#E8F5D4' : isGrade2 ? '#E2E7FF' : '#F2F3FF';
                      const color = isGrade1 ? '#436600' : isGrade2 ? 'var(--color-brand)' : 'var(--text-secondary)';
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 'fit-content',
                              backgroundColor: bg,
                              color,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                            }}
                          >
                            {label}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {facility.courtStats.totalCourts} sân đạt chuẩn
                          </span>
                        </div>
                      );
                    })()}
                  </td>

                  {/* Col 5: Trạng thái vận hành */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            backgroundColor: isSuspended ? '#FFDAD6' : '#EBF9F1',
                            color: isSuspended ? 'var(--color-danger)' : 'var(--color-brand)',
                          }}
                        >
                          {facility.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: isSuspended ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        {facility.statusNote}
                      </div>
                    </div>
                  </td>

                  {/* Col 6: Thao tác */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {isSuspended ? (
                        <>
                          {/* Re-evaluate / Reactivate button */}
                          <button
                            type="button"
                            onClick={() => onOpenStatusModal(facility, 'ACTIVE')}
                            style={{
                              backgroundColor: 'var(--color-brand)',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: 6,
                              padding: '5px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            <span>Thẩm định lại</span>
                          </button>
                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => onDeleteFacility(facility)}
                            title="Xóa / Vô hiệu hóa cơ sở"
                            style={{
                              backgroundColor: '#FFDAD6',
                              color: 'var(--color-danger)',
                              border: 'none',
                              borderRadius: 6,
                              padding: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Suspend Action Trigger */}
                          <button
                            type="button"
                            onClick={() => onOpenStatusModal(facility, 'SUSPENDED')}
                            title="Tạm đình chỉ cơ sở"
                            style={{
                              backgroundColor: '#F2F3FF',
                              color: 'var(--color-danger)',
                              border: 'none',
                              borderRadius: 6,
                              padding: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
