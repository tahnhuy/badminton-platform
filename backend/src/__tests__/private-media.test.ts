import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import sharp from 'sharp';
import path from 'path';
import { createHash } from 'crypto';
import { mkdtempSync, mkdirSync, symlinkSync, existsSync, readFileSync, writeFileSync, utimesSync, readdirSync, renameSync } from 'fs';
import { tmpdir } from 'os';
import { eq, sql } from 'drizzle-orm';
import { app } from '../app';
import { db, mediaFiles, posts, postImages } from '../db';
import { privateMediaService } from '../services/media/PrivateMediaService';
import { validatePrivateUploadsRoot } from '../shared/storage/private-root';
import { PrivateMediaStorage } from '../shared/storage/private-media';
import { uploadsRoot } from '../shared/storage/avatar-storage';
import { parsePrivateImages } from '../middleware/private-image-upload.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { createTestUser } from './test-helpers';

// SOC-02 (Social Tech Design §7.4, schema §13.9).
const CODE = { invalidImageCode: 'SOCIAL_IMAGE_INVALID' };
const root = privateMediaService.storage.root;
const mediaPath = (key: string) => path.join(root, 'media', key);
const hash = 'a'.repeat(64);

async function png(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#0a0' } }).png().toBuffer();
}
async function jpegWithExif(): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: '#a00' } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: 'secret-owner', Artist: 'gps-proxy' } } })
    .toBuffer();
}

async function storeOne(ownerId: number, bytes?: Buffer, mimetype = 'image/png') {
  const buffer = bytes ?? await png();
  return privateMediaService.transaction(tx => privateMediaService.storeImages([{ buffer, mimetype }], ownerId, tx, CODE));
}

async function keyOf(mediaId: number): Promise<string> {
  const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, mediaId));
  return row.storageKey;
}

