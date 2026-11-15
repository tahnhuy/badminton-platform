import { db } from '../../db';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { AppError } from '../../errors/AppError';
import {
  walletRepository,
  WalletAccountRecord,
  WalletEntryType,
  WalletHoldRecord,
  WalletLedgerRecord,
} from '../../repositories/wallet/WalletRepository';

export interface WalletSnapshot {
  userId: number;
  balance: string;
  held: string;
  available: string;
  updatedAt: Date;
}

export interface WalletMutationInput {
  userId: number;
  amount: string | number;
  entryType: WalletEntryType;
  referenceType?: string | null;
  referenceId?: number | null;
  description?: string | null;
  idempotencyKey?: string | null;
  createdBy?: number | null;
}

function toCents(value: string | number): bigint {
  const raw = String(value).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new AppError('WALLET_AMOUNT_INVALID', 400, 'Wallet amount must be a positive number with up to 2 decimals');
  }
  const [whole, fraction = ''] = raw.split('.');
  const cents = BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
  if (cents <= 0n) {
    throw new AppError('WALLET_AMOUNT_INVALID', 400, 'Wallet amount must be greater than zero');
  }
  return cents;
}

function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

function toCentsOrZero(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new AppError('WALLET_BALANCE_INVALID', 500, 'Stored wallet balance is invalid');
  }
  const [whole, fraction = ''] = raw.split('.');
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function toSignedCents(value: string): bigint {
  const raw = String(value ?? '0').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    throw new AppError('WALLET_BALANCE_INVALID', 500, 'Stored wallet amount is invalid');
  }
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [whole, fraction = ''] = unsigned.split('.');
  const cents = BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
  return negative ? -cents : cents;
}

export function parseWalletAmount(value: string | number): { cents: bigint; value: string } {
  const cents = toCents(value);
  return { cents, value: formatCents(cents) };
}

function addCents(balance: string, delta: bigint): string {
  return formatCents(toCentsOrZero(balance) + delta);
}

function subtractCents(balance: string, delta: bigint): string {
  const next = toCentsOrZero(balance) - delta;
  if (next < 0n) {
    throw new AppError('WALLET_INSUFFICIENT_BALANCE', 409, 'Wallet balance is insufficient');
  }
  return formatCents(next);
}

export class WalletService {
  private async withTx<T>(tx: TransactionContext | undefined, work: (executor: TransactionContext) => Promise<T>): Promise<T> {
    if (tx) return work(tx);
    return db.transaction(work);
  }

  private async snapshot(account: WalletAccountRecord, executor: TransactionContext): Promise<WalletSnapshot> {
    const held = await walletRepository.sumActiveHolds(account.userId, executor);
    const available = formatCents(toCentsOrZero(account.balance) - toCentsOrZero(held));
    return {
      userId: account.userId,
      balance: formatCents(toCentsOrZero(account.balance)),
      held: formatCents(toCentsOrZero(held)),
      available,
      updatedAt: account.updatedAt,
    };
  }

  async getWallet(userId: number, tx?: TransactionContext): Promise<WalletSnapshot> {
    return this.withTx(tx, async executor => {
      const account = await walletRepository.ensureAccount(userId, executor);
      return this.snapshot(account, executor);
    });
  }

  async listEntries(userId: number, limit = 50, tx?: TransactionContext): Promise<WalletLedgerRecord[]> {
    return this.withTx(tx, executor => walletRepository.listEntries(userId, limit, executor));
  }

  async credit(input: WalletMutationInput, tx?: TransactionContext): Promise<{ wallet: WalletSnapshot; entry: WalletLedgerRecord }> {
    const amount = toCents(input.amount);
    return this.withTx(tx, async executor => {
      const account = await walletRepository.ensureAccount(input.userId, executor);
      const existing = await this.findExistingEntry(input, amount, executor);
      if (existing) return { wallet: await this.snapshot(account, executor), entry: existing };

      const balanceAfter = addCents(account.balance, amount);
      const updated = await walletRepository.updateBalance(input.userId, balanceAfter, executor);
      const entry = await walletRepository.insertEntry({
        userId: input.userId,
        entryType: input.entryType,
        amount: formatCents(amount),
        balanceAfter,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.createdBy,
      }, executor);
      return { wallet: await this.snapshot(updated, executor), entry };
    });
  }

