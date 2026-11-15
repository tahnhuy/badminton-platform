/**
 * Regenerates meta/<tag>_snapshot.json for a hand-written migration from the current
 * Drizzle schema, keeping the journal chain (id/prevId). Used when drizzle-kit generate
 * would prompt interactively (column renames). Writes only the snapshot file.
 *
 * Usage: npx tsx src/db/scripts/write-snapshot.ts 0014
 */
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { generateDrizzleJson } from 'drizzle-kit/api';
import * as schema from '../schema';

const prefix = process.argv[2];
if (!prefix || !/^\d{4}$/.test(prefix)) throw new Error('Pass the 4-digit migration prefix');
const meta = path.join(__dirname, '../migrations/meta');
const previous = String(Number(prefix) - 1).padStart(4, '0');
const prev = JSON.parse(readFileSync(path.join(meta, `${previous}_snapshot.json`), 'utf8'));
const current = JSON.parse(readFileSync(path.join(meta, `${prefix}_snapshot.json`), 'utf8'));
const generated = generateDrizzleJson(schema as Record<string, unknown>, prev.id) as Record<string, unknown>;
generated.id = current.id;
generated.prevId = prev.id;
writeFileSync(path.join(meta, `${prefix}_snapshot.json`), `${JSON.stringify(generated, null, 2)}\n`);
console.log(`Wrote ${prefix}_snapshot.json (prevId ${prev.id})`);
