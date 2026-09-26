export interface SeedEntry {
  registrationId: number;
  skillRank: number | null;
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
