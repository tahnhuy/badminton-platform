import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  db, bookings, conversationMembers, conversations, courts, facilities, matchPlayers, matches,
  matchmakingMatches, matchmakingRequests, notifications, playerProfiles,
  postComments, posts, skillLevels, users,
} from '../db';
import { notificationResourceResolver } from '../services/notifications/NotificationResourceResolver';
import { createTestUser, recruitmentFixtureColumns } from './test-helpers';
import { authRepository } from '../repositories/auth/AuthRepository';
import request from 'supertest';
import { app } from '../app';

// NTF-05 (G0-07/D5): allowlisted resource resolvers re-check the owning module and
// never turn a notification into an access grant.

async function skillId(): Promise<number> {
  return (await db.select().from(skillLevels).limit(1))[0].id;
}

async function player(email: string) {
  const user = await createTestUser({ email, role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: email, skillLevelId: await skillId() });
  return user.id;
}

async function publishedPost(authorId: number, extra: Partial<typeof posts.$inferInsert> = {}) {
  const values = { authorId, type: 'FREE', body: 'hello', publishedAt: new Date(), ...extra };
  if (values.hiddenAt && !values.hiddenBy) values.hiddenBy = authorId;
  const [row] = await db.insert(posts).values(values).returning();
  return row;
}

async function recruitment(hostId: number, options: { published: boolean }) {
  const skill = { id: await skillId() };
  const startAt = new Date(Date.now() + 86_400_000);
  const [row] = await db.insert(matchmakingRequests).values({
    playerId: hostId, matchType: 'SINGLES', minSkillLevelId: skill.id, maxSkillLevelId: skill.id,
    preferredDate: '2026-12-01', preferredStartTime: '10:00', preferredEndTime: '11:00',
    matchDurationMinutes: 60, status: 'OPEN', expiresAt: startAt,
    ...(await recruitmentFixtureColumns(hostId, 'SINGLES', startAt, 60)),
  }).returning();
  if (options.published) {
    await db.update(posts).set({ publishedAt: new Date() }).where(eq(posts.id, row.postId));
  }
  return row;
}

async function bookingFor(playerId: number) {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Resolver Club', phone: '0908123456', status: 'ACTIVE', address: '1 Test',
    ward: 'W', district: 'D', city: 'C', openingTime: '00:00:00', closingTime: '23:59:59',
  }).returning();
  const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Court 1', status: 'ACTIVE' }).returning();
  const [row] = await db.insert(bookings).values({
    playerId, courtId: court.id, bookingDate: '2026-12-01', startTime: '10:00', endTime: '11:00',
    unitPrice: '100000', totalAmount: '100000', status: 'CONFIRMED', bookingCode: `BK-${Date.now()}`,
  }).returning();
  return row;
}

