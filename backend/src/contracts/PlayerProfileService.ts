export interface PlayerSkillRank {
  userId: number;
  skillLevelId: number;
  skillRank: number;
}

export interface PlayerProfileSummary {
  userId: number;
  fullName: string;
  skillLevelId: number;
  skillRank: number;
}

export interface PlayerProfileService {
  getSkillRank(userId: number): Promise<PlayerSkillRank | null>;
  getProfilesByIds(userIds: number[]): Promise<PlayerProfileSummary[]>;
}
