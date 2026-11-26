import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, pool } from '../db';
import { playerProfiles, skillLevels, users } from '../db/schema/users';
import { playerSkillSurveys } from '../db/schema/skill-survey';
import { PRD_EXAMPLES } from '../services/auth/skill-survey/fixtures';
import { createTestUser, surveyBody, flushEmailOutbox, latestOtp } from './test-helpers';

/** AUTH-30 — registration API with the skill survey (Auth Tech Design "Registration skill survey"). */

let counter = 0;
function registerBody(answers: Record<string, unknown> = PRD_EXAMPLES[1].answers, extra: Record<string, unknown> = {}) {
  counter += 1;
  return {
    email: `survey_${counter}_${Date.now()}@example.com`,
    password: 'ValidPassword123!',
    fullName: 'Người chơi khảo sát',
    withdrawalPin: '284691',
    withdrawalPinConfirm: '284691',
    skillSurvey: { version: 1, answers },
    ...extra,
  };
}

async function registerAgent(agent: request.Agent, body: unknown) {
  const pending = await agent.post('/api/v1/auth/register').send(body as object);
  if (pending.status !== 202) return pending;
  await flushEmailOutbox();
  const otp = await latestOtp((body as { email: string }).email, 'REGISTER_OTP');
  return agent.post('/api/v1/auth/register/verify').send({
    challengeId: pending.body.data.challengeId,
    otp,
  });
}

const register = (body: unknown) => registerAgent(request.agent(app), body);

async function retireVersion1() {
  await pool.query("UPDATE skill_survey_versions SET status = 'RETIRED' WHERE version = 1");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/v1/auth/skill-survey', () => {
  it('returns version 1 questions without any scoring data, publicly and without cookies', async () => {
    const res = await request(app).get('/api/v1/auth/skill-survey');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    const survey = res.body.data;
    expect(survey.version).toBe(1);
    expect(survey.steps.map((s: { title: string }) => s.title)).toEqual([
      'Tiểu sử & thói quen', 'Kỹ thuật', 'Thực chiến & thể lực', 'Thành tích thi đấu',
    ]);
    expect(survey.questions).toHaveLength(16);
    expect(survey.skillScale.map((s: { value: number }) => s.value)).toEqual([0, 1, 2, 3]);

    const text = JSON.stringify(survey);
    for (const secret of ['score', 'bottleneckRef', 'experienceCap', 'weights', 'bands', 'returningPenalty', 'experienceMix', 'group']) {
      expect(text).not.toContain(`"${secret}"`);
    }

    const returning = survey.questions.find((q: { id: string }) => q.id === 'returningAfterBreak');
    expect(returning).toEqual({
      id: 'returningAfterBreak',
      type: 'BOOLEAN',
      text: expect.any(String),
      options: [{ code: false, label: 'Không' }, { code: true, label: 'Có' }],
      hiddenWhen: { questionId: 'yearsPlaying', optionCode: 'LESS_THAN_6M' },
    });
    const skill = survey.questions.find((q: { id: string }) => q.id === 'skill.service');
    expect(skill).toEqual({ id: 'skill.service', type: 'SKILL', text: 'Giao cầu', description: expect.any(String) });
    const years = survey.questions.find((q: { id: string }) => q.id === 'yearsPlaying');
    expect(years.options[0]).toEqual({ code: 'LESS_THAN_6M', label: 'Dưới 6 tháng' });
  });

  it('returns 503 AUTH_SKILL_SURVEY_UNAVAILABLE when no version is ACTIVE', async () => {
    await retireVersion1();
    const res = await request(app).get('/api/v1/auth/skill-survey');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_SKILL_SURVEY_UNAVAILABLE');
  });
});

