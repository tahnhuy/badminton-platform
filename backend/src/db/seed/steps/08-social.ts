import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../index';
import { userBlocks } from '../../schema/messaging';
import { socialPostService } from '../../../services/social/SocialPostService';
import { socialInteractionService } from '../../../services/social/SocialInteractionService';
import { messagingService } from '../../../services/messaging/MessagingService';
import { COMMENTS, FREE_POSTS, REACTIONS } from '../data/social';
import { MAIN_PLAYER_KEY } from '../data/people';
import { at, stampAt } from '../lib/stamp';
import { uuidFor } from '../lib/ids';
import type { SeedContext, SeedPlayer } from '../context';

/** Feed posts, comments and reactions through the real Social services; one block relationship. */
export async function seedSocial(ctx: SeedContext): Promise<void> {
  const { clock, random } = ctx;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const blocker = ctx.players.get('player36')!;

  // Special case: player36 blocked the main account (neither sees the other's posts or chats).
  const blockedAt = clock.at(-15, '22:10');
  await messagingService.blockPlayer(blocker.id, main.id);
  await db.update(userBlocks).set({ createdAt: blockedAt }).where(and(eq(userBlocks.blockerId, blocker.id), eq(userBlocks.blockedId, main.id)));
  const blocked = (a: number, b: number) => (a === blocker.id && b === main.id) || (a === main.id && b === blocker.id);

  const people = [...ctx.players.values()].filter(p => p.active);
  const latest = clock.now.getTime() - 5 * 60_000;
  const mainPostIndexes = new Set([2, 8, 13, 19]);
  let posts = 0;
  let comments = 0;
  let reactions = 0;

  for (const [index, spec] of FREE_POSTS.entries()) {
    const day = -38 + Math.round((index * 38) / FREE_POSTS.length);
    const postedAt = clock.at(day, `${String(random.int(7, 22)).padStart(2, '0')}:${random.pick(['05', '20', '35', '50'])}`);
    if (postedAt.getTime() > latest) continue;
    let author: SeedPlayer | undefined = mainPostIndexes.has(index) ? main : undefined;
    for (let i = 0; !author && i < 20; i += 1) {
      const candidate = random.pick(people);
      if (candidate.joinedAt.getTime() < postedAt.getTime() - 3_600_000) author = candidate;
    }
    if (!author || author.joinedAt.getTime() >= postedAt.getTime()) continue;
    const postAuthor = author;

    const created = await stampAt(postedAt, () => socialPostService.create({ id: postAuthor.id, role: 'PLAYER' }, {
      type: 'FREE', body: spec.body, background: spec.background ?? null, clientRequestId: uuidFor(`post-${index}`),
    }, []));
    const postId = created.post.id;
    posts += 1;

    const engaged = people.filter(p => p.id !== postAuthor.id && !blocked(p.id, postAuthor.id) && p.joinedAt.getTime() < postedAt.getTime());
    const boost = postAuthor.id === main.id ? 2 : 1;
    for (const [n, commenter] of random.sample(engaged, random.int(0, 3) * boost).entries()) {
      const commentedAt = new Date(Math.min(latest, postedAt.getTime() + random.int(10, 30 * 60) * 60_000));
      await stampAt(commentedAt, () => socialInteractionService.createComment({ id: commenter.id, role: 'PLAYER' }, postId,
        random.pick(COMMENTS), uuidFor(`comment-${index}-${n}`)));
      comments += 1;
    }
    for (const reactor of random.sample(engaged, random.int(2, 10) * boost)) {
      const reactedAt = new Date(Math.min(latest, postedAt.getTime() + random.int(5, 48 * 60) * 60_000));
      await stampAt(reactedAt, () => socialInteractionService.setReaction({ id: reactor.id, role: 'PLAYER' }, postId, random.pick(REACTIONS)));
      // post_reactions has a composite key (no id): date the row explicitly.
      await db.execute(sql`UPDATE post_reactions SET created_at = ${await at('post_reactions', 'created_at', reactedAt)}, updated_at = ${await at('post_reactions', 'updated_at', reactedAt)}
        WHERE post_id = ${postId} AND user_id = ${reactor.id}`);
      reactions += 1;
    }
  }
  ctx.log(`Cộng đồng: ${posts} bài, ${comments} bình luận, ${reactions} cảm xúc; 1 lượt chặn (player36 chặn tài khoản demo chính)`);
}
