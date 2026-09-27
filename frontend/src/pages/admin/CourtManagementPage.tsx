import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { AdminHeader } from '../../components/admin/AdminHeader';
import { FacilityMetricCards } from '../../components/admin/facility/FacilityMetricCards';
import { FacilityFiltersToolbar } from '../../components/admin/facility/FacilityFiltersToolbar';
import { FacilityTable } from '../../components/admin/facility/FacilityTable';
import { FacilityStatusModal } from '../../components/admin/facility/FacilityStatusModal';
import { CreateFacilityModal } from '../../components/admin/facility/CreateFacilityModal';
import type { CreateFacilityFormData } from '../../components/admin/facility/CreateFacilityModal';
import { FacilityComplianceBanner } from '../../components/admin/facility/FacilityComplianceBanner';
import { TablePagination } from '../../components/admin/TablePagination';
import { ToastContainer } from '../../components/admin/Toast';
import type { ToastMessage } from '../../components/admin/Toast';
import type { Facility, FacilityStatus, FacilitySortOption, FacilityStats } from '../../types/facility';
import { adminFacilityService } from '../../services/adminFacilityService';
import { exportFacilitiesToExcel } from '../../utils/facilityExcelExport';

export const CourtManagementPage: React.FC = () => {
  // Data state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [totalFacilities, setTotalFacilities] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<FacilityStats>({
    totalFacilities: 0,
    provincesCovered: 0,
    quarterGrowth: 0,
    totalBwfCourts: 0,
    yonexCount: 0,
    pvcCount: 0,
    activeFacilities: 0,
    sellingRate: 0,
    suspendedFacilities: 0,
    pendingViolations: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FacilityStatus | ''>('');
  const [city, setCity] = useState('');
  const [bwfStandard, setBwfStandard] = useState('');
  const [sort, setSort] = useState<FacilitySortOption | ''>('courtCount_desc');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestIdRef = useRef(0);

  // Layout sidebar & drawer states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modals state
  const [statusModalFacility, setStatusModalFacility] = useState<Facility | null>(null);
  const [targetStatus, setTargetStatus] = useState<FacilityStatus>('SUSPENDED');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = String(Date.now());
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load facilities from API
  const loadFacilities = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setIsLoading(true);
      const res = await adminFacilityService.fetchFacilities({
        page,
        limit,
        search: debouncedSearch || undefined,
        status: status || undefined,
        city: city || undefined,
        bwfStandard: bwfStandard || undefined,
        sort: sort || undefined,
      });

      if (requestId !== requestIdRef.current) return;

      setFacilities(res.data.items || []);
      setTotalFacilities(res.data.meta.total);
      setTotalPages(res.data.meta.totalPages);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      addToast('error', err.message || 'Không thể tải danh sách cơ sở');
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, limit, debouncedSearch, status, city, bwfStandard, sort]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, city, bwfStandard, sort]);

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setCity('');
    setBwfStandard('');
    setSort('courtCount_desc');
    setPage(1);
  };

  const handleOpenStatusModal = (facility: Facility, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    setStatusModalFacility(facility);
    setTargetStatus(newStatus);
  };

  const handleConfirmStatusChange = async (facilityId: number, newStatus: FacilityStatus) => {
    try {
      const res = await adminFacilityService.updateFacilityStatus(facilityId, newStatus);
      addToast('success', res.message || `Cơ sở đã được cập nhật sang trạng thái ${newStatus}`);
      loadFacilities();
    } catch (err: any) {
      addToast('error', err.message || 'Không thể cập nhật trạng thái cơ sở');
      throw err;
    }
  };

  const handleDeleteFacility = async (facility: Facility) => {
    if (!window.confirm(`Bạn có chắc chắn muốn vô hiệu hóa cơ sở "${facility.name}" và toàn bộ các sân trực thuộc?`)) {
      return;
    }
    try {
      await adminFacilityService.deleteFacility(facility.id);
      addToast('success', `Đã vô hiệu hóa cơ sở "${facility.name}" thành công`);
      loadFacilities();
    } catch (err: any) {
      addToast('error', err.message || 'Không thể vô hiệu hóa cơ sở');
    }
  };

  // Full multi-page dataset export handler
  const fetchAllFacilitiesForExport = async (): Promise<Facility[]> => {
    const pageSize = 100;
    const baseParams = {
      search: search || undefined,
      status: status || undefined,
      city: city || undefined,
      bwfStandard: bwfStandard || undefined,
      sort: sort || undefined,
    };

    const first = await adminFacilityService.fetchFacilities({ page: 1, limit: pageSize, ...baseParams });
    const all = [...(first.data.items || [])];
    const totalP = first.data.meta.totalPages || 1;

    for (let p = 2; p <= totalP; p++) {
      const next = await adminFacilityService.fetchFacilities({ page: p, limit: pageSize, ...baseParams });
      all.push(...(next.data.items || []));
    }

    return all;
  };

  const handleExportExcel = async () => {
    try {
      addToast('info', 'Đang kết xuất toàn bộ dữ liệu cơ sở ra tệp Excel...');
      const all = await fetchAllFacilitiesForExport();
      if (all.length === 0) {
        addToast('info', 'Không có dữ liệu cơ sở nào để xuất');
        return;
      }
      exportFacilitiesToExcel(all);
      addToast('success', `Đã xuất ${all.length} cơ sở ra tệp Excel thành công`);
    } catch (err: any) {
      addToast('error', `Lỗi khi xuất tệp Excel: ${err.message || 'Thao tác thất bại'}`);
    }
  };

  const handleCreateFacility = async (formData: CreateFacilityFormData) => {
    try {
      const res = await adminFacilityService.createFacility(formData);
      addToast('success', res.message || `Đã khởi tạo cơ sở "${formData.name}" thành công!`);
      loadFacilities();
    } catch (err: any) {
      addToast('error', err.message || 'Không thể khởi tạo cơ sở');
      throw err;
    }
  };

  return (
    <div className="admin-layout">
      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Global Admin Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Layout */}
      <div className={`admin-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Global Admin Header */}
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)}
        />

        {/* Page Inner Container */}
        <main
          style={{
            padding: '96px 20px 48px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            maxWidth: 1400,
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Top Page Header */}
          <div className="page-top-header">
            <div className="page-top-header-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h1 className="page-top-header-title">
                  Quản lý cơ sở &amp; Cụm sân thi đấu
                </h1>
                <span
                  style={{
                    backgroundColor: '#E2E7FF',
                    color: 'var(--text-secondary)',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  BWF STANDARD
                </span>
              </div>

              <p className="page-top-header-desc">
                Giám sát tính pháp lý, tiêu chuẩn sân BWF, trạng thái vận hành và đình chỉ cơ sở vi phạm trên toàn hệ sinh thái SmashPro.
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="page-header-actions">
              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  height: 38,
                  padding: '0 14px',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(189, 202, 186, 0.5)',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Xuất Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                style={{
                  height: 38,
                  padding: '0 16px',
                  backgroundColor: 'var(--color-brand)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Thêm cơ sở mới</span>
              </button>
            </div>
          </div>

          {/* 4 Bento Metric Cards */}
          <FacilityMetricCards stats={stats} />

          {/* Filters & Search Toolbar */}
          <FacilityFiltersToolbar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            city={city}
            onCityChange={setCity}
            bwfStandard={bwfStandard}
            onBwfStandardChange={setBwfStandard}
            sort={sort}
            onSortChange={setSort}
            onReset={handleResetFilters}
          />

          {/* Facility Table */}
          <FacilityTable
            facilities={facilities}
            isLoading={isLoading}
            onOpenStatusModal={handleOpenStatusModal}
            onDeleteFacility={handleDeleteFacility}
            filterSummaryText={city ? `TP. ${city} (Khớp ${totalFacilities} cụm sân)` : `Toàn quốc (Khớp ${totalFacilities} cụm sân)`}
          />

          {/* Table Pagination */}
          <TablePagination
            page={page}
            limit={limit}
            total={totalFacilities}
            totalPages={totalPages}
            onPageChange={setPage}
            onLimitChange={setLimit}
          />

          {/* Compliance & SLA Policy Banner */}
          <FacilityComplianceBanner />
        </main>
      </div>

      {/* Facility Status / Re-evaluate Modal */}
      <FacilityStatusModal
        isOpen={statusModalFacility !== null}
        facility={statusModalFacility}
        targetStatus={targetStatus}
        onClose={() => setStatusModalFacility(null)}
        onConfirm={handleConfirmStatusChange}
      />

      {/* Create Facility Modal */}
      <CreateFacilityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateFacility}
      />
    </div>
  );
};
