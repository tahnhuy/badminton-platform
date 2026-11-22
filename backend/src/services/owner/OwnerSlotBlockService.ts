import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { ownerCourtRepository as courts } from '../../repositories/owner/OwnerCourtRepository';
import { ownerFacilityRepository as facilities } from '../../repositories/owner/OwnerFacilityRepository';
import { courtSlotBlockRepository as blocks } from '../../repositories/owner/CourtSlotBlockRepository';
import { lockCourtDate } from '../../repositories/owner/owner-db';
import { bookingRepository } from '../../repositories/booking/BookingRepository';
import { ownerConfig } from '../../shared/config/owner-config';
import { todayInAppTimezone, addDaysToDateString, timeToMinutes } from '../booking/availability.service';
import { databaseErrorCode, ownerConflict, ownerMissing } from './owner-errors';
export interface BlockInput { bookingDate: string; startTime: string; endTime: string; reason: string }
export const ownerSlotBlockService = {
  async create(ownerId: number, courtId: number, input: BlockInput) {
    const config = await ownerConfig.get();
    const today = todayInAppTimezone();
    if (input.bookingDate < today || input.bookingDate > addDaysToDateString(today, config.maintenanceAdvanceWindowDays)) throw new AppError('SLOT_BLOCK_OUTSIDE_ADVANCE_WINDOW', 400, 'Date is outside the maintenance window');
    try {
      return await db.transaction(async tx => {
        const target = await courts.find(ownerId, courtId, tx);
        if (!target) ownerMissing('COURT');
        if (!await facilities.lock(ownerId, target.facility.id, tx)) ownerMissing('COURT');
        await lockCourtDate(tx, courtId, input.bookingDate);
        const owned = await courts.find(ownerId, courtId, tx);
        if (!owned) ownerMissing('COURT');
        if (owned.court.status !== 'ACTIVE' || owned.facility.status !== 'ACTIVE') ownerConflict('COURT_NOT_ELIGIBLE', 'Court/facility is not active');
        if (input.startTime >= input.endTime || timeToMinutes(input.startTime) < timeToMinutes(owned.facility.openingTime) || timeToMinutes(input.endTime) > timeToMinutes(owned.facility.closingTime)) throw new AppError('SLOT_BLOCK_INVALID_RANGE', 400, 'Block must fall within opening hours on one day');
        const staleHolds = await bookingRepository.findStaleHoldsForCourt(courtId, input.bookingDate, tx);
        if (staleHolds.length > 0) {
          await bookingRepository.lockUsersAscending(staleHolds.map((row: { playerId: number }) => row.playerId), tx);
          await bookingRepository.expireBookingsByIds(staleHolds.map((row: { id: number }) => row.id), tx);
        }
        const occupied = await bookingRepository.findActiveIntervals(courtId, input.bookingDate, new Date(), tx) as { startTime: string; endTime: string }[];
        if (occupied.some(row => timeToMinutes(input.startTime) < timeToMinutes(row.endTime) && timeToMinutes(row.startTime) < timeToMinutes(input.endTime))) ownerConflict('SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING', 'Cancel eligible bookings before blocking');
        if (await blocks.overlaps(courtId, input.bookingDate, input.startTime, input.endTime, tx)) ownerConflict('SLOT_BLOCK_OVERLAP_BLOCK', 'Maintenance blocks overlap');
        const block = await blocks.create({ ...input, courtId, createdBy: ownerId, status: 'ACTIVE' }, tx);
        return { blocks: [{ id: block.id, courtId, ...input, status: 'ACTIVE' }] };
      });
    } catch (error) {
      if (databaseErrorCode(error) === '23P01') ownerConflict('SLOT_BLOCK_OVERLAP_BLOCK', 'Maintenance blocks overlap');
      throw error;
    }
  },
  async release(ownerId: number, courtId: number, blockId: number) {
    return db.transaction(async tx => {
      if (!await courts.find(ownerId, courtId, tx)) ownerMissing('COURT');
      const row = await blocks.release(courtId, blockId, tx);
      if (!row) ownerMissing('SLOT_BLOCK');
      return { id: row.id, courtId, status: row.status };
    });
  },
};
