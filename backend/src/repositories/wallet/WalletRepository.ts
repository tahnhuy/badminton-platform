import { db } from '../../db';
import {
  walletAccounts,
  walletHolds,
  walletLedgerEntries,
  walletTopUps,
  walletBankAccounts,
  walletPayoutRequests,
} from '../../db/schema/wallet';
import { and, desc, eq, sql } from 'drizzle-orm';

type Executor = any;

export type WalletEntryType =
  | 'TOP_UP'
  | 'PAYMENT'
  | 'REFUND'
  | 'WITHDRAWAL'
  | 'PAYOUT'
  | 'ADMIN_ADJUSTMENT'
  | 'OWNER_EARNING'
  | 'OWNER_EARNING_REVERSAL'
  | 'TOURNAMENT_EARNING';

export type WalletHoldStatus = 'HELD' | 'CAPTURED' | 'RELEASED';

export interface WalletAccountRecord {
  userId: number;
  balance: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletLedgerRecord {
  id: number;
  userId: number;
  entryType: WalletEntryType;
  amount: string;
  balanceAfter: string;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  idempotencyKey: string | null;
  createdBy: number | null;
  createdAt: Date;
}

export interface WalletHoldRecord {
  id: number;
  userId: number;
  amount: string;
  status: WalletHoldStatus;
  referenceType: string | null;
  referenceId: number | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  releasedAt: Date | null;
  capturedAt: Date | null;
}

export type WalletPayoutType = 'WITHDRAWAL' | 'OWNER_PAYOUT';
export type WalletPayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'FAILED';

export interface WalletBankAccountRecord {
  id: number;
  userId: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface WalletPayoutRequestRecord {
  id: number;
  userId: number;
  requestType: WalletPayoutType;
  amount: string;
  status: WalletPayoutStatus;
  bankAccountId: number;
  holdId: number | null;
  adminId: number | null;
  adminNote: string | null;
  transferReference: string | null;
  clientRequestId: string | null;
  requestedAt: Date;
  reviewedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type WalletTopUpStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export interface WalletTopUpRecord {
  id: number;
  userId: number;
  amount: string;
  status: WalletTopUpStatus;
  provider: string;
  txnRef: string;
  providerTransactionId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  expiresAt: Date | null;
}

export interface NewLedgerEntry {
  userId: number;
  entryType: WalletEntryType;
  amount: string;
  balanceAfter: string;
  referenceType?: string | null;
  referenceId?: number | null;
  description?: string | null;
  idempotencyKey?: string | null;
  createdBy?: number | null;
}

export class WalletRepository {
  async ensureAccount(userId: number, executor: Executor = db): Promise<WalletAccountRecord> {
    await executor
      .insert(walletAccounts)
      .values({ userId })
      .onConflictDoNothing({ target: walletAccounts.userId });

    const account = await this.findAccount(userId, executor, true);
    if (!account) throw new Error(`Wallet account not found for user ${userId}`);
    return account;
  }

  async findAccount(userId: number, executor: Executor = db, lock = false): Promise<WalletAccountRecord | null> {
    let query = executor
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, userId));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletAccountRecord) || null;
  }

  async updateBalance(userId: number, balance: string, executor: Executor = db): Promise<WalletAccountRecord> {
    const [row] = await executor
      .update(walletAccounts)
      .set({ balance, updatedAt: new Date() })
      .where(eq(walletAccounts.userId, userId))
      .returning();
    return row as WalletAccountRecord;
  }

  async sumActiveHolds(userId: number, executor: Executor = db): Promise<string> {
    const [row] = await executor
      .select({ total: sql<string>`COALESCE(SUM(${walletHolds.amount}), 0)` })
      .from(walletHolds)
      .where(and(eq(walletHolds.userId, userId), eq(walletHolds.status, 'HELD')));
    return String(row?.total ?? '0');
  }

  async findEntryByIdempotency(
    userId: number,
    idempotencyKey: string,
    executor: Executor = db,
  ): Promise<WalletLedgerRecord | null> {
    const [row] = await executor
      .select()
      .from(walletLedgerEntries)
      .where(and(eq(walletLedgerEntries.userId, userId), eq(walletLedgerEntries.idempotencyKey, idempotencyKey)))
      .limit(1);
    return (row as WalletLedgerRecord) || null;
  }

  async insertEntry(entry: NewLedgerEntry, executor: Executor = db): Promise<WalletLedgerRecord> {
    const [row] = await executor
      .insert(walletLedgerEntries)
      .values({
        userId: entry.userId,
        entryType: entry.entryType,
        amount: entry.amount,
        balanceAfter: entry.balanceAfter,
        referenceType: entry.referenceType ?? null,
        referenceId: entry.referenceId ?? null,
        description: entry.description ?? null,
        idempotencyKey: entry.idempotencyKey ?? null,
        createdBy: entry.createdBy ?? null,
      })
      .returning();
    return row as WalletLedgerRecord;
  }

