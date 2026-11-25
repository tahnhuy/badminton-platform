import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { playerSkillSurveys, skillSurveyVersions } from '../../db/schema/skill-survey';
import { skillLevelChanges, skillRatingEvents } from '../../db/schema/skill-rating';
import { tournamentMatches, tournamentRegistrations, tournamentTeamPlayers, tournaments } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { NotFoundError } from '../../errors/AppError';
import { skillRatingConfig, type SkillRatingConfig } from '../../shared/config/skill-rating-config';
import { notificationService } from '../notifications/NotificationService';
import { bandOf, initialRating, replay, type Band, type PlayerState, type RatedTournament } from './rating/skillRating';

/**
 * Skill rating and level adjustment from professional tournaments (Tech Design §7.10; TRN-14).
 * The match history is the source of truth: every trigger replays all rated matches of COMPLETED
 * professional tournaments from the initial ratings (deterministic), rebuilds the event cache,
 * and appends a `skill_level_changes` row for each level that differs from the stored one.
 */

type Executor = typeof db | TransactionContext;
const ADVISORY_LOCK_KEY = 7_420_012;
const DEFAULT_MINS = [0, 15, 30, 45, 60, 70, 80];
const RATED = ['WINNER_DECLARED', 'RETIRED'];
const round2 = (value: number) => Math.round(value * 100) / 100;

export type RatingTrigger =
  | { reason: 'TOURNAMENT_RESULT'; tournamentId: number }
  | { reason: 'RECALCULATION'; tournamentId: number | null };

export interface SkillRatingView {
  rating: number;
  tentative: boolean;
  ratedMatchCount: number;
  level: { id: number; name: string; rank: number };
  band: { min: number; max: number };
  next: { name: string; threshold: number; remaining: number } | null;
  previous: { name: string; threshold: number } | null;
  events: Array<{ tournament: { id: number; name: string }; tournamentMatchId: number; before: number; after: number; opponent: number; expected: number; outcome: 0 | 1; at: string }>;
  changes: Array<{ from: string; to: string; rating: number; reason: string; tournament: { id: number; name: string } | null; at: string }>;
}

export class SkillRatingService {
  /** Bands of the active survey version mapped onto skill levels (fallback: report §4.1 bands). */
  async bands(executor: Executor = db): Promise<Band[]> {
    const levels = await executor.select({ id: skillLevels.id, code: skillLevels.code, rank: skillLevels.rank }).from(skillLevels).orderBy(asc(skillLevels.rank));
    const [active] = await executor.select({ definition: skillSurveyVersions.definition }).from(skillSurveyVersions)
      .where(eq(skillSurveyVersions.status, 'ACTIVE')).limit(1);
    const defined = (active?.definition as { bands?: Array<{ levelCode: string; minScore: number }> } | undefined)?.bands ?? [];
    return levels.map((level, index) => ({
      levelId: level.id, rank: level.rank,
      min: defined.find(b => b.levelCode === level.code)?.minScore ?? DEFAULT_MINS[index] ?? 100,
    }));
  }

