import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// RP-05 (database-schema.md §13.8): the 0022 migration extends REPORTS targets
// without rewriting existing rows and creates the evidence tables.

const dir = join(__dirname, '../db/migrations');
const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
const baseline = files.filter(name => Number(name.slice(0, 4)) <= 21);
const migration = readFileSync(
  join(dir, files.find(name => name.startsWith('0022'))!),
  'utf8',
);

function adminUrl(database: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function withScratchDatabase(name: string, run: (client: Client) => Promise<void>): Promise<void> {
  const admin = new Client({ connectionString: adminUrl('badminton_db') });
  await admin.connect();
  let client: Client | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    client = new Client({ connectionString: adminUrl(name) });
    await client.connect();
    await run(client);
  } finally {
    await client?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}

async function rejects(client: Client, statement: string, params: unknown[] = []): Promise<string> {
  await client.query('SAVEPOINT probe');
  try {
    await client.query(statement, params);
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT probe');
    return (error as { constraint?: string; message: string }).constraint ?? (error as Error).message;
  }
  await client.query('ROLLBACK TO SAVEPOINT probe');
  throw new Error(`Expected statement to fail: ${statement}`);
}

describe('RP-05 migration on fresh and populated databases', () => {
  it('extends targets, preserves old reports and creates evidence tables', async () => {
    await withScratchDatabase(`report_evidence_${process.pid}`, async client => {
      for (const file of baseline) await client.query(readFileSync(join(dir, file), 'utf8'));

      const first = await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('a@report.test','x','PLAYER','ACTIVE') RETURNING id");
      const second = await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('b@report.test','x','PLAYER','ACTIVE') RETURNING id");
      const reporter = first.rows[0].id as number;
      const target = second.rows[0].id as number;
      const old = await client.query(
        "INSERT INTO reports (reporter_id,reported_player_id,reason_code,status) VALUES ($1,$2,'SPAM','OPEN') RETURNING id",
        [reporter, target],
      );

      await client.query(migration);

      expect((await client.query('SELECT id FROM reports WHERE id=$1', [old.rows[0].id])).rowCount).toBe(1);
      const tables = (await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('report_evidence','report_evidence_media') ORDER BY 1",
      )).rows.map(row => row.table_name);
      expect(tables).toEqual(['report_evidence', 'report_evidence_media']);
      expect((await client.query(
        "SELECT config_value FROM system_configs WHERE config_key='REPORT_ENABLED'",
      )).rows[0]).toEqual({ config_value: 'true' });

      const columns = (await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='reports' AND column_name IN ('reported_post_id','reported_comment_id','reported_message_id','reported_attachment_id') ORDER BY 1",
      )).rows.map(row => row.column_name);
      expect(columns).toEqual([
        'reported_attachment_id', 'reported_comment_id', 'reported_message_id', 'reported_post_id',
      ]);

      const facility = await client.query(
        "INSERT INTO facilities (owner_id,name,phone,status,address,district,city,latitude,longitude,opening_time,closing_time) VALUES ($1,'F','0900000000','ACTIVE','1','D','C','10.0','106.0','06:00','22:00') RETURNING id",
        [reporter],
      );
      await client.query('BEGIN');
      expect(await rejects(client,
        'INSERT INTO reports (reporter_id,reported_player_id,reported_facility_id,reason_code,status) VALUES ($1,$2,$3,$4,$5)',
        [reporter, target, facility.rows[0].id, 'SPAM', 'OPEN'],
      )).toBe('chk_report_target');

      const post = await client.query(
        "INSERT INTO posts (author_id,type,body,published_at,creation_hash) VALUES ($1,'FREE','body',now(),$2) RETURNING id",
        [reporter, 'a'.repeat(64)],
      );
      const comment = await client.query(
        "INSERT INTO post_comments (post_id,author_id,body,creation_hash) VALUES ($1,$2,'comment',$3) RETURNING id",
        [post.rows[0].id, reporter, 'a'.repeat(64)],
      );
      const conversation = await client.query(
        "INSERT INTO conversations (type,title,created_by) VALUES ('GROUP','T',$1) RETURNING id",
        [reporter],
      );
      const message = await client.query(
        "INSERT INTO messages (conversation_id,seq,sender_id,body,client_message_id,content_hash) VALUES ($1,1,$2,'hello',gen_random_uuid(),$3) RETURNING id",
        [conversation.rows[0].id, reporter, 'a'.repeat(64)],
      );
      const media = await client.query(
        "INSERT INTO media_files (owner_id,kind,mime_type,byte_size,sha256,storage_key) VALUES ($1,'IMAGE','image/png',3,$2,gen_random_uuid()::text) RETURNING id",
        [reporter, 'a'.repeat(64)],
      );
      const attachment = await client.query(
        'INSERT INTO message_attachments (message_id,media_id,position) VALUES ($1,$2,1) RETURNING id',
        [message.rows[0].id, media.rows[0].id],
      );

      expect(await rejects(client,
        'INSERT INTO reports (reporter_id,reported_attachment_id,reason_code,status) VALUES ($1,$2,$3,$4)',
        [reporter, attachment.rows[0].id, 'SPAM', 'OPEN'],
      )).toBe('chk_report_attachment_requires_message');

      for (const [column, id] of [
        ['reported_post_id', post.rows[0].id],
        ['reported_comment_id', comment.rows[0].id],
        ['reported_message_id', message.rows[0].id],
      ] as const) {
        const row = await client.query(
          `INSERT INTO reports (reporter_id,${column},reason_code,status) VALUES ($1,$2,'SPAM','OPEN') RETURNING id`,
          [reporter, id],
        );
        expect(row.rowCount).toBe(1);
      }

      const report = await client.query(
        "INSERT INTO reports (reporter_id,reported_message_id,reported_attachment_id,reason_code,status) VALUES ($1,$2,$3,'SPAM','OPEN') RETURNING id",
        [reporter, message.rows[0].id, attachment.rows[0].id],
      );
      await client.query('INSERT INTO report_evidence (report_id,content_text) VALUES ($1,$2)', [report.rows[0].id, 'hello']);
      await client.query('INSERT INTO report_evidence_media (report_id,media_id) VALUES ($1,$2)', [report.rows[0].id, media.rows[0].id]);
      expect((await client.query(
        'SELECT content_text FROM report_evidence WHERE report_id=$1', [report.rows[0].id],
      )).rows[0]).toEqual({ content_text: 'hello' });
      await client.query('COMMIT');
    });
  });
});
