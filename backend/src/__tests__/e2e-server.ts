// Set test environment variables BEFORE importing app or env
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test';
process.env.DIRECT_URL = process.env.DIRECT_URL || 'postgres://badminton_user:badminton_password@localhost:5433/badminton_test';
process.env.PORT = process.env.PORT || '3000';
process.env.COOKIE_SECURE = 'false';
process.env.ALLOW_TEST_AUTH = 'true';

import { ensureTestDatabase, cleanTestDatabase } from './test-db';
import { createTestUser } from './test-helpers';
import { resetRateLimitStores } from '../middleware/rate-limit.middleware';
import { app } from '../app';
import { db, facilities, courts, courtPricings } from '../db';
import { logger } from '../shared/logging/logger';

async function main() {
  await ensureTestDatabase();

  // Test-only routes registered only in this test runner (never in app.ts or index.ts)
  app.post('/api/v1/test/reset', async (_req, res) => {
    resetRateLimitStores();
    await cleanTestDatabase();
    res.status(200).json({ status: 'ok' });
  });

  app.post('/api/v1/test/create-user', async (req, res) => {
    try {
      const user = await createTestUser(req.body);
      res.status(201).json({
        id: user.id,
        email: user.email,
        plainPassword: user.plainPassword,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Test-only booking fixture: one active facility + court with pricing.
  app.post('/api/v1/test/seed-court', async (_req, res) => {
    try {
      const owner = await createTestUser({ role: 'COURT_OWNER' });
      const [facility] = await db
        .insert(facilities)
        .values({
          ownerId: owner.id,
          name: 'E2E Badminton Club',
          phone: '0900000000',
          status: 'ACTIVE',
          address: '1 Đường E2E',
          ward: 'Tân Thuận Đông',
          district: 'Quận 7',
          city: 'Hồ Chí Minh',
          latitude: '10.7',
          longitude: '106.7',
          openingTime: '06:00:00',
          closingTime: '22:00:00',
        })
        .returning();

      const [court] = await db
        .insert(courts)
        .values({ facilityId: facility.id, name: 'Sân E2E', status: 'ACTIVE' })
        .returning();

      await db.insert(courtPricings).values([
        { courtId: court.id, startTime: '06:00:00', endTime: '17:00:00', price: '80000', validFrom: '2025-01-01' },
        { courtId: court.id, startTime: '17:00:00', endTime: '22:00:00', price: '120000', validFrom: '2025-01-01' },
      ]);

      res.status(201).json({ facilityId: facility.id, courtId: court.id });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, () => {
    logger.info(`E2E test backend server running on port ${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start E2E test backend:', err);
  process.exit(1);
});
