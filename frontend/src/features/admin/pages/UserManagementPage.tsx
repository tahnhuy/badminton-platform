import { AdminMain } from '../components/AdminMain';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { UserMetricCards } from '../components/UserMetricCards';
import { UserFiltersToolbar } from '../components/UserFiltersToolbar';
import { UserTable } from '../components/UserTable';
import { TablePagination } from '../components/TablePagination';
import { UserDetailsModal } from '../components/UserDetailsModal';
import { UserStatusModal } from '../components/UserStatusModal';
import { ResetPasswordModal } from '../components/ResetPasswordModal';
import { DeleteUserModal } from '../components/DeleteUserModal';
import { CreateUserModal } from '../components/CreateUserModal';
import { ToastContainer } from '../components/Toast';
import type { ToastMessage } from '../components/Toast';
import { UserManagementActions } from '../components/UserManagementActions';
import type { User, UserRole, UserStatus, UserSortOption, CreateUserPayload, UserStats } from '../types/user';
import { adminUserService } from '../services/adminUserService';
import { exportUsersToExcel } from '../utils/excelExport';

export const UserManagementPage: React.FC = () => {
  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, suspended: 0, deactivated: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [sort, setSort] = useState<UserSortOption | ''>('newest');

  // Debounced search value used for API calls (avoids a request per keystroke)
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Guards against out-of-order responses overwriting newer results
  const requestIdRef = useRef(0);

  // Selected table row IDs
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Desktop Sidebar collapse state & Mobile Drawer state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modals state
  const [selectedUserForDetails, setSelectedUserForDetails] = useState<User | null>(null);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<User | null>(null);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);
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

  // Debounce the search box before hitting the API
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users from API
  const loadUsers = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      setIsLoading(true);
      const res = await adminUserService.fetchUsers({
        page,
        limit,
        search: debouncedSearch || undefined,
        role: role || undefined,
        status: status || undefined,
        sort: sort || undefined,
      });

      if (requestId !== requestIdRef.current) return;

      setUsers(res.data || []);
      setTotalUsers(res.pagination?.total ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      console.error('API fetch users error:', err);
      addToast('error', `Lỗi khi tải dữ liệu người dùng: ${err.message || 'Không thể kết nối máy chủ'}`);
      setUsers([]);
      setTotalUsers(0);
      setTotalPages(1);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, limit, debouncedSearch, role, status, sort]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Checkbox handlers
  const handleSelectToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === users.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setRole('');
    setStatus('');
    setSort('newest');
    setPage(1);
  };

  // 4. Export to Excel Handler (paginates through every page, no silent truncation)
  const fetchAllUsersForExport = async (): Promise<User[]> => {
    const pageSize = 500;
    const baseParams = {
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
      sort: sort || undefined,
    };

    const first = await adminUserService.fetchUsers({ page: 1, limit: pageSize, ...baseParams });
    const all = [...(first.data || [])];
    const totalPages = first.pagination?.totalPages ?? 1;

    for (let nextPage = 2; nextPage <= totalPages; nextPage++) {
      const next = await adminUserService.fetchUsers({ page: nextPage, limit: pageSize, ...baseParams });
      all.push(...(next.data || []));
    }

    return all;
  };

  const handleExportExcel = async () => {
    try {
      addToast('info', 'Đang tạo và tải file Excel danh sách người dùng...');
      const fetched = await fetchAllUsersForExport();
      const usersToExport = fetched.length > 0 ? fetched : users;
      exportUsersToExcel(usersToExport, `danh-sach-nguoi-dung-smashpro-${Date.now()}.xls`);
      addToast('success', `Đã xuất thành công ${usersToExport.length} tài khoản ra file Excel!`);
    } catch (err: any) {
      addToast('error', `Lỗi khi xuất Excel: ${err.message}`);
    }
  };

  // 5. Bulk Actions Handlers
  const handleBulkStatus = async (targetStatus: UserStatus) => {
    if (selectedIds.length === 0) {
      addToast('info', 'Vui lòng tích chọn ít nhất 1 người dùng trên bảng để thực hiện tác vụ.');
      return;
    }
    try {
      const res = await adminUserService.bulkUpdateStatus(selectedIds, targetStatus);
      addToast('success', `Đã cập nhật trạng thái ${targetStatus} cho ${res.affectedCount} tài khoản!`);
      setSelectedIds([]);
      loadUsers();
    } catch (err: any) {
      addToast('error', `Lỗi tác vụ hàng loạt: ${err.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      addToast('info', 'Vui lòng tích chọn ít nhất 1 người dùng trên bảng để thực hiện tác vụ.');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mềm (Soft-delete) ${selectedIds.length} tài khoản đã chọn?`)) {
      return;
    }
    try {
      const res = await adminUserService.bulkDeleteUsers(selectedIds);
      addToast('success', `Đã xóa mềm thành công ${res.affectedCount} tài khoản!`);
      setSelectedIds([]);
      loadUsers();
    } catch (err: any) {
      addToast('error', `Lỗi khi xóa hàng loạt: ${err.message}`);
    }
  };

  // 6. Create User Handler
  const handleCreateUser = async (payload: CreateUserPayload) => {
    await adminUserService.createUser(payload);
    addToast('success', `Đã tạo tài khoản ${payload.email} thành công!`);
    loadUsers();
  };

  // Status mutation action
  const handleConfirmStatus = async (userId: number, newStatus: UserStatus) => {
    await adminUserService.updateUserStatus(userId, newStatus);
    addToast('success', `Đã cập nhật trạng thái người dùng thành ${newStatus}!`);
    loadUsers();
  };

  // Password reset action
  const handleConfirmResetPassword = async (userId: number, newPass: string) => {
    await adminUserService.resetPassword(userId, newPass);
    addToast('success', 'Đã đặt lại mật khẩu mới cho người dùng thành công!');
  };

  // Soft delete action
  const handleConfirmDelete = async (userId: number) => {
    await adminUserService.deleteUser(userId);
    addToast('success', 'Đã chuyển tài khoản sang trạng thái Soft Delete!');
    loadUsers();
  };

  return (
    <div className="flex min-h-svh bg-background font-sans text-foreground">
      {/* Left Navigation Sidebar */}
      <AdminSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      {/* Main Content Area */}
      <AdminMain isCollapsed={isCollapsed}>
        {/* Top Header */}
        <AdminHeader
          isCollapsed={isCollapsed}
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
        />

        {/* Content Container */}
        <main id="admin-main-content" tabIndex={-1}
          className="mx-auto flex w-full min-w-0 max-w-360 flex-col gap-6 px-4 pb-16 pt-24 sm:px-6"
        >
          {/* Top Page Metadata Header */}
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              {/* Page Title */}
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Quản lý người dùng hệ thống
              </h1>

              {/* Subtitle */}
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                Giám sát, phân quyền và kiểm duyệt tài khoản Vận Động Viên (Player) & Chủ Cơ Sở (Court Owner) trên toàn nền tảng SmashPro.
              </p>
            </div>

            <UserManagementActions
              selectedCount={selectedIds.length}
              onExport={handleExportExcel}
              onBulkStatus={handleBulkStatus}
              onBulkDelete={handleBulkDelete}
              onAddUser={() => setIsCreateModalOpen(true)}
            />
          </div>

          {/* Metric Cards Bento Grid */}
          <UserMetricCards
            totalUsers={stats.total}
            activeCount={stats.active}
            suspendedCount={stats.suspended}
            deactivatedCount={stats.deactivated}
          />

          {/* Filter & Search Toolbar Container (Chức năng 8: Sort) */}
          <UserFiltersToolbar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            role={role}
            onRoleChange={(val) => {
              setRole(val);
              setPage(1);
            }}
            status={status}
            onStatusChange={(val) => {
              setStatus(val);
              setPage(1);
            }}
            sort={sort}
            onSortChange={(val) => {
              setSort(val);
              setPage(1);
            }}
            totalCount={totalUsers}
            onClearFilters={handleClearFilters}
          />

          {/* User Management Data Table Card */}
          <UserTable
            users={users}
            isLoading={isLoading}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            onSelectAllToggle={handleSelectAllToggle}
            onViewDetails={(u) => setSelectedUserForDetails(u)}
            onChangeStatus={(u) => setSelectedUserForStatus(u)}
            onResetPassword={(u) => setSelectedUserForPassword(u)}
            onDeleteUser={(u) => setSelectedUserForDelete(u)}
          />

          {/* Table Pagination Footer */}
          <TablePagination
            page={page}
            limit={limit}
            total={totalUsers}
            totalPages={totalPages}
            onPageChange={(p) => setPage(p)}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </main>
      </AdminMain>

      {/* Modals */}
      <CreateUserModal
        key={isCreateModalOpen ? 'create-open' : 'create-closed'}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {}}
        onSubmit={handleCreateUser}
      />

      <UserDetailsModal
        user={selectedUserForDetails}
        onClose={() => setSelectedUserForDetails(null)}
        onEditStatus={(u) => {
          setSelectedUserForDetails(null);
          setSelectedUserForStatus(u);
        }}
        onResetPassword={(u) => {
          setSelectedUserForDetails(null);
          setSelectedUserForPassword(u);
        }}
        onDeleteUser={(u) => {
          setSelectedUserForDetails(null);
          setSelectedUserForDelete(u);
        }}
      />

      <UserStatusModal
        user={selectedUserForStatus}
        onClose={() => setSelectedUserForStatus(null)}
        onConfirm={handleConfirmStatus}
      />

      <ResetPasswordModal
        key={selectedUserForPassword?.id ?? 'reset-none'}
        user={selectedUserForPassword}
        onClose={() => setSelectedUserForPassword(null)}
        onConfirm={handleConfirmResetPassword}
      />

      <DeleteUserModal
        key={selectedUserForDelete?.id ?? 'delete-none'}
        user={selectedUserForDelete}
        onClose={() => setSelectedUserForDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};