  async debit(input: WalletMutationInput, tx?: TransactionContext): Promise<{ wallet: WalletSnapshot; entry: WalletLedgerRecord }> {
    const amount = toCents(input.amount);
    return this.withTx(tx, async executor => {
      const account = await walletRepository.ensureAccount(input.userId, executor);
      const existing = await this.findExistingEntry(input, -amount, executor);
      if (existing) return { wallet: await this.snapshot(account, executor), entry: existing };

      await this.assertAvailable(account, amount, executor);
      const balanceAfter = subtractCents(account.balance, amount);
      const updated = await walletRepository.updateBalance(input.userId, balanceAfter, executor);
      const entry = await walletRepository.insertEntry({
        userId: input.userId,
        entryType: input.entryType,
        amount: formatCents(-amount),
        balanceAfter,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.createdBy,
      }, executor);
      return { wallet: await this.snapshot(updated, executor), entry };
    });
  }

  async hold(input: {
    userId: number;
    amount: string | number;
    referenceType?: string | null;
    referenceId?: number | null;
    idempotencyKey?: string | null;
  }, tx?: TransactionContext): Promise<{ wallet: WalletSnapshot; hold: WalletHoldRecord }> {
    const amount = toCents(input.amount);
    return this.withTx(tx, async executor => {
      const account = await walletRepository.ensureAccount(input.userId, executor);
      if (input.idempotencyKey) {
        const existing = await walletRepository.findHoldByIdempotency(input.userId, input.idempotencyKey, executor);
        if (existing) {
          const sameReference = (existing.referenceType ?? null) === (input.referenceType ?? null)
            && (existing.referenceId ?? null) === (input.referenceId ?? null);
          if (existing.amount !== formatCents(amount) || !sameReference) {
            throw new AppError(
              'WALLET_IDEMPOTENCY_CONFLICT',
              409,
              'Idempotency key was used with a different wallet hold',
            );
          }
          return { wallet: await this.snapshot(account, executor), hold: existing };
        }
      }
      await this.assertAvailable(account, amount, executor);
      const hold = await walletRepository.createHold({
        userId: input.userId,
        amount: formatCents(amount),
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        idempotencyKey: input.idempotencyKey,
      }, executor);
      return { wallet: await this.snapshot(account, executor), hold };
    });
  }

  async releaseHold(holdId: number, tx?: TransactionContext): Promise<WalletHoldRecord> {
    return this.withTx(tx, async executor => {
      const hold = await walletRepository.findHoldById(holdId, executor, true);
      if (!hold) throw new AppError('WALLET_HOLD_NOT_FOUND', 404, 'Wallet hold not found');
      if (hold.status === 'RELEASED') return hold;
      if (hold.status === 'CAPTURED') {
        throw new AppError('WALLET_HOLD_CAPTURED', 409, 'Wallet hold was already captured');
      }
      return walletRepository.updateHoldStatus(hold.id, 'RELEASED', executor);
    });
  }

