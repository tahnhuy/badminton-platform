import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import path from 'path';
import { readdir, readFile, rm, utimes } from 'fs/promises';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, users, playerProfiles, skillLevels } from '../db';
import { AvatarStorage, uploadsRoot, AVATAR_MAX_BYTES } from '../shared/storage/avatar-storage';
import { PlayerAvatarService } from '../services/players/PlayerAvatarService';
import { PlayerProfileRepository } from '../repositories/players/PlayerProfileRepository';

let ids: number[];
const images: Record<string, Buffer> = {};
const storage = new AvatarStorage();
function file(buffer: Buffer, mimetype = 'image/png'): Express.Multer.File {
  return { buffer, mimetype } as Express.Multer.File;
}
function upload(userId: number, buffer: Buffer, mime = 'image/png', filename = 'avatar.png') {
  return request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(userId))
    .attach('avatar', buffer, { filename, contentType: mime });
}
async function files() { return readdir(path.join(uploadsRoot, 'avatars')).catch(() => []); }
async function current(id = ids[0]) {
  return (await db.select().from(playerProfiles).where(eq(playerProfiles.userId, id)))[0].avatarUrl;
}
beforeAll(async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    images[format] = await sharp({ create: { width: 12, height: 10, channels: 3, background: '#087139' } }).toFormat(format).toBuffer();
  }
});
beforeEach(async () => {
  const [level] = await db.select().from(skillLevels).limit(1);
  ids = (await db.insert(users).values([0, 1].map(i => ({ email: `avatar${i}@example.test`, passwordHash: 'fixture', role: 'PLAYER', status: 'ACTIVE' }))).returning()).map(user => user.id);
  await db.insert(playerProfiles).values(ids.map(userId => ({ userId, fullName: `Player ${userId}`, skillLevelId: level.id })));
});
afterEach(async () => { vi.restoreAllMocks(); await rm(uploadsRoot, { recursive: true, force: true }); });

