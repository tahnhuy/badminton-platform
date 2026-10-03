import { asc } from 'drizzle-orm';
import { db } from '../../db';
import { skillLevels } from '../../db/schema/users';

export interface SkillLevelDto {
  code: string;
  name: string;
  rank: number;
  description: string | null;
}

export const skillLevelsRepository = {
  async listAll(): Promise<SkillLevelDto[]> {
    const rows = await db
      .select({
        code: skillLevels.code,
        name: skillLevels.name,
        rank: skillLevels.rank,
        description: skillLevels.description,
      })
      .from(skillLevels)
      .orderBy(asc(skillLevels.rank));

    return rows;
  },
};
