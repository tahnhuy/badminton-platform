import { FacilityHandoverPanel } from '@/components/common/facility-handover-panel';
import { Button } from '@/components/ui/button';
import { Download, Plus } from 'lucide-react';
import { AdminMain } from '../components/AdminMain';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { FacilityMetricCards } from '../components/facility/FacilityMetricCards';
import { FacilityFiltersToolbar } from '../components/facility/FacilityFiltersToolbar';
import { FacilityTable } from '../components/facility/FacilityTable';
import { FacilityStatusModal } from '../components/facility/FacilityStatusModal';
import { CreateFacilityModal } from '../components/facility/CreateFacilityModal';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { CreateFacilityFormData } from '../components/facility/CreateFacilityModal';
import { FacilityComplianceBanner } from '../components/facility/FacilityComplianceBanner';
import { FacilityCourtProfileDialog } from '../components/facility/FacilityCourtProfileDialog';
import { TablePagination } from '@/components/common/table-pagination';
import { ToastContainer } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import type { Facility, FacilityStatus, FacilityStatusFilter, FacilitySortOption, FacilityStats } from '../types/facility';
import { adminFacilityService } from '../services/adminFacilityService';
import { exportFacilitiesToExcel } from '../utils/facilityExcelExport';

const FACILITY_STATUSES: FacilityStatus[] = ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED'];
const FACILITY_STATUS_FILTERS: FacilityStatusFilter[] = [...FACILITY_STATUSES, 'DISABLED'];

