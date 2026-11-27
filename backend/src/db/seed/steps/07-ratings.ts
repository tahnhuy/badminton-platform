import { sql } from 'drizzle-orm';
import { db } from '../../index';
import { ratingService } from '../../../services/ratings/RatingService';
import { at as sqlTime, stampAt } from '../lib/stamp';
import type { SeedContext } from '../context';

const COMMENTS = [
  'Chơi fair-play, rất vui!', 'Đánh chắc tay, phối hợp tốt.', 'Đúng giờ và nhiệt tình.', 'Cầu đẹp, hẹn trận sau!',
  'Giao lưu thoải mái, hỗ trợ người mới.', 'Đập cầu uy lực quá!', undefined, undefined, undefined,
];

/**
 * Post-match ratings through the real RatingService (participants only, no self-rating, at
 * most 3 per request). `player_ratings` is immutable by trigger, so the back-dating of the rows
 * just created happens in one transaction that disables and re-enables that trigger.
 */
export async function seedRatings(ctx: SeedContext): Promise<void> {
  const { random, clock } = ctx;
  const latest = clock.now.getTime() - 10 * 60_000;
  const dated: Array<{ ids: number[]; at: Date }> = [];
  let total = 0;

  for (const match of ctx.completedMatches) {
    for (const rater of match.playerIds) {
      if (!random.chance(0.65)) continue;
      const targets = random.shuffle(match.playerIds.filter(id => id !== rater)).slice(0, 3);
      const at = new Date(Math.min(latest, match.completedAt.getTime() + random.int(30, 36 * 60) * 60_000));
      const items = targets.map(ratedPlayerId => ({
        ratedPlayerId,
        skillRating: random.pick([3, 4, 4, 4, 5, 5]),
        attitudeRating: random.pick([4, 5, 5, 5]),
        comment: random.pick(COMMENTS),
      }));
      const result = await stampAt(at, () => ratingService.createRatings(rater, match.matchId, items as never)) as { created: Array<{ id: number }> };
      dated.push({ ids: result.created.map(r => r.id), at });
      total += result.created.length;
    }
  }

  await db.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE player_ratings DISABLE TRIGGER trg_player_ratings_immutable`);
    for (const { ids, at } of dated) {
      if (ids.length === 0) continue;
      await tx.execute(sql`UPDATE player_ratings SET created_at = ${await sqlTime('player_ratings', 'created_at', at)}, updated_at = ${await sqlTime('player_ratings', 'updated_at', at)}
        WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
    }
    await tx.execute(sql`ALTER TABLE player_ratings ENABLE TRIGGER trg_player_ratings_immutable`);
  });
  const enabled = await db.execute(sql`SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_player_ratings_immutable'`);
  if ((enabled.rows[0] as { tgenabled: string }).tgenabled !== 'O') throw new Error('player_ratings immutability trigger is not enabled');
  ctx.log(`Đánh giá: ${total} lượt đánh giá sau trận`);
}
