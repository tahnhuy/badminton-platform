import { describe, expect, it } from 'vitest';
import {
  buildBracket,
  buildSlots,
  calcBracketSize,
  calcByeCount,
  nextPowerOfTwo,
  orderForDraw,
  orderRegistrationsForSeeding,
  seedPositions,
  shuffle,
} from '../services/tournaments/bracket/bracketGenerator';
import { createSeededRng } from '../services/tournaments/bracket/seededRng';
import { SeedEntry } from '../services/tournaments/bracket/types';

const entriesWithRanks = (ranks: number[]): SeedEntry[] =>
  ranks.map((skillRank, index) => ({ registrationId: index + 1, skillRank }));

const unrankedEntries = (count: number): SeedEntry[] =>
  Array.from({ length: count }, (_, index) => ({ registrationId: index + 1, skillRank: null }));

const byeRecipients = (slots: ReadonlyArray<number | null>): Set<number> => {
  const recipients = new Set<number>();
  for (let index = 0; index < slots.length; index += 2) {
    const first = slots[index];
    const second = slots[index + 1];
    if ((first === null) !== (second === null)) {
      recipients.add((first ?? second) as number);
    }
  }
  return recipients;
};

describe('nextPowerOfTwo / calcBracketSize', () => {
  it('rounds up to the smallest power of two', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9].map(calcBracketSize)).toEqual([2, 4, 4, 8, 8, 8, 8, 16]);
  });

  it('rejects a non-positive or non-integer count', () => {
    expect(() => calcBracketSize(0)).toThrow();
    expect(() => calcBracketSize(2.5)).toThrow();
  });
});

describe('calcByeCount', () => {
  it('returns size minus registrations', () => {
    expect(calcByeCount(5, 8)).toBe(3);
    expect(calcByeCount(8, 8)).toBe(0);
  });
});