  /** Rated history in replay order: tournaments by completed_at, matches by round then position. */
  private async history(executor: Executor): Promise<RatedTournament[]> {
    const done = await executor.select({ id: tournaments.id }).from(tournaments)
      .where(and(eq(tournaments.status, 'COMPLETED'), eq(tournaments.competitionType, 'PROFESSIONAL'), isNull(tournaments.deletedAt), isNotNull(tournaments.completedAt)))
      .orderBy(asc(tournaments.completedAt), asc(tournaments.id));
    if (done.length === 0) return [];
    const ids = done.map(t => t.id);
    const rows = await executor.select().from(tournamentMatches)
      .where(and(inArray(tournamentMatches.tournamentId, ids), inArray(tournamentMatches.resolution, RATED),
        isNotNull(tournamentMatches.registration1Id), isNotNull(tournamentMatches.registration2Id), isNotNull(tournamentMatches.winnerRegistrationId)))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex));
    const regIds = [...new Set(rows.flatMap(r => [r.registration1Id!, r.registration2Id!]))];
    const regs = regIds.length === 0 ? [] : await executor.select({ id: tournamentRegistrations.id, playerId: tournamentRegistrations.playerId, teamId: tournamentRegistrations.teamId })
      .from(tournamentRegistrations).where(inArray(tournamentRegistrations.id, regIds));
    const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
    const members = teamIds.length === 0 ? [] : await executor.select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId })
      .from(tournamentTeamPlayers).where(and(inArray(tournamentTeamPlayers.teamId, teamIds), isNull(tournamentTeamPlayers.leftAt)));
    const playersOf = (regId: number) => {
      const reg = regs.find(r => r.id === regId)!;
      return reg.playerId !== null ? [reg.playerId] : members.filter(m => m.teamId === reg.teamId).map(m => m.playerId).sort((a, b) => a - b);
    };
    return done.map(t => ({
      tournamentId: t.id,
      matches: rows.filter(r => r.tournamentId === t.id).map(r => ({
        tournamentId: t.id, tournamentMatchId: r.id,
        side1: playersOf(r.registration1Id!), side2: playersOf(r.registration2Id!),
        winnerSide: (r.winnerRegistrationId === r.registration1Id ? 1 : 2) as 1 | 2,
      })).filter(m => m.side1.length > 0 && m.side2.length > 0),
    }));
  }

  /** Initial state: survey level and score; else the first recorded level; else the current level. */
  private async initialStates(playerIds: number[], bands: Band[], executor: Executor): Promise<Map<number, PlayerState>> {
    const states = new Map<number, PlayerState>();
    if (playerIds.length === 0) return states;
    const rankOf = new Map(bands.map(b => [b.levelId, b.rank]));
    const profiles = await executor.select({ id: playerProfiles.userId, levelId: playerProfiles.skillLevelId }).from(playerProfiles).where(inArray(playerProfiles.userId, playerIds));
    const surveys = await executor.select({ id: playerSkillSurveys.userId, levelId: playerSkillSurveys.resultingSkillLevelId, score: playerSkillSurveys.finalScore })
      .from(playerSkillSurveys).where(inArray(playerSkillSurveys.userId, playerIds));
    const firstChanges = await executor.selectDistinctOn([skillLevelChanges.playerId], { id: skillLevelChanges.playerId, levelId: skillLevelChanges.fromLevelId })
      .from(skillLevelChanges).where(inArray(skillLevelChanges.playerId, playerIds))
      .orderBy(skillLevelChanges.playerId, asc(skillLevelChanges.createdAt), asc(skillLevelChanges.id));
    for (const id of playerIds) {
      const survey = surveys.find(s => s.id === id);
      const levelId = survey?.levelId ?? firstChanges.find(c => c.id === id)?.levelId ?? profiles.find(p => p.id === id)?.levelId;
      const rank = (levelId !== undefined ? rankOf.get(levelId) : undefined) ?? bands[0].rank;
      states.set(id, { rating: initialRating(bands, rank, survey ? Number(survey.score) : null), count: 0, rank, tentative: true });
    }
    return states;
  }

  /**
   * Replays everything inside the caller's transaction (completion, correction or Admin
   * recalculation). Serialised by an advisory transaction lock. Returns the changed players.
   */
  /**
   * Serialises replays. Callers that may replay take it FIRST in their transaction, before any
   * tournament/match row lock: a replay inserts rows referencing every completed tournament
   * (FK KEY SHARE locks), so taking it after a row lock can deadlock (review, TRN-14).
   * Re-entrant within one transaction.
   */
  async acquireReplayLock(tx: TransactionContext): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})`);
  }

  async replayInTransaction(tx: TransactionContext, trigger: RatingTrigger, cfg?: SkillRatingConfig): Promise<Array<{ playerId: number; fromRank: number; toRank: number }>> {
    // Callers pass `cfg` loaded before their transaction: a cache miss would read through the
    // global pool while row locks are held (review, TRN-14).
    const config = cfg ?? await skillRatingConfig.get();
    if (!config.enabled) return [];
    await this.acquireReplayLock(tx);
    const bands = await this.bands(tx);
    const history = await this.history(tx);
    const played = new Set(history.flatMap(t => t.matches.flatMap(m => [...m.side1, ...m.side2])));
    // Players rated before but absent from the history now (e.g. their only match corrected to a
    // walkover) are reset to their initial state (review, TRN-14).
    const previouslyRated = await tx.select({ id: playerProfiles.userId }).from(playerProfiles)
      .where(sql`${playerProfiles.skillRating} IS NOT NULL OR ${playerProfiles.ratedMatchCount} > 0
        OR ${playerProfiles.userId} IN (SELECT player_id FROM skill_level_changes)`);
    const players = [...new Set([...played, ...previouslyRated.map(r => r.id)])].sort((a, b) => a - b);
    const initial = await this.initialStates(players, bands, tx);
    const { states, events, changes } = replay(initial, history, bands, config);

    await tx.delete(skillRatingEvents);
    for (let i = 0; i < events.length; i += 500) {
      await tx.insert(skillRatingEvents).values(events.slice(i, i + 500).map(e => ({
        playerId: e.playerId, tournamentId: e.tournamentId, tournamentMatchId: e.tournamentMatchId,
        ratingBefore: round2(e.before).toFixed(2), ratingAfter: round2(e.after).toFixed(2), opponentRating: round2(e.opponent).toFixed(2),
        expected: e.expected.toFixed(4), kFactor: e.k.toFixed(2), outcome: e.outcome, sequence: e.sequence,
      })));
    }

    const levelIdOf = new Map(bands.map(b => [b.rank, b.levelId]));
    const rankOf = new Map(bands.map(b => [b.levelId, b.rank]));
    const current = players.length === 0 ? [] : await tx.select({ id: playerProfiles.userId, levelId: playerProfiles.skillLevelId })
      .from(playerProfiles).where(inArray(playerProfiles.userId, players)).for('update');
    const levels = await tx.select({ id: skillLevels.id, name: skillLevels.name }).from(skillLevels);
    const changed: Array<{ playerId: number; fromRank: number; toRank: number }> = [];
    const now = new Date();
    for (const id of players) {
      const state = states.get(id)!;
      const stored = current.find(c => c.id === id);
      if (!stored) continue;
      const toLevelId = levelIdOf.get(state.rank)!;
      await tx.update(playerProfiles).set({
        skillRating: played.has(id) ? round2(state.rating).toFixed(2) : null, ratedMatchCount: state.count, isSkillTentative: state.tentative,
        skillLevelId: toLevelId, updatedAt: now,
      }).where(eq(playerProfiles.userId, id));
      if (stored.levelId === toLevelId) continue;
      const lastReplayChange = [...changes].reverse().find(c => c.playerId === id);
      const tournamentId = trigger.reason === 'TOURNAMENT_RESULT' ? lastReplayChange?.tournamentId ?? trigger.tournamentId : trigger.tournamentId;
      await tx.insert(skillLevelChanges).values({
        playerId: id, fromLevelId: stored.levelId, toLevelId, skillRating: round2(state.rating).toFixed(2), tournamentId, reason: trigger.reason,
      });
      const fromRank = rankOf.get(stored.levelId) ?? state.rank;
      changed.push({ playerId: id, fromRank, toRank: state.rank });
      const toName = levels.find(l => l.id === toLevelId)?.name ?? '';
      await notificationService.notify(tx, [{
        recipientId: id, type: 'SKILL_LEVEL_CHANGED',
        title: state.rank > fromRank ? `Chúc mừng! Bạn lên trình ${toName}` : `Trình độ của bạn đổi thành ${toName}`,
        content: state.rank > fromRank
          ? `Phong độ ở giải đấu chuyên nghiệp đưa bạn lên trình ${toName}. Xem chi tiết trong hồ sơ.`
          : `Theo kết quả các giải đấu gần đây, trình độ của bạn được điều chỉnh về ${toName}. Thi đấu tốt để lấy lại bậc nhé.`,
        // Opens the Player's own profile, where the skill rating card lives (also after an Admin recalculation).
        resource: { type: 'SKILL_RATING', id },
        dedupKey: `skill-level:${id}:${toLevelId}:${trigger.reason}:${tournamentId ?? 'all'}:${now.getTime()}`,
      }]);
    }
    return changed;
  }

  /** Admin "recalculate" (also used after a parameter change). */
  async recalculateAll(): Promise<{ changed: number }> {
    const changed = await db.transaction(tx => this.replayInTransaction(tx, { reason: 'RECALCULATION', tournamentId: null }));
    return { changed: changed.length };
  }

  /** GET /players/me/skill-rating — owner only (PRD Decision #28). */
  async own(playerId: number): Promise<SkillRatingView> {
    const [profile] = await db.select({ levelId: playerProfiles.skillLevelId, rating: playerProfiles.skillRating, count: playerProfiles.ratedMatchCount, tentative: playerProfiles.isSkillTentative })
      .from(playerProfiles).where(eq(playerProfiles.userId, playerId)).limit(1);
    if (!profile) throw new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND');
    const bands = await this.bands();
    const levels = await db.select({ id: skillLevels.id, name: skillLevels.name, rank: skillLevels.rank }).from(skillLevels).orderBy(asc(skillLevels.rank));
    const level = levels.find(l => l.id === profile.levelId)!;
    let rating = profile.rating !== null ? Number(profile.rating) : null;
    if (rating === null) {
      const [survey] = await db.select({ score: playerSkillSurveys.finalScore }).from(playerSkillSurveys).where(eq(playerSkillSurveys.userId, playerId)).limit(1);
      rating = round2(initialRating(bands, level.rank, survey ? Number(survey.score) : null));
    }
    const cfg = await skillRatingConfig.get();
    const band = bandOf(bands, level.rank);
    const upper = levels.find(l => l.rank === level.rank + 1);
    const lower = levels.find(l => l.rank === level.rank - 1);
    const events = await db.select({
      tournamentId: skillRatingEvents.tournamentId, name: tournaments.name, tournamentMatchId: skillRatingEvents.tournamentMatchId,
      before: skillRatingEvents.ratingBefore, after: skillRatingEvents.ratingAfter, opponent: skillRatingEvents.opponentRating,
      expected: skillRatingEvents.expected, outcome: skillRatingEvents.outcome, at: tournaments.completedAt,
    }).from(skillRatingEvents).innerJoin(tournaments, eq(tournaments.id, skillRatingEvents.tournamentId))
      .where(eq(skillRatingEvents.playerId, playerId)).orderBy(desc(skillRatingEvents.sequence)).limit(30);
    const changes = await db.select({
      fromId: skillLevelChanges.fromLevelId, toId: skillLevelChanges.toLevelId, rating: skillLevelChanges.skillRating, reason: skillLevelChanges.reason,
      tournamentId: skillLevelChanges.tournamentId, name: tournaments.name, at: skillLevelChanges.createdAt,
    }).from(skillLevelChanges).leftJoin(tournaments, eq(tournaments.id, skillLevelChanges.tournamentId))
      .where(eq(skillLevelChanges.playerId, playerId)).orderBy(desc(skillLevelChanges.createdAt), desc(skillLevelChanges.id)).limit(20);
    const nameOf = (id: number) => levels.find(l => l.id === id)?.name ?? '';
    return {
      rating, tentative: profile.tentative, ratedMatchCount: profile.count, level, band,
      next: upper ? { name: upper.name, threshold: band.max + cfg.hysteresis, remaining: round2(Math.max(0, band.max + cfg.hysteresis - rating)) } : null,
      previous: lower ? { name: lower.name, threshold: band.min - cfg.hysteresis } : null,
      events: events.map(e => ({
        tournament: { id: e.tournamentId, name: e.name }, tournamentMatchId: e.tournamentMatchId,
        before: Number(e.before), after: Number(e.after), opponent: Number(e.opponent), expected: Number(e.expected),
        outcome: e.outcome as 0 | 1, at: (e.at ?? new Date()).toISOString(),
      })),
      changes: changes.map(c => ({
        from: nameOf(c.fromId), to: nameOf(c.toId), rating: Number(c.rating), reason: c.reason,
        tournament: c.tournamentId ? { id: c.tournamentId, name: c.name ?? '' } : null, at: c.at.toISOString(),
      })),
    };
  }

  /** Seed tie-break (Tech Design §7.1): current R by player (cache or initial). */
  async ratingsOf(playerIds: number[], executor: Executor = db): Promise<Map<number, number>> {
    if (playerIds.length === 0) return new Map();
    const rows = await executor.select({ id: playerProfiles.userId, rating: playerProfiles.skillRating, levelId: playerProfiles.skillLevelId })
      .from(playerProfiles).where(inArray(playerProfiles.userId, playerIds));
    const bands = await this.bands(executor);
    return new Map(rows.map(r => {
      const rank = bands.find(b => b.levelId === r.levelId)?.rank ?? bands[0].rank;
      const { min, max } = bandOf(bands, rank);
      return [r.id, r.rating !== null ? Number(r.rating) : (min + max) / 2];
    }));
  }
}

export const skillRatingService = new SkillRatingService();
