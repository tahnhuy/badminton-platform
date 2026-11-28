export type FacilityStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL' | 'REJECTED';
export type FacilityStatusFilter = FacilityStatus | 'DISABLED';
export type FacilitySortOption = 'courtCount_desc' | 'courtCount_asc' | 'newest' | 'oldest' | 'name_asc' | 'name_desc';
export type FacilityDataSource = 'OWNER_DECLARED' | 'ADMIN_ENTERED' | 'GOOGLE_PLACES_IMPORT' | 'DEMO_SEED';

export interface FacilityOwner {
  id: number;
  name: string;
  phone: string;
  email: string;
}

export interface CourtConditionSummary {
  NORMAL: number;
  NEEDS_MAINTENANCE: number;
  UNDER_MAINTENANCE: number;
  UNSPECIFIED: number;
}

export interface CourtStats {
  totalCourts: number;
  activeCourts: number;
  conditionSummary: CourtConditionSummary;
}

export interface CourtStandardSummary {
  id: number; standardCode: string; standardName: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'INVALIDATED'; expiresAt: string | null;
}

export interface Court {
  id: number;
  name: string;
  status: string;
  description: string | null;
  surfaceType: string | null;
  surfaceBrand: string | null;
  surfaceModel: string | null;
  surfaceThicknessMm: string | null;
  condition: string | null;
  conditionNote: string | null;
  latestReview?: { id: number; status: string; submittedAt: string } | null;
  standardClaims?: CourtStandardSummary[];
  profileVersion: number;
  dataSource: FacilityDataSource | null;
  confirmedAt: string | null;
  deletedAt: string | null;
}

export interface CourtProfileChange {
  id: number;
  changeType: 'PROFILE' | 'CONDITION';
  beforeValues: Record<string, unknown>;
  afterValues: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
  actorId: number;
  actorEmail: string | null;
}

export interface Facility {
  id: number;
  facilityCode: string;
  name: string;
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
  isDisabled: boolean;
  dataSource: FacilityDataSource | null;
  sourceRef: string | null;
  confirmedAt: string | null;
  imageUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  courts?: Court[];
}

export interface FacilityStats {
  totalFacilities: number;
  provincesCovered: number;
  newFacilitiesThisQuarter: number;
  totalActiveCourts: number;
  activeFacilities: number;
  activeFacilityRate: number;
  suspendedFacilities: number;
  unconfirmedSampleFacilities: number;
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
  status?: FacilityStatusFilter | '';
  city?: string;
  condition?: 'NORMAL' | 'NEEDS_MAINTENANCE' | 'UNDER_MAINTENANCE' | 'UNSPECIFIED' | '';
  surfaceType?: 'PVC' | 'WOOD' | 'PU_ACRYLIC' | 'OTHER' | '';
  sort?: FacilitySortOption | '';
}
