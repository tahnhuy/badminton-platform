import { BracketMatchPlan, BracketPlan, RegistrationSlot, Rng, SeedEntry } from './types';

export function nextPowerOfTwo(value: number): number {
  if (value <= 1) {
    return 1;
  }
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
}

export function calcBracketSize(registrationCount: number): number {
  if (!Number.isInteger(registrationCount) || registrationCount < 1) {
    throw new Error('registrationCount must be a positive integer');
  }
  return nextPowerOfTwo(registrationCount);
}

export function calcByeCount(registrationCount: number, bracketSize: number): number {
  return bracketSize - registrationCount;
}

export function seedPositions(bracketSize: number): number[] {
  const isPowerOfTwo = bracketSize >= 1 && (bracketSize & (bracketSize - 1)) === 0;
  if (!Number.isInteger(bracketSize) || !isPowerOfTwo) {
    throw new Error('bracketSize must be a power of two');
  }

  let positions = [1];
  for (let size = 2; size <= bracketSize; size *= 2) {
    const expanded: number[] = [];
    for (const seed of positions) {
      expanded.push(seed, size + 1 - seed);
    }
    positions = expanded;
  }
  return positions;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(rng() * (index + 1));
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

export function orderRegistrationsForSeeding(entries: readonly SeedEntry[], rng: Rng): SeedEntry[] {
  const ranked = entries
    .filter((entry) => entry.skillRank !== null)
    .map((entry) => ({ entry, tieBreak: rng() }));
  ranked.sort((left, right) => {
    const rankDifference = (right.entry.skillRank as number) - (left.entry.skillRank as number);
    if (rankDifference !== 0) return rankDifference;
    const ratingDifference = (right.entry.skillRating ?? 0) - (left.entry.skillRating ?? 0);
    return ratingDifference !== 0 ? ratingDifference : left.tieBreak - right.tieBreak;
  });
  const unranked = shuffle(
    entries.filter((entry) => entry.skillRank === null),
    rng,
  );
  return [...ranked.map((item) => item.entry), ...unranked];
}

/**
 * Draw order (Tech Design §7.2): seeded entries by `seedNo` ascending take seed positions
 * 1..k; every unseeded entry is placed in a random order after them (the draw). Without any
 * Organizer seed, falls back to skill-rank ordering.
 */
export function orderForDraw(entries: readonly SeedEntry[], rng: Rng): SeedEntry[] {
  const seeded = entries.filter(entry => entry.seedNo !== undefined && entry.seedNo !== null);
  if (seeded.length === 0) return orderRegistrationsForSeeding(entries, rng);
  const seedNos = new Set(seeded.map(entry => entry.seedNo));
  if (seedNos.size !== seeded.length) throw new Error('seed numbers must be unique');
  seeded.sort((left, right) => (left.seedNo as number) - (right.seedNo as number));
  const unseeded = shuffle(entries.filter(entry => entry.seedNo === undefined || entry.seedNo === null), rng);
  return [...seeded, ...unseeded];
}

export function buildSlots(orderedEntries: readonly SeedEntry[], bracketSize: number): Array<number | null> {
  return seedPositions(bracketSize).map((seedNumber) => {
    const entry = orderedEntries[seedNumber - 1];
    return entry ? entry.registrationId : null;
  });
}

type SlotSource =
  | { kind: 'registration'; registrationId: number }
  | { kind: 'match'; match: BracketMatchPlan };

function createMatch(
  roundIndex: number,
  matchIndex: number,
  registration1Id: number | null,
  registration2Id: number | null,
): BracketMatchPlan {
  return {
    roundIndex,
    matchIndex,
    registration1Id,
    registration2Id,
    winnerRegistrationId: null,
    nextMatchRoundIndex: null,
    nextMatchIndex: null,
    nextRegistrationSlot: null,
  };
}

function sourceRegistrationId(source: SlotSource): number | null {
  return source.kind === 'registration' ? source.registrationId : null;
}

function linkToNextMatch(source: SlotSource, next: BracketMatchPlan, slot: RegistrationSlot): void {
  if (source.kind === 'match') {
    source.match.nextMatchRoundIndex = next.roundIndex;
    source.match.nextMatchIndex = next.matchIndex;
    source.match.nextRegistrationSlot = slot;
  }
}

function buildInitialSources(
  slots: ReadonlyArray<number | null>,
  matches: BracketMatchPlan[],
): SlotSource[] {
  const sources: SlotSource[] = [];
  for (let matchIndex = 0; matchIndex < slots.length / 2; matchIndex += 1) {
    const first = slots[matchIndex * 2];
    const second = slots[matchIndex * 2 + 1];
    if (first !== null && second !== null) {
      const match = createMatch(0, matchIndex, first, second);
      matches.push(match);
      sources.push({ kind: 'match', match });
    } else {
      const registrationId = first !== null ? first : second;
      if (registrationId === null) {
        throw new Error('bracket contains an empty first-round pairing');
      }
      sources.push({ kind: 'registration', registrationId });
    }
  }
  return sources;
}

function buildRounds(initialSources: SlotSource[], matches: BracketMatchPlan[]): void {
  let current = initialSources;
  let roundIndex = 1;
  while (current.length > 1) {
    const next: SlotSource[] = [];
    for (let matchIndex = 0; matchIndex < current.length / 2; matchIndex += 1) {
      const first = current[matchIndex * 2];
      const second = current[matchIndex * 2 + 1];
      const match = createMatch(
        roundIndex,
        matchIndex,
        sourceRegistrationId(first),
        sourceRegistrationId(second),
      );
      linkToNextMatch(first, match, 'registration1');
      linkToNextMatch(second, match, 'registration2');
      matches.push(match);
      next.push({ kind: 'match', match });
    }
    current = next;
    roundIndex += 1;
  }
}

export function buildBracket(entries: readonly SeedEntry[], rng: Rng): BracketPlan {
  if (entries.length < 2) {
    throw new Error('a bracket requires at least 2 registrations');
  }

  const bracketSize = calcBracketSize(entries.length);
  const ordered = orderForDraw(entries, rng);
  const slots = buildSlots(ordered, bracketSize);
  const matches: BracketMatchPlan[] = [];
  buildRounds(buildInitialSources(slots, matches), matches);

  return {
    bracketSize,
    byeCount: calcByeCount(entries.length, bracketSize),
    totalRounds: Math.log2(bracketSize),
    slots,
    matches,
  };
}
