import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

export const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export * from './schema';
