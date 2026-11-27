/** Demo venues (Ho Chi Minh City). Prices are per hour; ranges cover the opening hours. */
export interface DemoCourt {
  name: string;
  surfaceType: 'PVC' | 'WOOD' | 'PU_ACRYLIC' | 'OTHER';
  surfaceBrand?: string;
  surfaceThicknessMm?: number;
  condition?: 'NORMAL' | 'NEEDS_MAINTENANCE' | 'UNDER_MAINTENANCE';
  conditionNote?: string;
}

export interface DemoFacility {
  ownerKey: string;
  /** ACTIVE = approved by Admin; PENDING = waiting for review; REJECTED = review rejected. */
  review: 'APPROVED' | 'PENDING' | 'REJECTED';
  rejectionReason?: string;
  createdDaysAgo: number;
  name: string;
  description: string;
  phone: string;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  openingTime: string;
  closingTime: string;
  prices: Array<{ start: string; end: string; price: number }>;
  courts: DemoCourt[];
}

const courtsOf = (count: number, base: Omit<DemoCourt, 'name'>, overrides: Record<number, Partial<DemoCourt>> = {}): DemoCourt[] =>
  Array.from({ length: count }, (_, i) => ({ ...base, name: `Sân ${String(i + 1).padStart(2, '0')}`, ...overrides[i + 1] }));

export const DEMO_FACILITIES: DemoFacility[] = [
  {
    ownerKey: 'owner1', review: 'APPROVED', createdDaysAgo: 148,
    name: 'CLB Cầu Lông Phúc Thịnh Quận 7',
    description: 'Cụm 8 sân thảm PVC tiêu chuẩn thi đấu, có phòng thay đồ, căng-tin và bãi giữ xe máy miễn phí.',
    phone: '0901234567', address: '18D Huỳnh Tấn Phát', ward: 'Tân Thuận Đông', district: 'Quận 7', city: 'Hồ Chí Minh',
    openingTime: '05:30', closingTime: '23:00',
    prices: [{ start: '05:30', end: '17:00', price: 80_000 }, { start: '17:00', end: '23:00', price: 120_000 }],
    courts: courtsOf(8, { surfaceType: 'PVC', surfaceBrand: 'Yonex', surfaceThicknessMm: 4.5, condition: 'NORMAL' }, {
      8: { condition: 'UNDER_MAINTENANCE', conditionNote: 'Đang thay thảm mới, dự kiến xong trong tuần.' },
    }),
  },
  {
    ownerKey: 'owner2', review: 'APPROVED', createdDaysAgo: 138,
    name: 'Sân Cầu Lông Tân Bình Pro',
    description: 'Trung tâm 12 sân sàn gỗ, trần cao 9 m, hệ thống đèn chống chói. Có lớp huấn luyện cho người mới.',
    phone: '0912345678', address: '102 Cộng Hòa', ward: 'Phường 4', district: 'Tân Bình', city: 'Hồ Chí Minh',
    openingTime: '05:00', closingTime: '23:30',
    prices: [{ start: '05:00', end: '16:00', price: 100_000 }, { start: '16:00', end: '23:30', price: 150_000 }],
    courts: courtsOf(12, { surfaceType: 'WOOD', surfaceBrand: 'Victor', surfaceThicknessMm: 22, condition: 'NORMAL' }, {
      12: { condition: 'NEEDS_MAINTENANCE', conditionNote: 'Một số tấm sàn bị cong nhẹ ở cuối sân.' },
    }),
  },
  {
    ownerKey: 'owner3', review: 'APPROVED', createdDaysAgo: 128,
    name: 'CLB Cầu Lông Hoàng Thành Quận 10',
    description: 'Sân nhỏ thân thiện trong khu dân cư, giá mềm, phù hợp nhóm bạn chơi phong trào buổi tối.',
    phone: '0987654321', address: '245 Thành Thái', ward: 'Phường 14', district: 'Quận 10', city: 'Hồ Chí Minh',
    openingTime: '06:00', closingTime: '22:00',
    prices: [{ start: '06:00', end: '17:00', price: 70_000 }, { start: '17:00', end: '22:00', price: 110_000 }],
    courts: courtsOf(6, { surfaceType: 'PU_ACRYLIC', condition: 'NORMAL' }),
  },
  {
    ownerKey: 'owner4', review: 'PENDING', createdDaysAgo: 5,
    name: 'Sân Cầu Lông Thanh Đa',
    description: 'Cụm 4 sân mới khai trương cạnh bán đảo Thanh Đa.',
    phone: '0938765432', address: '9 Bình Quới', ward: 'Phường 27', district: 'Bình Thạnh', city: 'Hồ Chí Minh',
    openingTime: '06:00', closingTime: '22:00',
    prices: [{ start: '06:00', end: '17:00', price: 75_000 }, { start: '17:00', end: '22:00', price: 115_000 }],
    courts: courtsOf(4, { surfaceType: 'PVC', condition: 'NORMAL' }),
  },
  {
    ownerKey: 'owner4', review: 'REJECTED', createdDaysAgo: 6,
    rejectionReason: 'Địa chỉ chưa khớp giấy phép kinh doanh, vui lòng bổ sung số nhà chính xác.',
    name: 'Sân Cầu Lông Thanh Đa 2',
    description: 'Chi nhánh thứ hai (đang hoàn thiện hồ sơ).',
    phone: '0938765432', address: 'Bình Quới', ward: null, district: 'Bình Thạnh', city: 'Hồ Chí Minh',
    openingTime: '06:00', closingTime: '22:00',
    prices: [],
    courts: [],
  },
];
