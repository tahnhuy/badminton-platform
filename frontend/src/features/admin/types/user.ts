export type UserRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type UserSortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export interface PlayerProfile {
  userId: number;
  fullName: string;
  skillLevelId: number;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourtOwnerProfile {
  userId: number;
  businessName: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: PlayerProfile | CourtOwnerProfile | null;
  fairPlayScore?: number;
  courtCount?: number;
  kycStatus?: 'APPROVED_BWF' | 'APPROVED_CCCD' | 'APPROVED_GPKD' | 'UNVERIFIED';
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  deactivated: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserListResponse {
  data: User[];
  pagination: Pagination;
  stats?: UserStats;
}

export interface UserDetailResponse {
  data: User;
}

export interface UserFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
  sort?: UserSortOption | '';
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  fullName?: string;
  skillLevelId?: number;
  avatarUrl?: string;
  businessName?: string;
  phone?: string;
}
