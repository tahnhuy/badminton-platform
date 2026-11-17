import './e2e-env';

import { seedRatingFixture } from './rating-fixture';
import { ensureTestDatabase, cleanTestDatabase } from './test-db';
import { createTestUser } from './test-helpers';
import { resetRateLimitStores } from '../middleware/rate-limit.middleware';
import { app } from '../app';
import { refundService } from '../services/payments/RefundService';
import { matchmakingExpiryService } from '../services/matchmaking/MatchmakingExpiryService';
import { bookingStateService } from '../services/booking/booking-state.service';
import { db, pool, facilities, courts, courtPricings } from '../db';
import { logger } from '../shared/logging/logger';
import { registerBlockPort } from '../services/matchmaking/block-port.registry';
import { testBlockPort } from './test-block-port';

async function main() {
  const current = await pool.query('SELECT current_database() AS name');
  if (current.rows[0].name !== 'badminton_test') throw new Error('E2E server requires badminton_test');
  // TEST-ONLY BlockPort double until the Messaging MSG-08 provider is merged (never in index.ts).
  registerBlockPort(testBlockPort);
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

      res.status(201).json({ facilityId: facility.id, courtId: court.id, ownerId: owner.id, ownerEmail: owner.email, ownerPassword: owner.plainPassword });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Real background workers are interval-driven in production. The E2E runner is
  // short-lived, so expose a deterministic trigger (no API interception or money mock).
  app.post('/api/v1/test/run-jobs', async (_req, res, next) => {
    try {
      const matchmaking = await matchmakingExpiryService.runOnce();
      const refunds = await refundService.processPending();
      const booking = await bookingStateService.runOnce();
      res.json({ refunds, matchmaking, booking });
    } catch (error) { next(error); }
  });

  app.post('/api/v1/test/seed-ratings', async (_req, res, next) => {
    try { res.json(await seedRatingFixture()); } catch (error) { next(error); }
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
