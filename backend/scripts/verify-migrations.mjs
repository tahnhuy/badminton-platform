import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const migrationsDir = path.join(root, 'src', 'db', 'migrations');
const metaDir = path.join(migrationsDir, 'meta');
const journalPath = path.join(metaDir, '_journal.json');
const binary = path.join(root, 'node_modules', '.bin', 'drizzle-kit');

function fail(message) {
  console.error(`\n[verify:migrations] FAIL: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(journalPath)) fail(`missing journal: ${journalPath}`);
if (!fs.existsSync(binary)) fail(`missing drizzle-kit binary: ${binary}`);

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const entries = [...(journal.entries ?? [])].sort((a, b) => a.idx - b.idx);
if (entries.length === 0) fail('journal has no entries');

const seenIdx = new Set();
const seenTags = new Set();
for (const entry of entries) {
  if (seenIdx.has(entry.idx)) fail(`duplicate journal idx ${entry.idx}`);
  if (seenTags.has(entry.tag)) fail(`duplicate journal tag ${entry.tag}`);
  seenIdx.add(entry.idx);
  seenTags.add(entry.tag);
  const sqlPath = path.join(migrationsDir, `${entry.tag}.sql`);
  if (!fs.existsSync(sqlPath)) fail(`journal entry ${entry.tag} has no ${entry.tag}.sql`);
}

const sqlFiles = fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql'));
for (const file of sqlFiles) {
  const tag = file.slice(0, -4);
  if (!seenTags.has(tag)) fail(`migration file ${file} has no journal entry`);
}

const latest = entries[entries.length - 1];
const padded = String(latest.idx).padStart(4, '0');
const snapshotName = `${padded}_snapshot.json`;
const snapshotPath = path.join(metaDir, snapshotName);
if (!fs.existsSync(snapshotPath)) fail(`latest journal idx ${latest.idx} has no ${snapshotName}`);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badminton-drizzle-check-'));
try {
  fs.mkdirSync(path.join(tempDir, 'meta'), { recursive: true });
  fs.copyFileSync(journalPath, path.join(tempDir, 'meta', '_journal.json'));
  fs.copyFileSync(snapshotPath, path.join(tempDir, 'meta', snapshotName));

  try {
    execFileSync(
      binary,
      [
        'generate',
        '--dialect', 'postgresql',
        '--schema', './src/db/schema/index.ts',
        '--out', tempDir,
      ],
      { cwd: root, stdio: 'pipe', encoding: 'utf8' },
    );
  } catch (error) {
    const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
    fail(`drizzle-kit generate failed\n${output}`);
  }

  const generated = fs.readdirSync(tempDir).filter(name => name.endsWith('.sql'));
  if (generated.length > 0) {
    fail(`schema has uncommitted migration(s): ${generated.join(', ')}. Run db:generate and review.`);
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log(`[verify:migrations] OK: ${sqlFiles.length} migrations, latest ${latest.tag}, no schema diff.`);
