import { db, facilities, courts, courtPricings } from '../../db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

export interface CourtWithFacility {
  courtId: number;
  courtName: string;
  courtStatus: string;
  courtDescription: string | null;
  courtDeletedAt: Date | null;
  facilityId: number;
  facilityName: string;
  facilityAddress: string;
  facilityWard: string;
  facilityDistrict: string;
  facilityCity: string;
  facilityPhone: string;
  facilityStatus: string;
  facilityDeletedAt: Date | null;
  openingTime: string;
  closingTime: string;
}

export interface CourtSummary extends CourtWithFacility {
  priceFrom: number | null;
}

interface SearchCourtsFilter {
  city?: string;
  district?: string;
  pricingDate: string;
}

const courtSelection = {
  courtId: courts.id,
  courtName: courts.name,
  courtStatus: courts.status,
  courtDescription: courts.description,
  courtDeletedAt: courts.deletedAt,
  facilityId: facilities.id,
  facilityName: facilities.name,
  facilityAddress: facilities.address,
  facilityWard: facilities.ward,
  facilityDistrict: facilities.district,
  facilityCity: facilities.city,
  facilityPhone: facilities.phone,
  facilityStatus: facilities.status,
  facilityDeletedAt: facilities.deletedAt,
  openingTime: facilities.openingTime,
  closingTime: facilities.closingTime,
};

export class CourtRepository {
  async findCourtWithFacility(courtId: number): Promise<CourtWithFacility | null> {
    const rows = await db
      .select(courtSelection)
      .from(courts)
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(eq(courts.id, courtId))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async findPricingsForDate(courtId: number, date: string) {
    return db
      .select({
        id: courtPricings.id,
        startTime: courtPricings.startTime,
        endTime: courtPricings.endTime,
        price: courtPricings.price,
      })
      .from(courtPricings)
      .where(
        and(
          eq(courtPricings.courtId, courtId),
          sql`${courtPricings.validFrom} <= ${date}`,
          sql`(${courtPricings.validTo} IS NULL OR ${courtPricings.validTo} >= ${date})`
        )
      )
      .orderBy(courtPricings.startTime);
  }

  async findPricingsForCourts(courtIds: number[], date: string) {
    if (courtIds.length === 0) return [];
    return db
      .select({
        courtId: courtPricings.courtId,
        id: courtPricings.id,
        startTime: courtPricings.startTime,
        endTime: courtPricings.endTime,
        price: courtPricings.price,
      })
      .from(courtPricings)
      .where(
        and(
          inArray(courtPricings.courtId, courtIds),
          sql`${courtPricings.validFrom} <= ${date}`,
          sql`(${courtPricings.validTo} IS NULL OR ${courtPricings.validTo} >= ${date})`
        )
      )
      .orderBy(courtPricings.courtId, courtPricings.startTime);
  }

  async findAllBookableCourts(filter: SearchCourtsFilter): Promise<CourtSummary[]> {
    const conditions = [
      eq(courts.status, 'ACTIVE'),
      isNull(courts.deletedAt),
      eq(facilities.status, 'ACTIVE'),
      isNull(facilities.deletedAt),
    ];

    if (filter.city) {
      conditions.push(sql`${facilities.city} ILIKE ${`%${filter.city}%`}`);
    }
    if (filter.district) {
      conditions.push(sql`${facilities.district} ILIKE ${`%${filter.district}%`}`);
    }

    const priceFrom = sql<number | null>`(
      SELECT MIN(cp.price)
      FROM ${courtPricings} cp
      WHERE cp.court_id = ${courts.id}
        AND cp.valid_from <= ${filter.pricingDate}
        AND (cp.valid_to IS NULL OR cp.valid_to >= ${filter.pricingDate})
    )`;

    const rows = await db
      .select({ ...courtSelection, priceFrom })
      .from(courts)
      .innerJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(and(...conditions))
      .orderBy(courts.id);

    return rows.map((row) => ({
      ...row,
      priceFrom: row.priceFrom != null ? Number(row.priceFrom) : null,
    }));
  }

  async findFacilityWithCourts(facilityId: number, pricingDate: string) {
    const [facility] = await db
      .select({
        id: facilities.id,
        name: facilities.name,
        description: facilities.description,
        phone: facilities.phone,
        status: facilities.status,
        address: facilities.address,
        ward: facilities.ward,
        district: facilities.district,
        city: facilities.city,
        latitude: facilities.latitude,
        longitude: facilities.longitude,
        openingTime: facilities.openingTime,
        closingTime: facilities.closingTime,
        deletedAt: facilities.deletedAt,
      })
      .from(facilities)
      .where(and(eq(facilities.id, facilityId), isNull(facilities.deletedAt), eq(facilities.status, 'ACTIVE')))
      .limit(1);

    if (!facility) return null;

    const priceFrom = sql<number | null>`(
      SELECT MIN(cp.price)
      FROM ${courtPricings} cp
      WHERE cp.court_id = ${courts.id}
        AND cp.valid_from <= ${pricingDate}
        AND (cp.valid_to IS NULL OR cp.valid_to >= ${pricingDate})
    )`;

    const courtRows = await db
      .select({
        id: courts.id,
        name: courts.name,
        description: courts.description,
        status: courts.status,
        priceFrom,
      })
      .from(courts)
      .where(and(eq(courts.facilityId, facilityId), isNull(courts.deletedAt), eq(courts.status, 'ACTIVE')))
      .orderBy(courts.id);

    return {
      facility,
      courts: courtRows.map((row) => ({
        ...row,
        priceFrom: row.priceFrom != null ? Number(row.priceFrom) : null,
      })),
    };
  }
}

export const courtRepository = new CourtRepository();
