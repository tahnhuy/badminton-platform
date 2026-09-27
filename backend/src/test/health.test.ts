import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('Health Check API', () => {
  it('GET /health returns 200 and success status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'ok',
      message: 'Badminton Platform API is running',
    });
  });

  it('Request with foreign Origin receives no Access-Control-Allow-Origin header (no open cors)', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://malicious-external-site.com');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
