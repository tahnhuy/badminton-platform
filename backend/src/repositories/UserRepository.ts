import { db, users, playerProfiles, courtOwnerProfiles, skillLevels } from '../db';
import { eq, ne, and, or, ilike, count, asc, desc, inArray, isNull, sql, SQL } from 'drizzle-orm';

export interface UserStatsData {
  total: number;
  active: number;
  suspended: number;
  deactivated: number;
}

export interface UserFilterOptions {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: string;
  sort?: string;
}

export interface PlayerProfileData {
  userId: number;
  fullName: string;
  skillLevelId: number;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourtOwnerProfileData {
  userId: number;
  businessName: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithProfile {
  id: number;
  email: string;
  role: string;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: PlayerProfileData | CourtOwnerProfileData | null;
}

export interface RawUser {
  id: number;
  email: string;
  passwordHash: string;
  role: string;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  fullName?: string;
  skillLevelId?: number;
  avatarUrl?: string;
  businessName?: string;
  phone?: string;
}

export class UserRepository {
  async getGlobalStats(): Promise<UserStatsData> {
    const statsResult = await db
      .select({
        total: count(),
        active: count(sql`CASE WHEN ${users.status} = 'ACTIVE' AND ${users.deletedAt} IS NULL THEN 1 END`),
        suspended: count(sql`CASE WHEN ${users.status} = 'SUSPENDED' AND ${users.deletedAt} IS NULL THEN 1 END`),
        deactivated: count(sql`CASE WHEN ${users.status} = 'DEACTIVATED' OR ${users.deletedAt} IS NOT NULL THEN 1 END`),
      })
      .from(users);

    const row = statsResult[0];
    return {
      total: Number(row?.total || 0),
      active: Number(row?.active || 0),
      suspended: Number(row?.suspended || 0),
      deactivated: Number(row?.deactivated || 0),
    };
  }

  private buildUserWhereClause(options: UserFilterOptions): SQL | undefined {
    const { search, role, status } = options;
    const conditions = [];

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (status) {
      conditions.push(eq(users.status, status));
    }

    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(users.email, searchPattern),
          ilike(playerProfiles.fullName, searchPattern),
          ilike(courtOwnerProfiles.businessName, searchPattern)
        )
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private resolveUserOrder(sort?: string): SQL {
    if (sort === 'oldest') return asc(users.createdAt);
    if (sort === 'name_asc') return asc(users.email);
    if (sort === 'name_desc') return desc(users.email);
    return desc(users.createdAt);
  }

  private async selectUserListRows(
    whereClause: SQL | undefined,
    orderExpr: SQL,
    limit: number,
    offset: number
  ): Promise<UserWithProfile[]> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        playerProfile: {
          userId: playerProfiles.userId,
          fullName: playerProfiles.fullName,
          skillLevelId: playerProfiles.skillLevelId,
          avatarUrl: playerProfiles.avatarUrl,
          createdAt: playerProfiles.createdAt,
          updatedAt: playerProfiles.updatedAt,
        },
        courtOwnerProfile: {
          userId: courtOwnerProfiles.userId,
          businessName: courtOwnerProfiles.businessName,
          phone: courtOwnerProfiles.phone,
          createdAt: courtOwnerProfiles.createdAt,
          updatedAt: courtOwnerProfiles.updatedAt,
        },
      })
      .from(users)
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(courtOwnerProfiles, eq(users.id, courtOwnerProfiles.userId))
      .where(whereClause)
      .orderBy(orderExpr, asc(users.id))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => {
      let profile: PlayerProfileData | CourtOwnerProfileData | null = null;
      if (row.role === 'PLAYER' && row.playerProfile?.userId) {
        profile = row.playerProfile;
      } else if (row.role === 'COURT_OWNER' && row.courtOwnerProfile?.userId) {
        profile = row.courtOwnerProfile;
      }

      return {
        id: row.id,
        email: row.email,
        role: row.role,
        status: row.status,
        deletedAt: row.deletedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        profile,
      };
    });
  }

  async findUsers(options: UserFilterOptions): Promise<{ users: UserWithProfile[]; total: number; stats: UserStatsData }> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;
    const whereClause = this.buildUserWhereClause(options);
    const orderExpr = this.resolveUserOrder(options.sort);

    const totalResult = await db
      .select({ count: count() })
      .from(users)
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(courtOwnerProfiles, eq(users.id, courtOwnerProfiles.userId))
      .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);
    const stats = await this.getGlobalStats();
    const usersList = await this.selectUserListRows(whereClause, orderExpr, limit, offset);

    return {
      users: usersList,
      total,
      stats,
    };
  }

  async findRawUserById(id: number): Promise<RawUser | null> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async findRolesByIds(ids: number[]): Promise<Array<{ id: number; role: string }>> {
    if (ids.length === 0) return [];
    return db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(inArray(users.id, ids));
  }

  async findUserByEmail(email: string): Promise<RawUser | null> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async findUserById(id: number): Promise<UserWithProfile | null> {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        playerProfile: {
          userId: playerProfiles.userId,
          fullName: playerProfiles.fullName,
          skillLevelId: playerProfiles.skillLevelId,
          avatarUrl: playerProfiles.avatarUrl,
          createdAt: playerProfiles.createdAt,
          updatedAt: playerProfiles.updatedAt,
        },
        courtOwnerProfile: {
          userId: courtOwnerProfiles.userId,
          businessName: courtOwnerProfiles.businessName,
          phone: courtOwnerProfiles.phone,
          createdAt: courtOwnerProfiles.createdAt,
          updatedAt: courtOwnerProfiles.updatedAt,
        },
      })
      .from(users)
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(courtOwnerProfiles, eq(users.id, courtOwnerProfiles.userId))
      .where(eq(users.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    let profile: PlayerProfileData | CourtOwnerProfileData | null = null;
    if (row.role === 'PLAYER' && row.playerProfile?.userId) {
      profile = row.playerProfile;
    } else if (row.role === 'COURT_OWNER' && row.courtOwnerProfile?.userId) {
      profile = row.courtOwnerProfile;
    }

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: row.status,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      profile,
    };
  }

  private async resolveSkillLevelId(skillLevelId?: number): Promise<number> {
    if (skillLevelId) {
      const requested = await db
        .select({ id: skillLevels.id })
        .from(skillLevels)
        .where(eq(skillLevels.id, skillLevelId))
        .limit(1);

      if (requested.length > 0) {
        return requested[0].id;
      }
    }

    const existing = await db.select({ id: skillLevels.id }).from(skillLevels).limit(1);
    if (existing.length > 0) {
      return existing[0].id;
    }

    const [created] = await db
      .insert(skillLevels)
      .values({
        code: 'INTERMEDIATE',
        name: 'Trung bình (Intermediate)',
        rank: 2,
        description: 'Trung bình phong trào',
      })
      .returning();

    return created.id;
  }

  async createUser(data: CreateUserData): Promise<UserWithProfile> {
    const userId = await db.transaction(async (tx) => {
      const [insertedUser] = await tx
        .insert(users)
        .values({
          email: data.email.trim().toLowerCase(),
          passwordHash: data.passwordHash,
          role: data.role,
          status: data.status || 'ACTIVE',
        })
        .returning();

      if (data.role === 'PLAYER') {
        const finalSkillId = await this.resolveSkillLevelId(data.skillLevelId);

        await tx.insert(playerProfiles).values({
          userId: insertedUser.id,
          fullName: data.fullName || data.email.split('@')[0],
          skillLevelId: finalSkillId,
          avatarUrl: data.avatarUrl || null,
        });
      } else if (data.role === 'COURT_OWNER') {
        await tx.insert(courtOwnerProfiles).values({
          userId: insertedUser.id,
          businessName: data.businessName || data.email.split('@')[0],
          phone: data.phone || '0900000000',
        });
      }

      return insertedUser.id;
    });

    const created = await this.findUserById(userId);
    return created!;
  }

  async updateStatus(id: number, status: string): Promise<UserWithProfile | null> {
    await db
      .update(users)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return this.findUserById(id);
  }

  async softDelete(id: number): Promise<void> {
    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  async bulkUpdateStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await db
      .update(users)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(inArray(users.id, ids), ne(users.status, status)))
      .returning({ id: users.id });

    return updated.length;
  }

  async bulkSoftDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const updated = await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(inArray(users.id, ids), isNull(users.deletedAt)))
      .returning({ id: users.id });

    return updated.length;
  }

  async updatePassword(id: number, passwordHash: string): Promise<UserWithProfile | null> {
    await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));

    return this.findUserById(id);
  }
}

export const userRepository = new UserRepository();
