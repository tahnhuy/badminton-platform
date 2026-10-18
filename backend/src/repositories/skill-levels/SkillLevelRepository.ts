import { asc } from 'drizzle-orm';
import { db } from '../../db';
import { skillLevels } from '../../db/schema/users';

export interface SkillLevelDto {
  id: number;
  code: string;
  name: string;
  rank: number;
  description: string | null;
}

export const skillLevelsRepository = {
  async listAll(): Promise<SkillLevelDto[]> {
    const rows = await db
      .select({
        id: skillLevels.id,
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
