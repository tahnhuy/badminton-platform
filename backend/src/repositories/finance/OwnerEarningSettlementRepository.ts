import { and, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { ownerEarningSettlements } from '../../db/schema/wallet';
import { bookings } from '../../db/schema/bookings';
import { users } from '../../db/schema/users';
import type { TransactionContext } from '../../contracts/TransactionContext';

type Executor = any;

export type OwnerEarningSettlementStatus = 'PENDING' | 'CREDITED' | 'REJECTED';
export type OwnerEarningSettlementMode = 'AUTO' | 'MANUAL';

export interface OwnerEarningSettlementRecord {
  id: number;
  bookingId: number;
  ownerId: number;
  amount: string;
  status: OwnerEarningSettlementStatus;
  mode: OwnerEarningSettlementMode;
  ledgerEntryId: number | null;
  decidedBy: number | null;
  decidedAt: Date | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OwnerEarningSettlementView extends OwnerEarningSettlementRecord {
  bookingCode: string | null;
  bookingDate: string | null;
  ownerEmail: string;
}

export interface OwnerEarningSettlementListFilter {
  status?: OwnerEarningSettlementStatus;
  ownerId?: number;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface CreateOwnerEarningSettlementInput {
  bookingId: number;
  ownerId: number;
  amount: string;
  status: OwnerEarningSettlementStatus;
  mode: OwnerEarningSettlementMode;
  ledgerEntryId?: number | null;
  decidedBy?: number | null;
  decidedAt?: Date | null;
  note?: string | null;
}

export class OwnerEarningSettlementRepository {
  async findByBookingId(
    bookingId: number,
    executor: Executor = db,
    forUpdate = false,
  ): Promise<OwnerEarningSettlementRecord | null> {
    const query = executor
      .select()
      .from(ownerEarningSettlements)
      .where(eq(ownerEarningSettlements.bookingId, bookingId))
      .limit(1);
    const [row] = forUpdate ? await query.for('update') : await query;
    return (row as OwnerEarningSettlementRecord | undefined) ?? null;
  }

  async findById(
    id: number,
    executor: Executor = db,
    forUpdate = false,
  ): Promise<OwnerEarningSettlementRecord | null> {
    const query = executor
      .select()
      .from(ownerEarningSettlements)
      .where(eq(ownerEarningSettlements.id, id))
      .limit(1);
    const [row] = forUpdate ? await query.for('update') : await query;
    return (row as OwnerEarningSettlementRecord | undefined) ?? null;
  }

  async create(
    input: CreateOwnerEarningSettlementInput,
    executor: TransactionContext | typeof db = db,
  ): Promise<OwnerEarningSettlementRecord> {
    const [row] = await executor
      .insert(ownerEarningSettlements)
      .values({
        bookingId: input.bookingId,
        ownerId: input.ownerId,
        amount: input.amount,
        status: input.status,
        mode: input.mode,
        ledgerEntryId: input.ledgerEntryId ?? null,
        decidedBy: input.decidedBy ?? null,
        decidedAt: input.decidedAt ?? null,
        note: input.note ?? null,
      })
      .returning();
    return row as OwnerEarningSettlementRecord;
  }

  async createIfAbsent(
    input: CreateOwnerEarningSettlementInput,
    executor: TransactionContext | typeof db = db,
  ): Promise<OwnerEarningSettlementRecord | null> {
    const [row] = await executor
      .insert(ownerEarningSettlements)
      .values({
        bookingId: input.bookingId,
        ownerId: input.ownerId,
        amount: input.amount,
        status: input.status,
        mode: input.mode,
        ledgerEntryId: input.ledgerEntryId ?? null,
        decidedBy: input.decidedBy ?? null,
        decidedAt: input.decidedAt ?? null,
        note: input.note ?? null,
      })
      .onConflictDoNothing({ target: ownerEarningSettlements.bookingId })
      .returning();
    return (row as OwnerEarningSettlementRecord | undefined) ?? null;
  }

  async updateDecision(
    id: number,
    input: {
      status: OwnerEarningSettlementStatus;
      ledgerEntryId?: number | null;
      decidedBy?: number | null;
      decidedAt?: Date | null;
      note?: string | null;
    },
    executor: TransactionContext | typeof db = db,
  ): Promise<OwnerEarningSettlementRecord> {
    const [row] = await executor
      .update(ownerEarningSettlements)
      .set({
        status: input.status,
        ledgerEntryId: input.ledgerEntryId ?? null,
        decidedBy: input.decidedBy ?? null,
        decidedAt: input.decidedAt ?? null,
        note: input.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(ownerEarningSettlements.id, id))
      .returning();
    return row as OwnerEarningSettlementRecord;
  }

  async findViewById(id: number): Promise<OwnerEarningSettlementView | null> {
    const [row] = await db
      .select({
        settlement: ownerEarningSettlements,
        bookingCode: bookings.bookingCode,
        bookingDate: bookings.bookingDate,
        ownerEmail: users.email,
      })
      .from(ownerEarningSettlements)
      .leftJoin(bookings, eq(bookings.id, ownerEarningSettlements.bookingId))
      .innerJoin(users, eq(users.id, ownerEarningSettlements.ownerId))
      .where(eq(ownerEarningSettlements.id, id))
      .limit(1);
    if (!row) return null;
    return {
      ...(row.settlement as OwnerEarningSettlementRecord),
      bookingCode: row.bookingCode ?? null,
      bookingDate: row.bookingDate ?? null,
      ownerEmail: row.ownerEmail,
    };
  }

  async list(filter: OwnerEarningSettlementListFilter): Promise<{ rows: OwnerEarningSettlementView[]; total: number }> {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(ownerEarningSettlements.status, filter.status));
    if (filter.ownerId) conditions.push(eq(ownerEarningSettlements.ownerId, filter.ownerId));
    if (filter.from) conditions.push(gte(ownerEarningSettlements.createdAt, filter.from));
    if (filter.to) conditions.push(lte(ownerEarningSettlements.createdAt, filter.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        settlement: ownerEarningSettlements,
        bookingCode: bookings.bookingCode,
        bookingDate: bookings.bookingDate,
        ownerEmail: users.email,
        total: sql<number>`COUNT(*) OVER()::int`,
      })
      .from(ownerEarningSettlements)
      .leftJoin(bookings, eq(bookings.id, ownerEarningSettlements.bookingId))
      .innerJoin(users, eq(users.id, ownerEarningSettlements.ownerId))
      .where(where)
      .orderBy(desc(ownerEarningSettlements.createdAt), desc(ownerEarningSettlements.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return {
      rows: rows.map((row: any) => ({
        ...(row.settlement as OwnerEarningSettlementRecord),
        bookingCode: row.bookingCode ?? null,
        bookingDate: row.bookingDate ?? null,
        ownerEmail: row.ownerEmail,
      })),
      total: Number(rows[0]?.total ?? 0),
    };
  }
}

export const ownerEarningSettlementRepository = new OwnerEarningSettlementRepository();
