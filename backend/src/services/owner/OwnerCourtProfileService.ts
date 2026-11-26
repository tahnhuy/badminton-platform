import { z } from 'zod';
import { db } from '../../db';
import { courtProfileRepository } from '../../repositories/facility/CourtProfileRepository';
import { ownerCourtProfileBody } from '../../validation/owner';
import { applyCourtProfileUpdate, courtProfileDto } from '../facility/court-profile';
import { ownerConflict, ownerMissing, paginated } from './owner-errors';

type ProfileInput = z.infer<typeof ownerCourtProfileBody>;

export const ownerCourtProfileService = {
  async update(ownerId: number, courtId: number, input: ProfileInput) {
    return db.transaction(async (tx) => {
      const row = await courtProfileRepository.findOwned(ownerId, courtId, tx, true);
      if (!row) ownerMissing('COURT');
      if (row.court.status === 'PENDING_APPROVAL') {
        ownerConflict('REVIEW_ALREADY_PENDING', 'Pending submission cannot be edited');
      }
      const result = await applyCourtProfileUpdate(row.court, ownerId, input, tx);
      return courtProfileDto(result.court);
    });
  },

  async history(ownerId: number, courtId: number, page: number, limit: number) {
    if (!await courtProfileRepository.findOwned(ownerId, courtId)) ownerMissing('COURT');
    const { rows, total } = await courtProfileRepository.listChanges(courtId, page, limit);
    return paginated(rows, total, page, limit);
  },
};
