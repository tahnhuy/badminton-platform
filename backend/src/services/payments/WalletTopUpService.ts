import crypto from 'crypto';
import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import { PaymentProviderFactory } from './provider.factory';
import { parseWalletAmount, walletService } from './WalletService';
import { env } from '../../shared/config/env';
import { signSepayFields, timingSafeEqualText, verifySepayWebhookSignature, buildSepayQrUrl } from './sepay-signature';
import { sepayPaymentAdapter } from './adapters/sepay.adapter';

export interface CreateTopUpInput {
  userId: number;
  amount: string | number;
  provider?: string;
  idempotencyKey?: string | null;
  ipAddress?: string;
}

export interface TopUpInitiation {
  topUpId: number;
  amount: string;
  status: string;
  provider: string;
  redirectUrl: string;
  txnRef: string;
  isMock: boolean;
  qrUrl?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  transferContent?: string;
}

export class WalletTopUpService {
  private buildTxnRef(userId: number): string {
    return `TOPUP-${userId}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  }

  async createTopUp(input: CreateTopUpInput): Promise<TopUpInitiation> {
    const amount = parseWalletAmount(input.amount);
    const requestedProvider = input.provider?.toUpperCase();
    const providerName = requestedProvider
      || (env.PAYMENT_PROVIDER === 'VNPAY'
        ? 'VNPAY'
        : env.PAYMENT_PROVIDER === 'MOCK' || (!env.SEPAY_BANK_ACCOUNT && env.NODE_ENV !== 'production')
          ? 'MOCK'
          : 'SEPAY');
    const provider = providerName === 'SEPAY' ? null : PaymentProviderFactory.getProvider(providerName);
    if (providerName === 'SEPAY') this.requireSepayBankConfig();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const row = await db.transaction(async tx => {
      if (input.idempotencyKey) {
        const existing = await walletRepository.findTopUpByIdempotency(input.userId, input.idempotencyKey, tx);
        if (existing) return existing;
      }
      return walletRepository.createTopUp({
        userId: input.userId,
        amount: amount.value,
        provider: providerName,
        txnRef: this.buildTxnRef(input.userId),
        idempotencyKey: input.idempotencyKey ?? null,
        expiresAt,
      }, tx);
    });

    if (row.provider === 'SEPAY') {
      const transferContent = row.txnRef;
      return {
        topUpId: row.id,
        amount: String(row.amount),
        status: row.status,
        provider: row.provider,
        redirectUrl: '',
        txnRef: row.txnRef,
        isMock: false,
        qrUrl: row.status === 'PENDING' ? buildSepayQrUrl({
          baseUrl: env.SEPAY_QR_BASE_URL,
          bankCode: env.SEPAY_BANK_CODE,
          accountNumber: env.SEPAY_BANK_ACCOUNT,
          amount: row.amount,
          content: transferContent,
        }) : undefined,
        bankCode: env.SEPAY_BANK_CODE,
        accountNumber: env.SEPAY_BANK_ACCOUNT,
        accountName: env.SEPAY_ACCOUNT_NAME,
        transferContent,
      };
    }

    const redirectUrl = row.status === 'PENDING' && provider
      ? await provider.createPaymentUrl({
        paymentId: row.id,
        txnRef: row.txnRef,
        orderInfo: `Nap vi ${row.txnRef}`,
        amount: Number(row.amount),
        expiresAt: row.expiresAt ?? undefined,
        ipAddress: input.ipAddress,
      })
      : null;

    return {
      topUpId: row.id,
      amount: String(row.amount),
      status: row.status,
      provider: row.provider,
      redirectUrl: redirectUrl || '',
      txnRef: row.txnRef,
      isMock: row.provider === 'MOCK',
    };
  }

  async mockConfirm(topUpId: number, userId: number): Promise<{ status: string; wallet: unknown }> {
    if (env.NODE_ENV === 'production') {
      throw new AppError('PAYMENT_MOCK_FORBIDDEN', 403, 'Mock top-up confirmation is not available in production');
    }
    return db.transaction(async tx => {
      const topUp = await walletRepository.findTopUpById(topUpId, tx, true);
      if (!topUp) throw new NotFoundError('Top-up not found', 'WALLET_TOP_UP_NOT_FOUND');
      if (topUp.userId !== userId) throw new ForbiddenError('You do not own this top-up', 'WALLET_TOP_UP_FORBIDDEN');
      if (topUp.status === 'SUCCESS') {
        return { status: topUp.status, wallet: await walletService.getWallet(userId, tx) };
      }
      if (topUp.provider !== 'MOCK') {
        throw new AppError('WALLET_TOP_UP_NOT_MOCK', 409, 'Only mock top-ups can be confirmed this way');
      }
      if (topUp.status !== 'PENDING') {
        throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not payable');
      }
      const updated = await walletRepository.updateTopUpStatus(topUp.id, 'SUCCESS', null, tx);
      const credited = await walletService.credit({
        userId,
        amount: topUp.amount,
        entryType: 'TOP_UP',
        referenceType: 'TOP_UP',
        referenceId: topUp.id,
        idempotencyKey: `wallet-topup:${topUp.id}`,
        description: 'Mock wallet top-up',
      }, tx);
      return { status: updated.status, wallet: credited.wallet };
    });
  }

  async buildSepayCheckout(topUpId: number, userId: number): Promise<{ action: string; fields: Record<string, string> }> {
    if (!env.SEPAY_MERCHANT_ID || !env.SEPAY_SECRET_KEY) {
      throw new AppError('SEPAY_CONFIG_MISSING', 500, 'SePay credentials are missing');
    }
    const topUp = await walletRepository.findTopUpById(topUpId);
    if (!topUp) throw new NotFoundError('Top-up not found', 'WALLET_TOP_UP_NOT_FOUND');
    if (topUp.userId !== userId) throw new ForbiddenError('You do not own this top-up', 'WALLET_TOP_UP_FORBIDDEN');
    if (topUp.status !== 'PENDING') throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not payable');
    if (topUp.provider !== 'SEPAY') throw new AppError('WALLET_TOP_UP_NOT_SEPAY', 409, 'Top-up is not a SePay top-up');

    const suffix = `topUpId=${encodeURIComponent(String(topUp.id))}`;
    const fields: Record<string, string> = {
      merchant: env.SEPAY_MERCHANT_ID,
      currency: 'VND',
      order_amount: String(Number(topUp.amount)),
      operation: 'PURCHASE',
      order_description: `Nap vi ${topUp.txnRef}`,
      order_invoice_number: topUp.txnRef,
      success_url: `${env.SEPAY_SUCCESS_URL}?${suffix}`,
      error_url: `${env.SEPAY_ERROR_URL}?${suffix}`,
      cancel_url: `${env.SEPAY_CANCEL_URL}?${suffix}`,
    };
    fields.signature = signSepayFields(fields, env.SEPAY_SECRET_KEY);
    return { action: env.SEPAY_CHECKOUT_URL, fields };
  }

  async handleSepayWebhook(payload: Record<string, unknown>, secretHeader: string | undefined): Promise<{ orderRef: string; status: string }> {
    if (!env.SEPAY_IPN_SECRET || !secretHeader || !timingSafeEqualText(secretHeader, env.SEPAY_IPN_SECRET)) {
      throw new AppError('PAYMENT_SIGNATURE_INVALID', 401, 'Invalid SePay IPN secret');
    }
    const verified = await sepayPaymentAdapter.verifyWebhook(payload);
    if (!verified.orderRef) throw new AppError('PAYMENT_ORDER_REF_MISSING', 400, 'SePay IPN is missing order_invoice_number');

    return db.transaction(async tx => {
      const topUp = await walletRepository.findTopUpByTxnRef(verified.orderRef!, tx, true);
      if (!topUp) throw new NotFoundError('Top-up not found', 'WALLET_TOP_UP_NOT_FOUND');

      if (verified.status !== 'SUCCESS') {
        if (topUp.status === 'PENDING') {
          await walletRepository.updateTopUpStatus(topUp.id, 'FAILED', verified.transactionId ?? null, tx);
        }
        return { orderRef: topUp.txnRef, status: 'FAILED' };
      }
      if (verified.amount !== undefined && Number(topUp.amount) !== verified.amount) {
        throw new AppError('PAYMENT_AMOUNT_MISMATCH', 400, 'SePay amount does not match the top-up');
      }
      if (topUp.status === 'SUCCESS') return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
      if (topUp.status !== 'PENDING') throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not payable');

      await walletService.credit({
        userId: topUp.userId,
        amount: topUp.amount,
        entryType: 'TOP_UP',
        referenceType: 'TOP_UP',
        referenceId: topUp.id,
        idempotencyKey: `wallet-topup:${topUp.id}`,
        description: `SePay top-up ${topUp.txnRef}`,
      }, tx as TransactionContext);
      await walletRepository.updateTopUpStatus(topUp.id, 'SUCCESS', verified.transactionId ?? null, tx);
      return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
    });
  }

  private requireSepayBankConfig(): void {
    if (!env.SEPAY_BANK_ACCOUNT || !env.SEPAY_BANK_CODE || !env.SEPAY_WEBHOOK_SECRET) {
      throw new AppError(
        'SEPAY_BANK_CONFIG_MISSING',
        500,
        'SEPAY_BANK_ACCOUNT, SEPAY_BANK_CODE and SEPAY_WEBHOOK_SECRET are required',
      );
    }
  }

  async handleSepayBankWebhook(
    rawBody: string,
    signature: string | undefined,
    timestamp: string | undefined,
  ): Promise<{ success: true; orderRef?: string; status?: string }> {
    const secret = env.SEPAY_WEBHOOK_SECRET || env.SEPAY_IPN_SECRET;
    if (!verifySepayWebhookSignature(rawBody, signature, timestamp, secret)) {
      throw new AppError('PAYMENT_SIGNATURE_INVALID', 401, 'Invalid SePay webhook signature');
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      throw new AppError('PAYMENT_PAYLOAD_INVALID', 400, 'Invalid SePay webhook JSON');
    }

    const transferType = String(payload.transferType ?? '');
    if (transferType === 'out') {
      await this.handleSepayOutgoingPayout(payload);
      return { success: true };
    }
    if (transferType !== 'in') {
      return { success: true };
    }

    const code = payload.code ? String(payload.code) : '';
    const content = String(payload.content ?? '');
    // The bank often fills `code` with its own reference; the transfer content is the
    // reliable carrier of our txnRef, so search both before falling back to `code`.
    const orderRef = `${content} ${code}`.match(/TOPUP-[A-Za-z0-9-]+/)?.[0] ?? (code || undefined);
    if (!orderRef) {
      throw new AppError('PAYMENT_ORDER_REF_MISSING', 400, 'SePay webhook is missing top-up code');
    }
    const amount = Number(payload.transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('PAYMENT_AMOUNT_INVALID', 400, 'SePay webhook amount is invalid');
    }
    const transactionId = payload.id !== undefined ? String(payload.id) : (payload.referenceCode ? String(payload.referenceCode) : null);

    const result = await db.transaction(async tx => {
      const topUp = await walletRepository.findTopUpByTxnRef(orderRef, tx, true);
      if (!topUp) throw new NotFoundError('Top-up not found', 'WALLET_TOP_UP_NOT_FOUND');
      if (topUp.provider !== 'SEPAY') {
        throw new AppError('WALLET_TOP_UP_PROVIDER_MISMATCH', 409, 'Top-up is not a SePay top-up');
      }
      if (Number(topUp.amount) !== amount) {
        throw new AppError('PAYMENT_AMOUNT_MISMATCH', 400, 'SePay amount does not match the top-up');
      }
      if (topUp.status === 'SUCCESS') return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
      if (topUp.status !== 'PENDING') throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not payable');

      await walletService.credit({
        userId: topUp.userId,
        amount: topUp.amount,
        entryType: 'TOP_UP',
        referenceType: 'TOP_UP',
        referenceId: topUp.id,
        idempotencyKey: `wallet-topup:${topUp.id}`,
        description: `SePay bank transfer ${topUp.txnRef}`,
      }, tx as TransactionContext);
      await walletRepository.updateTopUpStatus(topUp.id, 'SUCCESS', transactionId, tx);
      return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
    });

    return { success: true, ...result };
  }

  private async handleSepayOutgoingPayout(payload: Record<string, unknown>): Promise<void> {
    const content = String(payload.content ?? '');
    const match = content.match(/PAYOUT-(\d+)/i);
    if (!match) return;
    const payoutId = Number(match[1]);
    const amount = Number(payload.transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('PAYMENT_AMOUNT_INVALID', 400, 'SePay payout amount is invalid');
    }

    await db.transaction(async tx => {
      const request = await walletRepository.findPayoutRequest(payoutId, tx, true);
      if (!request) throw new NotFoundError('Payout request not found', 'WALLET_PAYOUT_NOT_FOUND');
      if (request.status === 'PAID') return;
      if (request.status !== 'APPROVED') {
        throw new AppError('WALLET_PAYOUT_NOT_APPROVED', 409, 'Payout must be approved before payment');
      }
      if (Number(request.amount) !== amount) {
        throw new AppError('PAYMENT_AMOUNT_MISMATCH', 400, 'SePay amount does not match the payout');
      }
      if (!request.holdId) throw new AppError('WALLET_PAYOUT_HOLD_MISSING', 409, 'Payout hold is missing');

      await walletService.captureHold(request.holdId, {
        entryType: request.requestType === 'OWNER_PAYOUT' ? 'PAYOUT' : 'WITHDRAWAL',
        idempotencyKey: `payout-capture:${request.id}`,
      }, tx as TransactionContext);
      await walletRepository.updatePayoutStatus(request.id, 'PAID', {
        transferReference: String(payload.referenceCode ?? payload.id ?? 'SEPAY-OUT'),
      }, tx);
    });
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<{ orderRef: string; status: string }> {
    const provider = PaymentProviderFactory.getProvider('VNPAY');
    const verified = await provider.verifyWebhook(payload);
    if (!verified.isValid) {
      throw new AppError('PAYMENT_SIGNATURE_INVALID', 400, verified.message || 'Invalid VNPAY signature');
    }
    if (!verified.orderRef) {
      throw new AppError('PAYMENT_ORDER_REF_MISSING', 400, 'VNPAY callback is missing vnp_TxnRef');
    }

    const result = await db.transaction(async tx => {
      const topUp = await walletRepository.findTopUpByTxnRef(verified.orderRef!, tx, true);
      if (!topUp) throw new NotFoundError('Top-up not found', 'WALLET_TOP_UP_NOT_FOUND');
      if (topUp.provider !== 'VNPAY') {
        throw new AppError('WALLET_TOP_UP_PROVIDER_MISMATCH', 409, 'Top-up is not a VNPAY top-up');
      }

      if (verified.status !== 'SUCCESS') {
        if (topUp.status === 'PENDING') {
          await walletRepository.updateTopUpStatus(topUp.id, 'FAILED', verified.transactionId ?? null, tx);
        }
        return { orderRef: topUp.txnRef, status: 'FAILED' };
      }

      if (verified.amount !== undefined && Number(topUp.amount) !== verified.amount) {
        throw new AppError('PAYMENT_AMOUNT_MISMATCH', 400, 'VNPAY amount does not match the top-up');
      }
      if (topUp.status === 'SUCCESS') {
        return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
      }
      if (topUp.status !== 'PENDING') {
        throw new AppError('WALLET_TOP_UP_NOT_PAYABLE', 409, 'Top-up is not payable');
      }

      await walletService.credit({
        userId: topUp.userId,
        amount: topUp.amount,
        entryType: 'TOP_UP',
        referenceType: 'TOP_UP',
        referenceId: topUp.id,
        idempotencyKey: `wallet-topup:${topUp.id}`,
        description: `VNPAY top-up ${topUp.txnRef}`,
      }, tx as TransactionContext);
      await walletRepository.updateTopUpStatus(topUp.id, 'SUCCESS', verified.transactionId ?? null, tx);
      return { orderRef: topUp.txnRef, status: 'SUCCESS' as const };
    });

    return result;
  }
}

export const walletTopUpService = new WalletTopUpService();
