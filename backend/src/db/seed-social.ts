import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { and, eq, inArray } from 'drizzle-orm';
import { db, pool, users, skillLevels, posts, postComments, postReactions, matchmakingRequests, matchmakingInvitations } from './index';
import { ensureSeedPlayerProfile, type SeedLevelCode } from './seeds/skill-survey-seed';
import { hashPassword } from '../utils/password';
import { socialPostService } from '../services/social/SocialPostService';
import { socialInteractionService } from '../services/social/SocialInteractionService';
import { recruitmentLifecycleService } from '../services/matchmaking/RecruitmentLifecycleService';
import { MatchmakingConfig, matchmakingConfig } from '../shared/config/matchmaking-config';
import type { RecruitmentDraftInput } from '../contracts/RecruitmentPort';
import type { CreatePostPayload } from '../validation/social';

/** Stable IDs let a rerun resume without duplicating or overwriting demo content. */
function clientId(key: string) {
  const hex = createHash('sha256').update(`social-demo:v1:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Social demo is for local development only');
  const connection = new URL(process.env.DATABASE_URL || process.env.DIRECT_URL || '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)) throw new Error('Social demo requires a local PostgreSQL database');

  const lock = await pool.connect();
  try {
    await lock.query('SELECT pg_advisory_lock(64102820)');
    const levels = await db.select().from(skillLevels);
    const average = levels.find(level => level.code === 'AVERAGE');
    const averagePlus = levels.find(level => level.code === 'AVERAGE_PLUS');
    if (!average || !averagePlus) throw new Error('Run db:migrate/db:seed first: canonical skill levels are required');
    const config = await matchmakingConfig.get();
    const password = 'Password@123';
    const passwordHash = await hashPassword(password);
    const people = [
      { key: 'nam', name: 'Nguyễn Văn Nam', skill: average.id, levelCode: 'AVERAGE' as SeedLevelCode },
      { key: 'an', name: 'Lê Hoàng An', skill: averagePlus.id, levelCode: 'AVERAGE_PLUS' as SeedLevelCode },
      { key: 'ha', name: 'Nguyễn Thu Hà', skill: average.id, levelCode: 'AVERAGE' as SeedLevelCode },
      { key: 'duc', name: 'Trần Minh Đức', skill: averagePlus.id, levelCode: 'AVERAGE_PLUS' as SeedLevelCode },
    ];
    const accounts: { key: string; name: string; skill: number; id: number; email: string }[] = [];
    for (const person of people) {
      const email = `social.demo.${person.key}@example.com`;
      await db.insert(users).values({ email, passwordHash, role: 'PLAYER', status: 'ACTIVE' }).onConflictDoNothing({ target: users.email });
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (user.role !== 'PLAYER' || user.status !== 'ACTIVE' || user.deletedAt) throw new Error(`Demo account unavailable: ${email}`);
      await ensureSeedPlayerProfile(db, { userId: user.id, fullName: person.name, levelCode: person.levelCode });
      accounts.push({ ...person, id: user.id, email });
    }
    const image = { buffer: readFileSync(path.resolve(__dirname, '../../../frontend/src/assets/hero.png')), mimetype: 'image/png' };
    let inserted = 0; let reused = 0;
    const publishedIds: number[] = [];
    const links: { label: string; postId: number }[] = [];
    async function ensurePost(authorId: number, key: string, payload: Omit<CreatePostPayload, 'clientRequestId'>, withImage = false) {
      const requestId = clientId(key);
      const [existing] = await db.select().from(posts).where(and(eq(posts.authorId, authorId), eq(posts.clientRequestId, requestId)));
      if (existing) { reused++; return { id: existing.id, fresh: false, visible: !existing.deletedAt && !existing.hiddenAt && !!existing.publishedAt }; }
      const result = await socialPostService.create({ id: authorId, role: 'PLAYER' }, { ...payload, clientRequestId: requestId }, withImage ? [image] : []);
      inserted++;
      return { id: result.post.id, fresh: true, visible: !!result.post.publishedAt };
    }

    const stories = [
      'Mọi người thường dành bao lâu để khởi động trước khi vào sân? Mình đang tập thói quen khởi động cổ tay và cổ chân thật kỹ. 🏸',
      'Tìm bạn cùng tập phông cầu ở Quận 7. Ưu tiên chơi vui, đều đặn và hỗ trợ nhau tiến bộ!',
      'Một mẹo nhỏ khi đánh đôi: gọi cầu rõ ràng giúp cả hai tự tin hơn. Mọi người còn mẹo phối hợp nào hay không?',
      'Buổi tập hôm nay tập trung vào di chuyển ngang sân. Mệt nhưng rất vui vì đã giữ được nhịp lâu hơn tuần trước.',
      'Mọi người đang dùng loại giày nào cho sân thảm? Mình muốn tìm một đôi bám sân tốt cho buổi tập tối.',
      'Chia sẻ lịch tập tuần này: hai buổi kỹ thuật, một buổi giao lưu. Có bạn nào thích tập bỏ nhỏ cùng không?',
      'Cảm ơn các bạn đã giao lưu hôm qua. Cả nhóm đánh rất fair-play và luôn nhắc nhau khởi động kỹ.',
      'Hôm nay thử dành 15 phút chỉ tập giao cầu thấp. Bài tập đơn giản nhưng cải thiện cảm giác cầu khá nhiều.',
      'Bạn mới chơi đừng ngại hỏi nhé! Mình rất vui nếu được cùng tập những động tác cơ bản vào cuối tuần.',
      'Một buổi chơi tốt với mình là ai cũng được vào sân và ra về vui vẻ. Cùng xây dựng cộng đồng cầu lông tích cực nhé!',
      'Không khí buổi tập cuối tuần tại sân rất vui. Hẹn mọi người ở buổi giao lưu tiếp theo! 🏸',
      'Chia sẻ góc sân quen thuộc trước buổi tập. Mọi người thích đánh sáng sớm hay buổi tối hơn?',
    ];
    for (const [index, body] of stories.entries()) {
      const author = accounts[index % accounts.length];
      const post = await ensurePost(author.id, `story-${index}`, { type: 'FREE', body }, index >= 10);
      if (post.visible) publishedIds.push(post.id);
    }

    // Dates are relative on first insertion; reruns preserve dates and all manual edits.
    const firstDay = Math.ceil((Date.now() + config.minLeadTimeMinutes * 60_000) / 86_400_000) * 86_400_000 + 2 * 86_400_000;
    const groupCapacity = Math.min(config.groupMaxSlots, Math.max(config.groupMinSlots, 8));
    const fixtures = [
      { key: 'doubles-q7', owner: 0, type: 'DOUBLES' as const, title: 'Đôi tối thứ Ba tại Phúc Thịnh', district: 'Quận 7', members: [1], publish: true },
      { key: 'singles-thuduc', owner: 1, type: 'SINGLES' as const, title: 'Tìm bạn đánh đơn tại Thủ Đức', district: 'Thủ Đức', members: [], publish: true },
      { key: 'group-weekend', owner: 2, type: 'GROUP' as const, title: 'Giao lưu cuối tuần · Quận 7', district: 'Quận 7', members: [0, 3], publish: true },
      { key: 'doubles-tanbinh', owner: 3, type: 'DOUBLES' as const, title: 'Đôi giao lưu sau giờ làm · Tân Bình', district: 'Tân Bình', members: [], publish: true },
      { key: 'unpublished', owner: 0, type: 'GROUP' as const, title: 'Kèo đang chuẩn bị · Chưa công khai', district: 'Quận 7', members: [], publish: false },
      { key: 'cancelled', owner: 1, type: 'DOUBLES' as const, title: 'Kèo đã hủy · Đổi lịch tập', district: 'Quận 10', members: [], publish: true, cancel: true },
    ];
    await seedRecruitmentStories(fixtures, accounts, firstDay, groupCapacity, average, averagePlus, ensurePost, links, config);

    await seedSocialInteractions(publishedIds, accounts);
    const feed = await socialPostService.listFeed({ id: accounts[0].id, role: 'PLAYER' }, { page: 1, limit: 50 });
    console.log(JSON.stringify({ inserted, reused, visibleFeedTotal: feed.meta.total, accounts: accounts.map(({ email, name }) => ({ email, name })), password, feed: 'http://localhost:5173/feed', posts: links.map(link => ({ ...link, url: `http://localhost:5173/posts/${link.postId}` })) }, null, 2));
  } finally {
    await lock.query('SELECT pg_advisory_unlock(64102820)');
    lock.release();
  }
}

