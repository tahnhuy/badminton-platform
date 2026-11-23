import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('Skill Levels API (AUTH-24)', () => {
  it('GET /api/v1/skill-levels returns 200 with 7 items ordered by rank 1-7 without cookies (seven levels since AUTH-29)', async () => {
    const res = await request(app).get('/api/v1/skill-levels');

    expect(res.status).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(7);

    const ranks = res.body.data.map((item: any) => item.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const codes = res.body.data.map((item: any) => item.code);
    expect(codes).toEqual([
      'BEGINNER',
      'WEAK',
      'AVERAGE_MINUS',
      'AVERAGE',
      'AVERAGE_PLUS',
      'GOOD',
      'EXCELLENT',
    ]);
  });
});
