import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { db, walletAccounts, walletLedgerEntries, walletTopUps } from '../db';
import { eq } from 'drizzle-orm';
import { createTestUser } from './test-helpers';
import { env } from '../shared/config/env';
import { signVnpayParams } from '../services/payments/vnpay-signature';
import { walletTopUpService } from '../services/payments/WalletTopUpService';
import { financeTopUpService } from '../services/finance/FinanceTopUpService';
import { walletService } from '../services/payments/WalletService';
import crypto from 'node:crypto';

const originalTmn = env.VNPAY_TMN_CODE;
const originalSecret = env.VNPAY_HASH_SECRET;
const originalSepayMerchant = env.SEPAY_MERCHANT_ID;
const originalSepaySecret = env.SEPAY_SECRET_KEY;
const originalSepayIpn = env.SEPAY_IPN_SECRET;
const originalSepayWebhook = env.SEPAY_WEBHOOK_SECRET;
const originalSepayBankCode = env.SEPAY_BANK_CODE;
const originalSepayBankAccount = env.SEPAY_BANK_ACCOUNT;
const originalSepayAccountName = env.SEPAY_ACCOUNT_NAME;

afterEach(() => {
  env.VNPAY_TMN_CODE = originalTmn;
  env.VNPAY_HASH_SECRET = originalSecret;
  env.SEPAY_MERCHANT_ID = originalSepayMerchant;
  env.SEPAY_SECRET_KEY = originalSepaySecret;
  env.SEPAY_IPN_SECRET = originalSepayIpn;
  env.SEPAY_WEBHOOK_SECRET = originalSepayWebhook;
  env.SEPAY_BANK_CODE = originalSepayBankCode;
  env.SEPAY_BANK_ACCOUNT = originalSepayBankAccount;
  env.SEPAY_ACCOUNT_NAME = originalSepayAccountName;
});

function signedPayload(secret: string, topUpId: number, amount: string) {
  const payload: Record<string, string | number> = {
    vnp_TxnRef: `TOPUP-${topUpId}`,
    vnp_Amount: Math.round(Number(amount) * 100),
    vnp_ResponseCode: '00',
    vnp_TransactionStatus: '00',
    vnp_TransactionNo: `TX-${topUpId}`,
  };
  payload.vnp_SecureHash = signVnpayParams(payload, secret);
  return payload;
}

