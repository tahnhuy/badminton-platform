import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { reconciliationService } from '../services/finance/ReconciliationService';
import { createTestUser } from './test-helpers';
import { api, complete, drawSingles, makePlayer, openTournament, playAll } from './tournament-test-kit';

// TRN-17 — tournament fees in Admin Finance, reconciliation and the Dashboard.

describe('Tournament fees in Finance', () => {
  it('reports gross/net fees, Organizer payouts and held fees, and reconciles without discrepancies', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const asAdmin = (url: string) => request(app).get(url).set('x-user-id', String(admin.id));
    const organizer = await makePlayer();

    // Completed tournament: 3 paid, one withdrawn (refunded) → Organizer earns 2 × 50 000.
    const done = await openTournament(organizer, { entryFee: 50000 });
    const [a, b, c] = [await makePlayer({ topUp: 50000 }), await makePlayer({ topUp: 50000 }), await makePlayer({ topUp: 50000 })];
    const regC = await api(c).post(`/api/v1/tournaments/${done}/registrations`);
    await api(c).delete(`/api/v1/tournaments/${done}/registrations/${regC.body.data.id}`);
    await drawSingles(organizer, done, [a, b]);
    await playAll(organizer, done);
    await complete(organizer, done);

    // Open tournament holding one fee.
    const open = await openTournament(organizer, { entryFee: 30000 });
    await api(await makePlayer({ topUp: 30000 })).post(`/api/v1/tournaments/${open}/registrations`);

    const overview = await asAdmin('/api/v1/admin/finance/overview?range=30d');
    expect(overview.status, JSON.stringify(overview.body)).toBe(200);
    const t = overview.body.data.tournament;
    expect(Number(t.grossFees)).toBeGreaterThanOrEqual(180000);
    expect(Number(t.refunds)).toBeGreaterThanOrEqual(50000);
    expect(Number(t.netFees)).toBeCloseTo(Number(t.grossFees) - Number(t.refunds), 2);
    expect(Number(t.organizerEarnings)).toBeGreaterThanOrEqual(100000);
    expect(Number(t.feesHeld)).toBeGreaterThanOrEqual(30000);

    const bySource = await asAdmin('/api/v1/admin/finance/reports/revenue?range=30d&groupBy=source');
    const fees = (bySource.body.data.rows as Array<{ key: string; gross: string; refunds: string; ownerEarnings: string }>).find(r => r.key === 'registration')!;
    expect(Number(fees.gross)).toBeGreaterThanOrEqual(180000);
    expect(Number(fees.refunds)).toBeGreaterThanOrEqual(50000);
    expect(Number(fees.ownerEarnings)).toBeGreaterThanOrEqual(100000);

    const result = await reconciliationService.run({ range: '30d' });
    const relevant = result.discrepancies.filter(row => ['PAYMENT_TOTAL', 'REFUND_TOTAL', 'PAYMENT_MISSING_LEDGER', 'REFUND_MISSING_LEDGER', 'TOURNAMENT_EARNING_TOTAL'].includes(row.type));
    expect(relevant).toEqual([]);

    // Same net definition on the Dashboard and in Finance (same custom day range, Vietnam time).
    // All money moved today; a yesterday→tomorrow window covers it under either end-date convention.
    const vnDate = (offsetDays: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + offsetDays * 86_400_000));
    const range = `range=custom&startDate=${vnDate(-1)}&endDate=${vnDate(1)}`;
    const kpis = await asAdmin(`/api/v1/admin/dashboard/kpis?${range}`);
    expect(kpis.status, JSON.stringify(kpis.body)).toBe(200);
    const sameDay = await asAdmin(`/api/v1/admin/finance/overview?${range}`);
    expect(Number(kpis.body.data.revenue.estimatedValue)).toBeCloseTo(Number(sameDay.body.data.netEstimated), 2);
  });
});
