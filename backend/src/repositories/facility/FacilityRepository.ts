import { AppError } from '../../errors/AppError';
import { db, facilities, courts, users, courtOwnerProfiles, playerProfiles, facilityStatusAudits } from '../../db';
import { eq, and, or, ilike, count, asc, desc, isNull, sql, SQL, inArray } from 'drizzle-orm';
import { cityFilterPatterns, normalizeCityName } from '../../shared/facility/city';
import { vietnamQuarterBounds } from '../../shared/facility/quarter';

export interface FacilityStatsData {
  totalFacilities: number;
  provincesCovered: number;
  newFacilitiesThisQuarter: number;
  totalActiveCourts: number;
  activeFacilities: number;
  activeFacilityRate: number;
  suspendedFacilities: number;
  unconfirmedSampleFacilities: number;
}

export interface FacilityFilterOptions {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  city?: string;
  condition?: string;
  surfaceType?: string;
  sort?: string;
}

export interface FacilityStatusAuditInput {
  actorId: number;
  reasonCode?: string;
  note?: string;
}

export interface CreateFacilityData {
  name: string;
  address: string;
  city: string;
  district?: string;
  ward?: string;
  phone?: string;
  description?: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  courtCount?: number;
  openingTime?: string;
  closingTime?: string;
}