  async findHoldByIdempotency(
    userId: number,
    idempotencyKey: string,
    executor: Executor = db,
  ): Promise<WalletHoldRecord | null> {
    const [row] = await executor
      .select()
      .from(walletHolds)
      .where(and(eq(walletHolds.userId, userId), eq(walletHolds.idempotencyKey, idempotencyKey)))
      .limit(1);
    return (row as WalletHoldRecord) || null;
  }

  async findHoldById(id: number, executor: Executor = db, lock = false): Promise<WalletHoldRecord | null> {
    let query = executor
      .select()
      .from(walletHolds)
      .where(eq(walletHolds.id, id));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletHoldRecord) || null;
  }

  async createHold(input: {
    userId: number;
    amount: string;
    referenceType?: string | null;
    referenceId?: number | null;
    idempotencyKey?: string | null;
  }, executor: Executor = db): Promise<WalletHoldRecord> {
    const [row] = await executor
      .insert(walletHolds)
      .values({
        userId: input.userId,
        amount: input.amount,
        status: 'HELD',
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning();
    return row as WalletHoldRecord;
  }

  async updateHoldStatus(
    id: number,
    status: WalletHoldStatus,
    executor: Executor = db,
  ): Promise<WalletHoldRecord> {
    const now = new Date();
    const [row] = await executor
      .update(walletHolds)
      .set({
        status,
        updatedAt: now,
        releasedAt: status === 'RELEASED' ? now : undefined,
        capturedAt: status === 'CAPTURED' ? now : undefined,
      })
      .where(eq(walletHolds.id, id))
      .returning();
    return row as WalletHoldRecord;
  }

  async findTopUpById(id: number, executor: Executor = db, lock = false): Promise<WalletTopUpRecord | null> {
    let query = executor
      .select()
      .from(walletTopUps)
      .where(eq(walletTopUps.id, id));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletTopUpRecord) || null;
  }

  async findTopUpByTxnRef(txnRef: string, executor: Executor = db, lock = false): Promise<WalletTopUpRecord | null> {
    let query = executor
      .select()
      .from(walletTopUps)
      .where(eq(walletTopUps.txnRef, txnRef));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletTopUpRecord) || null;
  }

  async findTopUpByIdempotency(
    userId: number,
    idempotencyKey: string,
    executor: Executor = db,
  ): Promise<WalletTopUpRecord | null> {
    const [row] = await executor
      .select()
      .from(walletTopUps)
      .where(and(eq(walletTopUps.userId, userId), eq(walletTopUps.idempotencyKey, idempotencyKey)))
      .limit(1);
    return (row as WalletTopUpRecord) || null;
  }

  async createTopUp(input: {
    userId: number;
    amount: string;
    provider: string;
    txnRef: string;
    idempotencyKey?: string | null;
    expiresAt?: Date | null;
  }, executor: Executor = db): Promise<WalletTopUpRecord> {
    const [row] = await executor
      .insert(walletTopUps)
      .values({
        userId: input.userId,
        amount: input.amount,
        status: 'PENDING',
        provider: input.provider,
        txnRef: input.txnRef,
        idempotencyKey: input.idempotencyKey ?? null,
        expiresAt: input.expiresAt ?? null,
      })
      .returning();
    return row as WalletTopUpRecord;
  }

  async updateTopUpStatus(
    id: number,
    status: WalletTopUpStatus,
    providerTransactionId: string | null,
    executor: Executor = db,
  ): Promise<WalletTopUpRecord> {
    const now = new Date();
    const [row] = await executor
      .update(walletTopUps)
      .set({
        status,
        providerTransactionId,
        paidAt: status === 'SUCCESS' ? now : undefined,
        updatedAt: now,
      })
      .where(eq(walletTopUps.id, id))
      .returning();
    return row as WalletTopUpRecord;
  }

  async createBankAccount(input: {
    userId: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    isDefault?: boolean;
  }, executor: Executor = db): Promise<WalletBankAccountRecord> {
    const [row] = await executor
      .insert(walletBankAccounts)
      .values({
        userId: input.userId,
        bankCode: input.bankCode,
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        isDefault: input.isDefault ?? false,
      })
      .returning();
    return row as WalletBankAccountRecord;
  }

  async listBankAccounts(userId: number, executor: Executor = db): Promise<WalletBankAccountRecord[]> {
    return executor
      .select()
      .from(walletBankAccounts)
      .where(eq(walletBankAccounts.userId, userId))
      .orderBy(desc(walletBankAccounts.isDefault), desc(walletBankAccounts.id)) as Promise<WalletBankAccountRecord[]>;
  }

  async findBankAccount(id: number, executor: Executor = db): Promise<WalletBankAccountRecord | null> {
    const [row] = await executor.select().from(walletBankAccounts).where(eq(walletBankAccounts.id, id)).limit(1);
    return (row as WalletBankAccountRecord) || null;
  }

  async createPayoutRequest(input: {
    userId: number;
    requestType: WalletPayoutType;
    amount: string;
    bankAccountId: number;
    clientRequestId?: string | null;
  }, executor: Executor = db): Promise<WalletPayoutRequestRecord> {
    const [row] = await executor
      .insert(walletPayoutRequests)
      .values({
        userId: input.userId,
        requestType: input.requestType,
        amount: input.amount,
        status: 'PENDING',
        bankAccountId: input.bankAccountId,
        clientRequestId: input.clientRequestId ?? null,
      })
      .returning();
    return row as WalletPayoutRequestRecord;
  }

  async findPayoutRequestByClientRequestId(
    userId: number,
    clientRequestId: string,
    executor: Executor = db,
    lock = false,
  ): Promise<WalletPayoutRequestRecord | null> {
    let query = executor
      .select()
      .from(walletPayoutRequests)
      .where(
        and(
          eq(walletPayoutRequests.userId, userId),
          eq(walletPayoutRequests.clientRequestId, clientRequestId)
        )
      );
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletPayoutRequestRecord) || null;
  }

  async setPayoutHold(id: number, holdId: number, executor: Executor = db): Promise<WalletPayoutRequestRecord> {
    const [row] = await executor
      .update(walletPayoutRequests)
      .set({ holdId, updatedAt: new Date() })
      .where(eq(walletPayoutRequests.id, id))
      .returning();
    return row as WalletPayoutRequestRecord;
  }

  async findPayoutRequest(id: number, executor: Executor = db, lock = false): Promise<WalletPayoutRequestRecord | null> {
    let query = executor.select().from(walletPayoutRequests).where(eq(walletPayoutRequests.id, id));
    if (lock) query = query.for('update');
    const [row] = await query.limit(1);
    return (row as WalletPayoutRequestRecord) || null;
  }

  async listPayoutRequestsByUser(userId: number, executor: Executor = db): Promise<WalletPayoutRequestRecord[]> {
    return executor
      .select()
      .from(walletPayoutRequests)
      .where(eq(walletPayoutRequests.userId, userId))
      .orderBy(desc(walletPayoutRequests.createdAt), desc(walletPayoutRequests.id)) as Promise<WalletPayoutRequestRecord[]>;
  }

  async listPayoutRequests(status?: WalletPayoutStatus, limit = 100, executor: Executor = db): Promise<WalletPayoutRequestRecord[]> {
    let query = executor.select().from(walletPayoutRequests);
    if (status) query = query.where(eq(walletPayoutRequests.status, status));
    return query
      .orderBy(desc(walletPayoutRequests.createdAt), desc(walletPayoutRequests.id))
      .limit(limit) as Promise<WalletPayoutRequestRecord[]>;
  }

  async updatePayoutStatus(
    id: number,
    status: WalletPayoutStatus,
    values: { adminId?: number | null; adminNote?: string | null; transferReference?: string | null } = {},
    executor: Executor = db,
  ): Promise<WalletPayoutRequestRecord> {
    const now = new Date();
    const [row] = await executor
      .update(walletPayoutRequests)
      .set({
        status,
        adminId: values.adminId ?? undefined,
        adminNote: values.adminNote ?? undefined,
        transferReference: values.transferReference ?? undefined,
        reviewedAt: status === 'APPROVED' || status === 'REJECTED' ? now : undefined,
        paidAt: status === 'PAID' ? now : undefined,
        updatedAt: now,
      })
      .where(eq(walletPayoutRequests.id, id))
      .returning();
    return row as WalletPayoutRequestRecord;
  }

  async listEntries(userId: number, limit = 50, executor: Executor = db, offset = 0): Promise<WalletLedgerRecord[]> {
    return executor
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.userId, userId))
      .orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id))
      .limit(limit)
      .offset(offset) as Promise<WalletLedgerRecord[]>;
  }

  async countEntries(userId: number, executor: Executor = db): Promise<number> {
    const [row] = await executor
      .select({ total: sql<string>`COUNT(*)` })
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.userId, userId));
    return Number(row?.total ?? 0);
  }
}

export const walletRepository = new WalletRepository();
