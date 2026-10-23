import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db, courtPricings } from '../../db';
import { OwnerExecutor, OwnerTransaction } from './owner-db';

type PricingInput = Pick<typeof courtPricings.$inferInsert, 'courtId' | 'startTime' | 'endTime' | 'price' | 'validFrom' | 'validTo'>;
export const ownerPricingRepository = {
  async list(courtId: number, validOn?: string, executor: OwnerExecutor = db) {
    return executor.select().from(courtPricings).where(and(eq(courtPricings.courtId, courtId), validOn ? sql`${courtPricings.validityRange} @> ${validOn}::date` : undefined)).orderBy(asc(courtPricings.validFrom), asc(courtPricings.startTime), asc(courtPricings.id));
  },
  async find(courtId: number, id: number, executor: OwnerExecutor = db) {
    const [row] = await executor.select().from(courtPricings).where(and(eq(courtPricings.courtId, courtId), eq(courtPricings.id, id)));
    return row ?? null;
  },
  async overlaps(input: PricingInput, tx: OwnerTransaction, excludeId?: number) {
    const [row] = await tx.select({ id: courtPricings.id }).from(courtPricings).where(and(
      eq(courtPricings.courtId, input.courtId), excludeId ? ne(courtPricings.id, excludeId) : undefined,
      sql`${courtPricings.pricingTimeRange} && int4range(extract(epoch from ${input.startTime}::time)::integer, extract(epoch from ${input.endTime}::time)::integer, '[)')`,
      sql`${courtPricings.validityRange} && daterange(${input.validFrom}::date, ${input.validTo ?? null}::date, '[]')`,
    )).limit(1);
    return !!row;
  },
  async save(input: PricingInput, tx: OwnerTransaction, id?: number) {
    const query = id ? tx.update(courtPricings).set({ ...input, updatedAt: new Date() }).where(and(eq(courtPricings.id, id), eq(courtPricings.courtId, input.courtId))) : tx.insert(courtPricings).values(input);
    const [row] = await query.returning();
    return row ?? null;
  },
};
