import type { db } from '../db';

export type ProfileTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ProfileReader = typeof db | ProfileTransaction;

export interface ProfileIdentity {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  skillLevel: { code: string; name: string; rank: number; description: string | null };
  /** Initial survey level not yet confirmed by an official promotion (AUTH-30). */
  isSkillTentative: boolean;
}
export interface ProfileStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  resultsAvailable: boolean;
}
export interface ProfileRatingDimension {
  average: number | null;
  count: number;
  notEnoughData: boolean;
}
export interface PlayerProfileRead extends ProfileIdentity {
  ratings: { skill: ProfileRatingDimension; attitude: ProfileRatingDimension } | null;
  stats: ProfileStats | null;
}
/** Implemented by Ratings, not by a second aggregate query in Profile. */
export interface ProfileRatingsReader {
  summary(userId: number, reader: ProfileReader): Promise<{
    totalRatings: number;
    averageSkillRating: number | null;
    averageAttitudeRating: number | null;
  }>;
}
