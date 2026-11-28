import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { expect, it } from 'vitest';
import { app } from '../app';
import { db, facilities, courts, courtPricings } from '../db';
import { createTestUser } from './test-helpers';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

// Measurement only: no invented latency SLA. Functional assertions still fail on
// incorrect status/data. This is in-process HTTP + real test PostgreSQL, not a
// production capacity test or a substitute for a populated staging load test.
it('measures search and availability latency under bounded concurrent reads', async () => {
  const owner = await createTestUser({ role: 'COURT_OWNER' });
  const [facility] = await db.insert(facilities).values({
    ownerId: owner.id, name: 'Performance fixture', phone: '0900000000', status: 'ACTIVE',
    address: '1 Test', district: 'Quận 1', city: 'TP. Hồ Chí Minh', openingTime: '06:00:00', closingTime: '22:00:00',
  }).returning();
  const [court] = await db.insert(courts).values({facilityId: facility.id, name: 'Performance court', status: 'ACTIVE'}).returning();
  await db.insert(courtPricings).values({courtId: court.id, startTime: '06:00:00', endTime: '22:00:00', price: '100000', validFrom: '2020-01-01'});
  const date = addDaysToDateString(todayInAppTimezone(), 2);
  const endpoints = [
    {name: 'search', path: '/api/v1/courts', query: {date}},
    {name: 'availability', path: `/api/v1/courts/${court.id}/availability`, query: {date}},
  ];
  const measurements = [];
  for (const endpoint of endpoints) {
    for (let i = 0; i < 5; i++) expect((await request(app).get(endpoint.path).query(endpoint.query)).status).toBe(200);
    const latencies: number[] = [];
    let errors = 0;
    const started = performance.now();
    for (let batch = 0; batch < 10; batch++) {
      await Promise.all(Array.from({length: 5}, async () => {
        const start = performance.now();
        const response = await request(app).get(endpoint.path).query(endpoint.query);
        latencies.push(performance.now() - start);
        if (response.status !== 200) errors++;
        expect(response.status).toBe(200);
        if (endpoint.name === 'search') {
          expect(response.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: court.id })]));
        } else {
          expect(response.body.data.intervals).toEqual(expect.arrayContaining([
            expect.objectContaining({ startTime: '06:00', endTime: '22:00' }),
          ]));
        }
      }));
    }
    const elapsedMs = performance.now() - started;
    latencies.sort((a,b) => a-b);
    measurements.push({endpoint: endpoint.name, samples: latencies.length, concurrency: 5, warmup: 5, errors,
      p50Ms: latencies[Math.ceil(latencies.length * .5)-1], p95Ms: latencies[Math.ceil(latencies.length * .95)-1],
      maxMs: latencies.at(-1), requestsPerSecond: latencies.length / (elapsedMs/1000)});
  }
  const out = resolve(__dirname, '../../../docs/reports/testing/artifacts');
  mkdirSync(out, {recursive: true});
  writeFileSync(resolve(out, 'performance.json'), JSON.stringify({date: new Date().toISOString(), node: process.version,
    dataset: '1 facility, 1 court, 1 pricing, no bookings', environment: 'Supertest + PostgreSQL test; MOCK payment; test auth',
    latencySla: null, measurements}, null, 2));
});
