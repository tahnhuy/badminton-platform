import { ownerBookingReadRepository as repo, OwnerBookingRead, OwnerHistoryFilter } from '../../repositories/owner/OwnerBookingReadRepository';
import { ownerFacilityRepository } from '../../repositories/owner/OwnerFacilityRepository';
import { ownerMissing, paginated } from './owner-errors';
export function refundStatus(status: string | null) {
  if (status === 'REFUND_PENDING') return 'PENDING';
  if (status === 'REFUNDED') return 'REFUNDED';
  if (status === 'REFUND_FAILED') return 'FAILED';
  return 'NONE';
}
export function bookingSummary(row: OwnerBookingRead) {
  return { id: row.id, bookingCode: row.bookingCode, facilityId: row.facilityId, courtId: row.courtId, bookingDate: row.bookingDate, startTime: row.startTime, endTime: row.endTime, status: row.status, totalAmount: Number(row.totalAmount), unitPrice: Number(row.unitPrice), bookingKind: row.tournamentId ? 'TOURNAMENT' : 'PLAYER', refundStatus: row.tournamentId ? 'NONE' : refundStatus(row.paymentStatus) };
}
export function playerContact(row: OwnerBookingRead) {
  return { id: row.playerId, fullName: row.playerName, email: row.playerEmail, phone: row.playerPhone };
}
export const ownerBookingReadService = {
  async detail(ownerId: number, id: number) {
    const row = await repo.detail(ownerId, id);
    if (!row) ownerMissing('BOOKING');
    return { ...bookingSummary(row), cancellationReason: row.cancellationReason, cancelledAt: row.cancelledAt, expiresAt: row.expiresAt, ...(row.tournamentId ? { tournamentId: row.tournamentId, matchId: row.matchId } : { player: playerContact(row) }), pricingDetails: await repo.pricingDetails(id) };
  },
  async history(ownerId: number, facilityId: number, filter: OwnerHistoryFilter) {
    if (!await ownerFacilityRepository.find(ownerId, facilityId)) ownerMissing('FACILITY');
    const { rows, total } = await repo.history(ownerId, facilityId, filter);
    return paginated(rows.map(bookingSummary), total, filter.page, filter.limit);
  },
};
