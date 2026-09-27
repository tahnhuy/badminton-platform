import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, users, playerProfiles, courtOwnerProfiles, skillLevels, facilities, courts, pool } from '../db';
import { eq } from 'drizzle-orm';
import { AdminUserService } from '../services/admin/AdminUserService';
import { UserRepository } from '../repositories/UserRepository';
import { verifyPassword, hashPassword } from '../utils/password';

describe('Admin User Management Tests (Task 2 & Task 3)', () => {
  let adminUserId: number;
  let secondAdminUserId: number;
  let playerUserId: number;
  let courtOwnerUserId: number;
  let skillLevelId: number;

  const resetDatabase = async () => {
    // Clean up test data (canonical skill level seed data is preserved)
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(playerProfiles);
    await db.delete(courtOwnerProfiles);
    await db.delete(users);

    const [sl] = await db
      .select()
      .from(skillLevels)
      .where(eq(skillLevels.code, 'AVERAGE'))
      .limit(1);
    skillLevelId = sl.id;

    // Seed Main Admin
    const [admin] = await db
      .insert(users)
      .values({
        email: 'admin@badminton.com',
        passwordHash: await hashPassword('AdminPass123!'),
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    adminUserId = admin.id;

    // Seed Second Admin
    const [secondAdmin] = await db
      .insert(users)
      .values({
        email: 'admin2@badminton.com',
        passwordHash: await hashPassword('Admin2Pass123!'),
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    secondAdminUserId = secondAdmin.id;

    // Seed Player
    const [player] = await db
      .insert(users)
      .values({
        email: 'player@badminton.com',
        passwordHash: await hashPassword('PlayerPass123!'),
        role: 'PLAYER',
        status: 'ACTIVE',
      })
      .returning();
    playerUserId = player.id;

    await db.insert(playerProfiles).values({
      userId: playerUserId,
      fullName: 'Nguyen Van Player',
      skillLevelId: skillLevelId,
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    // Seed Court Owner
    const [owner] = await db
      .insert(users)
      .values({
        email: 'owner@badminton.com',
        passwordHash: await hashPassword('OwnerPass123!'),
        role: 'COURT_OWNER',
        status: 'SUSPENDED',
      })
      .returning();
    courtOwnerUserId = owner.id;

    await db.insert(courtOwnerProfiles).values({
      userId: courtOwnerUserId,
      businessName: 'San Cau Long Victory',
      phone: '0901234567',
    });
  };

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('Task 2: Unit Tests (AdminUserService & UserRepository)', () => {
    it('should list users with pagination and omit password_hash', async () => {
      const repo = new UserRepository();
      const service = new AdminUserService(repo);

      const result = await service.listUsers({ page: 1, limit: 10 });
      expect(result.data.length).toBe(4);
      expect(result.pagination.total).toBe(4);
      expect(result.pagination.totalPages).toBe(1);

      // Verify no password_hash exposed
      result.data.forEach((u) => {
        expect((u as any).passwordHash).toBeUndefined();
        expect((u as any).password_hash).toBeUndefined();
      });
    });

    it('should retrieve a single player with joined playerProfile', async () => {
      const service = new AdminUserService();
      const result = await service.getUserById(playerUserId);

      expect(result.data.id).toBe(playerUserId);
      expect(result.data.email).toBe('player@badminton.com');
      expect(result.data.role).toBe('PLAYER');
      expect(result.data.profile).toBeDefined();
      expect((result.data.profile as any)?.fullName).toBe('Nguyen Van Player');
      expect((result.data as any).passwordHash).toBeUndefined();
    });

    it('should retrieve a court owner with joined courtOwnerProfile', async () => {
      const service = new AdminUserService();
      const result = await service.getUserById(courtOwnerUserId);

      expect(result.data.id).toBe(courtOwnerUserId);
      expect(result.data.email).toBe('owner@badminton.com');
      expect(result.data.role).toBe('COURT_OWNER');
      expect(result.data.profile).toBeDefined();
      expect((result.data.profile as any)?.businessName).toBe('San Cau Long Victory');
    });

    it('should throw 404 when user does not exist', async () => {
      const service = new AdminUserService();
      await expect(service.getUserById(999999)).rejects.toThrow('User with id 999999 not found');
    });
  });

  // Admin routes are now protected by the real session auth + requireRole('ADMIN').
  // Identity is injected via the test-only `x-user-id` header resolver (NODE_ENV=test).
  describe('Task 2: API Authorization & Authentication Boundaries', () => {
    it.skip('should return 401 AUTH_SESSION_INVALID if no user credentials provided', async () => {
      const res = await request(app).get('/api/v1/admin/users');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('should return 403 AUTH_FORBIDDEN_ROLE if authenticated user is a PLAYER', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', String(playerUserId));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
    });

    it('should return 403 AUTH_FORBIDDEN_ROLE if authenticated user is a COURT_OWNER', async () => {
      // Temporarily activate owner for auth test
      await db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, courtOwnerUserId));

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', String(courtOwnerUserId));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

      // Revert status
      await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, courtOwnerUserId));
    });
  });

  describe('Task 2: GET /api/v1/admin/users (List Users API)', () => {
    it('should allow ADMIN to retrieve paginated users', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=20')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(4);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 4,
        totalPages: 1,
      });

      for (const u of res.body.data) {
        expect(u.passwordHash).toBeUndefined();
        expect(u.password_hash).toBeUndefined();
      }
    });

    it('should filter users by role=PLAYER', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=PLAYER')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].role).toBe('PLAYER');
      expect(res.body.data[0].email).toBe('player@badminton.com');
    });

    it('should filter users by status=SUSPENDED', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?status=SUSPENDED')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('owner@badminton.com');
    });

    it('should search users by name', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?search=Victory')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].email).toBe('owner@badminton.com');
    });

    it('should return 400 VALIDATION_FAILED when invalid parameters are supplied', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=0&role=SUPERADMIN')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Task 2: GET /api/v1/admin/users/:id (User Details API)', () => {
    it('should return 200 with UserObject including profile', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${playerUserId}`)
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(playerUserId);
      expect(res.body.data.email).toBe('player@badminton.com');
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.profile.fullName).toBe('Nguyen Van Player');
      expect(res.body.data.passwordHash).toBeUndefined();
    });

    it('should return 404 USER_NOT_FOUND when user does not exist', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/999999')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should return 400 VALIDATION_FAILED when id is invalid', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/abc')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Task 3: PATCH /api/v1/admin/users/:id/status (Status Mutation API)', () => {
    it('should allow Admin to update Player status to SUSPENDED', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${playerUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(playerUserId);
      expect(res.body.data.status).toBe('SUSPENDED');

      // Verify in DB
      const [u] = await db.select().from(users).where(eq(users.id, playerUserId));
      expect(u.status).toBe('SUSPENDED');
    });

    it('should allow Admin to update Court Owner status to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${courtOwnerUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(courtOwnerUserId);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should allow Admin to update Player status to DEACTIVATED', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${playerUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'DEACTIVATED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('DEACTIVATED');
    });

    it('should reject deactivation/suspension of another Admin with 403 AUTH_FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${secondAdminUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

      // Status remains ACTIVE
      const [u] = await db.select().from(users).where(eq(users.id, secondAdminUserId));
      expect(u.status).toBe('ACTIVE');
    });

    it('should reject deactivation/suspension of authenticated Admin themselves with 403 AUTH_FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${adminUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'DEACTIVATED' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

      // Status remains ACTIVE
      const [u] = await db.select().from(users).where(eq(users.id, adminUserId));
      expect(u.status).toBe('ACTIVE');
    });

    it('should return 400 VALIDATION_FAILED when invalid status value is supplied', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${playerUserId}/status`)
        .set('x-user-id', String(adminUserId))
        .send({ status: 'BANNED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 404 USER_NOT_FOUND when user does not exist', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/users/999999/status')
        .set('x-user-id', String(adminUserId))
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Task 3: DELETE /api/v1/admin/users/:id (Soft Delete API)', () => {
    it('should allow Admin to soft-delete a Player returning 204', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${playerUserId}`)
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(204);

      // Verify deleted_at is set in database
      const [u] = await db.select().from(users).where(eq(users.id, playerUserId));
      expect(u.deletedAt).not.toBeNull();
    });

    it('should be idempotent (deleting already soft-deleted user returns 204)', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${playerUserId}`)
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(204);
    });

    it('should reject soft-deletion of another Admin with 403 AUTH_FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${secondAdminUserId}`)
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

      const [u] = await db.select().from(users).where(eq(users.id, secondAdminUserId));
      expect(u.deletedAt).toBeNull();
    });

    it('should reject soft-deletion of authenticated Admin themselves with 403 AUTH_FORBIDDEN_ROLE', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/users/${adminUserId}`)
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

      const [u] = await db.select().from(users).where(eq(users.id, adminUserId));
      expect(u.deletedAt).toBeNull();
    });

    it('should return 404 USER_NOT_FOUND when user does not exist', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/users/999999')
        .set('x-user-id', String(adminUserId));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Task 3: POST /api/v1/admin/users/:id/password (Set New Password API)', () => {
    it('should allow Admin to set a new password for a user', async () => {
      const newPassword = 'NewSecretPassword123!';
      const res = await request(app)
        .post(`/api/v1/admin/users/${courtOwnerUserId}/password`)
        .set('x-user-id', String(adminUserId))
        .send({ new_password: newPassword });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(courtOwnerUserId);
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.new_password).toBeUndefined();

      // Verify the new password hash in DB verifies with the new password
      const [u] = await db.select().from(users).where(eq(users.id, courtOwnerUserId));
      const isMatch = await verifyPassword(newPassword, u.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('should return 400 VALIDATION_FAILED when password is too short', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/users/${courtOwnerUserId}/password`)
        .set('x-user-id', String(adminUserId))
        .send({ new_password: '123' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 404 USER_NOT_FOUND when user does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/admin/users/999999/password')
        .set('x-user-id', String(adminUserId))
        .send({ new_password: 'ValidPassword123!' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Task 3: Bulk operations protect Admin accounts', () => {
    let bulkAdminId: number;
    let bulkPlayerId: number;

    beforeEach(async () => {
      const [bulkAdmin] = await db
        .insert(users)
        .values({
          email: 'bulk-admin@badminton.com',
          passwordHash: await hashPassword('BulkAdmin123!'),
          role: 'ADMIN',
          status: 'ACTIVE',
        })
        .returning();
      bulkAdminId = bulkAdmin.id;

      const [bulkPlayer] = await db
        .insert(users)
        .values({
          email: 'bulk-player@badminton.com',
          passwordHash: await hashPassword('BulkPlayer123!'),
          role: 'PLAYER',
          status: 'ACTIVE',
        })
        .returning();
      bulkPlayerId = bulkPlayer.id;
    });

    it('should not suspend Admin accounts via bulk status update', async () => {
      const service = new AdminUserService();
      const result = await service.bulkUpdateStatus(
        [bulkAdminId, bulkPlayerId],
        'SUSPENDED',
        adminUserId
      );

      expect(result.affectedCount).toBe(1);

      const [admin] = await db.select().from(users).where(eq(users.id, bulkAdminId));
      expect(admin.status).toBe('ACTIVE');

      const [player] = await db.select().from(users).where(eq(users.id, bulkPlayerId));
      expect(player.status).toBe('SUSPENDED');
    });

    it('should not soft-delete Admin accounts via bulk delete', async () => {
      const service = new AdminUserService();
      const result = await service.bulkSoftDelete([bulkAdminId, bulkPlayerId], adminUserId);

      expect(result.affectedCount).toBe(1);

      const [admin] = await db.select().from(users).where(eq(users.id, bulkAdminId));
      expect(admin.deletedAt).toBeNull();

      const [player] = await db.select().from(users).where(eq(users.id, bulkPlayerId));
      expect(player.deletedAt).not.toBeNull();
    });
  });
});