seed().catch(error => {
  console.error(error instanceof Error ? error.message : 'Social demo seed failed');
  process.exitCode = 1;
}).finally(() => pool.end());

async function seedRecruitmentStories(
  fixtures: ({ key: string; owner: number; type: "DOUBLES"; title: string; district: string; members: number[]; publish: boolean; cancel?: undefined; } | { key: string; owner: number; type: "SINGLES"; title: string; district: string; members: never[]; publish: boolean; cancel?: undefined; } | { key: string; owner: number; type: "GROUP"; title: string; district: string; members: number[]; publish: boolean; cancel?: undefined; } | { key: string; owner: number; type: "DOUBLES"; title: string; district: string; members: never[]; publish: boolean; cancel: boolean; })[],
  accounts: { key: string; name: string; skill: number; id: number; email: string; }[],
  firstDay: number,
  groupCapacity: number,
  average: { id: number; code: string; name: string; rank: number; description: string | null; createdAt: Date; updatedAt: Date; },
  averagePlus: { id: number; code: string; name: string; rank: number; description: string | null; createdAt: Date; updatedAt: Date; },
  ensurePost: (authorId: number, key: string, payload: Omit<CreatePostPayload, "clientRequestId">, withImage?: boolean) => Promise<{ id: number; fresh: boolean; visible: boolean; }>,
  links: { label: string; postId: number; }[],
  config: MatchmakingConfig,
) {
  for (const [index, fixture] of fixtures.entries()) {
    const owner = accounts[fixture.owner];
    const start = new Date(firstDay + index * 86400000 + 11 * 3600000); // 18:00 Vietnam.
    const companions = fixture.type === 'GROUP' ? Math.min(2, groupCapacity - 3) : 0;
    const memberIndices = fixture.members.slice(0, fixture.type === 'GROUP' ? groupCapacity - companions - 2 : 1);
    const draft: RecruitmentDraftInput = {
      matchType: fixture.type, startAt: start.toISOString(), minSkillLevelId: average.id, maxSkillLevelId: averagePlus.id,
      costNote: 'Dự kiến 80.000đ/người, thống nhất trực tiếp với chủ kèo.',
      court: { kind: 'EXTERNAL', name: fixture.district === 'Quận 7' ? 'Sân Phúc Thịnh (mẫu)' : `Sân giao lưu ${fixture.district} (mẫu)`, city: 'Hồ Chí Minh', district: fixture.district, address: `Địa chỉ sân mẫu · ${fixture.district}` },
      ...(fixture.type === 'GROUP' ? { capacity: groupCapacity, minPlayers: Math.min(4, groupCapacity), companionCount: companions, durationMinutes: 90 } : {}),
    };
    const post = await ensurePost(owner.id, fixture.key, { type: 'MATCH_FINDING', title: fixture.title, body: 'Chơi vui, luân phiên và khởi động kỹ trước giờ nhé! Vui lòng trao đổi với chủ kèo để thống nhất chi phí.', publish: fixture.publish, recruitment: draft });
    links.push({ label: fixture.title, postId: post.id });
    const [request] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.postId, post.id));
    if (post.fresh && memberIndices.length) {
      // Explicit demo fixtures, not proof of live Invite/Apply/BlockPort integration.
      // Keep recruitment open and below capacity; no synthetic Match/chat is created.
      await db.transaction(async (tx) => {
        const memberIds = memberIndices.map(i => accounts[i].id);
        await tx.select({ id: users.id }).from(users).where(inArray(users.id, [owner.id, ...memberIds])).orderBy(users.id).for('update');
        const [current] = await tx.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, request.id)).for('update');
        const existing = await tx.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.requestId, request.id));
        if (current.status !== 'OPEN' || existing.length) return;
        const now = new Date();
        await tx.insert(matchmakingInvitations).values(memberIds.map(playerId => ({ requestId: request.id, createdBy: owner.id, playerId, kind: 'INVITE', status: 'ACCEPTED', decidedBy: playerId, respondedAt: now, expiresAt: new Date(Math.min(start.getTime(), now.getTime() + config.invitationTimeoutMinutes * 60000)) })));
      });
    }
    if (post.fresh && 'cancel' in fixture && fixture.cancel) await recruitmentLifecycleService.cancel(owner.id, request.id, 'KEEP');
  }
}

async function seedSocialInteractions(publishedIds: number[], accounts: { key: string; name: string; skill: number; id: number; email: string; }[]) {
  for (const [index, postId] of publishedIds.entries()) {
    for (let offset = 1; offset <= 2; offset++) {
      const actor = accounts[(index + offset) % accounts.length];
      const viewer = { id: actor.id, role: 'PLAYER' };
      const key = clientId(`comment-${index}-${offset}`);
      const [comment] = await db.select({ id: postComments.id }).from(postComments).where(and(eq(postComments.authorId, actor.id), eq(postComments.clientRequestId, key)));
      if (!comment) await socialInteractionService.createComment(viewer, postId, offset === 1 ? 'Cảm ơn bạn đã chia sẻ! Hẹn gặp mọi người trên sân. 🏸' : 'Ý tưởng hay quá, mình sẽ thử trong buổi tập tiếp theo!', key);
      const [reaction] = await db.select().from(postReactions).where(and(eq(postReactions.postId, postId), eq(postReactions.userId, actor.id)));
      if (!reaction) await socialInteractionService.setReaction(viewer, postId, ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY'][(index + offset) % 6]);
    }
  }
}