describe('POST /api/v1/auth/register with skillSurvey', () => {
  it('PRD example #4: 201 with meta.skillSurveyResult GOOD 76.96, tentative profile and one survey row', async () => {
    const res = await register(registerBody(PRD_EXAMPLES[4].answers));
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.data).sort()).toEqual(['email', 'id', 'requiresPasswordChange', 'role']);
    const result = res.body.meta.skillSurveyResult;
    expect(result).toMatchObject({
      version: 1,
      nominalSkillLevel: { code: 'GOOD', name: 'Khá', rank: 6 },
      skillLevel: { code: 'GOOD', name: 'Khá', rank: 6 },
      isSkillTentative: true,
      finalScore: 76.96,
      components: { K: 88.89, R: 100, X: 76, P: 100, A: 0, T: 0 },
      appliedGuardrails: [],
      guardrails: [],
      strengths: [{ criterion: 'R', score: 100 }, { criterion: 'P', score: 100 }],
      areaToImprove: { criterion: 'K', score: 88.89 },
    });

    const userId = res.body.data.id;
    const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
    const [good] = await db.select().from(skillLevels).where(eq(skillLevels.code, 'GOOD'));
    expect(profile.skillLevelId).toBe(good.id);
    expect(profile.isSkillTentative).toBe(true);

    const rows = await db.select().from(playerSkillSurveys).where(eq(playerSkillSurveys.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      surveyVersion: 1,
      answers: PRD_EXAMPLES[4].answers,
      scoreK: '88.89', scoreR: '100.00', scoreX: '76.00', scoreP: '100.00', scoreA: '0.00', scoreT: '0.00',
      rawScore: '76.96', finalScore: '76.96',
      nominalSkillLevelId: good.id, resultingSkillLevelId: good.id,
      appliedGuardrails: [],
    });
  });

  it('PRD example #2: the own-result endpoint returns the registration result (G1 on R)', async () => {
    const agent = request.agent(app);
    const body = registerBody(PRD_EXAMPLES[2].answers);
    const res = await registerAgent(agent, body);
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await agent.get('/api/v1/players/me/skill-survey')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/login').send({ email: body.email, password: body.password })).status).toBe(200);
    const registered = res.body.meta.skillSurveyResult;
    expect(registered.skillLevel.code).toBe('AVERAGE_MINUS');
    expect(registered.guardrails).toEqual([
      { code: 'G1_BOTTLENECK', cap: { code: 'AVERAGE_MINUS', name: 'Trung bình yếu', rank: 3 }, criterion: 'R' },
    ]);
    expect(registered.areaToImprove.criterion).toBe('R');

    const again = await agent.get('/api/v1/players/me/skill-survey');
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual(registered);

    const [row] = await db.select().from(playerSkillSurveys).where(eq(playerSkillSurveys.userId, res.body.data.id));
    expect(row.rawScore).toBe('55.80');
    expect(row.appliedGuardrails).toEqual(['G1_BOTTLENECK']);
  });

  it('PRD example #3: stores G2 and keeps item 4 absent while it is hidden', async () => {
    const res = await register(registerBody(PRD_EXAMPLES[3].answers));
    expect(res.status).toBe(201);
    expect(res.body.meta.skillSurveyResult.appliedGuardrails).toEqual(['G2_EXPERIENCE_CAP']);
    const [row] = await db.select().from(playerSkillSurveys).where(eq(playerSkillSurveys.userId, res.body.data.id));
    expect(row.answers).not.toHaveProperty('returningAfterBreak');
  });

  it('accepts item 4 = false while hidden', async () => {
    const res = await register(registerBody({ ...PRD_EXAMPLES[3].answers, returningAfterBreak: false }));
    expect(res.status).toBe(201);
  });

  it('exposes isSkillTentative on the profile read model', async () => {
    const agent = request.agent(app);
    const body = registerBody();
    await registerAgent(agent, body);
    await agent.post('/api/v1/auth/login').send({ email: body.email, password: body.password });
    const res = await agent.get('/api/v1/players/me');
    expect(res.status).toBe(200);
    expect(res.body.data.isSkillTentative).toBe(true);
    expect(res.body.data.skillLevel.code).toBe('AVERAGE');
  });

  describe('answer validation → 400 VALIDATION_FAILED with the question id as field', () => {
    const base = PRD_EXAMPLES[1].answers;
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['missing answer', (({ stamina, ...rest }) => rest)(base as Record<string, unknown>), 'stamina'],
      ['unknown option code', { ...base, rallyConsistency: '100_PLUS' }, 'rallyConsistency'],
      ['skill outside 0–3', { ...base, 'skill.smash': 4 }, 'skill.smash'],
      ['non-integer skill', { ...base, 'skill.smash': 1.5 }, 'skill.smash'],
      ['skill sent as a string', { ...base, 'skill.smash': '2' }, 'skill.smash'],
      ['choice sent as a number', { ...base, coaching: 1 }, 'coaching'],
      ['item 4 missing while visible', (({ returningAfterBreak, ...rest }) => rest)(base as Record<string, unknown>), 'returningAfterBreak'],
      ['item 4 not boolean', { ...base, returningAfterBreak: 'true' }, 'returningAfterBreak'],
      ['item 4 true with less than 6 months', { ...PRD_EXAMPLES[3].answers, returningAfterBreak: true }, 'returningAfterBreak'],
      ['unknown answer key', { ...base, 'skill.trickShot': 2 }, 'skill.trickShot'],
    ];
    for (const [name, answers, field] of cases) {
      it(name, async () => {
        const res = await register(registerBody(answers));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(res.body.error.details).toEqual([{ field, code: 'VALIDATION_FAILED' }]);
      });
    }

    it('rejects a __proto__ answer key as unknown (raw body, not the parsed record)', async () => {
      const raw = JSON.stringify(registerBody()).replace('"answers":{', '"answers":{"__proto__":"x",');
      const res = await request(app).post('/api/v1/auth/register').set('Content-Type', 'application/json').send(raw);
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: '__proto__', code: 'VALIDATION_FAILED' }]);
    });

    it('still lists missing questions when another answer has an invalid type', async () => {
      const { stamina: _drop, ...rest } = base as Record<string, unknown>;
      const res = await register(registerBody({ ...rest, coaching: null }));
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual(expect.arrayContaining([
        { field: 'coaching', code: 'VALIDATION_FAILED' },
        { field: 'stamina', code: 'VALIDATION_FAILED' },
      ]));
    });

    it('caps unknown-key errors', async () => {
      const junk = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`junk${i}`, 1]));
      const res = await register(registerBody({ ...base, ...junk }));
      expect(res.status).toBe(400);
      expect(res.body.error.details).toHaveLength(5);
    });

    it('reports survey and account field errors together', async () => {
      const res = await register({ ...registerBody({ ...base, stamina: 'NOPE' }), email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { field: 'email', code: 'VALIDATION_FAILED' },
        { field: 'stamina', code: 'VALIDATION_FAILED' },
      ]);
    });

    it('rejects a missing or malformed skillSurvey', async () => {
      const { skillSurvey: _drop, ...noSurvey } = registerBody();
      const missing = await register(noSurvey);
      expect(missing.status).toBe(400);
      expect(missing.body.error.details).toEqual([{ field: 'skillSurvey', code: 'VALIDATION_FAILED' }]);
      const badVersion = await register({ ...registerBody(), skillSurvey: { version: '1', answers: base } });
      expect(badVersion.status).toBe(400);
      expect(badVersion.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('survey error codes and check order', () => {
    it('wrong version → 400 AUTH_SKILL_SURVEY_OUTDATED', async () => {
      const res = await register({ ...registerBody(), skillSurvey: surveyBody(PRD_EXAMPLES[1].answers, 2) });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AUTH_SKILL_SURVEY_OUTDATED');
    });

    it('old form with skillLevelCode → 400 AUTH_REGISTRATION_FORM_OUTDATED', async () => {
      const { skillSurvey: _drop, ...rest } = registerBody();
      const res = await register({ ...rest, skillLevelCode: 'AVERAGE' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('AUTH_REGISTRATION_FORM_OUTDATED');
    });

    it('no ACTIVE version → 503 AUTH_SKILL_SURVEY_UNAVAILABLE', async () => {
      await retireVersion1();
      const res = await register(registerBody());
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('AUTH_SKILL_SURVEY_UNAVAILABLE');
    });

    it('old form wins over a missing ACTIVE version; unavailable wins over a wrong version; outdated wins over bad answers', async () => {
      const outdatedAndBad = await register({ ...registerBody({ stamina: 'NOPE' }), skillSurvey: { version: 2, answers: { stamina: 'NOPE' } } });
      expect(outdatedAndBad.body.error.code).toBe('AUTH_SKILL_SURVEY_OUTDATED');

      await retireVersion1();
      const oldForm = await register({ ...registerBody(), skillLevelCode: 'AVERAGE' });
      expect(oldForm.body.error.code).toBe('AUTH_REGISTRATION_FORM_OUTDATED');
      const wrongVersion = await register({ ...registerBody(), skillSurvey: surveyBody(PRD_EXAMPLES[1].answers, 2) });
      expect(wrongVersion.body.error.code).toBe('AUTH_SKILL_SURVEY_UNAVAILABLE');
    });

    it('survey validation runs before the email check', async () => {
      await createTestUser({ email: 'taken_survey@example.com' });
      const res = await register({ ...registerBody({ stamina: 'NOPE' }), email: 'taken_survey@example.com' });
      expect(res.status).toBe(400);
      const valid = await register({ ...registerBody(), email: 'taken_survey@example.com' });
      expect(valid.status).toBe(409);
      expect(valid.body.error.code).toBe('AUTH_EMAIL_ALREADY_REGISTERED');
    });
  });

  it('rolls back user and profile when the last step (survey row insert) fails', async () => {
    // Registration creates no session, so the survey row is the last write in the transaction.
    await pool.query(`CREATE OR REPLACE FUNCTION test_fail_survey_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'survey insert failed'; END $$`);
    await pool.query('CREATE TRIGGER test_fail_survey_insert BEFORE INSERT ON player_skill_surveys FOR EACH ROW EXECUTE FUNCTION test_fail_survey_insert()');
    const body = registerBody();
    let res;
    try {
      res = await register(body);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS test_fail_survey_insert ON player_skill_surveys');
      await pool.query('DROP FUNCTION IF EXISTS test_fail_survey_insert()');
    }
    expect(res.status).toBe(500);
    expect(await db.select().from(users).where(eq(users.email, body.email))).toHaveLength(0);
    expect(await db.select().from(playerProfiles)).toHaveLength(0);
    expect(await db.select().from(playerSkillSurveys)).toHaveLength(0);
  });
});

describe('GET /api/v1/players/me/skill-survey', () => {
  it('404 PLAYER_SKILL_SURVEY_NOT_FOUND for a Player without a survey row', async () => {
    const user = await createTestUser({ email: 'no_survey@example.com' });
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send({ email: user.email, password: 'ValidPassword123!' });
    expect(login.status).toBe(200);
    const res = await agent.get('/api/v1/players/me/skill-survey');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PLAYER_SKILL_SURVEY_NOT_FOUND');
  });

  it('requires a signed-in Player', async () => {
    const res = await request(app).get('/api/v1/players/me/skill-survey');
    expect(res.status).toBe(401);
  });

  it('is forbidden for non-Player roles', async () => {
    const owner = await createTestUser({ email: 'owner_survey@example.com', role: 'COURT_OWNER' });
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email: owner.email, password: 'ValidPassword123!' });
    const res = await agent.get('/api/v1/players/me/skill-survey');
    expect(res.status).toBe(403);
  });
});
