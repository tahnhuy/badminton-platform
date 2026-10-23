import {
  facilityRepository,
  FacilityRepository,
  FacilityFilterOptions,
  FacilityWithDetails,
  CreateFacilityData,
} from '../../repositories/facility/FacilityRepository';
import { NotFoundError } from '../../errors/AppError';

export interface AdminFacilityDTO {
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
  owner: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  courtStats: {
    totalCourts: number;
    surfaceSummary: string;
    specNote: string;
  };
  status: string;
  statusNote: string;
  imageUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  courts?: {
    id: number;
    name: string;
    status: string;
    description: string | null;
    deletedAt: Date | null;
  }[];
}

export class AdminFacilityService {
  constructor(private readonly repo: FacilityRepository = facilityRepository) {}

  private generateFacilityCode(city: string, id: number): string {
    let cityCode = 'SGN';
    const lower = (city || '').toLowerCase();
    if (lower.includes('hà nội') || lower.includes('ha noi')) {
      cityCode = 'HAN';
    } else if (lower.includes('đà nẵng') || lower.includes('da nang')) {
      cityCode = 'DAD';
    } else if (lower.includes('hồ chí minh') || lower.includes('ho chi minh') || lower.includes('hcm')) {
      cityCode = 'SGN';
    } else if (lower.includes('cần thơ') || lower.includes('can tho')) {
      cityCode = 'VCA';
    } else if (lower.includes('hải phòng') || lower.includes('hai phong')) {
      cityCode = 'HPH';
    } else if (lower.includes('bình dương') || lower.includes('binh duong')) {
      cityCode = 'BDG';
    }
    const padded = String(id).padStart(3, '0');
    return `#FAC-${cityCode}-${padded}`;
  }

  private mapToDTO(facility: FacilityWithDetails): AdminFacilityDTO {
    const isSuspended = facility.status === 'SUSPENDED' || facility.deletedAt !== null;
    const courtCount = facility.courtCount || (facility.courts ? facility.courts.filter(c => !c.deletedAt).length : 0);

    // Formatted surface & BWF specs
    let grade = courtCount >= 14 ? 'Grade 1 Hub' : courtCount >= 6 ? 'Grade 2' : 'Standard';
    let surfaceSummary = `${Math.ceil(courtCount * 0.6)} Yonex Tournament, ${Math.floor(courtCount * 0.4)} Enlio PVC`;
    if (courtCount >= 16) {
      surfaceSummary = '100% Thảm Yonex Pro';
    } else if (courtCount < 6) {
      surfaceSummary = 'Thảm PVC Tiêu chuẩn phong trào';
    }

    let statusNote = 'Đang mở bán Slot P06';

    if (facility.status === 'PENDING_APPROVAL') statusNote = 'Chờ duyệt, chưa nhận đặt sân';
    else if (facility.status === 'REJECTED') statusNote = 'Hồ sơ bị từ chối, chưa nhận đặt sân';
    else if (isSuspended) {
      statusNote = 'Khóa tạo giải & ca mới';
    } else if (courtCount >= 16) {
      statusNote = 'Flagship Arena Hub';
    }

    return {
      id: facility.id,
      facilityCode: this.generateFacilityCode(facility.city, facility.id),
      name: facility.name,
      grade,
      address: facility.address,
      city: facility.city,
      district: facility.district,
      ward: facility.ward,
      phone: facility.phone,
      description: facility.description,
      openingTime: facility.openingTime,
      closingTime: facility.closingTime,
      owner: {
        id: facility.owner.id,
        name: facility.owner.fullName || 'Chủ sân SmashPro',
        phone: facility.owner.phone || facility.phone,
        email: facility.owner.email,
      },
      courtStats: {
        totalCourts: courtCount,
        surfaceSummary,
        specNote: 'Độ dày thảm: 4.5mm',
      },
      status: facility.status,
      statusNote,
      imageUrl: null,
      deletedAt: facility.deletedAt,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
      courts: facility.courts?.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        description: c.description,
        deletedAt: c.deletedAt,
      })),
    };
  }

  async listFacilities(options: FacilityFilterOptions) {
    const [{ items, total }, stats] = await Promise.all([
      this.repo.findAll(options),
      this.repo.getGlobalStats(),
    ]);

    const totalPages = options.limit > 0 ? Math.ceil(total / options.limit) : 0;
    const dtos = items.map((f) => this.mapToDTO(f));

    return {
      items: dtos,
      stats,
      meta: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
      },
    };
  }

  async getFacilityById(id: number): Promise<AdminFacilityDTO> {
    const facility = await this.repo.findById(id);
    if (!facility) {
      throw new NotFoundError('Facility not found', 'ADMIN_FACILITY_NOT_FOUND');
    }
    return this.mapToDTO(facility);
  }

  async updateFacilityStatus(
    id: number,
    status: 'ACTIVE' | 'SUSPENDED',
    _actorId?: number
  ): Promise<AdminFacilityDTO> {
    const updated = await this.repo.updateStatus(id, status);
    if (!updated) {
      throw new NotFoundError('Facility not found', 'ADMIN_FACILITY_NOT_FOUND');
    }
    return this.mapToDTO(updated);
  }

  async deleteFacility(id: number, _actorId?: number) {
    const res = await this.repo.softDeleteFacility(id);
    if (!res.success) {
      throw new NotFoundError('Facility not found', 'ADMIN_FACILITY_NOT_FOUND');
    }
    return res;
  }

  async updateCourtStatus(
    facilityId: number,
    courtId: number,
    status: 'ACTIVE' | 'SUSPENDED',
    _actorId?: number
  ) {
    const court = await this.repo.findCourt(facilityId, courtId);
    if (!court) {
      throw new NotFoundError('Court not found or does not belong to facility', 'ADMIN_COURT_NOT_FOUND');
    }
    const updated = await this.repo.updateCourtStatus(facilityId, courtId, status);
    return updated;
  }

  async deleteCourt(facilityId: number, courtId: number, _actorId?: number) {
    const court = await this.repo.findCourt(facilityId, courtId);
    if (!court) {
      throw new NotFoundError('Court not found or does not belong to facility', 'ADMIN_COURT_NOT_FOUND');
    }
    const res = await this.repo.softDeleteCourt(facilityId, courtId);
    return res;
  }

  async createFacility(data: CreateFacilityData): Promise<AdminFacilityDTO> {
    const created = await this.repo.createFacility(data);
    return this.mapToDTO(created);
  }
}

export const adminFacilityService = new AdminFacilityService();
