import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, paymentRefunds, payments, walletLedgerEntries } from '../db';
import { eq } from 'drizzle-orm';
import { createTestUser } from './test-helpers';
import { walletService } from '../services/payments/WalletService';
import { walletPayoutService } from '../services/payments/WalletPayoutService';
import { walletTopUpService } from '../services/payments/WalletTopUpService';
import { env } from '../shared/config/env';
import crypto from 'node:crypto';

let user: Awaited<ReturnType<typeof createTestUser>>;
let admin: Awaited<ReturnType<typeof createTestUser>>;
let owner: Awaited<ReturnType<typeof createTestUser>>;

beforeEach(async () => {
  await db.delete(paymentRefunds);
  await db.delete(payments);
  user = await createTestUser({ role: 'PLAYER' });
  admin = await createTestUser({ role: 'ADMIN' });
  owner = await createTestUser({ role: 'COURT_OWNER' });
});

describe('Wallet payouts (WAL-05/06/07)', () => {
  it('reserves a withdrawal, then pays on approval and debits the wallet once', async () => {
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(user.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    const request = await walletPayoutService.createRequest(user.id, {
      requestType: 'WITHDRAWAL', amount: '60000', bankAccountId: bank.id,
    });
    expect(request.status).toBe('PENDING');
    expect((await walletService.getWallet(user.id)).available).toBe('40000.00');

    const approved = await walletPayoutService.approve(request.id, admin.id, 'OK');
    expect(approved.status).toBe('APPROVED');
    const paid = await walletPayoutService.markPaid(request.id, admin.id, 'BANK-TX-1');
    expect(paid.status).toBe('PAID');
    expect((await walletService.getWallet(user.id)).balance).toBe('40000.00');

    const entries = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.userId, user.id));
    expect(entries.some(entry => entry.entryType === 'WITHDRAWAL' && entry.amount === '-60000.00')).toBe(true);

    const replay = await walletPayoutService.markPaid(request.id, admin.id, 'BANK-TX-1');
    expect(replay.status).toBe('PAID');
    expect((await walletService.getWallet(user.id)).balance).toBe('40000.00');
  });

  it('releases the hold when a request is rejected', async () => {
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(user.id, {
      bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
    });
    const request = await walletPayoutService.createRequest(user.id, {
      requestType: 'WITHDRAWAL', amount: '30000', bankAccountId: bank.id,
    });
    await walletPayoutService.reject(request.id, admin.id, 'Invalid bank');
    expect((await walletService.getWallet(user.id)).available).toBe('100000.00');
    await expect(walletPayoutService.markPaid(request.id, admin.id, 'X'))
      .rejects.toMatchObject({ code: 'WALLET_PAYOUT_NOT_APPROVED' });
  });

  it('exposes withdrawal and Admin payout routes', async () => {
    await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });

    const bank = await request(app)
      .post('/api/v1/wallet/bank-accounts')
      .set('x-user-id', String(user.id))
      .send({ bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A' });
    expect(bank.status).toBe(201);

    const created = await request(app)
      .post('/api/v1/wallet/withdrawals')
      .set('x-user-id', String(user.id))
      .send({ amount: '40000', bankAccountId: bank.body.data.id });
    expect(created.status).toBe(201);

    const approved = await request(app)
      .post(`/api/v1/admin/wallet/payouts/${created.body.data.id}/approve`)
      .set('x-user-id', String(admin.id))
      .send({ note: 'OK' });
    expect(approved.status).toBe(200);

    const paid = await request(app)
      .post(`/api/v1/admin/wallet/payouts/${created.body.data.id}/paid`)
      .set('x-user-id', String(admin.id))
      .send({ transferReference: 'BANK-ROUTE-1' });
    expect(paid.status).toBe(200);
    expect((await walletService.getWallet(user.id)).balance).toBe('60000.00');
  });

  it('marks an approved payout paid from a SePay outgoing webhook', async () => {
    const previousSecret = env.SEPAY_WEBHOOK_SECRET;
    env.SEPAY_WEBHOOK_SECRET = 'payout-out-secret';
    try {
      await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
      const bank = await walletPayoutService.createBankAccount(user.id, {
        bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
      });
      const request = await walletPayoutService.createRequest(user.id, {
        requestType: 'WITHDRAWAL', amount: '60000', bankAccountId: bank.id,
      });
      await walletPayoutService.approve(request.id, admin.id);

      const rawBody = JSON.stringify({
        id: 555,
        content: `PAYOUT-${request.id} chuyen tien`,
        transferType: 'out',
        transferAmount: 60000,
        referenceCode: 'SB-OUT-1',
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `sha256=${crypto.createHmac('sha256', 'payout-out-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;
      await walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp);

      expect((await walletService.getWallet(user.id)).balance).toBe('40000.00');
      expect((await walletPayoutService.listMine(user.id))[0].status).toBe('PAID');
    } finally {
      env.SEPAY_WEBHOOK_SECRET = previousSecret;
    }
  });

  it('auto-approves a payout when sandbox auto-approval is enabled', async () => {
    const previous = env.WALLET_AUTO_APPROVE_PAYOUTS;
    env.WALLET_AUTO_APPROVE_PAYOUTS = true;
    try {
      await walletService.credit({ userId: user.id, amount: '100000', entryType: 'TOP_UP' });
      const bank = await walletPayoutService.createBankAccount(user.id, {
        bankCode: 'TPBank', accountNumber: '0123456789', accountName: 'NGUYEN VAN A',
      });
      const request = await walletPayoutService.createRequest(user.id, {
        requestType: 'WITHDRAWAL', amount: '60000', bankAccountId: bank.id,
      });
      expect(request.status).toBe('APPROVED');
      expect((await walletService.getWallet(user.id)).available).toBe('40000.00');
    } finally {
      env.WALLET_AUTO_APPROVE_PAYOUTS = previous;
    }
  });

  it('supports owner payout requests and Admin wallet adjustments', async () => {
    await walletService.credit({ userId: owner.id, amount: '100000', entryType: 'TOP_UP' });
    const bank = await walletPayoutService.createBankAccount(owner.id, {
      bankCode: 'ACB', accountNumber: '99999999', accountName: 'OWNER',
    });
    const request = await walletPayoutService.createRequest(owner.id, {
      requestType: 'OWNER_PAYOUT', amount: '50000', bankAccountId: bank.id,
    });
    await walletPayoutService.approve(request.id, admin.id);
    await walletPayoutService.markPaid(request.id, admin.id, 'OWNER-TX-1');
    expect((await walletService.getWallet(owner.id)).balance).toBe('50000.00');

    const adjusted = await walletPayoutService.adminCredit(owner.id, admin.id, '10000', 'Goodwill');
    expect(adjusted.wallet.balance).toBe('60000.00');
    const entry = adjusted.entry;
    expect(entry.entryType).toBe('ADMIN_ADJUSTMENT');
    expect(entry.createdBy).toBe(admin.id);
    expect(entry.description).toBe('Goodwill');
  });
});