describe('seedPositions', () => {
  it('produces a standard single-elimination seed layout', () => {
    expect(seedPositions(1)).toEqual([1]);
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('rejects a non power-of-two size', () => {
    expect(() => seedPositions(6)).toThrow();
  });
});

describe('shuffle', () => {
  it('is deterministic per seed, keeps all items, and does not mutate the input', () => {
    const items = [1, 2, 3, 4, 5];
    const first = shuffle(items, createSeededRng(42));
    const second = shuffle(items, createSeededRng(42));
    expect(first).toEqual(second);
    expect([...first].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('orderRegistrationsForSeeding', () => {
  it('orders ranked entries by skill rank descending', () => {
    const ordered = orderRegistrationsForSeeding(entriesWithRanks([1, 6, 3]), createSeededRng(1));
    expect(ordered.map((entry) => entry.skillRank)).toEqual([6, 3, 1]);
  });

  it('randomizes ties deterministically for the same seed', () => {
    const entries = entriesWithRanks([3, 3, 3, 3]);
    const first = orderRegistrationsForSeeding(entries, createSeededRng(7)).map((entry) => entry.registrationId);
    const second = orderRegistrationsForSeeding(entries, createSeededRng(7)).map((entry) => entry.registrationId);
    expect(first).toEqual(second);
  });

  it('places unranked entries after ranked entries', () => {
    const entries: SeedEntry[] = [
      { registrationId: 1, skillRank: null },
      { registrationId: 2, skillRank: 5 },
      { registrationId: 3, skillRank: null },
    ];
    const ordered = orderRegistrationsForSeeding(entries, createSeededRng(3));
    expect(ordered[0].registrationId).toBe(2);
    expect(ordered.slice(1).every((entry) => entry.skillRank === null)).toBe(true);
  });
});

describe('buildSlots', () => {
  it('maps seed numbers to standard positions and leaves missing seeds as BYEs', () => {
    const ordered = entriesWithRanks([6, 5, 4, 3, 2]);
    expect(buildSlots(ordered, 8)).toEqual([1, null, 4, 5, 2, null, 3, null]);
  });
});

describe('buildBracket', () => {
  it('requires at least two registrations', () => {
    expect(() => buildBracket(entriesWithRanks([5]), createSeededRng(1))).toThrow();
  });

  it('creates a single final match for two registrations', () => {
    const plan = buildBracket(unrankedEntries(2), createSeededRng(1));
    expect(plan.bracketSize).toBe(2);
    expect(plan.byeCount).toBe(0);
    expect(plan.totalRounds).toBe(1);
    expect(plan.matches).toHaveLength(1);
    expect(plan.matches[0]).toMatchObject({
      roundIndex: 0,
      matchIndex: 0,
      nextMatchRoundIndex: null,
      nextMatchIndex: null,
      nextRegistrationSlot: null,
    });
  });

  it('creates size - 1 - byeCount real matches across sizes', () => {
    for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 16]) {
      const plan = buildBracket(unrankedEntries(count), createSeededRng(9));
      expect(plan.bracketSize).toBe(nextPowerOfTwo(count));
      expect(plan.byeCount).toBe(plan.bracketSize - count);
      expect(plan.matches).toHaveLength(plan.bracketSize - 1 - plan.byeCount);
    }
  });

  it('never creates a first-round match with an empty pairing', () => {
    const plan = buildBracket(unrankedEntries(11), createSeededRng(2));
    const firstRound = plan.matches.filter((match) => match.roundIndex === 0);
    expect(firstRound.length).toBeGreaterThan(0);
    for (const match of firstRound) {
      expect(match.registration1Id).not.toBeNull();
      expect(match.registration2Id).not.toBeNull();
    }
  });

  it('places every registration exactly once in the slots', () => {
    const plan = buildBracket(unrankedEntries(13), createSeededRng(4));
    const ids = plan.slots
      .filter((id): id is number => id !== null)
      .sort((left, right) => left - right);
    expect(ids).toEqual(Array.from({ length: 13 }, (_, index) => index + 1));
  });

  it('auto-advances a BYE without creating a match for it', () => {
    const plan = buildBracket(unrankedEntries(3), createSeededRng(5));
    const final = plan.matches.find((match) => match.roundIndex === 1 && match.matchIndex === 0);
    expect(final).toBeDefined();
    expect(final?.registration1Id).not.toBeNull();
    expect(final?.registration2Id).toBeNull();
    expect(plan.matches.filter((match) => match.roundIndex === 0)).toHaveLength(1);
  });

  it('links each child match to its next match and destination slot', () => {
    const plan = buildBracket(unrankedEntries(4), createSeededRng(6));
    const firstRound = plan.matches.filter((match) => match.roundIndex === 0);
    expect(firstRound).toHaveLength(2);
    expect(firstRound[0].nextMatchRoundIndex).toBe(1);
    expect(firstRound[0].nextMatchIndex).toBe(0);
    expect(firstRound[0].nextRegistrationSlot).toBe('registration1');
    expect(firstRound[1].nextMatchRoundIndex).toBe(1);
    expect(firstRound[1].nextRegistrationSlot).toBe('registration2');
  });

  it('gives BYEs to the highest seeds', () => {
    const plan = buildBracket(entriesWithRanks([6, 5, 4, 3, 2]), createSeededRng(8));
    const recipients = byeRecipients(plan.slots);
    expect(recipients).toEqual(new Set([1, 2, 3]));
  });

  it('keeps the top two seeds in opposite halves', () => {
    const plan = buildBracket(entriesWithRanks([6, 5, 4, 3, 2, 1, 4, 3]), createSeededRng(11));
    const half = plan.slots.length / 2;
    const seed1Half = plan.slots.indexOf(1) < half;
    const seed2Half = plan.slots.indexOf(2) < half;
    expect(seed1Half).not.toBe(seed2Half);
  });

  it('is deterministic for the same seed and differs across seeds', () => {
    const first = buildBracket(unrankedEntries(7), createSeededRng(123));
    const second = buildBracket(unrankedEntries(7), createSeededRng(123));
    const third = buildBracket(unrankedEntries(7), createSeededRng(124));
    expect(first).toEqual(second);
    expect(first.slots).not.toEqual(third.slots);
  });
});

describe('Organizer seeds and the draw (TRN-04)', () => {
  /** n registrations; the first `seeded` get seedNo 1..seeded (registration id = n - index, so ids differ from seeds). */
  const seededEntries = (n: number, seeded: number): SeedEntry[] =>
    Array.from({ length: n }, (_, index) => ({
      registrationId: 1000 + index, skillRank: (index * 7) % 5, seedNo: index < seeded ? index + 1 : null,
    }));
  const position = (slots: ReadonlyArray<number | null>, registrationId: number) => slots.indexOf(registrationId);

  it('orders seeded entries by seed number before the randomly drawn rest', () => {
    const entries = seededEntries(6, 3).reverse();
    const ordered = orderForDraw(entries, createSeededRng(5));
    expect(ordered.slice(0, 3).map(e => e.seedNo)).toEqual([1, 2, 3]);
    expect(ordered.slice(3).every(e => e.seedNo === null)).toBe(true);
    expect(() => orderForDraw([{ registrationId: 1, skillRank: 1, seedNo: 1 }, { registrationId: 2, skillRank: 1, seedNo: 1 }], createSeededRng(1)))
      .toThrow(/unique/);
  });

  for (let n = 2; n <= 128; n += n < 16 ? 1 : 13) {
    it(`places seeds correctly for ${n} registrations`, () => {
      const seeded = Math.min(n, 8);
      const plan = buildBracket(seededEntries(n, seeded), createSeededRng(n));
      const size = plan.bracketSize;
      const byes = byeRecipients(plan.slots);
      // BYEs go to the top seeds first.
      const expectedByes = Array.from({ length: Math.min(plan.byeCount, seeded) }, (_, i) => 1000 + i);
      for (const id of expectedByes) expect(byes.has(id)).toBe(true);
      // Seeds 1 and 2 in opposite halves; seeds 1–4 in different quarters.
      if (n >= 2) expect(position(plan.slots, 1000) < size / 2).not.toBe(position(plan.slots, 1001) < size / 2);
      if (n >= 4 && size >= 4) {
        const quarters = [1000, 1001, 1002, 1003].map(id => Math.floor(position(plan.slots, id) / (size / 4)));
        expect(new Set(quarters).size).toBe(4);
      }
      expect(plan.matches).toHaveLength(size - 1 - plan.byeCount);
    });
  }

  it('keeps seeded positions fixed across draws and reproduces a draw from its seed', () => {
    const entries = seededEntries(11, 4);
    const a = buildBracket(entries, createSeededRng(77));
    const b = buildBracket(entries, createSeededRng(78));
    for (const id of [1000, 1001, 1002, 1003]) expect(position(a.slots, id)).toBe(position(b.slots, id));
    expect(buildBracket(entries, createSeededRng(77))).toEqual(a);
  });
});
