export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RatingEntry {
  id: number;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
  createdAt: string;
}

export interface PendingRatedPlayer {
  playerId: number;
  fullName: string | null;
  rating: RatingEntry;
}

export interface PendingPlayer {
  playerId: number;
  fullName: string | null;
}

export interface PendingResponse {
  matchId: number;
  matchType: string;
  ratedPlayers: PendingRatedPlayer[];
  pendingPlayers: PendingPlayer[];
}

export interface CreateRatingItem {
  ratedPlayerId: number;
  skillRating: number;
  attitudeRating: number;
  comment?: string;
}

export interface CreatedRating {
  id: number;
  ratedPlayerId: number;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateRatingsResult {
  matchId: number;
  created: CreatedRating[];
  alreadyRated: Array<{ ratedPlayerId: number }>;
}

export interface UserRatingRow {
  id: number;
  matchId: number;
  raterId: number;
  raterFullName: string | null;
  ratedPlayerId: number;
  ratedPlayerFullName: string | null;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
  createdAt: string;
}

export interface SkillLevelRef {
  id: number;
  code: string | null;
  name: string | null;
  rank: number | null;
}

export interface SkillAdjustmentRow {
  id: number;
  playerId: number;
  previousSkillLevel: SkillLevelRef;
  newSkillLevel: SkillLevelRef;
  averageSkillRating: number;
  ratingsConsidered: number;
  source: string;
  createdAt: string;
}

export interface RatingSummary {
  userId: number;
  totalRatings: number;
  notEnoughData: boolean;
  averageSkillRating: number | null;
  averageAttitudeRating: number | null;
  skillDistribution: Record<string, number> | null;
  attitudeDistribution: Record<string, number> | null;
}
