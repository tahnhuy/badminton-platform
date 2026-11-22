import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { pool } from '../db';
import { SKILL_SURVEY_DEFINITION_V1, validateSkillSurveyDefinition } from '../services/auth/skill-survey';

/**
 * AUTH-29 — migration 0029 on the migrated badminton_test database.
 * Note: test cleanup truncates `users` CASCADE, which empties
 * skill_survey_versions, and re-inserts version 1 from the TS constant
 * (test-db.ts). Checks on the migration's own seed therefore read the SQL file.
 */

const MIGRATION_SQL = readFileSync(join(__dirname, '../db/migrations/0029_player_skill_surveys.sql'), 'utf8');

function migrationDefinitionLiteral(): string {
  const match = MIGRATION_SQL.match(/\$json\$([\s\S]*?)\$json\$::jsonb/);
  if (!match) throw new Error('version 1 literal not found in migration 0029');
  return match[1];
}

const LEVELS: Array<[number, string, string, string]> = [
  [1, 'BEGINNER', 'Mới chơi', 'Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định'],
  [2, 'WEAK', 'Yếu', 'Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả, hay đứng sai vị trí'],
  [3, 'AVERAGE_MINUS', 'Trung bình yếu', 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi; dễ tự đánh hỏng khi đối phương tăng tốc'],
  [4, 'AVERAGE', 'Trung bình', 'Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí; độ ổn định chưa đồng đều giữa các kỹ thuật'],
  [5, 'AVERAGE_PLUS', 'Trung bình khá', 'Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật có chủ đích'],
  [6, 'GOOD', 'Khá', 'Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ; người chơi phong trào năng lực cao'],
  [7, 'EXCELLENT', 'Giỏi', 'Kỹ thuật chuyên sâu, chính xác ngay cả dưới áp lực; chủ động công thủ tốc độ cao; thường đã có thành tích thi đấu (bao gồm cả bán chuyên và chuyên nghiệp)'],
];

describe('migration 0029 — seven-level catalog and survey version 1', () => {
  it('has seven skill levels with the matrix §1.2 names and descriptions', async () => {
    const { rows } = await pool.query('SELECT rank, code, name, description FROM skill_levels ORDER BY rank');
    expect(rows.map(r => [r.rank, r.code, r.name, r.description])).toEqual(LEVELS);
  });

  it('seeds version 1 in the migration with exactly SKILL_SURVEY_DEFINITION_V1', () => {
    const literal = migrationDefinitionLiteral();
    expect(JSON.parse(literal)).toEqual(SKILL_SURVEY_DEFINITION_V1);
    expect(literal).toContain('"score":33.333333333333336');
    expect(literal).toContain('"score":66.66666666666667');
    expect(MIGRATION_SQL).toMatch(/VALUES \(1, 'ACTIVE', \$json\$/);
  });

  it('stores exactly one ACTIVE version, equal to SKILL_SURVEY_DEFINITION_V1 and valid against the catalog', async () => {
    const { rows } = await pool.query("SELECT version, definition FROM skill_survey_versions WHERE status = 'ACTIVE'");
    expect(rows).toHaveLength(1);
    expect(rows[0].version).toBe(1);
    expect(rows[0].definition).toEqual(SKILL_SURVEY_DEFINITION_V1);
    const levels = await pool.query('SELECT code FROM skill_levels ORDER BY rank');
    expect(validateSkillSurveyDefinition(rows[0].definition, levels.rows.map(r => r.code))).toEqual([]);
  });

  it('keeps full-precision option scores in the stored definition', async () => {
    const { rows } = await pool.query(
      `SELECT o->>'score' AS score FROM skill_survey_versions v,
         jsonb_array_elements(v.definition->'questions') q, jsonb_array_elements(q->'options') o
       WHERE v.version = 1 AND q->>'id' = 'frequencyPerWeek' AND o->>'code' = 'ONE'`,
    );
    expect(Number(rows[0].score)).toBe(100 / 3);
  });

  it('rejects a change to a published definition (trigger) but allows status changes', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        client.query(`UPDATE skill_survey_versions SET definition = definition || '{"returningPenalty": 10}'::jsonb WHERE version = 1`),
      ).rejects.toThrow(/immutable once published/);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await client.query("UPDATE skill_survey_versions SET status = 'RETIRED' WHERE version = 1");
      await expect(
        client.query(`UPDATE skill_survey_versions SET definition = '{}'::jsonb WHERE version = 1`),
      ).rejects.toThrow(/immutable once published/);
      await client.query('ROLLBACK');
      await client.query('BEGIN');
      await expect(
        client.query("UPDATE skill_survey_versions SET status = 'DRAFT' WHERE version = 1"),
      ).rejects.toThrow(/cannot return to DRAFT/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('allows at most one ACTIVE version', async () => {
    await expect(
      pool.query(`INSERT INTO skill_survey_versions (version, status, definition) VALUES (2, 'ACTIVE', '{}'::jsonb)`),
    ).rejects.toThrow(/uq_skill_survey_versions_active/);
    await pool.query(`INSERT INTO skill_survey_versions (version, status, definition) VALUES (2, 'DRAFT', '{}'::jsonb)`);
    await pool.query(`UPDATE skill_survey_versions SET definition = '{"note": "draft edits allowed"}'::jsonb WHERE version = 2`);
    await pool.query('DELETE FROM skill_survey_versions WHERE version = 2');
  });

  it('adds player_profiles.is_skill_tentative (NOT NULL, default true)', async () => {
    const { rows } = await pool.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'player_profiles' AND column_name = 'is_skill_tentative'`,
    );
    expect(rows).toEqual([{ is_nullable: 'NO', column_default: 'true' }]);
  });

  it('enforces score and guardrail checks on player_skill_surveys', async () => {
    const { rows } = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'player_skill_surveys'::regclass AND contype = 'c' ORDER BY conname`,
    );
    expect(rows.map(r => r.conname)).toEqual([
      'chk_player_skill_surveys_components',
      'chk_player_skill_surveys_guardrails',
      'chk_player_skill_surveys_scores',
    ]);
  });

  it('does not touch PLAYER_SKILL_ADJUSTMENT_ENABLED', async () => {
    expect(MIGRATION_SQL).not.toMatch(/PLAYER_SKILL_ADJUSTMENT_ENABLED/);
    expect(MIGRATION_SQL).not.toMatch(/system_configs/);
  });
});
