import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, playerProfiles, skillLevels, systemConfigs, posts } from '../db';
import { createTestUser } from './test-helpers';
import { clearConfigCache } from '../shared/config/config-registry';
import { recruitmentPort } from '../services/matchmaking/RecruitmentService';
import { socialRepository } from '../repositories/social/SocialRepository';
import type { RecruitmentDraftInput } from '../contracts/RecruitmentPort';

// Shared fixtures for SOC-03/05/06/07 and MM-23 tests (test database only).

export async function player(name?: string): Promise<number> {
  const user = await createTestUser({ role: 'PLAYER' });
  const [skill] = await db.select().from(skillLevels).where(eq(skillLevels.code, 'AVERAGE')).limit(1);
  await db.insert(playerProfiles).values({ userId: user.id, fullName: name ?? `P ${user.id}`, skillLevelId: skill.id });
  return user.id;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await db.insert(systemConfigs).values({ configKey: key, configValue: value, description: key })
    .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: value } });
  clearConfigCache();
}

export const as = (id: number, method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string) =>
  request(app)[method](url).set('x-user-id', String(id));

export async function png(color = '#0a0'): Promise<Buffer> {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toBuffer();
}

export function freePost(author: number, body: string | null = 'Xin chào', clientRequestId: string = randomUUID()) {
  return as(author, 'post', '/api/v1/posts').send({ type: 'FREE', body, clientRequestId });
}

export function multipartPost(author: number, payload: Record<string, unknown>, images: Buffer[]) {
  let req = as(author, 'post', '/api/v1/posts').field('payload', JSON.stringify(payload));
  images.forEach((image, index) => { req = req.attach('images', image, { filename: `i${index}.png`, contentType: 'image/png' }); });
  return req;
}

export async function skillIds(): Promise<{ min: number; max: number; mid: number }> {
  const levels = await db.select().from(skillLevels).orderBy(skillLevels.rank);
  return { min: levels[0].id, max: levels[levels.length - 1].id, mid: levels[Math.floor(levels.length / 2)].id };
}

export function startIn(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/**
 * Creates a MATCH_FINDING post and its recruitment in one transaction through the real
 * RecruitmentPort provider (the canonical endpoint is SOC-04).
 */
export async function matchFindingPost(host: number, draft: Partial<RecruitmentDraftInput> = {}, publish = false) {
  const levels = await skillIds();
  return db.transaction(async tx => {
    await socialRepository.lockUser(host, tx);
    const [post] = await tx.insert(posts).values({
      authorId: host, type: 'MATCH_FINDING', body: 'Tìm kèo', creationHash: 'f'.repeat(64), clientRequestId: randomUUID(),
    }).returning({ id: posts.id });
    const created = await recruitmentPort.createForPost({
      postId: post.id,
      hostId: host,
      publish,
      draft: { matchType: 'DOUBLES', startAt: startIn(48), minSkillLevelId: levels.min, maxSkillLevelId: levels.max, ...draft },
    }, tx);
    return { postId: post.id, requestId: created.requestId, publishedAt: created.publishedAt };
  });
}
