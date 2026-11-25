import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { db } from '../../db';
import { matchGames, matches, matchPlayers } from '../../db/schema/matchmaking';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { tournamentMatches, tournamentRegistrations, tournamentTeamPlayers, tournamentTeams } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentRepository, type TournamentRow } from '../../repositories/tournaments/TournamentRepository';
import { buildBracket, orderRegistrationsForSeeding } from './bracket/bracketGenerator';
import { createSeededRng } from './bracket/seededRng';
import type { TournamentViewer } from './TournamentService';

/**
 * Seeds, draw and bracket (Tournament Tech Design §3.3, §7.1, §7.2 — TRN-04).
 * The draw persists the whole bracket in one transaction; BYEs create no match row
 * (the BYE registration is written straight into its round-1 slot).
 */

interface Participant {
  registrationId: number;
  seedNo: number | null;
  /** Singles: the player's rank; Doubles: sum of both members' ranks. */
  skillRank: number;
  teamName: string | null;
  players: Array<{ id: number; fullName: string; avatarUrl: string | null; rank: number | null }>;
}

export interface SeedEntryView extends Participant {
  suggestedSeedNo: number;
}

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  forbidden: () => new AppError('TOURNAMENT_FORBIDDEN', 403, 'Only the Organizer can manage the draw'),
  versionConflict: () => new AppError('TOURNAMENT_VERSION_CONFLICT', 409, 'The tournament was changed by someone else; reload and try again'),
  alreadyGenerated: () => new AppError('TOURNAMENT_BRACKET_ALREADY_GENERATED', 409, 'The bracket has already been generated'),
  invalidState: (status: string) => new AppError('TOURNAMENT_INVALID_STATE', 409, `Action not allowed while the tournament is ${status}`),
  notEnough: () => new AppError('TOURNAMENT_NOT_ENOUGH_PARTICIPANTS', 409, 'At least 2 confirmed registrations are needed for the draw'),
  seedInvalid: (details: unknown[]) => new AppError('TOURNAMENT_SEED_INVALID', 400, 'Invalid seed order', details),
};

const DRAWN: readonly string[] = ['READY', 'IN_PROGRESS', 'COMPLETED'];

