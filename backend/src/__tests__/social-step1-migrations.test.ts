import { Client } from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { configDefinitions, ConfigKey } from '../shared/config/config-registry';

// SOC-01 (0011), SC-12 (0012) and NTF-01 (0013) on isolated scratch databases,
// following the matchmaking-migration.test.ts pattern. Never touches badminton_db data.
const dir = join(__dirname, '../db/migrations');
const files = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
const before = files.filter(name => Number(name.slice(0, 4)) <= 10);
const sql = (prefix: string) => readFileSync(join(dir, files.find(name => name.startsWith(prefix))!), 'utf8');

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

async function applyBaseline(client: Client): Promise<void> {
  for (const file of before) await client.query(readFileSync(join(dir, file), 'utf8'));
}

async function applyStep1(client: Client): Promise<void> {
  await client.query(sql('0011'));
  await client.query(sql('0012'));
  await client.query(sql('0013'));
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

const hash = 'a'.repeat(64);

describe('Step 1 migrations on fresh and populated databases', () => {
  for (const populated of [false, true]) {
    it(`applies 0011–0013 on a ${populated ? 'populated' : 'fresh'} database and preserves history`, async () => {
      await withScratchDatabase(`social_step1_${process.pid}_${populated ? 'populated' : 'fresh'}`, async client => {
        await applyBaseline(client);
        let before: Record<string, unknown> = {};
        if (populated) {
          const player = await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('p@test.test','x','PLAYER','ACTIVE') RETURNING id");
          const other = await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('o@test.test','x','PLAYER','ACTIVE') RETURNING id");
          await client.query("INSERT INTO reports (reporter_id,reported_player_id,reason_code,status) VALUES ($1,$2,'SPAM','OPEN')", [player.rows[0].id, other.rows[0].id]);
          await client.query("INSERT INTO notifications (user_id,type,title,content) VALUES ($1,'LEGACY','t','c'),($1,'LEGACY','t2','c2')", [player.rows[0].id]);
          // Admin-chosen value that must survive: the pre-extension 15-minute invitation timeout.
          await client.query("UPDATE system_configs SET config_value='15' WHERE config_key='MATCHMAKING_INVITATION_TIMEOUT_MINUTES'");
          await client.query("UPDATE system_configs SET config_value='8' WHERE config_key='PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS'");
          before = {
            notifications: (await client.query('SELECT id,user_id,type,title,content,is_read FROM notifications ORDER BY id')).rows,
            reports: (await client.query('SELECT * FROM reports ORDER BY id')).rows,
            configs: (await client.query('SELECT config_key,config_value FROM system_configs ORDER BY config_key')).rows,
          };
        }
        await applyStep1(client);

        const tables = (await client.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('media_files','posts','post_images','post_reactions','post_comments','conversations','messages') ORDER BY 1",
        )).rows.map(row => row.table_name);
        // No recruitment or Messaging schema in this step.
        expect(tables).toEqual(['media_files', 'post_comments', 'post_images', 'post_reactions', 'posts']);
        expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='matchmaking_requests' AND column_name='post_id'")).rowCount).toBe(0);

        const columns = (await client.query(
          "SELECT column_name,is_nullable FROM information_schema.columns WHERE table_name='notifications' AND column_name IN ('resource_type','resource_id','dedup_key') ORDER BY 1",
        )).rows;
        expect(columns).toEqual([
          { column_name: 'dedup_key', is_nullable: 'YES' },
          { column_name: 'resource_id', is_nullable: 'YES' },
          { column_name: 'resource_type', is_nullable: 'YES' },
        ]);
        const indexes = (await client.query(
          "SELECT indexname, indexdef FROM pg_indexes WHERE tablename='notifications' AND indexname IN ('uq_notifications_user_dedup_key','notifications_user_read_created_idx') ORDER BY 1",
        )).rows;
        expect(indexes.map(row => row.indexname)).toEqual(['notifications_user_read_created_idx', 'uq_notifications_user_dedup_key']);
        expect(indexes[1].indexdef).toContain('WHERE (dedup_key IS NOT NULL)');

        const configs = new Map((await client.query('SELECT config_key,config_value FROM system_configs')).rows.map(row => [row.config_key, row.config_value]));
        // 0007 already seeded 15; SC-12 must keep it (the absent-key → 1440 case is covered below).
        expect(configs.get('MATCHMAKING_INVITATION_TIMEOUT_MINUTES')).toBe('15');
        expect(configs.get('MATCHMAKING_APPLICATION_TIMEOUT_MINUTES')).toBe('1440');
        expect(configs.get('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES')).toBe(populated ? '8' : '5');
        expect(configs.get('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS')).toBe(populated ? '8' : '5');
        expect(configs.get('MATCHMAKING_REQUEST_EXPIRATION_MINUTES')).toBe('30');

        if (populated) {
          expect((await client.query('SELECT id,user_id,type,title,content,is_read FROM notifications ORDER BY id')).rows).toEqual(before.notifications);
          expect((await client.query('SELECT resource_type,resource_id,dedup_key FROM notifications')).rows.every(row => row.resource_type === null && row.dedup_key === null)).toBe(true);
          expect((await client.query('SELECT * FROM reports ORDER BY id')).rows).toEqual(before.reports);
          const kept = (await client.query('SELECT config_key,config_value FROM system_configs ORDER BY config_key')).rows;
          for (const row of before.configs as Array<{ config_key: string; config_value: string }>) {
            expect(kept).toContainEqual(row);
          }
        }
      });
    });
  }
});