export const CourtManagementPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const initialStatus: FacilityStatusFilter | '' =
    statusParam && FACILITY_STATUS_FILTERS.includes(statusParam as FacilityStatusFilter)
      ? statusParam as FacilityStatusFilter
      : '';

  // Data state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [totalFacilities, setTotalFacilities] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<FacilityStats>({
    totalFacilities: 0,
    provincesCovered: 0,
    newFacilitiesThisQuarter: 0,
    totalActiveCourts: 0,
    activeFacilities: 0,
    activeFacilityRate: 0,
    suspendedFacilities: 0,
    unconfirmedSampleFacilities: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FacilityStatusFilter | ''>(initialStatus);
  const [city, setCity] = useState('');
  const [condition, setCondition] = useState('');
  const [surfaceType, setSurfaceType] = useState('');
  const [sort, setSort] = useState<FacilitySortOption | ''>('courtCount_desc');

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestIdRef = useRef(0);

  // Layout sidebar & drawer states
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modals state
  const [statusModalFacility, setStatusModalFacility] = useState<Facility | null>(null);
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'SUSPENDED'>('SUSPENDED');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteFacilityTarget, setDeleteFacilityTarget] = useState<Facility | null>(null);
  const [deleteFacilityBusy, setDeleteFacilityBusy] = useState(false);
  const [deleteFacilityError, setDeleteFacilityError] = useState('');
  const [profileFacilityId, setProfileFacilityId] = useState<number | null>(null);

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

  // Keep the status filter in sync when a notification link changes the query string.
  useEffect(() => {
    const next: FacilityStatusFilter | '' =
      statusParam && FACILITY_STATUS_FILTERS.includes(statusParam as FacilityStatusFilter)
        ? statusParam as FacilityStatusFilter
        : '';
    setStatus(next);
    setPage(1);
  }, [statusParam]);

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
        condition: (condition || undefined) as any,
        surfaceType: (surfaceType || undefined) as any,
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
  }, [page, limit, debouncedSearch, status, city, condition, surfaceType, sort]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, city, condition, surfaceType, sort]);

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setCity('');
    setCondition('');
    setSurfaceType('');
    setSort('courtCount_desc');
    setPage(1);
  };

  const handleOpenStatusModal = (facility: Facility, newStatus: 'ACTIVE' | 'SUSPENDED') => {
    setStatusModalFacility(facility);
    setTargetStatus(newStatus);
  };

  const handleConfirmStatusChange = async (
    facilityId: number,
    newStatus: 'ACTIVE' | 'SUSPENDED',
    details?: { reason?: string; note?: string }
  ) => {
    try {
      const res = await adminFacilityService.updateFacilityStatus(facilityId, newStatus, details);
      addToast('success', res.message || `Cơ sở đã được cập nhật sang trạng thái ${newStatus}`);
      loadFacilities();
    } catch (err: any) {
      addToast('error', err.message || 'Không thể cập nhật trạng thái cơ sở');
      throw err;
    }
  };

  const handleDeleteFacility = (facility: Facility) => {
    setDeleteFacilityError('');
    setDeleteFacilityTarget(facility);
  };

  const confirmDeleteFacility = async () => {
    if (!deleteFacilityTarget) return;
    setDeleteFacilityBusy(true);
    setDeleteFacilityError('');
    try {
      await adminFacilityService.deleteFacility(deleteFacilityTarget.id);
      addToast('success', `Đã vô hiệu hóa cơ sở "${deleteFacilityTarget.name}" thành công`);
      setDeleteFacilityTarget(null);
      loadFacilities();
    } catch (err: any) {
      setDeleteFacilityError(err.message || 'Không thể vô hiệu hóa cơ sở');
    } finally {
      setDeleteFacilityBusy(false);
    }
  };

  // Full multi-page dataset export handler
  const fetchAllFacilitiesForExport = async (): Promise<Facility[]> => {
    const pageSize = 100;
    const baseParams = {
      search: search || undefined,
      status: status || undefined,
      city: city || undefined,
      condition: (condition || undefined) as any,
      surfaceType: (surfaceType || undefined) as any,
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
    <div className="flex min-h-svh bg-background font-sans text-foreground">
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
      <AdminMain isCollapsed={isCollapsed}>
        {/* Global Admin Header */}
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(!isMobileOpen)}
        />

        {/* Page Inner Container */}
        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6"
        >
          <header className="space-y-4"><div className="space-y-2"><h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Quản lý cơ sở & Cụm sân thi đấu</h1><p className="max-w-3xl text-sm text-muted-foreground">Theo dõi cơ sở, sân và hồ sơ duyệt trên nền tảng SmashPro.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={handleExportExcel}><Download aria-hidden="true" />Xuất Excel</Button><Button onClick={() => setIsCreateModalOpen(true)}><Plus aria-hidden="true" />Thêm cơ sở mới</Button></div></header>

          {/* 4 Bento Metric Cards */}
          <FacilityMetricCards stats={stats} />
          <FacilityHandoverPanel admin changed={loadFacilities} />

          {/* Filters & Search Toolbar */}
          <FacilityFiltersToolbar
            search={search}
            onSearchChange={setSearch}
            status={status}
            onStatusChange={setStatus}
            city={city}
            onCityChange={setCity}
            condition={condition}
            onConditionChange={setCondition}
            surfaceType={surfaceType}
            onSurfaceTypeChange={setSurfaceType}
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
            onOpenProfile={(facility) => setProfileFacilityId(facility.id)}
            filterSummaryText={city ? `TP. ${city} (Khớp ${totalFacilities} cụm sân)` : `Toàn quốc (Khớp ${totalFacilities} cụm sân)`}
          />

          {/* Table Pagination */}
          <TablePagination
            page={page}
            limit={limit}
            total={totalFacilities}
            totalPages={totalPages}
            totalLabel="cụm sân"
            onPageChange={setPage}
            onLimitChange={setLimit}
          />

          {/* Compliance & SLA Policy Banner */}
          <FacilityComplianceBanner />
        </main>
      </AdminMain>

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

      <FacilityCourtProfileDialog
        isOpen={profileFacilityId !== null}
        facilityId={profileFacilityId}
        onClose={() => setProfileFacilityId(null)}
        onSaved={loadFacilities}
      />

      {deleteFacilityTarget && <ConfirmDialog
        title="Vô hiệu hóa cơ sở?"
        description={<>Bạn có chắc chắn muốn vô hiệu hóa cơ sở <strong>{deleteFacilityTarget.name}</strong> và toàn bộ các sân trực thuộc?</>}
        error={deleteFacilityError}
        busy={deleteFacilityBusy}
        tone="danger"
        confirmLabel="Vô hiệu hóa"
        busyLabel="Đang xử lý..."
        onCancel={() => setDeleteFacilityTarget(null)}
        onConfirm={() => void confirmDeleteFacility()}
      />}
    </div>
  );
};
