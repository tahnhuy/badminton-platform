import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import authRouter from '../modules/auth/auth.routes';

describe('CSRF & JSON Guard (AUTH-08)', () => {
  beforeAll(() => {
    // Add a test endpoint under authRouter for JSON-only testing
    authRouter.post('/json-test', (req, res) => {
      res.status(200).json({ ok: true, body: req.body });
    });

    // Add a generic POST endpoint under /api/v1 for CSRF testing
    app.post('/api/v1/csrf-test', (req, res) => {
      res.status(200).json({ ok: true });
    });
  });

  describe('JSON-only guard on /api/v1/auth', () => {
    it('rejects POST with text/plain with 400 VALIDATION_FAILED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/json-test')
        .set('Content-Type', 'text/plain')
        .send('some plain text');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects POST with application/x-www-form-urlencoded with 400 VALIDATION_FAILED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/json-test')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('foo=bar');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('accepts POST with application/json', async () => {
      const res = await request(app)
        .post('/api/v1/auth/json-test')
        .set('Content-Type', 'application/json')
        .send({ foo: 'bar' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('CSRF Middleware on /api/v1', () => {
    it('allows POST when sid is not present (unauthenticated requests)', async () => {
      const res = await request(app).post('/api/v1/csrf-test');

      expect(res.status).toBe(200);
    });

    it('blocks POST with 403 AUTH_CSRF_TOKEN_INVALID when sid is present but X-CSRF-Token is missing', async () => {
      const res = await request(app)
        .post('/api/v1/csrf-test')
        .set('Cookie', 'sid=active_session_token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    });

    it('blocks POST with 403 AUTH_CSRF_TOKEN_INVALID when X-CSRF-Token does not match csrf_token cookie', async () => {
      const res = await request(app)
        .post('/api/v1/csrf-test')
        .set('Cookie', 'sid=active_session; csrf_token=expected_csrf_token_value')
        .set('X-CSRF-Token', 'different_csrf_token_value');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
    });

    it('allows POST when X-CSRF-Token matches csrf_token cookie exactly', async () => {
      const token = 'matching_csrf_token_1234567890';
      const res = await request(app)
        .post('/api/v1/csrf-test')
        .set('Cookie', `sid=active_session; csrf_token=${token}`)
        .set('X-CSRF-Token', token);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
