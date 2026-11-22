export type FacilityStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'REJECTED';
export type FacilitySortOption = 'courtCount_desc' | 'courtCount_asc' | 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export interface FacilityOwner {
  id: number;
  name: string;
  phone: string;
  email: string;
}

export interface CourtStats {
  totalCourts: number;
  surfaceSummary: string;
  specNote: string;
}

export interface Court {
  id: number;
  name: string;
  status: string;
  description: string | null;
  deletedAt: string | null;
}

export interface Facility {
  id: number;
  facilityCode: string;
  name: string;
  grade: string;
  address: string;
  city: string;
  district: string;
  ward: string | null;
  phone: string;
  description: string | null;
  openingTime: string;
  closingTime: string;
  owner: FacilityOwner;
  courtStats: CourtStats;
  status: FacilityStatus;
  statusNote: string;
  imageUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  courts?: Court[];
}

export interface FacilityStats {
  totalFacilities: number;
  provincesCovered: number;
  quarterGrowth: number;
  totalBwfCourts: number;
  yonexCount: number;
  pvcCount: number;
  activeFacilities: number;
  sellingRate: number;
  suspendedFacilities: number;
  pendingViolations: number;
}

export interface FacilityPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FacilityListResponse {
  data: {
    items: Facility[];
    stats: FacilityStats;
    meta: FacilityPagination;
  };
}

export interface FacilityFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FacilityStatus | '';
  city?: string;
  bwfStandard?: string;
  sort?: FacilitySortOption | '';
}
