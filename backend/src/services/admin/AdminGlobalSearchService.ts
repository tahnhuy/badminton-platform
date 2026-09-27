import { db } from '../../db';
import { users, playerProfiles, courtOwnerProfiles } from '../../db/schema/users';
import { facilities } from '../../db/schema/facilities';
import { tournaments } from '../../db/schema/tournaments';
import { reports } from '../../db/schema/reports';
import { or, ilike, eq, isNull, and } from 'drizzle-orm';

const RESULT_LIMIT = 5;

export interface GlobalSearchUserResult {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
}

export interface GlobalSearchFacilityResult {
  id: number;
  name: string;
  address: string;
  city: string;
  phone: string;
  status: string;
}

export interface GlobalSearchTournamentResult {
  id: number;
  name: string;
  format: string;
  status: string;
}

export interface GlobalSearchReportResult {
  id: number;
  reasonCode: string;
  description: string | null;
  status: string;
}

export interface GlobalSearchResult {
  users: GlobalSearchUserResult[];
  facilities: GlobalSearchFacilityResult[];
  tournaments: GlobalSearchTournamentResult[];
  reports: GlobalSearchReportResult[];
}

export class AdminGlobalSearchService {
  async search(query: string): Promise<GlobalSearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { users: [], facilities: [], tournaments: [], reports: [] };
    }

    const searchPattern = `%${trimmed}%`;
    const numericId = parseInt(trimmed, 10);
    const idSearch = !isNaN(numericId) && numericId > 0 && String(numericId) === trimmed
      ? numericId
      : null;

    return {
      users: await this.searchUsers(searchPattern, idSearch),
      facilities: await this.searchFacilities(searchPattern, idSearch),
      tournaments: await this.searchTournaments(searchPattern, idSearch),
      reports: await this.searchReports(searchPattern, idSearch),
    };
  }

  private async searchUsers(pattern: string, idSearch: number | null): Promise<GlobalSearchUserResult[]> {
    const conditions = [
      ilike(users.email, pattern),
      ilike(playerProfiles.fullName, pattern),
      ilike(courtOwnerProfiles.businessName, pattern),
      ilike(courtOwnerProfiles.phone, pattern),
    ];
    if (idSearch !== null) {
      conditions.push(eq(users.id, idSearch));
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        playerFullName: playerProfiles.fullName,
        playerAvatarUrl: playerProfiles.avatarUrl,
        courtOwnerName: courtOwnerProfiles.businessName,
        courtOwnerPhone: courtOwnerProfiles.phone,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(courtOwnerProfiles, eq(courtOwnerProfiles.userId, users.id))
      .where(and(isNull(users.deletedAt), or(...conditions)))
      .limit(RESULT_LIMIT);

    return rows.map((u) => ({
      id: u.id,
      fullName: u.playerFullName || u.courtOwnerName || u.email,
      email: u.email,
      phone: u.courtOwnerPhone || null,
      role: u.role,
      status: u.status,
      avatarUrl: u.playerAvatarUrl || null,
    }));
  }

  private async searchFacilities(pattern: string, idSearch: number | null): Promise<GlobalSearchFacilityResult[]> {
    const conditions = [
      ilike(facilities.name, pattern),
      ilike(facilities.address, pattern),
      ilike(facilities.district, pattern),
      ilike(facilities.city, pattern),
      ilike(facilities.phone, pattern),
    ];
    if (idSearch !== null) {
      conditions.push(eq(facilities.id, idSearch));
    }

    return db
      .select({
        id: facilities.id,
        name: facilities.name,
        address: facilities.address,
        city: facilities.city,
        phone: facilities.phone,
        status: facilities.status,
      })
      .from(facilities)
      .where(and(isNull(facilities.deletedAt), or(...conditions)))
      .limit(RESULT_LIMIT);
  }

  private async searchTournaments(pattern: string, idSearch: number | null): Promise<GlobalSearchTournamentResult[]> {
    const conditions = [
      ilike(tournaments.name, pattern),
      ilike(tournaments.format, pattern),
    ];
    if (idSearch !== null) {
      conditions.push(eq(tournaments.id, idSearch));
    }

    return db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        format: tournaments.format,
        status: tournaments.status,
      })
      .from(tournaments)
      .where(and(isNull(tournaments.deletedAt), or(...conditions)))
      .limit(RESULT_LIMIT);
  }

  private async searchReports(pattern: string, idSearch: number | null): Promise<GlobalSearchReportResult[]> {
    const conditions = [
      ilike(reports.reasonCode, pattern),
      ilike(reports.description, pattern),
    ];
    if (idSearch !== null) {
      conditions.push(eq(reports.id, idSearch));
    }

    return db
      .select({
        id: reports.id,
        reasonCode: reports.reasonCode,
        description: reports.description,
        status: reports.status,
      })
      .from(reports)
      .where(or(...conditions))
      .limit(RESULT_LIMIT);
  }
}

export const adminGlobalSearchService = new AdminGlobalSearchService();