export class TournamentBracketService {
  /** Confirmed registrations with players and skill (shared with match operations, TRN-06). */
  async participants(tournamentId: number, executor: typeof db | TransactionContext = db, registrationIds?: number[]): Promise<Participant[]> {
    if (registrationIds && registrationIds.length === 0) return [];
    const regs = await executor.select().from(tournamentRegistrations)
      .where(and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        registrationIds ? inArray(tournamentRegistrations.id, registrationIds) : eq(tournamentRegistrations.status, 'CONFIRMED'),
      ))
      .orderBy(asc(tournamentRegistrations.registeredAt), asc(tournamentRegistrations.id));
    const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
    const members = teamIds.length === 0 ? [] : await executor
      .select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId, role: tournamentTeamPlayers.role })
      .from(tournamentTeamPlayers).where(and(inArray(tournamentTeamPlayers.teamId, teamIds), isNull(tournamentTeamPlayers.leftAt)));
    const teams = teamIds.length === 0 ? [] : await executor.select({ id: tournamentTeams.id, name: tournamentTeams.name })
      .from(tournamentTeams).where(inArray(tournamentTeams.id, teamIds));
    const playerIds = [...regs.map(r => r.playerId).filter((id): id is number => id !== null), ...members.map(m => m.playerId)];
    const profiles = playerIds.length === 0 ? [] : await executor.select({
      id: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl, rank: skillLevels.rank,
    }).from(playerProfiles).leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(inArray(playerProfiles.userId, playerIds));
    const profile = (id: number) => {
      const p = profiles.find(x => x.id === id);
      return { id, fullName: p?.fullName ?? 'Người chơi', avatarUrl: p?.avatarUrl ?? null, rank: p?.rank ?? null };
    };
    return regs.map(reg => {
      const players = reg.playerId !== null
        ? [profile(reg.playerId)]
        : members.filter(m => m.teamId === reg.teamId)
          .sort((a, b) => (a.role === 'CAPTAIN' ? -1 : b.role === 'CAPTAIN' ? 1 : 0))
          .map(m => profile(m.playerId));
      return {
        registrationId: reg.id,
        seedNo: reg.seedNo,
        skillRank: players.reduce((sum, p) => sum + (p.rank ?? 0), 0),
        teamName: reg.teamId === null ? null : teams.find(t => t.id === reg.teamId)?.name ?? null,
        players,
      };
    });
  }

  /** Skill suggestion (Tech Design §7.1); ties broken by an RNG seeded with the tournament id, so it is stable. */
  private suggest(tournamentId: number, participants: Participant[]): Map<number, number> {
    const ordered = orderRegistrationsForSeeding(
      participants.map(p => ({ registrationId: p.registrationId, skillRank: p.skillRank })),
      createSeededRng(tournamentId),
    );
    return new Map(ordered.map((entry, index) => [entry.registrationId, index + 1]));
  }

  /** Status before version: a repeated draw must say "already generated", not "version conflict" (review, TRN-04). */
  private async lockForOrganizer(actor: TournamentViewer, id: number, version: number, tx: TransactionContext): Promise<TournamentRow> {
    const t = await tournamentRepository.findById(id, tx, { lock: true });
    if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
    if (t.creatorId !== actor.id) throw err.forbidden();
    if (DRAWN.includes(t.status)) throw err.alreadyGenerated();
    if (t.status !== 'REGISTRATION_CLOSED') throw err.invalidState(t.status);
    if (t.version !== version) throw err.versionConflict();
    return t;
  }

  async getSeeds(actor: TournamentViewer, id: number): Promise<{ editable: boolean; version: number; entries: SeedEntryView[] }> {
    const t = await tournamentRepository.findById(id);
    if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
    if (t.creatorId !== actor.id) throw err.forbidden();
    if (t.status !== 'REGISTRATION_CLOSED' && !DRAWN.includes(t.status)) throw err.invalidState(t.status);
    const participants = await this.participants(id);
    const suggestion = this.suggest(id, participants);
    const entries = participants
      .map(p => ({ ...p, suggestedSeedNo: suggestion.get(p.registrationId)! }))
      .sort((a, b) => a.suggestedSeedNo - b.suggestedSeedNo);
    return { editable: t.status === 'REGISTRATION_CLOSED', version: t.version, entries };
  }

  /** Replaces all seeds. Seeds must be 1..k without gaps; omitted registrations stay unseeded. */
  async setSeeds(actor: TournamentViewer, id: number, version: number, seeds: Array<{ registrationId: number; seedNo: number }>) {
    await db.transaction(async tx => {
      await this.lockForOrganizer(actor, id, version, tx);
      const confirmed = new Set((await this.participants(id, tx)).map(p => p.registrationId));
      const problems: unknown[] = [];
      const seen = new Set<number>();
      for (const seed of seeds) {
        if (!confirmed.has(seed.registrationId)) problems.push({ field: 'registrationId', code: 'NOT_A_CONFIRMED_REGISTRATION', registrationId: seed.registrationId });
        if (seen.has(seed.registrationId)) problems.push({ field: 'registrationId', code: 'DUPLICATE_REGISTRATION', registrationId: seed.registrationId });
        seen.add(seed.registrationId);
      }
      const numbers = seeds.map(s => s.seedNo).sort((a, b) => a - b);
      if (numbers.some((n, i) => n !== i + 1)) problems.push({ field: 'seedNo', code: 'SEEDS_MUST_BE_1_TO_K' });
      if (problems.length > 0) throw err.seedInvalid(problems);
      await tx.update(tournamentRegistrations).set({ seedNo: null })
        .where(and(eq(tournamentRegistrations.tournamentId, id), isNotNull(tournamentRegistrations.seedNo)));
      for (const seed of seeds) {
        await tx.update(tournamentRegistrations).set({ seedNo: seed.seedNo, updatedAt: new Date() })
          .where(eq(tournamentRegistrations.id, seed.registrationId));
      }
      await tournamentRepository.update(id, {}, tx);
    });
    return this.getSeeds(actor, id);
  }

  /**
   * The draw (PRD FR-32/33): applies the suggestion as seeds when the Organizer saved none,
   * builds the bracket with a stored random `draw_seed`, persists every real match with
   * its links and rosters, and moves the tournament to READY — all in one transaction.
   */
  async draw(actor: TournamentViewer, id: number, version: number): Promise<{ status: string; version: number; drawSeed: number }> {
    const row = await db.transaction(async tx => {
      const t = await this.lockForOrganizer(actor, id, version, tx);
      const participants = await this.participants(id, tx);
      if (participants.length < 2) throw err.notEnough();

      if (participants.every(p => p.seedNo === null)) {
        const suggestion = this.suggest(id, participants);
        for (const p of participants) {
          p.seedNo = suggestion.get(p.registrationId)!;
          await tx.update(tournamentRegistrations).set({ seedNo: p.seedNo }).where(eq(tournamentRegistrations.id, p.registrationId));
        }
      }
      const drawSeed = randomInt(1, 2 ** 31 - 1);
      const plan = buildBracket(
        participants.map(p => ({ registrationId: p.registrationId, skillRank: p.skillRank, seedNo: p.seedNo })),
        createSeededRng(drawSeed),
      );
      await this.persistPlan(t, plan.matches, participants, tx);
      return tournamentRepository.update(id, { status: 'READY', drawSeed }, tx);
    });
    return { status: row.status, version: row.version, drawSeed: row.drawSeed! };
  }

  private async persistPlan(
    t: TournamentRow,
    planned: ReturnType<typeof buildBracket>['matches'],
    participants: Participant[],
    tx: TransactionContext,
  ): Promise<void> {
    const key = (round: number, index: number) => `${round}:${index}`;
    const ids = new Map<string, number>();
    for (const m of planned) {
      const [match] = await tx.insert(matches).values({
        matchType: t.matchType, scheduledAt: t.tournamentStart, status: 'CONFIRMED',
      }).returning({ id: matches.id });
      const [tm] = await tx.insert(tournamentMatches).values({
        tournamentId: t.id, matchId: match.id, roundIndex: m.roundIndex, matchIndex: m.matchIndex,
        registration1Id: m.registration1Id, registration2Id: m.registration2Id, resolution: 'UNRESOLVED',
      }).returning({ id: tournamentMatches.id });
      ids.set(key(m.roundIndex, m.matchIndex), tm.id);
      if (m.registration1Id !== null && m.registration2Id !== null) {
        await this.writeRoster(match.id, m.registration1Id, m.registration2Id, participants, tx, t.matchType);
      }
    }
    for (const m of planned) {
      if (m.nextMatchRoundIndex === null || m.nextMatchIndex === null) continue;
      await tx.update(tournamentMatches)
        .set({ nextMatchId: ids.get(key(m.nextMatchRoundIndex, m.nextMatchIndex))!, nextRegistrationSlot: m.nextRegistrationSlot })
        .where(eq(tournamentMatches.id, ids.get(key(m.roundIndex, m.matchIndex))!));
    }
  }

  /** `match_players` for a playable match (Tech Design §2.4): team 1 = slot 1, team 2 = slot 2. */
  async writeRoster(matchId: number, reg1: number, reg2: number, participants: Participant[], tx: TransactionContext, matchType: string): Promise<void> {
    const joinedAt = new Date();
    const size = matchType === 'DOUBLES' ? 2 : 1;
    const side = (regId: number) => {
      const players = participants.find(p => p.registrationId === regId)?.players.map(p => p.id) ?? [];
      // A short roster would silently drop results from player statistics (review, TRN-04).
      if (players.length !== size) throw new Error(`registration ${regId} has ${players.length} active players, expected ${size}`);
      return players;
    };
    await tx.insert(matchPlayers).values([
      ...side(reg1).map(playerId => ({ matchId, playerId, teamNo: 1, status: 'ACTIVE', joinedAt })),
      ...side(reg2).map(playerId => ({ matchId, playerId, teamNo: 2, status: 'ACTIVE', joinedAt })),
    ]);
  }

  /** Public bracket (not DRAFT): rounds, slots with BYE flags, winners, scores, schedule. */
  async bracket(viewer: TournamentViewer | null, id: number) {
    const t = await tournamentRepository.findById(id);
    if (!t || (t.status === 'DRAFT' && t.creatorId !== viewer?.id && viewer?.role !== 'ADMIN')) throw err.notFound();
    const rows = await db.select({
      id: tournamentMatches.id, matchId: tournamentMatches.matchId, roundIndex: tournamentMatches.roundIndex, matchIndex: tournamentMatches.matchIndex,
      registration1Id: tournamentMatches.registration1Id, registration2Id: tournamentMatches.registration2Id,
      winnerRegistrationId: tournamentMatches.winnerRegistrationId, resolution: tournamentMatches.resolution,
      nextMatchId: tournamentMatches.nextMatchId, nextRegistrationSlot: tournamentMatches.nextRegistrationSlot,
      courtLabel: tournamentMatches.courtLabel, status: matches.status, scheduledAt: matches.scheduledAt,
      startedAt: matches.startedAt, completedAt: matches.completedAt,
    }).from(tournamentMatches).innerJoin(matches, eq(matches.id, tournamentMatches.matchId))
      .where(eq(tournamentMatches.tournamentId, id))
      .orderBy(asc(tournamentMatches.roundIndex), asc(tournamentMatches.matchIndex));
    if (rows.length === 0) return { generated: false, totalRounds: 0, rounds: [] };
    const games = await db.select().from(matchGames)
      .where(inArray(matchGames.matchId, rows.map(r => r.matchId))).orderBy(asc(matchGames.gameNo));
    // Load by the ids in the bracket, whatever their status now (review, TRN-04).
    const referenced = [...new Set(rows.flatMap(r => [r.registration1Id, r.registration2Id]).filter((x): x is number => x !== null))];
    const participants = new Map((await this.participants(id, db, referenced)).map(p => [p.registrationId, p]));
    const fed = new Set(rows.filter(r => r.nextMatchId !== null).map(r => `${r.nextMatchId}:${r.nextRegistrationSlot}`));
    const slot = (matchRowId: number, slotName: 'registration1' | 'registration2', regId: number | null) => {
      const p = regId === null ? null : participants.get(regId) ?? null;
      return {
        registrationId: regId,
        seedNo: p?.seedNo ?? null,
        teamName: p?.teamName ?? null,
        players: p ? p.players.map(({ id: playerId, fullName, avatarUrl }) => ({ id: playerId, fullName, avatarUrl })) : [],
        // Filled without a feeder match = the registration advanced on a BYE.
        fromBye: regId !== null && !fed.has(`${matchRowId}:${slotName}`) && rows.some(r => r.id === matchRowId && r.roundIndex > 0),
      };
    };
    const totalRounds = Math.max(...rows.map(r => r.roundIndex)) + 1;
    const rounds = Array.from({ length: totalRounds }, (_, roundIndex) => ({
      roundIndex,
      matches: rows.filter(r => r.roundIndex === roundIndex).map(r => ({
        id: r.id, roundIndex: r.roundIndex, matchIndex: r.matchIndex,
        slot1: slot(r.id, 'registration1', r.registration1Id),
        slot2: slot(r.id, 'registration2', r.registration2Id),
        winnerRegistrationId: r.winnerRegistrationId, resolution: r.resolution, status: r.status,
        scheduledAt: r.scheduledAt.toISOString(), courtLabel: r.courtLabel,
        startedAt: r.startedAt?.toISOString() ?? null, completedAt: r.completedAt?.toISOString() ?? null,
        sets: games.filter(g => g.matchId === r.matchId).map(g => ({ setNo: g.gameNo, team1Score: g.team1Score, team2Score: g.team2Score })),
        nextMatchId: r.nextMatchId,
      })),
    }));
    return { generated: true, totalRounds, drawSeed: t.drawSeed, rounds };
  }
}

export const tournamentBracketService = new TournamentBracketService();

export type { Participant as BracketParticipant };