describe('SOC-01 constraints, SC-12 preflight and NTF-01 dedup index', () => {
  let client: Client;
  let admin: Client;
  const name = `social_step1_${process.pid}_constraints`;
  let author: number;
  let other: number;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminUrl('badminton_db') });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${name}"`);
    client = new Client({ connectionString: adminUrl(name) });
    await client.connect();
    await applyBaseline(client);
    await applyStep1(client);
    author = (await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('a@test.test','x','PLAYER','ACTIVE') RETURNING id")).rows[0].id;
    other = (await client.query("INSERT INTO users (email,password_hash,role,status) VALUES ('b@test.test','x','PLAYER','ACTIVE') RETURNING id")).rows[0].id;
  });

  afterAll(async () => {
    await client?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
    await admin.end();
  });

  it('enforces the §13.2 post CHECKs', async () => {
    await client.query('BEGIN');
    try {
      const insert = 'INSERT INTO posts (author_id,type,title,body,published_at,hidden_at,hidden_by,creation_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)';
      expect(await rejects(client, insert, [author, 'FREE', 'Title', 'b', new Date(), null, null, hash])).toBe('chk_posts_title');
      expect(await rejects(client, insert, [author, 'FREE', null, 'b', null, null, null, hash])).toBe('chk_posts_published');
      expect(await rejects(client, insert, [author, 'FREE', null, 'b', new Date(), null, other, hash])).toBe('chk_posts_hidden');
      expect(await rejects(client, insert, [author, 'FREE', null, 'b', new Date(), new Date(), null, hash])).toBe('chk_posts_hidden');
      expect(await rejects(client, insert, [author, 'FREE', null, 'x'.repeat(2001), new Date(), null, null, hash])).toBe('chk_posts_body_length');
      expect(await rejects(client, insert, [author, 'OTHER', null, 'b', new Date(), null, null, hash])).toBe('chk_posts_type');
      // Allowed shapes: FREE published; MATCH_FINDING unpublished with title; 2000 chars; legacy NULL hash.
      await client.query(insert, [author, 'FREE', null, 'x'.repeat(2000), new Date(), null, null, hash]);
      await client.query(insert, [author, 'MATCH_FINDING', 'Kèo tối', null, null, null, null, null]);
      await client.query(insert, [author, 'FREE', null, 'hidden', new Date(), new Date(), other, hash]);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('rejects a second post or comment with the same author and client_request_id', async () => {
    await client.query('BEGIN');
    try {
      const key = '7f8d5a0e-2a6b-4b8c-9a51-0f1f2e3d4c5b';
      const insertPost = "INSERT INTO posts (author_id,type,body,published_at,client_request_id,creation_hash) VALUES ($1,'FREE','b',now(),$2,$3) RETURNING id";
      const post = (await client.query(insertPost, [author, key, hash])).rows[0].id;
      expect(await rejects(client, insertPost, [author, key, hash])).toBe('uq_posts_author_client_request');
      await client.query(insertPost, [other, key, hash]);
      await client.query("INSERT INTO posts (author_id,type,body,published_at,creation_hash) VALUES ($1,'FREE','b',now(),$2),($1,'FREE','b',now(),$2)", [author, hash]);

      const insertComment = 'INSERT INTO post_comments (post_id,author_id,body,client_request_id,creation_hash) VALUES ($1,$2,$3,$4,$5)';
      await client.query(insertComment, [post, other, 'hi', key, hash]);
      expect(await rejects(client, insertComment, [post, other, 'again', key, hash])).toBe('uq_post_comments_author_client_request');
      expect(await rejects(client, insertComment, [post, other, '   ', null, hash])).toBe('chk_post_comments_body');
      expect(await rejects(client, insertComment, [post, other, 'x'.repeat(501), null, hash])).toMatch(/too long/);
      expect(await rejects(client, insertComment, [post, other, 'no hash', null, null])).toMatch(/null value/);
      await client.query(insertComment, [post, other, 'x'.repeat(500), null, hash]);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('keeps creation_hash immutable while other columns stay editable', async () => {
    await client.query('BEGIN');
    try {
      const post = (await client.query("INSERT INTO posts (author_id,type,body,published_at,creation_hash) VALUES ($1,'FREE','b',now(),$2) RETURNING id", [author, hash])).rows[0].id;
      const legacy = (await client.query("INSERT INTO posts (author_id,type) VALUES ($1,'MATCH_FINDING') RETURNING id", [author])).rows[0].id;
      const comment = (await client.query("INSERT INTO post_comments (post_id,author_id,body,creation_hash) VALUES ($1,$2,'c',$3) RETURNING id", [post, other, hash])).rows[0].id;
      expect(await rejects(client, 'UPDATE posts SET creation_hash=$2 WHERE id=$1', [post, 'b'.repeat(64)])).toMatch(/creation_hash is immutable/);
      expect(await rejects(client, 'UPDATE posts SET creation_hash=$2 WHERE id=$1', [legacy, 'b'.repeat(64)])).toMatch(/creation_hash is immutable/);
      expect(await rejects(client, 'UPDATE post_comments SET creation_hash=$2 WHERE id=$1', [comment, 'b'.repeat(64)])).toMatch(/creation_hash is immutable/);
      await client.query("UPDATE posts SET body='edited', edited_at=now(), creation_hash=creation_hash WHERE id=$1", [post]);
      await client.query('UPDATE post_comments SET deleted_at=now(), deleted_by=$2 WHERE id=$1', [comment, author]);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('enforces media, image, and reaction constraints', async () => {
    await client.query('BEGIN');
    try {
      const insertMedia = 'INSERT INTO media_files (owner_id,kind,mime_type,byte_size,sha256,storage_key,state) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id';
      const media = (await client.query(insertMedia, [author, 'IMAGE', 'image/png', 10, hash, 'k1', 'READY'])).rows[0].id;
      expect(await rejects(client, insertMedia, [author, 'VIDEO', 'video/mp4', 10, hash, 'k2', 'READY'])).toBe('chk_media_files_kind');
      expect(await rejects(client, insertMedia, [author, 'IMAGE', 'image/png', 0, hash, 'k3', 'READY'])).toBe('chk_media_files_byte_size');
      expect(await rejects(client, insertMedia, [author, 'IMAGE', 'image/png', 1, hash, 'k4', 'DELETED'])).toBe('chk_media_files_state');
      expect(await rejects(client, insertMedia, [author, 'IMAGE', 'image/png', 1, hash, 'k1', 'READY'])).toBe('uq_media_files_storage_key');

      const post = (await client.query("INSERT INTO posts (author_id,type,body,published_at,creation_hash) VALUES ($1,'FREE','b',now(),$2) RETURNING id", [author, hash])).rows[0].id;
      const insertImage = 'INSERT INTO post_images (post_id,media_id,position,detached_at) VALUES ($1,$2,$3,$4)';
      await client.query(insertImage, [post, media, 1, null]);
      expect(await rejects(client, insertImage, [post, media, 1, null])).toBe('uq_post_images_active_position');
      expect(await rejects(client, insertImage, [post, media, 5, null])).toBe('chk_post_images_position');
      expect(await rejects(client, insertImage, [post, 999999, 2, null])).toBe('post_images_media_id_media_files_id_fk');
      await client.query(insertImage, [post, media, 1, new Date()]);

      const react = 'INSERT INTO post_reactions (post_id,user_id,type) VALUES ($1,$2,$3)';
      await client.query(react, [post, other, 'LOVE']);
      expect(await rejects(client, react, [post, other, 'LIKE'])).toBe('post_reactions_pkey');
      expect(await rejects(client, react, [post, author, 'CLAP'])).toBe('chk_post_reactions_type');
    } finally {
      await client.query('ROLLBACK');
    }
  });

  it('keeps one notification per (user, dedup_key) and allows legacy NULL keys', async () => {
    await client.query('BEGIN');
    try {
      const insert = "INSERT INTO notifications (user_id,type,title,content,dedup_key) VALUES ($1,'T','t','c',$2)";
      await client.query(insert, [author, 'k']);
      expect(await rejects(client, insert, [author, 'k'])).toBe('uq_notifications_user_dedup_key');
      await client.query(insert, [other, 'k']);
      await client.query(insert, [author, null]);
      await client.query(insert, [author, null]);
    } finally {
      await client.query('ROLLBACK');
    }
  });

  async function runSeed(setup: string[]): Promise<Map<string, string> | string> {
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM system_configs');
      for (const statement of setup) await client.query(statement);
      try {
        await client.query(sql('0012'));
      } catch (error) {
        return (error as Error).message;
      }
      return new Map((await client.query('SELECT config_key,config_value FROM system_configs')).rows.map(row => [row.config_key, row.config_value]));
    } finally {
      await client.query('ROLLBACK');
    }
  }

  const seedRow = (key: string, value: string) => `INSERT INTO system_configs (config_key,config_value) VALUES ('${key}','${value}')`;

  it('seeds every §8.9 key with the registry default when absent and never overwrites', async () => {
    const empty = await runSeed([]);
    expect(empty).toBeInstanceOf(Map);
    const seeded = empty as Map<string, string>;
    const keys = (Object.keys(configDefinitions) as ConfigKey[]).filter(key =>
      ['social', 'messaging'].includes(configDefinitions[key].domain)
      || ['MATCHMAKING_APPLICATION_TIMEOUT_MINUTES', 'MATCHMAKING_INVITATION_TIMEOUT_MINUTES', 'MATCHMAKING_GROUP_MIN_SLOTS',
        'MATCHMAKING_GROUP_MAX_SLOTS', 'MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', 'PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES'].includes(key));
    expect(keys).toHaveLength(13);
    for (const key of keys) expect(seeded.get(key)).toBe(String(configDefinitions[key].defaultValue));
    expect(seeded.size).toBe(13);

    const kept = await runSeed([seedRow('MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '15'), seedRow('SOCIAL_FEED_ENABLED', 'false')]);
    expect((kept as Map<string, string>).get('MATCHMAKING_INVITATION_TIMEOUT_MINUTES')).toBe('15');
    expect((kept as Map<string, string>).get('SOCIAL_FEED_ENABLED')).toBe('false');
  });

  it('copies MIN_MATCHES from stored MIN_RATINGS only when MIN_MATCHES is absent', async () => {
    expect((await runSeed([seedRow('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '7')]) as Map<string, string>).get('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES')).toBe('7');
    const both = await runSeed([seedRow('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '7'), seedRow('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES', '9')]);
    expect((both as Map<string, string>).get('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES')).toBe('9');
    // Invalid copy source is irrelevant when MIN_MATCHES already exists.
    expect(await runSeed([seedRow('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '500'), seedRow('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES', '9')])).toBeInstanceOf(Map);
  });

  it('stops without writing when a stored value is outside its approved range', async () => {
    for (const [key, value] of [
      ['MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '14'],
      ['MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '10081'],
      ['MESSAGING_ENABLED', 'yes'],
      ['SOCIAL_COMMENTS_PER_MINUTE', '1.5'],
      ['MATCHMAKING_GROUP_MAX_SLOTS', '21'],
      ['PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', '0'],
    ]) {
      const outcome = await runSeed([seedRow(key, value)]);
      expect(outcome, `${key}=${value}`).toMatch(/SC-12 preflight stopped/);
      expect(outcome).toContain(key);
    }
    expect(await runSeed([seedRow('MATCHMAKING_GROUP_MIN_SLOTS', '15')])).toMatch(/GROUP_MIN_SLOTS \(15\) > MATCHMAKING_GROUP_MAX_SLOTS \(12\)/);
    expect(await runSeed([seedRow('MATCHMAKING_GROUP_MIN_SLOTS', '15'), seedRow('MATCHMAKING_GROUP_MAX_SLOTS', '15')])).toBeInstanceOf(Map);
    // Nothing was written by the failed runs (each ran in a rolled-back transaction; verify the stop itself writes nothing).
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM system_configs');
      await client.query(seedRow('MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '10'));
      await client.query('SAVEPOINT seed');
      await expect(client.query(sql('0012'))).rejects.toThrow(/SC-12 preflight stopped/);
      await client.query('ROLLBACK TO SAVEPOINT seed');
      expect((await client.query('SELECT config_key,config_value FROM system_configs')).rows).toEqual([
        { config_key: 'MATCHMAKING_INVITATION_TIMEOUT_MINUTES', config_value: '10' },
      ]);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
