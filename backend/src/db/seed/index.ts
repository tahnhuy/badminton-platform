/**
 * Demo seed — one coherent dataset for manual testing and presentations (docs/plans/demo-seed-plan.md).
 *
 *   npm run db:reset -- --yes        back up, wipe, migrate, seed (local DB)
 *   npm run db:seed                  seed a freshly migrated, empty DB
 *   SEED_TARGET=demo npm run db:reset -- --yes   same on a remote demo server
 *
 * Never runs with NODE_ENV=production. Production only runs migrations + db:create-admin.
 */
// Wire the application exactly as the server does (registers ports such as the block port);
// building the Express app does not listen on a port or start workers.
import '../../app';
import { sql } from 'drizzle-orm';
import { db, pool } from '../index';
import { env } from '../../shared/config/env';
import { passwordHasher } from '../../services/auth/password-hasher';
import { withdrawalPinHasher } from '../../services/auth/withdrawal-pin-hasher';
import { createClock } from './lib/clock';
import { createRandom } from './lib/random';
import { resetDatabase } from './reset';
import { DEMO_ADMIN, DEMO_OWNERS, DEMO_PASSWORD, DEMO_PLAYERS, DEMO_WITHDRAWAL_PIN, MAIN_PLAYER_KEY } from './data/people';
import { seedAccounts } from './steps/01-accounts';
import { seedFacilities } from './steps/02-facilities';
import { seedWallets } from './steps/03-wallets';
import { seedBookings } from './steps/04-bookings';
import { seedFinance } from './steps/05-finance';
import { seedMatchmaking } from './steps/06-matchmaking';
import { seedRatings } from './steps/07-ratings';
import { seedSocial } from './steps/08-social';
import { seedTournaments } from './steps/10-tournaments';
import { seedMessaging } from './steps/09-messaging';
import { finalizeAndVerify, printSummary } from './steps/99-verify';
import type { SeedContext } from './context';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const reset = args.has('--reset');
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DIRECT_URL / DATABASE_URL is not set');

  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data with NODE_ENV=production');
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host) && process.env.SEED_TARGET !== 'demo') {
    throw new Error(`Database host "${host}" is not local. Set SEED_TARGET=demo to seed a remote demo server.`);
  }

  const log = (message: string) => console.log(`• ${message}`);
  if (reset) {
    if (!args.has('--yes')) throw new Error('db:reset wipes the whole database. Re-run with: npm run db:reset -- --yes');
    await resetDatabase(url, { backup: !args.has('--no-backup'), log });
  } else {
    const existing = await db.execute(sql`SELECT COUNT(*) AS n FROM users`);
    if (Number((existing.rows[0] as { n: string }).n) > 0) {
      throw new Error('The database already has users. The demo seed needs an empty DB: npm run db:reset -- --yes');
    }
  }

  const started = Date.now();
  const ctx: SeedContext = {
    clock: createClock(),
    random: createRandom(),
    passwordHash: await passwordHasher.hash(DEMO_PASSWORD),
    pinHash: await withdrawalPinHasher.hash(DEMO_WITHDRAWAL_PIN),
    adminId: 0,
    owners: new Map(),
    players: new Map(),
    facilities: [],
    completedMatches: [],
    log,
  };

  await seedAccounts(ctx);
  await seedFacilities(ctx);
  await seedWallets(ctx);
  await seedBookings(ctx);
  await seedFinance(ctx);
  await seedSocial(ctx);
  await seedMessaging(ctx);
  await seedMatchmaking(ctx);
  await seedRatings(ctx);
  await seedTournaments(ctx);
  await finalizeAndVerify(ctx);
  await printSummary();

  const main = DEMO_PLAYERS.find(p => p.key === MAIN_PLAYER_KEY)!;
  console.log(`\nXong sau ${((Date.now() - started) / 1000).toFixed(1)} s. Mật khẩu chung: ${DEMO_PASSWORD} · PIN rút tiền: ${DEMO_WITHDRAWAL_PIN}`);
  console.log(`  Người chơi demo chính  ${main.email}`);
  console.log(`  Admin                  ${DEMO_ADMIN.email}`);
  console.log(`  Chủ sân                ${DEMO_OWNERS.map(o => o.email).join(', ')}`);
  console.log(`  Người chơi             player01@smashpro.vn … player${String(DEMO_PLAYERS.length - 1).padStart(2, '0')}@smashpro.vn`);
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack && process.env.SEED_DEBUG) console.error(error.stack);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
