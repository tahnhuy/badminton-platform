import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, users, courtOwnerProfiles, playerProfiles, facilities, courts, pool } from '../db';
import { hashPassword } from '../utils/password';

describe('Admin Facility & Court Management Tests (Tasks 1, 2, 3)', () => {
  let adminUserId: number;
  let ownerUserId: number;
  let facility1Id: number;
  let facility2Id: number;
  let court1Id: number;
  let court2Id: number;
  let court3Id: number;

  const resetDatabase = async () => {
    // Clean up test data
    await db.delete(courts);
    await db.delete(facilities);
    await db.delete(courtOwnerProfiles);
    await db.delete(playerProfiles);
    await db.delete(users);

    // Seed Admin
    const [admin] = await db
      .insert(users)
      .values({
        email: 'fac-admin@badminton.com',
        passwordHash: await hashPassword('AdminPass123!'),
        role: 'ADMIN',
        status: 'ACTIVE',
      })
      .returning();
    adminUserId = admin.id;

    // Seed Owner
    const [owner] = await db
      .insert(users)
      .values({
        email: 'fac-owner@badminton.com',
        passwordHash: await hashPassword('OwnerPass123!'),
        role: 'COURT_OWNER',
        status: 'ACTIVE',
      })
      .returning();
    ownerUserId = owner.id;

    await db.insert(courtOwnerProfiles).values({
      userId: ownerUserId,
      businessName: 'CLB Cầu Lông Phúc Thịnh',
      phone: '0908123456',
    });

    // Seed Facility 1 (Active)
    const [f1] = await db
      .insert(facilities)
      .values({
        ownerId: ownerUserId,
        name: 'CLB Cầu Lông Phúc Thịnh Quận 7',
        phone: '0908123456',
        status: 'ACTIVE',
        address: '18D Huỳnh Tấn Phát',
        ward: 'Tân Thuận Đông',
        district: 'Quận 7',
        city: 'TP. Hồ Chí Minh',
        latitude: '10.7483',
        longitude: '106.7212',
        openingTime: '06:00:00',
        closingTime: '23:00:00',
      })
      .returning();
    facility1Id = f1.id;

    // Seed Facility 2 (Suspended)
    const [f2] = await db
      .insert(facilities)
      .values({
        ownerId: ownerUserId,
        name: 'CLB Cầu Lông Bình Thạnh Star',
        phone: '0918882391',
        status: 'SUSPENDED',
        address: '102 Nơ Trang Long',
        ward: 'Phường 14',
        district: 'Bình Thạnh',
        city: 'TP. Hồ Chí Minh',
        latitude: '10.8032',
        longitude: '106.6983',
        openingTime: '05:30:00',
        closingTime: '22:30:00',
      })
      .returning();
    facility2Id = f2.id;

    // Seed Courts for Facility 1
    const [c1] = await db
      .insert(courts)
      .values({
        facilityId: facility1Id,
        name: 'Sân 1',
        status: 'ACTIVE',
        description: 'Yonex Pro standard',
      })
      .returning();
    court1Id = c1.id;

    const [c2] = await db
      .insert(courts)
      .values({
        facilityId: facility1Id,
        name: 'Sân 2',
        status: 'ACTIVE',
        description: 'Enlio PVC standard',
      })
      .returning();
    court2Id = c2.id;

    // Seed Court for Facility 2
    const [c3] = await db
      .insert(courts)
      .values({
        facilityId: facility2Id,
        name: 'Sân 1 Bình Thạnh',
        status: 'SUSPENDED',
        description: 'PVC standard',
      })
      .returning();
    court3Id = c3.id;
  };

  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/v1/admin/facilities (Task 1: Query API & Stats)', () => {
    it('should return list of facilities with stats and metadata', async () => {
      const res = await request(app)
        .get('/api/v1/admin/facilities')
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.stats).toBeDefined();
      expect(res.body.data.stats.totalFacilities).toBe(2);
      expect(res.body.data.stats.activeFacilities).toBe(1);
      expect(res.body.data.stats.suspendedFacilities).toBe(1);
      expect(res.body.data.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });

      // Verify DTO fields
      const item = res.body.data.items[0];
      expect(item.facilityCode).toContain('#FAC-SGN-');
      expect(item.owner).toBeDefined();
      expect(item.courtStats).toBeDefined();
    });

    it('should filter facilities by status ACTIVE', async () => {
      const res = await request(app)
        .get('/api/v1/admin/facilities')
        .query({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(facility1Id);
    });

    it('should filter facilities by city', async () => {
      const res = await request(app)
        .get('/api/v1/admin/facilities')
        .query({ city: 'Hồ Chí Minh' });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
    });

    it('should search facilities by keyword', async () => {
      const res = await request(app)
        .get('/api/v1/admin/facilities')
        .query({ search: 'Bình Thạnh' });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].id).toBe(facility2Id);
    });
  });

  describe('GET /api/v1/admin/facilities/:id (Task 1: Detail API)', () => {
    it('should return facility details including its courts', async () => {
      const res = await request(app).get(`/api/v1/admin/facilities/${facility1Id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(facility1Id);
      expect(res.body.data.courts).toHaveLength(2);
      expect(res.body.data.courts[0].name).toBe('Sân 1');
    });

    it('should return 404 for non-existent facility', async () => {
      const res = await request(app).get('/api/v1/admin/facilities/99999');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ADMIN_FACILITY_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/admin/facilities/:id (Task 2: Facility Status Mutation)', () => {
    it('should update facility status to SUSPENDED', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/facilities/${facility1Id}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('should re-evaluate and reactivate facility status to ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/facilities/${facility1Id}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should return 400 for invalid status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/facilities/${facility1Id}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('DELETE /api/v1/admin/facilities/:id (Task 2: Cascade Soft-Delete)', () => {
    it('should soft-delete facility and its child courts with 204 No Content', async () => {
      const res = await request(app).delete(`/api/v1/admin/facilities/${facility1Id}`);

      expect(res.status).toBe(204);

      // Verify soft deleted in DB
      const detailRes = await request(app).get(`/api/v1/admin/facilities/${facility1Id}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.deletedAt).not.toBeNull();
      // Courts should be soft deleted
      expect(detailRes.body.data.courts.every((c: any) => c.deletedAt !== null)).toBe(true);
    });

    it('should be idempotent on repeated DELETE', async () => {
      const res = await request(app).delete(`/api/v1/admin/facilities/${facility1Id}`);
      expect(res.status).toBe(204);
    });
  });

  describe('PATCH & DELETE /api/v1/admin/facilities/:facilityId/courts/:courtId (Task 3: Court Mutations)', () => {
    it('should update specific court status', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/facilities/${facility2Id}/courts/${court3Id}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should return 404 when court does not belong to the requested facility', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/facilities/${facility1Id}/courts/${court3Id}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ADMIN_COURT_NOT_FOUND');
    });

    it('should soft-delete a specific court', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/facilities/${facility2Id}/courts/${court3Id}`);

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/v1/admin/facilities (Facility Creation)', () => {
    it('should create a new facility with owner and child courts', async () => {
      const res = await request(app)
        .post('/api/v1/admin/facilities')
        .send({
          name: 'Sân Cầu Lông Cầu Giấy Arena New',
          address: '35 Trần Thái Tông, Dịch Vọng Hậu',
          city: 'Hà Nội',
          ownerName: 'Nguyễn Văn Bách',
          ownerPhone: '0987654321',
          ownerEmail: 'bach.caugiay@badminton.com',
          courtCount: 6,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Sân Cầu Lông Cầu Giấy Arena New');
      expect(res.body.data.city).toBe('Hà Nội');
      expect(res.body.data.courtStats.totalCourts).toBe(6);
      expect(res.body.data.courts).toHaveLength(6);
    });

    it('should return 400 for validation errors', async () => {
      const res = await request(app)
        .post('/api/v1/admin/facilities')
        .send({
          name: 'A', // too short
          address: '1',
          city: '',
          ownerName: '',
          ownerPhone: '123',
          ownerEmail: 'invalid-email',
        });

      expect(res.status).toBe(400);
    });
  });
});
