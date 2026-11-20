import React from 'react';
import { FilterToolbar } from '@/components/common/filter-toolbar';
import type { FilterSelectConfig, ActiveFilterChip } from '@/components/common/filter-toolbar';
import type { FacilityStatus, FacilitySortOption } from '../../types/facility';

interface FacilityFiltersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: FacilityStatus | '';
  onStatusChange: (value: FacilityStatus | '') => void;
  city: string;
  onCityChange: (value: string) => void;
  bwfStandard: string;
  onBwfStandardChange: (value: string) => void;
  sort: FacilitySortOption | '';
  onSortChange: (value: FacilitySortOption | '') => void;
  onReset: () => void;
  totalCount?: number;
}

export const FacilityFiltersToolbar: React.FC<FacilityFiltersToolbarProps> = ({
  search,
  onSearchChange,
  status,
  onStatusChange,
  city,
  onCityChange,
  bwfStandard,
  onBwfStandardChange,
  sort,
  onSortChange,
  onReset,
  totalCount,
}) => {
  const getStatusLabel = (s: FacilityStatus | '') => {
    switch (s) {
      case 'PENDING_APPROVAL': return 'Chờ duyệt';
      case 'REJECTED': return 'Bị từ chối';
      case 'ACTIVE':
        return 'Trạng thái: Hoạt động (ACTIVE)';
      case 'SUSPENDED':
        return 'Trạng thái: Tạm đình chỉ (SUSPENDED)';
      default:
        return '';
    }
  };

  const getSortLabel = (s: FacilitySortOption | '') => {
    switch (s) {
      case 'courtCount_desc':
        return 'Sắp xếp: Quy mô số sân giảm dần';
      case 'courtCount_asc':
        return 'Sắp xếp: Quy mô số sân tăng dần';
      case 'newest':
        return 'Sắp xếp: Mới nhất';
      case 'oldest':
        return 'Sắp xếp: Cũ nhất';
      case 'name_asc':
        return 'Sắp xếp: Tên cơ sở A - Z';
      default:
        return '';
    }
  };

  const filters: FilterSelectConfig[] = [
    {
      id: 'city',
      value: city,
      placeholder: 'Tất cả tỉnh / thành',
      ariaLabel: 'Lọc theo tỉnh thành',
      options: [
        { value: 'Hồ Chí Minh', label: 'TP. Hồ Chí Minh' },
        { value: 'Hà Nội', label: 'Hà Nội' },
        { value: 'Đà Nẵng', label: 'Đà Nẵng' },
        { value: 'Cần Thơ', label: 'Cần Thơ' },
        { value: 'Hải Phòng', label: 'Hải Phòng' },
        { value: 'Bình Dương', label: 'Bình Dương' },
      ],
      onChange: (val) => onCityChange(val),
    },
    {
      id: 'status',
      value: status,
      placeholder: 'Tất cả trạng thái',
      ariaLabel: 'Lọc theo trạng thái',
      options: [
        { value: 'ACTIVE', label: 'Đang hoạt động (ACTIVE)' },
        { value: 'SUSPENDED', label: 'Tạm đình chỉ (SUSPENDED)' },
        { value: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
        { value: 'REJECTED', label: 'Bị từ chối' },
      ],
      onChange: (val) => onStatusChange(val as FacilityStatus | ''),
    },
    {
      id: 'bwfStandard',
      value: bwfStandard,
      placeholder: 'Tất cả tiêu chuẩn',
      ariaLabel: 'Lọc theo tiêu chuẩn sân',
      options: [
        { value: 'Grade 1', label: 'BWF Grade 1 Hub' },
        { value: 'Grade 2', label: 'BWF Grade 2' },
        { value: 'Standard', label: 'Tiêu chuẩn phong trào' },
      ],
      onChange: (val) => onBwfStandardChange(val),
    },
    {
      id: 'sort',
      value: sort || 'courtCount_desc',
      ariaLabel: 'Sắp xếp danh sách',
      options: [
        { value: 'courtCount_desc', label: 'Quy mô số sân giảm dần' },
        { value: 'courtCount_asc', label: 'Quy mô số sân tăng dần' },
        { value: 'newest', label: 'Mới nhất' },
        { value: 'oldest', label: 'Cũ nhất' },
        { value: 'name_asc', label: 'Tên cơ sở (A - Z)' },
      ],
      onChange: (val) => onSortChange(val as FacilitySortOption | ''),
    },
  ];

  const activeChips: ActiveFilterChip[] = [];

  if (city) {
    activeChips.push({
      id: 'city',
      label: `Khu vực: ${city}`,
      onRemove: () => onCityChange(''),
    });
  }

  if (status) {
    activeChips.push({
      id: 'status',
      label: getStatusLabel(status),
      onRemove: () => onStatusChange(''),
    });
  }

  if (bwfStandard) {
    const standardLabel =
      bwfStandard === 'Standard'
        ? 'Tiêu chuẩn: Phong trào (Standard)'
        : `Tiêu chuẩn: BWF ${bwfStandard}`;
    activeChips.push({
      id: 'bwfStandard',
      label: standardLabel,
      onRemove: () => onBwfStandardChange(''),
    });
  }

  if (sort && sort !== 'courtCount_desc') {
    activeChips.push({
      id: 'sort',
      label: getSortLabel(sort),
      onRemove: () => onSortChange('courtCount_desc'),
    });
  }

  return (
    <FilterToolbar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: 'Tìm tên CLB, người đại diện, địa chỉ, mã (FAC-)...',
      }}
      filters={filters}
      activeChips={activeChips}
      totalCount={totalCount}
      totalCountLabel="cơ sở phù hợp"
      onClearAll={onReset}
    />
  );
};
