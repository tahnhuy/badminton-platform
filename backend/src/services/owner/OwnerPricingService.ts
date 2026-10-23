import { z } from 'zod';
import { db } from '../../db';
import { ownerPricingBody } from '../../validation/owner';
import { ownerCourtRepository } from '../../repositories/owner/OwnerCourtRepository';
import { ownerFacilityRepository } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerPricingRepository as repo } from '../../repositories/owner/OwnerPricingRepository';
import { databaseErrorCode, ownerConflict, ownerMissing } from './owner-errors';
function dto(row: NonNullable<Awaited<ReturnType<typeof repo.find>>>) {
  return { id: row.id, startTime: row.startTime, endTime: row.endTime, pricePerHour: Number(row.price), validFrom: row.validFrom, validTo: row.validTo };
}
export const ownerPricingService = {
  async list(ownerId: number, courtId: number, validOn?: string) {
    if (!await ownerCourtRepository.find(ownerId, courtId)) ownerMissing('COURT');
    return (await repo.list(courtId, validOn)).map(dto);
  },
  async save(ownerId: number, courtId: number, input: z.infer<typeof ownerPricingBody>) {
    try {
      return await db.transaction(async tx => {
        const owned = await ownerCourtRepository.find(ownerId, courtId, tx);
        if (!owned) ownerMissing('COURT');
        if (!await ownerFacilityRepository.lock(ownerId, owned.facility.id, tx) || !await ownerCourtRepository.find(ownerId, courtId, tx)) ownerMissing('COURT');
        if (input.pricingId && !await repo.find(courtId, input.pricingId, tx)) ownerMissing('PRICING');
        const { pricePerHour, pricingId, ...rest } = input;
        const values = { ...rest, courtId, price: String(pricePerHour) };
        if (await repo.overlaps(values, tx, pricingId)) ownerConflict('PRICING_INTERVAL_OVERLAP', 'Pricing intervals overlap');
        const row = await repo.save(values, tx, pricingId);
        if (!row) ownerMissing('PRICING');
        return { created: !pricingId, data: dto(row) };
      });
    } catch (error) {
      if (databaseErrorCode(error) === '23P01') ownerConflict('PRICING_INTERVAL_OVERLAP', 'Pricing intervals overlap');
      throw error;
    }
  },
};
