import { courtReviewSummaries } from '../../repositories/admin/CourtReviewSummaryRepository';
import {
  facilityRepository,
  FacilityRepository,
  FacilityFilterOptions,
  FacilityWithDetails,
  FacilityStatusAuditInput,
  CreateFacilityData,
} from '../../repositories/facility/FacilityRepository';
import { NotFoundError } from '../../errors/AppError';
import { db } from '../../db';
import { courtProfileRepository } from '../../repositories/facility/CourtProfileRepository';
import { applyCourtProfileUpdate, courtProfileDto } from '../facility/court-profile';
import { updateCourtProfileBodySchema } from '../../validation/admin';
import { z } from 'zod';

type CourtProfileSummary = {
  NORMAL: number;
  NEEDS_MAINTENANCE: number;
  UNDER_MAINTENANCE: number;
  UNSPECIFIED: number;
};

type CourtProfileBody = z.infer<typeof updateCourtProfileBodySchema>;

export interface AdminFacilityDTO {
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
  owner: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  courtStats: {
    totalCourts: number;
    activeCourts: number;
    conditionSummary: CourtProfileSummary;
  };
  status: string;
  isDisabled: boolean;
  dataSource: string | null;
  sourceRef: string | null;
  confirmedAt: Date | null;
  imageUrl: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  courts?: {
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
    profileVersion: number;
    dataSource: string | null;
    confirmedAt: Date | null;
    deletedAt: Date | null;
    latestReview?: { id: number; status: string; submittedAt: Date } | null;
    standardClaims?: { id: number; standardCode: string; standardName: string; status: string; expiresAt: string | null }[];
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

  private mapToDTO(facility: FacilityWithDetails, summary?: CourtProfileSummary): AdminFacilityDTO {
    const courtCount = facility.courtCount || (facility.courts ? facility.courts.filter(c => !c.deletedAt).length : 0);
    const activeCourtCount = facility.courts
      ? facility.courts.filter(c => c.status === 'ACTIVE' && !c.deletedAt).length
      : facility.activeCourtCount ?? 0;
    const conditionSummary = summary ?? this.summarizeCourts(facility.courts ?? []);

    return {
      id: facility.id,
      facilityCode: this.generateFacilityCode(facility.city, facility.id),
      name: facility.name,
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
        name: facility.owner.fullName || 'Chưa khai báo',
        phone: facility.owner.phone || facility.phone,
        email: facility.owner.email,
      },
      courtStats: {
        totalCourts: courtCount,
        activeCourts: activeCourtCount,
        conditionSummary,
      },
      status: facility.status,
      isDisabled: facility.deletedAt !== null,
      dataSource: facility.dataSource,
      sourceRef: facility.sourceRef,
      confirmedAt: facility.confirmedAt,
      imageUrl: null,
      deletedAt: facility.deletedAt,
      createdAt: facility.createdAt,
      updatedAt: facility.updatedAt,
      courts: facility.courts?.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        description: c.description,
        surfaceType: c.surfaceType ?? null,
        surfaceBrand: c.surfaceBrand ?? null,
        surfaceModel: c.surfaceModel ?? null,
        surfaceThicknessMm: c.surfaceThicknessMm ?? null,
        condition: c.condition ?? null,
        conditionNote: c.conditionNote ?? null,
        profileVersion: c.profileVersion,
        dataSource: c.dataSource,
        confirmedAt: c.confirmedAt,
        deletedAt: c.deletedAt,
      })),
    };
  }

  private summarizeCourts(courts: NonNullable<FacilityWithDetails['courts']>): CourtProfileSummary {
    const summary: CourtProfileSummary = {
      NORMAL: 0,
      NEEDS_MAINTENANCE: 0,
      UNDER_MAINTENANCE: 0,
      UNSPECIFIED: 0,
    };
    for (const court of courts) {
      if (court.deletedAt) continue;
      const key = (court.condition ?? 'UNSPECIFIED') as keyof CourtProfileSummary;
      if (key in summary) summary[key] += 1;
    }
    return summary;
  }

  async listFacilities(options: FacilityFilterOptions) {
    const [{ items, total }, stats] = await Promise.all([
      this.repo.findAll(options),
      this.repo.getGlobalStats(),
    ]);

    const totalPages = options.limit > 0 ? Math.ceil(total / options.limit) : 0;
    const summaries = await this.repo.courtConditionSummaries(items.map((item) => item.id));
    const dtos = items.map((f) => this.mapToDTO(f, summaries.get(f.id)));

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
    const dto = this.mapToDTO(facility);
    const summary = await courtReviewSummaries(id);
    const reviews = new Map(summary.reviews.map(review => [review.courtId, review]));
    const claims = new Map<number, typeof summary.claims>();
    for (const claim of summary.claims) claims.set(claim.courtId, [...(claims.get(claim.courtId) ?? []), claim]);
    dto.courts = dto.courts?.map(court => ({
      ...court, latestReview: reviews.get(court.id) ?? null, standardClaims: claims.get(court.id) ?? [],
    }));
    return dto;
  }

  async updateFacilityStatus(
    id: number,
    status: 'ACTIVE' | 'SUSPENDED',
    audit: FacilityStatusAuditInput
  ): Promise<AdminFacilityDTO> {
    const updated = await this.repo.updateStatus(id, status, audit);
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

  async updateCourtProfile(
    adminId: number,
    facilityId: number,
    courtId: number,
    input: CourtProfileBody,
    reason: string
  ) {
    return db.transaction(async (tx) => {
      const court = await courtProfileRepository.findInFacility(facilityId, courtId, tx, true);
      if (!court) {
        throw new NotFoundError('Court not found or does not belong to facility', 'ADMIN_COURT_NOT_FOUND');
      }
      const result = await applyCourtProfileUpdate(court, adminId, input, tx, reason);
      return courtProfileDto(result.court);
    });
  }

  async courtProfileHistory(facilityId: number, courtId: number, page: number, limit: number) {
    const court = await courtProfileRepository.findInFacility(facilityId, courtId);
    if (!court) {
      throw new NotFoundError('Court not found or does not belong to facility', 'ADMIN_COURT_NOT_FOUND');
    }
    const { rows, total } = await courtProfileRepository.listChanges(courtId, page, limit);
    return {
      data: rows,
      meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
    };
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
