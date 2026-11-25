export interface SeedEntry {
  registrationId: number;
  skillRank: number | null;
  /** Organizer seed (1 = top). When any entry has one, seeds decide the order (Tech Design §7.2). */
  seedNo?: number | null;
  /** Skill rating R (Doubles: team mean) — tie-break inside the same level sum (Tech Design §7.1, TRN-14). */
  skillRating?: number | null;
}

export type Rng = () => number;

export type RegistrationSlot = 'registration1' | 'registration2';

export interface BracketMatchPlan {
  roundIndex: number;
  matchIndex: number;
  registration1Id: number | null;
  registration2Id: number | null;
  winnerRegistrationId: number | null;
  nextMatchRoundIndex: number | null;
  nextMatchIndex: number | null;
  nextRegistrationSlot: RegistrationSlot | null;
}

export interface BracketPlan {
  bracketSize: number;
  byeCount: number;
  totalRounds: number;
  slots: Array<number | null>;
  matches: BracketMatchPlan[];
}