export interface FacilityWithDetails {
  id: number;
  ownerId: number;
  name: string;
  description: string | null;
  phone: string;
  status: string;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  openingTime: string;
  closingTime: string;
  dataSource: string | null;
  sourceRef: string | null;
  confirmedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: number;
    email: string;
    fullName?: string | null;
    phone?: string | null;
  };
  courtCount: number;
  activeCourtCount?: number;
  courts?: {
    id: number;
    facilityId: number;
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
    sourceRef: string | null;
    confirmedAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

export class FacilityRepository {
  async getGlobalStats(): Promise<FacilityStatsData> {
    const [facStats] = await db
      .select({
        total: count(sql`CASE WHEN ${facilities.deletedAt} IS NULL THEN 1 END`),
        active: count(
          sql`CASE WHEN ${facilities.deletedAt} IS NULL AND ${facilities.status} = 'ACTIVE' THEN 1 END`
        ),
        suspended: count(
          sql`CASE WHEN ${facilities.deletedAt} IS NULL AND ${facilities.status} = 'SUSPENDED' THEN 1 END`
        ),
        unconfirmedSample: count(
          sql`CASE WHEN ${facilities.deletedAt} IS NULL AND ${facilities.confirmedAt} IS NULL AND ${facilities.dataSource} IN ('GOOGLE_PLACES_IMPORT', 'DEMO_SEED') THEN 1 END`
        ),
      })
      .from(facilities);

    const cityRows = await db
      .selectDistinct({ city: facilities.city })
      .from(facilities)
      .where(isNull(facilities.deletedAt));
    const provinces = new Set(cityRows.map((row) => normalizeCityName(row.city)).filter(Boolean)).size;

    const quarter = vietnamQuarterBounds();
    const [courtStats] = await db
      .select({ total: count() })
      .from(courts)
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(
        and(
          eq(courts.status, 'ACTIVE'),
          isNull(courts.deletedAt),
          eq(facilities.status, 'ACTIVE'),
          isNull(facilities.deletedAt)
        )
      );

    const [quarterStats] = await db
      .select({ total: count() })
      .from(facilities)
      .where(
        and(
          isNull(facilities.deletedAt),
          sql`(${facilities.createdAt} AT TIME ZONE 'UTC') >= ${quarter.start}::timestamptz`,
          sql`(${facilities.createdAt} AT TIME ZONE 'UTC') < ${quarter.end}::timestamptz`
        )
      );

    const totalFac = Number(facStats?.total || 0);
    const activeFac = Number(facStats?.active || 0);

    return {
      totalFacilities: totalFac,
      provincesCovered: provinces,
      newFacilitiesThisQuarter: Number(quarterStats?.total || 0),
      totalActiveCourts: Number(courtStats?.total || 0),
      activeFacilities: activeFac,
      activeFacilityRate: totalFac > 0 ? Number(((activeFac / totalFac) * 100).toFixed(1)) : 0,
      suspendedFacilities: Number(facStats?.suspended || 0),
      unconfirmedSampleFacilities: Number(facStats?.unconfirmedSample || 0),
    };
  }

  private buildWhereClause(options: FacilityFilterOptions): SQL | undefined {
    const { search, status, city } = options;
    const conditions: SQL[] = [];

    if (status) {
      if (status === 'DISABLED') {
        conditions.push(sql`${facilities.deletedAt} IS NOT NULL`);
      } else {
        conditions.push(and(eq(facilities.status, status), isNull(facilities.deletedAt))!);
      }
    }

    if (city) {
      const patterns = cityFilterPatterns(city);
      if (patterns.length > 0) {
        conditions.push(or(...patterns.map((pattern) => ilike(facilities.city, pattern)))!);
      }
    }

    if (options.condition) {
      const condition = options.condition === 'UNSPECIFIED' ? undefined : options.condition;
      conditions.push(sql`EXISTS (SELECT 1 FROM ${courts} fc WHERE fc.facility_id = ${facilities.id} AND fc.deleted_at IS NULL AND ${condition ? sql`fc.condition = ${condition}` : sql`fc.condition IS NULL`})`);
    }

    if (options.surfaceType) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${courts} fc WHERE fc.facility_id = ${facilities.id} AND fc.deleted_at IS NULL AND fc.surface_type = ${options.surfaceType})`);
    }

    if (search && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(facilities.name, term),
          ilike(facilities.address, term),
          ilike(facilities.district, term),
          ilike(facilities.ward, term),
          ilike(facilities.city, term),
          ilike(facilities.phone, term),
          sql`CAST(${facilities.id} AS TEXT) ILIKE ${term}`,
          sql`EXISTS (SELECT 1 FROM ${users} u WHERE u.id = ${facilities.ownerId} AND (u.email ILIKE ${term} OR EXISTS (SELECT 1 FROM ${playerProfiles} pp WHERE pp.user_id = u.id AND pp.full_name ILIKE ${term}) OR EXISTS (SELECT 1 FROM ${courtOwnerProfiles} cop WHERE cop.user_id = u.id AND cop.business_name ILIKE ${term})))`
        )!
      );
    }

    if (conditions.length === 0) return undefined;
    if (conditions.length === 1) return conditions[0];
    return and(...conditions);
  }

  async findAll(options: FacilityFilterOptions): Promise<{ items: FacilityWithDetails[]; total: number }> {
    const { page, limit, sort } = options;
    const offset = (page - 1) * limit;
    const whereClause = this.buildWhereClause(options);

    // Count total query
    const [countRow] = await db
      .select({ total: count() })
      .from(facilities)
      .where(whereClause);
    const total = Number(countRow?.total || 0);

    // Build base query
    const query = db
      .select({
        id: facilities.id,
        ownerId: facilities.ownerId,
        name: facilities.name,
        description: facilities.description,
        phone: facilities.phone,
        status: facilities.status,
        address: facilities.address,
        ward: facilities.ward,
        district: facilities.district,
        city: facilities.city,
        openingTime: facilities.openingTime,
        closingTime: facilities.closingTime,
        dataSource: facilities.dataSource,
        sourceRef: facilities.sourceRef,
        confirmedAt: facilities.confirmedAt,
        deletedAt: facilities.deletedAt,
        createdAt: facilities.createdAt,
        updatedAt: facilities.updatedAt,
        ownerEmail: users.email,
        ownerPlayerName: playerProfiles.fullName,
        ownerBusinessName: courtOwnerProfiles.businessName,
        ownerPhone: courtOwnerProfiles.phone,
        courtCount: sql<number>`(SELECT COUNT(*)::int FROM ${courts} c WHERE c.facility_id = ${facilities.id} AND c.deleted_at IS NULL)`,
        activeCourtCount: sql<number>`(SELECT COUNT(*)::int FROM ${courts} c WHERE c.facility_id = ${facilities.id} AND c.deleted_at IS NULL AND c.status = 'ACTIVE')`,
      })
      .from(facilities)
      .leftJoin(users, eq(facilities.ownerId, users.id))
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(courtOwnerProfiles, eq(users.id, courtOwnerProfiles.userId))
      .where(whereClause);

    // Sorting
    switch (sort) {
      case 'oldest':
        query.orderBy(asc(facilities.createdAt));
        break;
      case 'courtCount_desc':
        query.orderBy(desc(sql`(SELECT COUNT(*) FROM ${courts} c WHERE c.facility_id = ${facilities.id} AND c.deleted_at IS NULL)`));
        break;
      case 'courtCount_asc':
        query.orderBy(asc(sql`(SELECT COUNT(*) FROM ${courts} c WHERE c.facility_id = ${facilities.id} AND c.deleted_at IS NULL)`));
        break;
      case 'name_asc':
        query.orderBy(asc(facilities.name));
        break;
      case 'name_desc':
        query.orderBy(desc(facilities.name));
        break;
      case 'newest':
      default:
        query.orderBy(desc(facilities.createdAt));
        break;
    }

    const rows = await query.limit(limit).offset(offset);

    const items: FacilityWithDetails[] = rows.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      name: r.name,
      description: r.description,
      phone: r.phone,
      status: r.status,
      address: r.address,
      ward: r.ward,
      district: r.district,
      city: r.city,
      openingTime: r.openingTime,
      closingTime: r.closingTime,
      dataSource: r.dataSource,
      sourceRef: r.sourceRef,
      confirmedAt: r.confirmedAt,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      owner: {
        id: r.ownerId,
        email: r.ownerEmail || '',
        fullName: r.ownerBusinessName || r.ownerPlayerName || null,
        phone: r.ownerPhone || r.phone || null,
      },
      courtCount: Number(r.courtCount || 0),
      activeCourtCount: Number(r.activeCourtCount || 0),
    }));

    return { items, total };
  }

  async courtConditionSummaries(facilityIds: number[]): Promise<Map<number, {
    NORMAL: number;
    NEEDS_MAINTENANCE: number;
    UNDER_MAINTENANCE: number;
    UNSPECIFIED: number;
  }>> {
    if (facilityIds.length === 0) return new Map();
    const rows = await db
      .select({
        facilityId: courts.facilityId,
        condition: courts.condition,
        value: count(),
      })
      .from(courts)
      .where(and(inArray(courts.facilityId, facilityIds), isNull(courts.deletedAt)))
      .groupBy(courts.facilityId, courts.condition);

    const result = new Map<number, {
      NORMAL: number;
      NEEDS_MAINTENANCE: number;
      UNDER_MAINTENANCE: number;
      UNSPECIFIED: number;
    }>();
    for (const id of facilityIds) {
      result.set(id, { NORMAL: 0, NEEDS_MAINTENANCE: 0, UNDER_MAINTENANCE: 0, UNSPECIFIED: 0 });
    }
    for (const row of rows) {
      const bucket = result.get(row.facilityId);
      if (!bucket) continue;
      const key = (row.condition ?? 'UNSPECIFIED') as keyof typeof bucket;
      if (key in bucket) bucket[key] += Number(row.value);
    }
    return result;
  }

  async findById(id: number, executor: any = db): Promise<FacilityWithDetails | null> {
    const rows = await executor
      .select({
        id: facilities.id,
        ownerId: facilities.ownerId,
        name: facilities.name,
        description: facilities.description,
        phone: facilities.phone,
        status: facilities.status,
        address: facilities.address,
        ward: facilities.ward,
        district: facilities.district,
        city: facilities.city,
        openingTime: facilities.openingTime,
        closingTime: facilities.closingTime,
        dataSource: facilities.dataSource,
        sourceRef: facilities.sourceRef,
        confirmedAt: facilities.confirmedAt,
        deletedAt: facilities.deletedAt,
        createdAt: facilities.createdAt,
        updatedAt: facilities.updatedAt,
        ownerEmail: users.email,
        ownerPlayerName: playerProfiles.fullName,
        ownerBusinessName: courtOwnerProfiles.businessName,
        ownerPhone: courtOwnerProfiles.phone,
      })
      .from(facilities)
      .leftJoin(users, eq(facilities.ownerId, users.id))
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(courtOwnerProfiles, eq(users.id, courtOwnerProfiles.userId))
      .where(eq(facilities.id, id))
      .limit(1);

    if (!rows || rows.length === 0) return null;
    const r = rows[0];

    const courtRows = await executor
      .select()
      .from(courts)
      .where(eq(courts.facilityId, id))
      .orderBy(asc(courts.id));

    return {
      id: r.id,
      ownerId: r.ownerId,
      name: r.name,
      description: r.description,
      phone: r.phone,
      status: r.status,
      address: r.address,
      ward: r.ward,
      district: r.district,
      city: r.city,
      openingTime: r.openingTime,
      closingTime: r.closingTime,
      dataSource: r.dataSource,
      sourceRef: r.sourceRef,
      confirmedAt: r.confirmedAt,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      owner: {
        id: r.ownerId,
        email: r.ownerEmail || '',
        fullName: r.ownerBusinessName || r.ownerPlayerName || null,
        phone: r.ownerPhone || r.phone || null,
      },
      courtCount: courtRows.filter((c: any) => c.deletedAt === null).length,
      activeCourtCount: courtRows.filter((c: any) => c.deletedAt === null && c.status === 'ACTIVE').length,
      courts: courtRows.map((c: any) => ({
        id: c.id,
        facilityId: c.facilityId,
        name: c.name,
        status: c.status,
        description: c.description,
        surfaceType: c.surfaceType ?? null,
        surfaceBrand: c.surfaceBrand ?? null,
        surfaceModel: c.surfaceModel ?? null,
        surfaceThicknessMm: c.surfaceThicknessMm ?? null,
        condition: c.condition ?? null,
        conditionNote: c.conditionNote ?? null,
        profileVersion: c.profileVersion ?? 0,
        dataSource: c.dataSource,
        sourceRef: c.sourceRef,
        confirmedAt: c.confirmedAt,
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async updateStatus(
    id: number,
    status: 'ACTIVE' | 'SUSPENDED',
    audit?: FacilityStatusAuditInput
  ): Promise<FacilityWithDetails | null> {
    return await db.transaction(async (tx) => {
      // Lock row
      const [existing] = await tx
        .select()
        .from(facilities)
        .where(eq(facilities.id, id))
        .for('update');

      if (!existing) return null;

      if (!['ACTIVE', 'SUSPENDED'].includes(existing.status)) {
        throw new AppError('REVIEW_NOT_PENDING', 409, 'Use the review endpoint for onboarding');
      }
      await tx.update(facilities).set({ status, updatedAt: new Date() }).where(eq(facilities.id, id));
      // Parent eligibility changes without approving/rejecting/reactivating child courts.

      if (audit && existing.status !== status) {
        await tx.insert(facilityStatusAudits).values({
          facilityId: id,
          actorId: audit.actorId,
          fromStatus: existing.status,
          toStatus: status,
          reasonCode: audit.reasonCode || null,
          note: audit.note || null,
        });
      }

      return this.findById(id, tx);
    });
  }

  async softDeleteFacility(id: number): Promise<{ success: boolean; alreadyDeleted: boolean }> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(facilities)
        .where(eq(facilities.id, id))
        .for('update');

      if (!existing) return { success: false, alreadyDeleted: false };
      if (existing.deletedAt !== null) {
        return { success: true, alreadyDeleted: true };
      }

      const now = new Date();
      // Atomically soft-delete facility and child courts
      await tx
        .update(facilities)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(facilities.id, id));

      await tx
        .update(courts)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(courts.facilityId, id), isNull(courts.deletedAt)));

      return { success: true, alreadyDeleted: false };
    });
  }

  async findCourt(facilityId: number, courtId: number) {
    const [court] = await db
      .select()
      .from(courts)
      .where(and(eq(courts.id, courtId), eq(courts.facilityId, facilityId)))
      .limit(1);

    return court || null;
  }

  async updateCourtStatus(facilityId: number, courtId: number, status: 'ACTIVE' | 'SUSPENDED') {
    return await db.transaction(async (tx) => {
      const [court] = await tx
        .select()
        .from(courts)
        .where(and(eq(courts.id, courtId), eq(courts.facilityId, facilityId)))
        .for('update');

      if (!court) return null;
      if (!['ACTIVE', 'SUSPENDED'].includes(court.status)) {
        throw new AppError('REVIEW_NOT_PENDING', 409, 'Use the review endpoint for onboarding');
      }

      const [updated] = await tx
        .update(courts)
        .set({ status, updatedAt: new Date() })
        .where(eq(courts.id, courtId))
        .returning();

      return updated;
    });
  }

  async softDeleteCourt(facilityId: number, courtId: number): Promise<{ success: boolean; alreadyDeleted: boolean }> {
    return await db.transaction(async (tx) => {
      const [court] = await tx
        .select()
        .from(courts)
        .where(and(eq(courts.id, courtId), eq(courts.facilityId, facilityId)))
        .for('update');

      if (!court) return { success: false, alreadyDeleted: false };
      if (court.deletedAt !== null) {
        return { success: true, alreadyDeleted: true };
      }

      await tx
        .update(courts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(courts.id, courtId));

      return { success: true, alreadyDeleted: false };
    });
  }

  async createFacility(data: CreateFacilityData): Promise<FacilityWithDetails> {
    return await db.transaction(async (tx) => {
      // 1. Find or create court owner user
      let ownerId: number;
      const [existingUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, data.ownerEmail))
        .limit(1);

      if (existingUser) {
        ownerId = existingUser.id;
        const [existingProfile] = await tx
          .select()
          .from(courtOwnerProfiles)
          .where(eq(courtOwnerProfiles.userId, ownerId))
          .limit(1);

        if (!existingProfile) {
          await tx.insert(courtOwnerProfiles).values({
            userId: ownerId,
            businessName: data.ownerName,
            phone: data.ownerPhone,
          });
        }
      } else {
        const [insertedUser] = await tx
          .insert(users)
          .values({
            email: data.ownerEmail,
            passwordHash: '$2a$10$wT0l8R2V4Yt9F3z1x5m.Oe0oK8q7U8E9N9J9g8s7d6f5g4h3j2k1l',
            role: 'COURT_OWNER',
            status: 'ACTIVE',
          })
          .returning();
        ownerId = insertedUser.id;

        await tx.insert(courtOwnerProfiles).values({
          userId: ownerId,
          businessName: data.ownerName,
          phone: data.ownerPhone,
        });
      }

      // 2. Insert Facility
      const [insertedFacility] = await tx
        .insert(facilities)
        .values({
          ownerId,
          name: data.name,
          description: data.description || null,
          phone: data.phone || data.ownerPhone,
          status: 'ACTIVE',
          address: data.address,
          ward: data.ward || 'Phường Trung Tâm',
          district: data.district || 'Quận Trung Tâm',
          city: data.city,
          openingTime: data.openingTime || '05:30:00',
          closingTime: data.closingTime || '23:00:00',
          dataSource: 'ADMIN_ENTERED',
          deletedAt: null,
        })
        .returning();

      // 3. Insert Child Courts
      const courtCount = Math.max(1, data.courtCount || 4);
      for (let i = 1; i <= courtCount; i++) {
        await tx.insert(courts).values({
          facilityId: insertedFacility.id,
          name: `Sân ${String(i).padStart(2, '0')}`,
          status: 'ACTIVE',
          description: null,
          dataSource: 'ADMIN_ENTERED',
          deletedAt: null,
        });
      }

      const created = await this.findById(insertedFacility.id, tx);
      if (!created) {
        throw new Error('Failed to retrieve newly created facility');
      }
      return created;
    });
  }
}

export const facilityRepository = new FacilityRepository();
