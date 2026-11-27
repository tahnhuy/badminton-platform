import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../app';
import { env } from '../shared/config/env';
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, systemConfigs, walletTopUps, walletPayoutRequests } from '../db';
import { clearConfigCache } from '../shared/config/config-registry';
import { createTestUser, ensureWithdrawalPin, TEST_WITHDRAWAL_PIN } from './test-helpers';
import { walletService } from '../services/payments/WalletService';
import { walletPayoutService } from '../services/payments/WalletPayoutService';
import { walletTopUpService } from '../services/payments/WalletTopUpService';
import { walletRequestExpiryService } from '../services/payments/WalletRequestExpiryService';

async function configure(key: string, value: string) {
  await db.insert(systemConfigs).values({ configKey: key, configValue: value }).onConflictDoUpdate({
    target: systemConfigs.configKey, set: { configValue: value },
  });
  clearConfigCache();
}
afterEach(async () => {
  await configure('WALLET_REQUEST_TIMEOUT_MINUTES', '15');
  await configure('WALLET_AUTO_APPROVE_PAYOUTS', 'false');
});

describe('wallet request deadlines', () => {
  it('lets Admin set the timeout and rejects values outside the minute range', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const endpoint = '/api/v1/admin/configs/WALLET_REQUEST_TIMEOUT_MINUTES';
    const response = await request(app).patch(endpoint).set('x-user-id', String(admin.id)).send({ value: 30 });
    expect(response.status).toBe(200);
    expect(response.body.data.configValue).toBe('30');
    for (const value of [0, 10081, 1.5]) {
      expect((await request(app).patch(endpoint).set('x-user-id', String(admin.id)).send({ value })).status).toBe(400);
    }
  });

  it('rejects late SePay transfers without crediting the wallet', async () => {
    const original = { secret: env.SEPAY_WEBHOOK_SECRET, bank: env.SEPAY_BANK_ACCOUNT, bankCode: env.SEPAY_BANK_CODE };
    env.SEPAY_WEBHOOK_SECRET = 'expiry-test-secret';
    env.SEPAY_BANK_ACCOUNT = '123456789';
    env.SEPAY_BANK_CODE = 'MBBank';
    try {
      const user = await createTestUser();
      const intent = await walletTopUpService.createTopUp({ userId: user.id, amount: '50000', provider: 'SEPAY' });
      await db.update(walletTopUps).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(walletTopUps.id, intent.topUpId));
      const rawBody = JSON.stringify({ id: 123456, transferType: 'in', transferAmount: 50000, content: intent.txnRef });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `sha256=${createHmac('sha256', 'expiry-test-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;
      await expect(walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp)).rejects.toMatchObject({ code: 'WALLET_TOP_UP_EXPIRED' });
      expect((await walletService.getWallet(user.id)).balance).toBe('0.00');
    } finally {
      env.SEPAY_WEBHOOK_SECRET = original.secret;
      env.SEPAY_BANK_ACCOUNT = original.bank;
      env.SEPAY_BANK_CODE = original.bankCode;
    }
  });
  it('snapshots the configured deadline and blocks expired top-ups before the sweep', async () => {
    await configure('WALLET_REQUEST_TIMEOUT_MINUTES', '2');
    const user = await createTestUser();
    const start = Date.now();
    const intent = await walletTopUpService.createTopUp({ userId: user.id, amount: '50000', provider: 'MOCK' });
    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, intent.topUpId));
    expect(row!.expiresAt!.getTime()).toBeGreaterThanOrEqual(start + 120_000);
    expect(row!.expiresAt!.getTime()).toBeLessThan(Date.now() + 121_000);
    await configure('WALLET_REQUEST_TIMEOUT_MINUTES', '10');
    const [unchanged] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, intent.topUpId));
    expect(unchanged!.expiresAt).toEqual(row!.expiresAt);
    await db.update(walletTopUps).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(walletTopUps.id, intent.topUpId));
    await expect(walletTopUpService.mockConfirm(intent.topUpId, user.id)).rejects.toMatchObject({ code: 'WALLET_TOP_UP_EXPIRED' });
    await walletRequestExpiryService.runOnce();
    const [expired] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, intent.topUpId));
    expect(expired!.status).toBe('EXPIRED');
    expect((await walletService.getWallet(user.id)).balance).toBe('0.00');
  });

  for (const autoApprove of [false, true]) {
    it(`expires ${autoApprove ? 'approved' : 'pending'} payouts and releases the hold exactly once`, async () => {
      await configure('WALLET_REQUEST_TIMEOUT_MINUTES', '2');
      await configure('WALLET_AUTO_APPROVE_PAYOUTS', String(autoApprove));
      const user = await createTestUser();
      const admin = await createTestUser({ role: 'ADMIN' });
      await ensureWithdrawalPin(user.id);
      await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
      const bank = await walletPayoutService.createBankAccount(user.id, { bankCode: 'MB', accountNumber: '123456789', accountName: 'TEST' });
      const payout = await walletPayoutService.createRequest(user.id, {
        requestType: 'WITHDRAWAL', amount: '40000', bankAccountId: bank.id,
        withdrawalPin: TEST_WITHDRAWAL_PIN, clientRequestId: randomUUID(),
      });
      expect(payout.expiresAt.getTime() - payout.createdAt.getTime()).toBeGreaterThan(119_000);
      expect((await walletService.getWallet(user.id)).available).toBe('60000.00');
      await db.update(walletPayoutRequests).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(walletPayoutRequests.id, payout.id));
      await expect(walletPayoutService.approve(payout.id, admin.id)).rejects.toMatchObject({ code: 'WALLET_PAYOUT_EXPIRED' });
      await expect(walletPayoutService.markPaid(payout.id, admin.id, 'BANK')).rejects.toMatchObject({ code: 'WALLET_PAYOUT_EXPIRED' });
      await walletRequestExpiryService.runOnce();
      await walletRequestExpiryService.runOnce();
      expect((await walletService.getWallet(user.id)).available).toBe('100000.00');
      expect((await walletService.getWallet(user.id)).balance).toBe('100000.00');
      const [expired] = await db.select().from(walletPayoutRequests).where(eq(walletPayoutRequests.id, payout.id));
      expect(expired!.status).toBe('FAILED');
      expect(expired!.adminNote).toContain('hết hạn');
    });
  }
});
