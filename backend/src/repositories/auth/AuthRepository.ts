import crypto from 'crypto';
import { and, eq, isNull, or, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { authSessions, authLoginLockouts } from '../../db/schema/auth';
import { users, skillLevels, playerProfiles, courtOwnerProfiles } from '../../db/schema/users';
import { systemConfig, SystemRole } from '../../shared/config/system-config';

export type DbClient = typeof db;
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = DbClient | DbTransaction;

export interface SessionRevokeCallbacks {
  onRawTokenRevoked?: (rawToken: string) => void;
  onUserSessionsRevoked?: (userId: number) => void;
}

let sessionRevokeCallbacks: SessionRevokeCallbacks = {};

export function setSessionRevokeCallbacks(callbacks: SessionRevokeCallbacks): void {
  sessionRevokeCallbacks = callbacks;
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export const authRepository = {
  /**
   * Generates a 32-byte base64url token, computes its SHA-256 hash,
   * snapshots idle & absolute timeouts per role, and inserts into auth_sessions.
   * Supports execution within a database transaction.
   * Returns rawToken to caller only.
   */
  async createSession(userId: number, role: SystemRole, executor: DbExecutor = db) {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashSessionToken(rawToken);

    const { idleTimeoutMinutes, absoluteTimeoutMinutes } = await systemConfig.getSessionTimeouts(role);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + absoluteTimeoutMinutes * 60 * 1000);

    const [session] = await executor
      .insert(authSessions)
      .values({
        userId,
        tokenHash,
        idleTimeoutMinutes,
        lastSeenAt: now,
        expiresAt,
      })
      .returning();

    return {
      rawToken,
      session,
    };
  },

  /**
   * Finds an active (not revoked) session by raw token, joining with the users table.
   */
  async findActiveSessionWithUser(rawToken: string) {
    const tokenHash = hashSessionToken(rawToken);

    const [row] = await db
      .select({
        session: authSessions,
        user: {
          id: users.id,
          email: users.email,
          role: users.role,
          status: users.status,
          mustChangePassword: users.mustChangePassword,
          deletedAt: users.deletedAt,
        },
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));


    return row || null;
  },

  /**
   * Finds a user by email, case-insensitively (including soft-deleted)
   */
  async findUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
      .orderBy(users.id)
      .limit(1);
    return user || null;
  },

  /**
   * Finds a user by ID
   */
  async findUserById(userId: number) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    return user || null;
  },

  /**
   * Finds a skill level by its unique code
   */
  async findSkillLevelByCode(code: string) {
    const [skillLevel] = await db
      .select()
      .from(skillLevels)
      .where(eq(skillLevels.code, code));
    return skillLevel || null;
  },

  /**
   * Updates last_seen_at only if the recorded timestamp is older than 60 seconds
   */
  async touchSessionLastSeen(sessionId: number, lastSeenAt: Date): Promise<void> {
    const elapsedMs = Date.now() - lastSeenAt.getTime();
    if (elapsedMs > 60 * 1000) {
      await db
        .update(authSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(authSessions.id, sessionId));
    }
  },

  /**
   * Revokes a single session by its raw token
   */
  async revokeSessionByToken(rawToken: string): Promise<void> {
    sessionRevokeCallbacks.onRawTokenRevoked?.(rawToken);
    const tokenHash = hashSessionToken(rawToken);
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.tokenHash, tokenHash), isNull(authSessions.revokedAt)));

  },

  /**
   * Revokes all active sessions belonging to a specific user
   */
  async revokeAllSessionsForUser(userId: number, executor: DbExecutor = db): Promise<void> {
    await executor
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
    sessionRevokeCallbacks.onUserSessionsRevoked?.(userId);
  },

  /**
   * Deletes session rows of a user that are revoked or past expires_at
   */
  async cleanupUserSessions(userId: number, executor: DbExecutor = db): Promise<void> {
    const now = new Date();
    await executor
      .delete(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          or(sql`${authSessions.revokedAt} IS NOT NULL`, lte(authSessions.expiresAt, now))
        )
      );
  },

  /**
   * Cleans up revoked/expired sessions and creates the new login session inside
   * a single transaction, so cleanup is rolled back if session creation fails.
   */
  async createLoginSession(userId: number, role: SystemRole) {
    return db.transaction(async (tx) => {
      await this.cleanupUserSessions(userId, tx);
      return this.createSession(userId, role, tx);
    });
  },

  /**
   * Gets the login lockout record for a user
   */
  async getLoginLockout(userId: number) {
    const [lockout] = await db
      .select()
      .from(authLoginLockouts)
      .where(eq(authLoginLockouts.userId, userId));
    return lockout || null;
  },

  /**
   * Records a failed login attempt via an atomic UPSERT.
   * If an existing lock has expired (locked_until <= now()), it treats prior failed attempts as 0.
   * Increments failed_attempts, and sets locked_until when reaching or transitioning to the threshold.
   */
  async recordFailedLogin(userId: number, threshold: number, lockoutMinutes: number) {
    const result = await db.execute(sql`
      INSERT INTO auth_login_lockouts (user_id, failed_attempts, locked_until, updated_at)
      VALUES (
        ${userId},
        1,
        CASE WHEN 1 >= ${threshold} THEN now() + (${lockoutMinutes} || ' minutes')::interval ELSE NULL END,
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        failed_attempts = CASE
          WHEN auth_login_lockouts.locked_until IS NOT NULL AND auth_login_lockouts.locked_until > now()
            THEN auth_login_lockouts.failed_attempts
          WHEN auth_login_lockouts.locked_until IS NOT NULL AND auth_login_lockouts.locked_until <= now()
            THEN 1
          ELSE auth_login_lockouts.failed_attempts + 1
        END,
        locked_until = CASE
          WHEN auth_login_lockouts.locked_until IS NOT NULL AND auth_login_lockouts.locked_until > now()
            THEN auth_login_lockouts.locked_until
          WHEN (
            CASE
              WHEN auth_login_lockouts.locked_until IS NOT NULL AND auth_login_lockouts.locked_until <= now() THEN 1
              ELSE auth_login_lockouts.failed_attempts + 1
            END
          ) >= ${threshold}
            THEN now() + (${lockoutMinutes} || ' minutes')::interval
          ELSE NULL
        END,
        updated_at = now()
      RETURNING user_id, failed_attempts, locked_until, updated_at;
    `);

    const row = result.rows[0];
    if (!row) return null;
    return {
      userId: Number(row.user_id),
      failedAttempts: Number(row.failed_attempts),
      lockedUntil: row.locked_until ? new Date(row.locked_until as string) : null,
      updatedAt: new Date(row.updated_at as string),
    };
  },

  /**
   * Resets the lockout failure counter and locked_until for a user
   */
  async resetLoginLockout(userId: number, executor: DbExecutor = db): Promise<void> {
    await executor
      .insert(authLoginLockouts)
      .values({
        userId,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: authLoginLockouts.userId,
        set: {
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        },
      });
  },

  /**
   * Updates a user's password hash and sets must_change_password to false
   */
  async updateUserPassword(userId: number, passwordHash: string, executor: DbExecutor = db) {
    const [updated] = await executor
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  },

  /**
   * Admin sets a user's password:
   * Updates password hash, sets mustChangePassword = true,
   * revokes all sessions, and resets lockout in a single transaction.
   */
  async adminSetUserPassword(userId: number, passwordHash: string) {
    return db.transaction(async (tx) => {
      const [updatedUser] = await tx
        .update(users)
        .set({
          passwordHash,
          mustChangePassword: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) return null;

      await this.revokeAllSessionsForUser(userId, tx);
      await this.resetLoginLockout(userId, tx);

      return updatedUser;
    });
  },

  /**
   * Registers a Player in a single database transaction.
   * Inserts user, inserts player_profile, creates session.
   */
  async registerPlayer(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string | null;
    skillLevelId: number;
  }) {
    return db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email,
          passwordHash: data.passwordHash,
          role: 'PLAYER',
          status: 'ACTIVE',
          mustChangePassword: false,
        })
        .returning();

      await tx.insert(playerProfiles).values({
        userId: newUser.id,
        fullName: data.fullName,
        phone: data.phone ?? null,
        skillLevelId: data.skillLevelId,
      });

      const { rawToken, session } = await this.createSession(newUser.id, 'PLAYER', tx);

      return {
        user: newUser,
        rawToken,
        session,
      };
    });
  },

  /**
   * Creates a Court Owner account in a single transaction.
   * Inserts user (role COURT_OWNER, must_change_password = true) and court_owner_profile.
   */
  async createCourtOwnerAccount(data: {
    email: string;
    passwordHash: string;
    businessName: string;
    phone: string;
  }) {
    return db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email: data.email,
          passwordHash: data.passwordHash,
          role: 'COURT_OWNER',
          status: 'ACTIVE',
          mustChangePassword: true,
        })
        .returning();

      await tx.insert(courtOwnerProfiles).values({
        userId: newUser.id,
        businessName: data.businessName,
        phone: data.phone,
      });

      return newUser;
    });
  },

  /**
   * Creates an Admin account directly
   */
  async createAdminUser(data: { email: string; passwordHash: string }) {
    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
      })
      .returning();
    return newUser;
  },
};
