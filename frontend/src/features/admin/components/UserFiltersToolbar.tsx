import React from 'react';
import { FilterToolbar } from '@/components/common/filter-toolbar';
import type { FilterSelectConfig, ActiveFilterChip } from '@/components/common/filter-toolbar';
import type { UserRole, UserStatus, UserSortOption } from '../types/user';

interface UserFiltersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  role: UserRole | '';
  onRoleChange: (value: UserRole | '') => void;
  status: UserStatus | '';
  onStatusChange: (value: UserStatus | '') => void;
  sort: UserSortOption | '';
  onSortChange: (value: UserSortOption | '') => void;
  totalCount: number;
  onClearFilters: () => void;
}

export const UserFiltersToolbar: React.FC<UserFiltersToolbarProps> = ({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  sort,
  onSortChange,
  totalCount,
  onClearFilters,
}) => {
  const getRoleLabel = (r: UserRole | '') => {
    switch (r) {
      case 'PLAYER':
        return 'Vai trò: VĐV (Player)';
      case 'COURT_OWNER':
        return 'Vai trò: Chủ sân (Court Owner)';
      case 'ADMIN':
        return 'Vai trò: Quản trị viên (Admin)';
      default:
        return '';
    }
  };

  const getStatusLabel = (s: UserStatus | '') => {
    switch (s) {
      case 'ACTIVE':
        return 'Trạng thái: Hoạt động (ACTIVE)';
      case 'SUSPENDED':
        return 'Trạng thái: Tạm đình chỉ (SUSPENDED)';
      case 'DEACTIVATED':
        return 'Trạng thái: Đã vô hiệu hóa (DEACTIVATED)';
      default:
        return '';
    }
  };

  const getSortLabel = (s: UserSortOption | '') => {
    switch (s) {
      case 'newest':
        return 'Sắp xếp: Mới gia nhập nhất';
      case 'oldest':
        return 'Sắp xếp: Gia nhập sớm nhất';
      case 'name_asc':
        return 'Sắp xếp: Tên A - Z';
      case 'name_desc':
        return 'Sắp xếp: Tên Z - A';
      default:
        return '';
    }
  };

  const filters: FilterSelectConfig[] = [
    {
      id: 'role',
      value: role,
      placeholder: 'Tất cả vai trò',
      ariaLabel: 'Lọc theo vai trò',
      options: [
        { value: 'PLAYER', label: 'VĐV (Player)' },
        { value: 'COURT_OWNER', label: 'Chủ sân (Court Owner)' },
        { value: 'ADMIN', label: 'Quản trị viên (Admin)' },
      ],
      onChange: (val) => onRoleChange(val as UserRole | ''),
    },
    {
      id: 'status',
      value: status,
      placeholder: 'Tất cả trạng thái',
      ariaLabel: 'Lọc theo trạng thái',
      options: [
        { value: 'ACTIVE', label: 'Hoạt động (ACTIVE)' },
        { value: 'SUSPENDED', label: 'Tạm đình chỉ (SUSPENDED)' },
        { value: 'DEACTIVATED', label: 'Đã vô hiệu hóa (DEACTIVATED)' },
      ],
      onChange: (val) => onStatusChange(val as UserStatus | ''),
    },
    {
      id: 'sort',
      value: sort || 'newest',
      ariaLabel: 'Sắp xếp danh sách',
      options: [
        { value: 'newest', label: 'Mới gia nhập nhất' },
        { value: 'oldest', label: 'Gia nhập sớm nhất' },
        { value: 'name_asc', label: 'Tên A - Z' },
        { value: 'name_desc', label: 'Tên Z - A' },
      ],
      onChange: (val) => onSortChange(val as UserSortOption | ''),
    },
  ];

  const activeChips: ActiveFilterChip[] = [];
  if (role) {
    activeChips.push({
      id: 'role',
      label: getRoleLabel(role),
      onRemove: () => onRoleChange(''),
    });
  }
  if (status) {
    activeChips.push({
      id: 'status',
      label: getStatusLabel(status),
      onRemove: () => onStatusChange(''),
    });
  }
  if (sort && sort !== 'newest') {
    activeChips.push({
      id: 'sort',
      label: getSortLabel(sort),
      onRemove: () => onSortChange('newest'),
    });
  }

  return (
    <FilterToolbar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: 'Tìm theo họ tên, email, SĐT, mã định danh...',
      }}
      filters={filters}
      activeChips={activeChips}
      totalCount={totalCount}
      totalCountLabel="người dùng"
      onClearAll={activeChips.length > 0 || search ? onClearFilters : undefined}
    />
  );
};
