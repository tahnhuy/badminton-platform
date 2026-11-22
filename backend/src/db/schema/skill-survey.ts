import { sql } from 'drizzle-orm';
import { bigint, check, jsonb, numeric, pgTable, smallint, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { playerProfiles, skillLevels, users } from './users';

/**
 * Registration skill survey (database-schema.md §13.8, Auth Tech Design
 * "Skill levels and survey data"). A version's definition cannot change once it
 * is ACTIVE or RETIRED (trigger in migration 0032); at most one ACTIVE version.
 */
export const skillSurveyVersions = pgTable('skill_survey_versions', {
  version: smallint('version').primaryKey(),
  status: varchar('status').notNull(),
  definition: jsonb('definition').notNull(),
  note: text('note'),
  createdBy: bigint('created_by', { mode: 'number' }).references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedBy: bigint('published_by', { mode: 'number' }).references(() => users.id),
  publishedAt: timestamp('published_at'),
}, (t) => ({
  status: check('chk_skill_survey_versions_status', sql`${t.status} IN ('DRAFT', 'ACTIVE', 'RETIRED')`),
  oneActive: uniqueIndex('uq_skill_survey_versions_active').on(t.status).where(sql`${t.status} = 'ACTIVE'`),
}));

/** One row per Player; no retake. Scores are stored rounded to 2 decimals. */
export const playerSkillSurveys = pgTable('player_skill_surveys', {
  userId: bigint('user_id', { mode: 'number' }).primaryKey().references(() => playerProfiles.userId),
  surveyVersion: smallint('survey_version').notNull().references(() => skillSurveyVersions.version),
  answers: jsonb('answers').notNull(),
  scoreK: numeric('score_k', { precision: 5, scale: 2 }).notNull(),
  scoreR: numeric('score_r', { precision: 5, scale: 2 }).notNull(),
  scoreX: numeric('score_x', { precision: 5, scale: 2 }).notNull(),
  scoreP: numeric('score_p', { precision: 5, scale: 2 }).notNull(),
  scoreA: numeric('score_a', { precision: 5, scale: 2 }).notNull(),
  scoreT: numeric('score_t', { precision: 5, scale: 2 }).notNull(),
  rawScore: numeric('raw_score', { precision: 5, scale: 2 }).notNull(),
  finalScore: numeric('final_score', { precision: 5, scale: 2 }).notNull(),
  nominalSkillLevelId: bigint('nominal_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  resultingSkillLevelId: bigint('resulting_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  appliedGuardrails: text('applied_guardrails').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  components: check(
    'chk_player_skill_surveys_components',
    sql`${t.scoreK} BETWEEN 0 AND 100 AND ${t.scoreR} BETWEEN 0 AND 100 AND ${t.scoreX} BETWEEN 0 AND 100 AND ${t.scoreP} BETWEEN 0 AND 100 AND ${t.scoreA} BETWEEN 0 AND 100 AND ${t.scoreT} BETWEEN 0 AND 100`,
  ),
  scores: check(
    'chk_player_skill_surveys_scores',
    sql`${t.rawScore} BETWEEN 0 AND 100 AND ${t.finalScore} BETWEEN 0 AND 100 AND ${t.finalScore} <= ${t.rawScore}`,
  ),
  guardrails: check(
    'chk_player_skill_surveys_guardrails',
    sql`${t.appliedGuardrails} <@ ARRAY['G1_BOTTLENECK', 'G2_EXPERIENCE_CAP']::text[]`,
  ),
}));
