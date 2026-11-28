import express, { type ErrorRequestHandler } from 'express';
import { createServer, request as httpRequest } from 'node:http';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Exercise the transitive dependency actually used by Express, without adding a
// direct dependency or changing the application's numeric trust-proxy policy.
const proxyAddress = require('proxy-addr') as {
  compile(subnet: string): (address: string) => boolean;
};

describe('security dependency regressions (SEC-01)', () => {
  it('does not trust arbitrary IPv4 clients through broad IPv6 subnet prefixes', () => {
    for (const subnet of ['::/1', '::ffff:10.0.0.0/8']) {
      const trust = proxyAddress.compile(subnet);
      expect(trust('203.0.113.1')).toBe(false);
      expect(trust('10.1.2.3')).toBe(false);
    }
  });

  it('preserves correctly mapped IPv4 subnet boundaries', () => {
    const trust = proxyAddress.compile('::ffff:10.0.0.0/104');
    expect(trust('10.1.2.3')).toBe(true);
    expect(trust('203.0.113.1')).toBe(false);
    expect(trust('::ffff:10.1.2.3')).toBe(true);
  });

  it('rejects oversized constrained arrays before accumulating per-element issues', () => {
    // A bounded 2,000-element fixture, not an unbounded memory/load attack.
    const schema = z.array(z.string()).max(2);
    const result = schema.safeParse(Array(2000).fill(123));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]).toMatchObject({ code: 'too_big', maximum: 2, path: [] });
    }
    expect(schema.safeParse(['valid']).success).toBe(true);
  });

  it('handles trailing bytes after a compressed JSON frame and keeps serving valid requests', async () => {
    const server = express();
    server.use(express.json());
    server.post('/echo', (req, res) => { res.json(req.body); });
    const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
      res.status(error.status ?? 500).json({ error: 'parse' });
    };
    server.use(handleError);
    const compressed = gzipSync(Buffer.from('{"ok":true}'));
    // Send the exact bytes over HTTP; JSON serializers must not rewrite Buffer.
    const listener = createServer(server);
    await new Promise<void>(resolve => { listener.listen(0, '127.0.0.1', resolve); });
    try {
      const address = listener.address();
      if (!address || typeof address === 'string') throw new Error('Missing test server address');
      const send = (body: Buffer) => new Promise<{ status: number; body: unknown }>((resolve, reject) => {
        const req = httpRequest({ hostname: '127.0.0.1', port: address.port, path: '/echo', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', 'Content-Length': body.length },
        }, response => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => { chunks.push(chunk); });
          response.on('error', reject);
          response.on('end', () => {
            try { resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
            catch (error) { reject(error); }
          });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(new Error('HTTP regression timed out')); });
        req.end(body);
      });
      expect((await send(compressed)).body).toEqual({ ok: true });
      expect((await send(Buffer.concat([compressed, Buffer.from('trailing')]))).status).toBe(400);
      const next = await send(compressed);
      expect(next.status).toBe(200);
      expect(next.body).toEqual({ ok: true });
    } finally {
      await new Promise<void>((resolve, reject) => { listener.close(error => error ? reject(error) : resolve()); });
    }
  });
});