describe('notification resource resolver (NTF-05)', () => {
  it('links a visible POST and hides missing, deleted, hidden or unpublished posts from others', async () => {
    const author = await player('author@resolver.test');
    const viewer = await player('viewer@resolver.test');

    const visible = await publishedPost(author);
    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'POST', visible.id))
      .toBe(`/posts/${visible.id}`);

    const unpublished = await publishedPost(author, { type: 'MATCH_FINDING', body: null, publishedAt: null });
    expect(await notificationResourceResolver.resolve({ id: author, role: 'PLAYER' }, 'POST', unpublished.id))
      .toBe(`/posts/${unpublished.id}`);
    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'POST', unpublished.id))
      .toBeNull();

    const hidden = await publishedPost(author, { hiddenAt: new Date() });
    const deleted = await publishedPost(author, { deletedAt: new Date() });
    for (const post of [hidden, deleted]) {
      expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'POST', post.id))
        .toBeNull();
    }

    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'POST', 999_999_999))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'COURT_OWNER' }, 'POST', visible.id))
      .toBeNull();
  });

  it('links a visible COMMENT and hides deleted, hidden or inaccessible comments', async () => {
    const author = await player('comment-author@resolver.test');
    const viewer = await player('comment-viewer@resolver.test');
    const post = await publishedPost(author);
    const [comment] = await db.insert(postComments).values({
      postId: post.id, authorId: author, body: 'nice', creationHash: 'a'.repeat(64),
    }).returning();

    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'COMMENT', comment.id))
      .toBe(`/posts/${post.id}#comment-${comment.id}`);

    const hiddenPost = await publishedPost(author, { hiddenAt: new Date() });
    const [hiddenComment] = await db.insert(postComments).values({
      postId: hiddenPost.id, authorId: author, body: 'hidden', creationHash: 'b'.repeat(64),
    }).returning();
    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'COMMENT', hiddenComment.id))
      .toBeNull();

    await db.update(postComments).set({ deletedAt: new Date() }).where(eq(postComments.id, comment.id));
    expect(await notificationResourceResolver.resolve({ id: viewer, role: 'PLAYER' }, 'COMMENT', comment.id))
      .toBeNull();
  });

  it('links MATCHMAKING_REQUEST only for a readable request and never for a stranger of an unpublished one', async () => {
    const host = await player('host@resolver.test');
    const stranger = await player('stranger@resolver.test');
    const publicRequest = await recruitment(host, { published: true });
    const privateRequest = await recruitment(host, { published: false });

    expect(await notificationResourceResolver.resolve({ id: host, role: 'PLAYER' }, 'MATCHMAKING_REQUEST', publicRequest.id))
      .toBe(`/matchmaking/requests/${publicRequest.id}`);
    expect(await notificationResourceResolver.resolve({ id: stranger, role: 'PLAYER' }, 'MATCHMAKING_REQUEST', publicRequest.id))
      .toBe(`/matchmaking/requests/${publicRequest.id}`);
    expect(await notificationResourceResolver.resolve({ id: stranger, role: 'PLAYER' }, 'MATCHMAKING_REQUEST', privateRequest.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: host, role: 'PLAYER' }, 'MATCHMAKING_REQUEST', 999_999_999))
      .toBeNull();
  });

  it('links MATCH and CONVERSATION only for their participants', async () => {
    const host = await player('match-host@resolver.test');
    const outsider = await player('match-outsider@resolver.test');
    const req = await recruitment(host, { published: true });
    const [match] = await db.insert(matches).values({
      matchType: 'SINGLES', status: 'CONFIRMED', scheduledAt: new Date(Date.now() + 86_400_000),
    }).returning();
    await db.insert(matchmakingMatches).values({
      matchmakingRequestId: req.id, matchId: match.id, status: 'MATCHED', matchedAt: new Date(),
    });
    await db.insert(matchPlayers).values({
      matchId: match.id, playerId: host, teamNo: 1, status: 'ACTIVE', joinedAt: new Date(),
    });

    expect(await notificationResourceResolver.resolve({ id: host, role: 'PLAYER' }, 'MATCH', match.id))
      .toBe(`/matchmaking/matches/${match.id}`);
    expect(await notificationResourceResolver.resolve({ id: outsider, role: 'PLAYER' }, 'MATCH', match.id))
      .toBeNull();

    const [conversation] = await db.insert(conversations).values({
      type: 'GROUP', title: 'Kèo #1', createdBy: host,
    }).returning();
    await db.insert(conversationMembers).values([
      { conversationId: conversation.id, userId: host },
      { conversationId: conversation.id, userId: outsider },
    ]);
    expect(await notificationResourceResolver.resolve({ id: host, role: 'PLAYER' }, 'CONVERSATION', conversation.id))
      .toBe(`/messages/${conversation.id}`);
    expect(await notificationResourceResolver.resolve({ id: 999_999_999, role: 'PLAYER' }, 'CONVERSATION', conversation.id))
      .toBeNull();
  });

  it('links BOOKING only for its owner and rejects unknown or disallowed resource types', async () => {
    const owner = await player('booking-owner@resolver.test');
    const other = await player('booking-other@resolver.test');
    const booking = await bookingFor(owner);

    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'BOOKING', booking.id))
      .toBe(`/bookings/${booking.id}`);
    expect(await notificationResourceResolver.resolve({ id: other, role: 'PLAYER' }, 'BOOKING', booking.id))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'TOURNAMENT', 1)).toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'UNKNOWN', 1)).toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'POST', null)).toBeNull();
  });

  it('links PROFILE only for the owning active Player', async () => {
    const owner = await player('profile-owner@resolver.test');
    const other = await player('profile-other@resolver.test');
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'PROFILE', owner))
      .toBe('/profile');
    expect(await notificationResourceResolver.resolve({ id: other, role: 'PLAYER' }, 'PROFILE', owner))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'ADMIN' }, 'PROFILE', owner))
      .toBeNull();
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'PROFILE', 999_999_999))
      .toBeNull();
    await db.update(users).set({ status: 'SUSPENDED' }).where(eq(users.id, owner));
    expect(await notificationResourceResolver.resolve({ id: owner, role: 'PLAYER' }, 'PROFILE', owner))
      .toBeNull();
  });

  it('adds resourcePath only to the detail response and re-checks access at open time', async () => {
    const author = await player('api-author@resolver.test');
    const viewer = await player('api-viewer@resolver.test');
    const post = await publishedPost(author);
    const [notification] = await db.insert(notifications).values({
      userId: viewer, type: 'SOCIAL_POST_COMMENTED', title: 'Bình luận mới', content: 'Nội dung',
      resourceType: 'POST', resourceId: post.id, dedupKey: 'resolver:api:1',
    }).returning();

    const session = await authRepository.createSession(viewer, 'PLAYER');
    const cookie = `sid=${session.rawToken}; csrf_token=csrf-ntf`;
    const detail = await request(app).get(`/api/v1/notifications/${notification.id}`).set('Cookie', cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.data.resourcePath).toBe(`/posts/${post.id}`);

    await db.update(posts).set({ hiddenAt: new Date(), hiddenBy: author }).where(eq(posts.id, post.id));
    const afterHide = await request(app).get(`/api/v1/notifications/${notification.id}`).set('Cookie', cookie);
    expect(afterHide.status).toBe(200);
    expect(afterHide.body.data).toMatchObject({ title: 'Bình luận mới', content: 'Nội dung', resourcePath: null });

    const listed = await request(app).get('/api/v1/notifications').set('Cookie', cookie);
    expect(listed.body.data[0].resourcePath).toBeUndefined();

    const otherSession = await authRepository.createSession(author, 'PLAYER');
    const otherDetail = await request(app).get(`/api/v1/notifications/${notification.id}`)
      .set('Cookie', `sid=${otherSession.rawToken}; csrf_token=csrf-ntf`);
    expect(otherDetail.status).toBe(404);
  });
});

