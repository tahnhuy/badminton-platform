import type { Clock } from './lib/clock';
import type { Random } from './lib/random';
import type { LevelCode } from './data/people';

export interface SeedPlayer {
  id: number;
  key: string;
  email: string;
  fullName: string;
  level: LevelCode;
  joinedAt: Date;
  active: boolean;
}

export interface SeedFacility {
  id: number;
  name: string;
  ownerId: number;
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'REJECTED';
  openingTime: string;
  closingTime: string;
  /** Bookable courts (ACTIVE and not under maintenance). */
  courtIds: number[];
  allCourtIds: number[];
}

/** Shared state passed from step to step; later steps read what earlier ones created. */
export interface SeedContext {
  clock: Clock;
  random: Random;
  /** Hash of the shared demo password, computed with this environment's PASSWORD_PEPPER. */
  passwordHash: string;
  pinHash: string;
  adminId: number;
  owners: Map<string, number>;
  players: Map<string, SeedPlayer>;
  facilities: SeedFacility[];
  /** Completed matchmaking matches (step 06), rated in step 07. */
  completedMatches: Array<{ matchId: number; playerIds: number[]; completedAt: Date }>;
  log: (message: string) => void;
}