describe('Avatar API and content validation', () => {
  it.each(['png', 'jpeg', 'webp'])('stores a real %s, updates only the caller and serves decoded bytes', async format => {
    const response = await upload(ids[0], images[format], `image/${format}`, '../../untrusted-filename.svg');
    expect(response.status).toBe(201);
    const url = response.body.data.avatarUrl;
    expect(url).toMatch(new RegExp(`^/uploads/avatars/${ids[0]}-[a-f0-9-]+\\.${format}$`));
    expect(await current()).toBe(url); expect(await current(ids[1])).toBeNull();
    const served = await request(app).get(url); expect(served.status).toBe(200);
    expect(served.headers['content-type']).toContain(`image/${format}`);
    const bytes = await readFile(path.join(uploadsRoot, 'avatars', path.basename(url)));
    expect(await sharp(bytes).metadata()).toMatchObject({ format, width: 12, height: 10 });
    const publicCard = await request(app).get(`/api/v1/players/${ids[0]}`).set('X-User-Id', String(ids[1]));
    expect(publicCard.body.data.avatarUrl).toBe(url);
  });
  it.each([
    ['empty', Buffer.alloc(0), 'image/png'], ['fake', Buffer.from('not an image'), 'image/png'],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png'],
    ['truncated PNG', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    ['too large', Buffer.alloc(AVATAR_MAX_BYTES + 1), 'image/png'],
  ])('rejects %s without writing a file or changing DB', async (_label, bytes, mime) => {
    const response = await upload(ids[0], bytes as Buffer, mime as string);
    expect(response.status).toBe(400); expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(await current()).toBeNull(); expect(await files()).toEqual([]);
  });
  it('rejects format spoofing, unsupported MIME, multiple files and extra fields', async () => {
    expect((await upload(ids[0], images.png, 'image/jpeg')).status).toBe(400);
    expect((await upload(ids[0], images.png, 'image/gif')).status).toBe(400);
    const multiple = await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0]))
      .attach('avatar', images.png, 'one.png').attach('avatar', images.png, 'two.png');
    expect(multiple.status).toBe(400);
    const target = await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0]))
      .field('userId', String(ids[1])).attach('avatar', images.png, 'avatar.png');
    expect(target.status).toBe(400); expect(await files()).toEqual([]);
  });
  it('rejects missing/wrong fields, non-multipart and malformed boundary', async () => {
    expect((await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0])).send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0])).attach('other', images.png, 'avatar.png')).status).toBe(400);
    expect((await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0])).set('Content-Type', 'multipart/form-data').send('broken')).status).toBe(400);
  });
  it('bounds decoded pixels, not only compressed bytes', async () => {
    const bomb = await sharp({ create: { width: 4001, height: 4001, channels: 3, background: 'white' } }).png().toBuffer();
    expect(bomb.length).toBeLessThan(AVATAR_MAX_BYTES);
    expect((await upload(ids[0], bomb)).status).toBe(400); expect(await files()).toEqual([]);
  });
  it('requires an active Player and CSRF before parsing upload data', async () => {
    expect((await request(app).post('/api/v1/players/me/avatar').attach('avatar', images.png, 'avatar.png')).status).toBe(401);
    await db.update(users).set({ role: 'ADMIN' }).where(eq(users.id, ids[1]));
    expect((await upload(ids[1], images.png)).status).toBe(403);
    const noCsrf = await request(app).post('/api/v1/players/me/avatar').set('X-User-Id', String(ids[0])).set('Cookie', 'sid=test').attach('avatar', images.png, 'avatar.png');
    expect(noCsrf.status).toBe(403); expect(noCsrf.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    expect(await files()).toEqual([]);
  });
});
describe('Avatar file/DB consistency and retry cleanup', () => {
  it('replaces an old avatar and handles concurrent uploads without deleting the final avatar', async () => {
    const results = await Promise.all([upload(ids[0], images.png), upload(ids[0], images.webp, 'image/webp')]);
    expect(results.map(result => result.status)).toEqual([201, 201]);
    const saved = await current(); expect(results.map(result => result.body.data.avatarUrl)).toContain(saved);
    expect(await files()).toEqual([path.basename(saved!)]);
    expect((await request(app).get(saved!)).status).toBe(200);
  });
  it('removes a staged file and keeps the previous pointer if DB update fails', async () => {
    const original = (await upload(ids[0], images.png)).body.data.avatarUrl;
    const repository = new PlayerProfileRepository();
    vi.spyOn(repository, 'setAvatar').mockRejectedValue(new Error('DB write failed'));
    await expect(new PlayerAvatarService(repository, storage).upload(ids[0], file(images.png))).rejects.toThrow('DB write failed');
    expect(await current()).toBe(original); expect(await files()).toEqual([path.basename(original)]);
  });
  it('keeps DB unchanged on file-write failure', async () => {
    vi.spyOn(storage, 'write').mockRejectedValue(new Error('Disk failure'));
    await expect(new PlayerAvatarService(undefined, storage).upload(ids[0], file(images.png))).rejects.toThrow('Disk failure');
    expect(await current()).toBeNull(); expect(await files()).toEqual([]);
  });
  it('returns success after commit even if cleanup fails, then sweeps only unreferenced generated files', async () => {
    const service = new PlayerAvatarService(undefined, storage);
    const old = await service.upload(ids[0], file(images.png));
    const remove = vi.spyOn(storage, 'remove').mockRejectedValueOnce(new Error('Cleanup failure'));
    const latest = await service.upload(ids[0], file(images.png));
    expect(await current()).toBe(latest.avatarUrl); expect(await files()).toHaveLength(2);
    remove.mockRestore();
    const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    for (const name of await files()) await utimes(path.join(uploadsRoot, 'avatars', name), oldTime, oldTime);
    await service.sweep();
    expect(await files()).toEqual([path.basename(latest.avatarUrl)]);
    expect((await request(app).get(old.avatarUrl)).status).toBe(404);
    await service.cleanUnreferenced('/uploads/avatars/../../outside.png');
    expect(await current()).toBe(latest.avatarUrl);
  });
});