  async captureHold(
    holdId: number,
    input: { entryType?: WalletEntryType; idempotencyKey?: string | null } = {},
    tx?: TransactionContext,
  ): Promise<{ wallet: WalletSnapshot; hold: WalletHoldRecord; entry: WalletLedgerRecord | null }> {
    return this.withTx(tx, async executor => {
      const holdSummary = await walletRepository.findHoldById(holdId, executor);
      if (!holdSummary) throw new AppError('WALLET_HOLD_NOT_FOUND', 404, 'Wallet hold not found');

      const account = await walletRepository.ensureAccount(holdSummary.userId, executor);
      const hold = await walletRepository.findHoldById(holdId, executor, true);
      if (!hold) throw new AppError('WALLET_HOLD_NOT_FOUND', 404, 'Wallet hold not found');

      if (hold.status === 'CAPTURED') {
        const key = input.idempotencyKey ?? `wallet-hold:${hold.id}:capture`;
        const existing = await walletRepository.findEntryByIdempotency(hold.userId, key, executor);
        return { wallet: await this.snapshot(account, executor), hold, entry: existing };
      }
      if (hold.status === 'RELEASED') {
        throw new AppError('WALLET_HOLD_RELEASED', 409, 'Wallet hold was already released');
      }

      const amount = toCents(hold.amount);
      if (toCentsOrZero(account.balance) < amount) {
        throw new AppError('WALLET_INSUFFICIENT_BALANCE', 409, 'Wallet balance is insufficient to capture hold');
      }

      const key = input.idempotencyKey ?? `wallet-hold:${hold.id}:capture`;
      const existing = await walletRepository.findEntryByIdempotency(hold.userId, key, executor);
      if (existing) {
        const captured = await walletRepository.updateHoldStatus(hold.id, 'CAPTURED', executor);
        return { wallet: await this.snapshot(account, executor), hold: captured, entry: existing };
      }

      const balanceAfter = subtractCents(account.balance, amount);
      const updated = await walletRepository.updateBalance(hold.userId, balanceAfter, executor);
      const captured = await walletRepository.updateHoldStatus(hold.id, 'CAPTURED', executor);
      const entry = await walletRepository.insertEntry({
        userId: hold.userId,
        entryType: input.entryType ?? 'PAYMENT',
        amount: formatCents(-amount),
        balanceAfter,
        referenceType: hold.referenceType,
        referenceId: hold.referenceId,
        idempotencyKey: key,
      }, executor);
      return { wallet: await this.snapshot(updated, executor), hold: captured, entry };
    });
  }

  async adminCredit(input: Omit<WalletMutationInput, 'entryType' | 'createdBy'> & { adminId: number }, tx?: TransactionContext) {
    return this.credit({
      ...input,
      entryType: 'ADMIN_ADJUSTMENT',
      createdBy: input.adminId,
      description: this.requireAdminReason(input.description),
    }, tx);
  }

  async adminDebit(input: Omit<WalletMutationInput, 'entryType' | 'createdBy'> & { adminId: number }, tx?: TransactionContext) {
    return this.debit({
      ...input,
      entryType: 'ADMIN_ADJUSTMENT',
      createdBy: input.adminId,
      description: this.requireAdminReason(input.description),
    }, tx);
  }

  private requireAdminReason(description?: string | null): string {
    const reason = description?.trim();
    if (!reason) {
      throw new AppError('WALLET_ADJUSTMENT_REASON_REQUIRED', 400, 'Admin wallet adjustment requires a reason');
    }
    return reason;
  }

  private async findExistingEntry(
    input: WalletMutationInput,
    signedCents: bigint,
    executor: TransactionContext,
  ): Promise<WalletLedgerRecord | null> {
    if (!input.idempotencyKey) return null;
    const existing = await walletRepository.findEntryByIdempotency(input.userId, input.idempotencyKey, executor);
    if (!existing) return null;
    if (existing.entryType !== input.entryType || toSignedCents(existing.amount) !== signedCents) {
      throw new AppError('WALLET_IDEMPOTENCY_CONFLICT', 409, 'Idempotency key was used with a different wallet operation');
    }
    return existing;
  }

  private async assertAvailable(account: WalletAccountRecord, amount: bigint, executor: TransactionContext): Promise<void> {
    const held = await walletRepository.sumActiveHolds(account.userId, executor);
    const available = toCentsOrZero(account.balance) - toCentsOrZero(held);
    if (available < amount) {
      throw new AppError('WALLET_INSUFFICIENT_BALANCE', 409, 'Wallet available balance is insufficient');
    }
  }
}

export const walletService = new WalletService();