describe('VNPAY top-up (WAL-02, A4)', () => {
  it('creates a top-up and credits the wallet once via a signed IPN', async () => {
    env.VNPAY_TMN_CODE = 'TEST_TMN';
    env.VNPAY_HASH_SECRET = 'test-secret';
    const user = await createTestUser();

    const topUp = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '100000',
      provider: 'VNPAY',
      idempotencyKey: 'topup-vnpay-1',
    });
    expect(topUp.status).toBe('PENDING');
    expect(topUp.redirectUrl).toContain('vnp_SecureHash=');
    expect(topUp.redirectUrl).toContain('vnp_Amount=10000000');

    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, topUp.topUpId));
    expect(row?.status).toBe('PENDING');

    const payload = signedPayload('test-secret', 1, '100000');
    payload.vnp_TxnRef = row!.txnRef;
    payload.vnp_SecureHash = signVnpayParams(payload, 'test-secret');

    const confirmed = await walletTopUpService.handleWebhook(payload);
    expect(confirmed.status).toBe('SUCCESS');
    expect((await walletService.getWallet(user.id)).balance).toBe('100000.00');

    const [updated] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, topUp.topUpId));
    expect(updated?.status).toBe('SUCCESS');
    expect(updated?.providerTransactionId).toBe('TX-1');

    const entries = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.userId, user.id));
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe('TOP_UP');

    const replay = await walletTopUpService.handleWebhook(payload);
    expect(replay.status).toBe('SUCCESS');
    expect((await walletService.getWallet(user.id)).balance).toBe('100000.00');
    expect(await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.userId, user.id))).toHaveLength(1);
  });

  it('rejects an invalid signature and does not credit the wallet', async () => {
    env.VNPAY_TMN_CODE = 'TEST_TMN';
    env.VNPAY_HASH_SECRET = 'test-secret';
    const user = await createTestUser();
    const topUp = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '50000',
      provider: 'VNPAY',
    });
    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, topUp.topUpId));
    const payload = signedPayload('test-secret', 1, '50000');
    payload.vnp_TxnRef = row!.txnRef;
    payload.vnp_SecureHash = 'bad-hash';

    await expect(walletTopUpService.handleWebhook(payload)).rejects.toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
    expect((await walletService.getWallet(user.id)).balance).toBe('0.00');
    expect((await db.select().from(walletAccounts).where(eq(walletAccounts.userId, user.id)))[0].balance).toBe('0.00');
  });


  it('credits once when a bank webhook races a manual match of the same intent', async () => {
    env.SEPAY_WEBHOOK_SECRET = 'manual-race-secret';
    env.SEPAY_BANK_CODE = 'MBBank'; env.SEPAY_BANK_ACCOUNT = '0123456789'; env.SEPAY_ACCOUNT_NAME = 'TEST';
    const user = await createTestUser();
    const admin = await createTestUser({ role: 'ADMIN' });
    const topUp = await walletTopUpService.createTopUp({ userId: user.id, amount: '75000', provider: 'SEPAY', idempotencyKey: 'race-intent' });
    const rawBody = JSON.stringify({ id: 45678, gateway: 'MBBank', accountNumber: '0123456789', code: topUp.txnRef, content: topUp.txnRef, transferType: 'in', transferAmount: 75000, referenceCode: 'BANK-RACE' });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${crypto.createHmac('sha256', 'manual-race-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;
    await Promise.all([
      financeTopUpService.manualMatch({ topUpId: topUp.topUpId, provider: 'SEPAY', providerReference: '45678', userId: user.id, amount: '75000', reason: 'Verified statement' }, admin.id),
      walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp),
    ]);
    await walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp);
    expect((await walletService.getWallet(user.id)).balance).toBe('75000.00');
    expect(await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.entryType, 'TOP_UP'))).toHaveLength(1);
  });

  it('creates a SePay VietQR top-up and credits the wallet from an HMAC webhook', async () => {
    env.SEPAY_WEBHOOK_SECRET = 'sepay-webhook-secret';
    env.SEPAY_BANK_CODE = 'MBBank';
    env.SEPAY_BANK_ACCOUNT = '0123456789';
    env.SEPAY_ACCOUNT_NAME = 'NGUYEN VAN A';
    const user = await createTestUser();

    const topUp = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '75000',
      provider: 'SEPAY',
      idempotencyKey: 'topup-sepay-bank-1',
    });
    expect(topUp.redirectUrl).toBe('');
    expect(topUp.qrUrl).toContain('vietqr.app');
    expect(topUp.transferContent).toBe(topUp.txnRef);
    expect(topUp.bankCode).toBe('MBBank');

    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, topUp.topUpId));
    const rawBody = JSON.stringify({
      id: 98765,
      gateway: 'MBBank',
      accountNumber: '0123456789',
      code: row!.txnRef,
      content: `${row!.txnRef} chuyen tien`,
      transferType: 'in',
      transferAmount: 75000,
      referenceCode: 'SB-TEST-1',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${crypto.createHmac('sha256', 'sepay-webhook-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;

    const confirmed = await walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp);
    expect(confirmed.status).toBe('SUCCESS');
    expect((await walletService.getWallet(user.id)).balance).toBe('75000.00');

    await expect(walletTopUpService.handleSepayBankWebhook(rawBody, 'sha256=bad', timestamp))
      .rejects.toMatchObject({ code: 'PAYMENT_SIGNATURE_INVALID' });
    expect((await walletService.getWallet(user.id)).balance).toBe('75000.00');

    const replay = await walletTopUpService.handleSepayBankWebhook(rawBody, signature, timestamp);
    expect(replay.status).toBe('SUCCESS');
    expect((await walletService.getWallet(user.id)).balance).toBe('75000.00');
  });

  it('accepts the HMAC SePay bank webhook route', async () => {
    env.SEPAY_WEBHOOK_SECRET = 'route-secret';
    env.SEPAY_BANK_CODE = 'MBBank';
    env.SEPAY_BANK_ACCOUNT = '0123456789';
    const user = await createTestUser();
    const topUp = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '40000',
      provider: 'SEPAY',
      idempotencyKey: 'topup-sepay-route-1',
    });
    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, topUp.topUpId));
    const rawBody = JSON.stringify({
      id: 123456,
      code: row!.txnRef,
      content: row!.txnRef,
      transferType: 'in',
      transferAmount: 40000,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${crypto.createHmac('sha256', 'route-secret').update(`${timestamp}.${rawBody}`).digest('hex')}`;

    const response = await request(app)
      .post('/api/v1/payments/sepay/bank-webhook')
      .set('X-SePay-Signature', signature)
      .set('X-SePay-Timestamp', timestamp)
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect((await walletService.getWallet(user.id)).balance).toBe('40000.00');
  });

  it('exposes wallet and mock top-up routes', async () => {
    const user = await createTestUser();
    const created = await request(app)
      .post('/api/v1/wallet/top-ups')
      .set('x-user-id', String(user.id))
      .send({ amount: '20000', provider: 'MOCK' });
    expect(created.status).toBe(201);
    expect(created.body.data.isMock).toBe(true);

    const confirmed = await request(app)
      .post(`/api/v1/wallet/top-ups/${created.body.data.topUpId}/mock-confirm`)
      .set('x-user-id', String(user.id));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('SUCCESS');

    const wallet = await request(app)
      .get('/api/v1/wallet')
      .set('x-user-id', String(user.id));
    expect(wallet.status).toBe(200);
    expect(wallet.body.data.balance).toBe('20000.00');
  });

  it('reuses a top-up for the same idempotency key and supports mock confirmation', async () => {
    const user = await createTestUser();
    const first = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '30000',
      provider: 'MOCK',
      idempotencyKey: 'topup-mock-1',
    });
    const replay = await walletTopUpService.createTopUp({
      userId: user.id,
      amount: '30000',
      provider: 'MOCK',
      idempotencyKey: 'topup-mock-1',
    });
    expect(replay.topUpId).toBe(first.topUpId);
    expect(first.isMock).toBe(true);

    await walletTopUpService.mockConfirm(first.topUpId, user.id);
    expect((await walletService.getWallet(user.id)).balance).toBe('30000.00');
  });
});