describe('PRIVATE_UPLOADS_DIR startup validation', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'private-root-check-'));
  const publicRoot = path.join(base, 'public');
  mkdirSync(publicRoot, { recursive: true });

  it('rejects missing, relative, non-existent and public-root paths, including via symlink', () => {
    expect(validatePrivateUploadsRoot(undefined, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR is required']);
    expect(validatePrivateUploadsRoot('relative/dir', [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR must be an absolute path']);
    expect(validatePrivateUploadsRoot(path.join(base, 'absent'), [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR must be an existing directory']);
    const inside = path.join(publicRoot, 'private');
    mkdirSync(inside);
    expect(validatePrivateUploadsRoot(inside, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR must not be inside a public static root']);
    expect(validatePrivateUploadsRoot(publicRoot, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR must not be inside a public static root']);
    const link = path.join(base, 'link');
    symlinkSync(inside, link);
    expect(validatePrivateUploadsRoot(link, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR must not be inside a public static root']);
  });

  it('accepts a writable directory outside public roots and prepares tmp/ and media/', () => {
    const ok = path.join(base, 'ok');
    mkdirSync(ok);
    expect(validatePrivateUploadsRoot(ok, [publicRoot])).toEqual([]);
    expect(existsSync(path.join(ok, 'tmp'))).toBe(true);
    expect(existsSync(path.join(ok, 'media'))).toBe(true);
    expect(readdirSync(path.join(ok, 'tmp'))).toEqual([]);
  });

  // Review step 2 finding 1: tmp/ and media/ are checked through their realpath.
  function freshRoot(name: string): string {
    const dir = path.join(base, name);
    mkdirSync(dir);
    return dir;
  }

  it('rejects tmp/ or media/ symlinked into a public root outside the private root, without writing there', () => {
    const viaMedia = freshRoot('media-to-public');
    const leakMedia = path.join(publicRoot, 'leak-media');
    mkdirSync(leakMedia);
    symlinkSync(leakMedia, path.join(viaMedia, 'media'));
    expect(validatePrivateUploadsRoot(viaMedia, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR/media must resolve inside PRIVATE_UPLOADS_DIR']);

    const viaTmp = freshRoot('tmp-to-public');
    const leakTmp = path.join(publicRoot, 'leak-tmp');
    mkdirSync(leakTmp);
    symlinkSync(leakTmp, path.join(viaTmp, 'tmp'));
    expect(validatePrivateUploadsRoot(viaTmp, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR/tmp must resolve inside PRIVATE_UPLOADS_DIR']);
    expect(readdirSync(leakTmp)).toEqual([]); // the write probe never ran in the public dir
  });

  it('rejects tmp/ or media/ symlinked outside the private root (non-public target)', () => {
    const outside = path.join(base, 'elsewhere');
    mkdirSync(outside);
    const viaTmp = freshRoot('tmp-outside');
    symlinkSync(outside, path.join(viaTmp, 'tmp'));
    expect(validatePrivateUploadsRoot(viaTmp, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR/tmp must resolve inside PRIVATE_UPLOADS_DIR']);
    const viaMedia = freshRoot('media-outside');
    symlinkSync(outside, path.join(viaMedia, 'media'));
    expect(validatePrivateUploadsRoot(viaMedia, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR/media must resolve inside PRIVATE_UPLOADS_DIR']);
    const dangling = freshRoot('media-dangling');
    symlinkSync(path.join(base, 'does-not-exist'), path.join(dangling, 'media'));
    expect(validatePrivateUploadsRoot(dangling, [publicRoot])).toEqual(['PRIVATE_UPLOADS_DIR/media must be an existing directory']);
    expect(readdirSync(outside)).toEqual([]);
  });

  it('rejects tmp/ or media/ resolving into a public root nested inside the private root, and tmp/ aliasing media/', () => {
    const root = freshRoot('nested-public');
    const nestedPublic = path.join(root, 'www');
    mkdirSync(path.join(nestedPublic, 'm'), { recursive: true });
    symlinkSync(path.join(nestedPublic, 'm'), path.join(root, 'media'));
    expect(validatePrivateUploadsRoot(root, [nestedPublic])).toEqual(['PRIVATE_UPLOADS_DIR/media must not be inside a public static root']);

    const alias = freshRoot('tmp-alias-media');
    mkdirSync(path.join(alias, 'media'));
    symlinkSync(path.join(alias, 'media'), path.join(alias, 'tmp'));
    expect(validatePrivateUploadsRoot(alias, [publicRoot]))
      .toEqual(['PRIVATE_UPLOADS_DIR/tmp and PRIVATE_UPLOADS_DIR/media must be separate directories']);
  });

  it('accepts tmp/ and media/ symlinked to separate directories inside the private root', () => {
    const root = freshRoot('symlinked-ok');
    mkdirSync(path.join(root, 'store', 't'), { recursive: true });
    mkdirSync(path.join(root, 'store', 'm'), { recursive: true });
    symlinkSync(path.join(root, 'store', 't'), path.join(root, 'tmp'));
    symlinkSync(path.join(root, 'store', 'm'), path.join(root, 'media'));
    expect(validatePrivateUploadsRoot(root, [publicRoot])).toEqual([]);
    expect(readdirSync(path.join(root, 'store', 't'))).toEqual([]);
  });

  it('runtime storage refuses an invalid layout and stops writing when a directory is swapped for a symlink', async () => {
    const bad = freshRoot('runtime-bad');
    const leak = path.join(publicRoot, 'runtime-leak');
    mkdirSync(leak);
    mkdirSync(path.join(bad, 'tmp'));
    symlinkSync(leak, path.join(bad, 'media'));
    expect(() => new PrivateMediaStorage(bad, [publicRoot])).toThrow(/Invalid private uploads layout/);

    const good = freshRoot('runtime-swap');
    expect(validatePrivateUploadsRoot(good, [publicRoot])).toEqual([]);
    const storage = new PrivateMediaStorage(good, [publicRoot]);
    const key = await storage.write(Buffer.from('ok'));
    expect(existsSync(path.join(good, 'media', key))).toBe(true);
    // Swap media/ for a symlink into the public root after validation.
    renameSync(path.join(good, 'media'), path.join(good, 'media-old'));
    symlinkSync(leak, path.join(good, 'media'));
    await expect(storage.write(Buffer.from('leak'))).rejects.toThrow(/layout changed/);
    await expect(storage.remove(key)).rejects.toThrow(/layout changed/);
    await expect(storage.staleMediaKeys(Date.now())).rejects.toThrow(/layout changed/);
    expect(readdirSync(leak)).toEqual([]);
    expect(readdirSync(path.join(good, 'tmp'))).toEqual([]);
  });

  it('runs the test server with a private root outside the public avatar root', () => {
    expect(validatePrivateUploadsRoot(process.env.PRIVATE_UPLOADS_DIR, [uploadsRoot])).toEqual([]);
  });
});

describe('PrivateMediaService.storeImages and transaction cleanup', () => {
  let owner: number;
  beforeEach(async () => { owner = (await createTestUser()).id; });

  it('re-encodes, strips EXIF, writes the final file and inserts a READY row', async () => {
    const original = await jpegWithExif();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const [stored] = await storeOne(owner, original, 'image/jpeg');
    const [row] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, stored.id));
    expect(row).toMatchObject({ ownerId: owner, kind: 'IMAGE', mimeType: 'image/jpeg', state: 'READY', originalName: null });
    const bytes = readFileSync(mediaPath(row.storageKey));
    expect(row.byteSize).toBe(bytes.length);
    expect(row.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    const metadata = await sharp(bytes).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(bytes.toString('latin1')).not.toContain('secret-owner');
    expect(readdirSync(path.join(root, 'tmp'))).toEqual([]);
  });

  it('rejects invalid images before writing any file', async () => {
    const before = readdirSync(path.join(root, 'media')).length;
    const good = await png();
    const cases = [
      [{ buffer: Buffer.from('not an image'), mimetype: 'image/png' }],
      [{ buffer: good, mimetype: 'image/jpeg' }],
      [{ buffer: good, mimetype: 'image/gif' }],
      [{ buffer: good, mimetype: 'image/png' }, { buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1), mimetype: 'image/png' }],
      Array.from({ length: 5 }, () => ({ buffer: good, mimetype: 'image/png' })),
    ];
    for (const files of cases) {
      await expect(privateMediaService.transaction(tx => privateMediaService.storeImages(files, owner, tx, CODE)))
        .rejects.toMatchObject({ code: 'SOCIAL_IMAGE_INVALID', statusCode: 400 });
    }
    expect(readdirSync(path.join(root, 'media')).length).toBe(before);
    expect(await db.select().from(mediaFiles)).toEqual([]);
  });

  it('refuses a transaction not opened by the media service', async () => {
    await expect(db.transaction(async tx => privateMediaService.storeImages([{ buffer: await png(), mimetype: 'image/png' }], owner, tx, CODE)))
      .rejects.toThrow(/requires a transaction opened by PrivateMediaService/);
  });

  it('deletes staged files when the caller fails after storing', async () => {
    let key = '';
    await expect(privateMediaService.transaction(async tx => {
      const [stored] = await privateMediaService.storeImages([{ buffer: await png(), mimetype: 'image/png' }], owner, tx, CODE);
      const [row] = await tx.select().from(mediaFiles).where(eq(mediaFiles.id, stored.id));
      key = row.storageKey;
      expect(existsSync(mediaPath(key))).toBe(true);
      throw new Error('content insert failed');
    })).rejects.toThrow('content insert failed');
    expect(existsSync(mediaPath(key))).toBe(false);
    expect(await db.select().from(mediaFiles)).toEqual([]);
  });

  it('deletes staged files when COMMIT itself fails', async () => {
    let key = '';
    await expect(privateMediaService.transaction(async tx => {
      const [stored] = await privateMediaService.storeImages([{ buffer: await png(), mimetype: 'image/png' }], owner, tx, CODE);
      key = (await tx.select().from(mediaFiles).where(eq(mediaFiles.id, stored.id)))[0].storageKey;
      // A deferred constraint violation surfaces only at COMMIT.
      await tx.execute(sql`CREATE TEMP TABLE commit_probe (id int PRIMARY KEY DEFERRABLE INITIALLY DEFERRED) ON COMMIT DROP`);
      await tx.execute(sql`INSERT INTO commit_probe VALUES (1), (1)`);
    })).rejects.toThrow();
    expect(key).not.toBe('');
    expect(existsSync(mediaPath(key))).toBe(false);
    expect(await db.select().from(mediaFiles)).toEqual([]);
  });
});

describe('GET /api/v1/media/:id', () => {
  let author: number;
  let viewer: number;
  let owner: number;
  let admin: number;

  async function postWithImage(values: Partial<typeof posts.$inferInsert> = {}) {
    const [stored] = await storeOne(author);
    const [post] = await db.insert(posts).values({ authorId: author, type: 'FREE', body: 'b', publishedAt: new Date(), creationHash: hash, ...values }).returning();
    const [image] = await db.insert(postImages).values({ postId: post.id, mediaId: stored.id, position: 1 }).returning();
    return { mediaId: stored.id, postId: post.id, imageId: image.id };
  }
  const get = (id: number | string, userId?: number) => {
    const req = request(app).get(`/api/v1/media/${id}`);
    return userId ? req.set('x-user-id', String(userId)) : req;
  };

  beforeEach(async () => {
    author = (await createTestUser()).id;
    viewer = (await createTestUser()).id;
    owner = (await createTestUser({ role: 'COURT_OWNER' })).id;
    admin = (await createTestUser({ role: 'ADMIN' })).id;
  });

  it('serves a published post image to a Player with private, nosniff, inline headers', async () => {
    const { mediaId } = await postWithImage();
    const res = await get(mediaId, viewer).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toBe('inline');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.compare(res.body as Buffer, readFileSync(mediaPath(await keyOf(mediaId))))).toBe(0);
  });

  it('denies unauthenticated, non-Player, unattached and malformed requests', async () => {
    const { mediaId } = await postWithImage();
    expect((await get(mediaId)).status).toBe(401);
    for (const user of [owner, admin]) {
      const res = await get(mediaId, user);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('MEDIA_NOT_FOUND');
    }
    const [loose] = await storeOne(author);
    expect((await get(loose.id, author)).status).toBe(404);
    expect((await get(999999999, viewer)).status).toBe(404);
    expect((await get('abc', viewer)).status).toBe(400);
  });

  it('returns 404 for hidden, deleted and detached images', async () => {
    const hidden = await postWithImage({ hiddenAt: new Date(), hiddenBy: admin });
    const deleted = await postWithImage({ deletedAt: new Date() });
    const detached = await postWithImage();
    await db.update(postImages).set({ detachedAt: new Date() }).where(eq(postImages.id, detached.imageId));
    for (const { mediaId } of [hidden, deleted, detached]) {
      for (const user of [viewer, author]) {
        const res = await get(mediaId, user);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('MEDIA_NOT_FOUND');
      }
    }
  });

  it('allows only the author on an unpublished post until membership access is proven (SOC-05)', async () => {
    const { mediaId } = await postWithImage({ type: 'MATCH_FINDING', publishedAt: null, title: 'Kèo' });
    expect((await get(mediaId, author)).status).toBe(200);
    expect((await get(mediaId, viewer)).status).toBe(404);
  });

  it('marks a row MISSING when its file is gone and returns 404 afterwards', async () => {
    const { mediaId } = await postWithImage();
    await privateMediaService.storage.remove(await keyOf(mediaId));
    const res = await get(mediaId, viewer);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEDIA_NOT_FOUND');
    expect((await db.select().from(mediaFiles).where(eq(mediaFiles.id, mediaId)))[0].state).toBe('MISSING');
    expect((await get(mediaId, viewer)).status).toBe(404);
  });

  it('never exposes private files through the public /uploads static route', async () => {
    const { mediaId } = await postWithImage();
    const key = await keyOf(mediaId);
    for (const url of [`/uploads/${key}`, `/uploads/media/${key}`, `/uploads/../media/${key}`]) {
      expect((await request(app).get(url)).status).toBe(404);
    }
  });
});

describe('Private media GC', () => {
  it('removes stale tmp files and row-less final files only; never files with rows', async () => {
    const owner = (await createTestUser()).id;
    const [withRow] = await storeOne(owner);
    const [detachedLater] = await storeOne(owner);
    const [post] = await db.insert(posts).values({ authorId: owner, type: 'FREE', body: 'b', publishedAt: new Date(), creationHash: hash }).returning();
    await db.insert(postImages).values({ postId: post.id, mediaId: detachedLater.id, position: 1, detachedAt: new Date() });
    const rowKeys = [await keyOf(withRow.id), await keyOf(detachedLater.id)];
    const orphanOld = '11111111-1111-4111-8111-111111111111';
    const orphanFresh = '22222222-2222-4222-8222-222222222222';
    const tmpOld = path.join(root, 'tmp', 'stale-upload');
    const tmpFresh = path.join(root, 'tmp', 'fresh-upload');
    for (const file of [mediaPath(orphanOld), mediaPath(orphanFresh), tmpOld, tmpFresh]) writeFileSync(file, 'x');
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
    for (const file of [mediaPath(orphanOld), tmpOld, ...rowKeys.map(mediaPath)]) utimesSync(file, old, old);

    const result = await privateMediaService.sweep();
    expect(result).toEqual({ tmpRemoved: 1, orphansRemoved: 1 });
    expect(existsSync(mediaPath(orphanOld))).toBe(false);
    expect(existsSync(tmpOld)).toBe(false);
    expect(existsSync(mediaPath(orphanFresh))).toBe(true);
    expect(existsSync(tmpFresh)).toBe(true);
    for (const key of rowKeys) expect(existsSync(mediaPath(key))).toBe(true);
    await privateMediaService.storage.remove(orphanFresh);
    await privateMediaService.storage.removeTmp('fresh-upload');
  });
});

describe('Private image multipart parser', () => {
  const parserApp = express();
  parserApp.post('/upload', parsePrivateImages('images', 'SOCIAL_IMAGE_INVALID'), (req, res) => {
    const files = (req.files as Record<string, Express.Multer.File[]> | undefined)?.images ?? [];
    res.json({ count: files.length });
  });
  parserApp.use(errorHandler);

  it('enforces the 4-image and 5 MB limits with the feature error code', async () => {
    const small = await png();
    const ok = await request(parserApp).post('/upload').attach('images', small, 'a.png').field('payload', '{}');
    expect(ok.body).toEqual({ count: 1 });
    let tooMany = request(parserApp).post('/upload');
    for (let i = 0; i < 5; i += 1) tooMany = tooMany.attach('images', small, `${i}.png`);
    expect((await tooMany).body.error.code).toBe('SOCIAL_IMAGE_INVALID');
    const big = await request(parserApp).post('/upload').attach('images', Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png');
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe('SOCIAL_IMAGE_INVALID');
    const extra = await request(parserApp).post('/upload').attach('images', small, 'a.png').field('other', 'x');
    expect(extra.status).toBe(400);
  });
});
