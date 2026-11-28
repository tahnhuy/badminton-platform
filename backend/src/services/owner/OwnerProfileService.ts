import { ownerProfileRepository as repo } from '../../repositories/owner/OwnerProfileRepository';
import { ownerMissing } from './owner-errors';
/** The Owner's own contact profile. The phone is self-service: no Admin review and no OTP. */
export const ownerProfileService = {
  async read(userId: number) { return (await repo.find(userId)) ?? ownerMissing('PROFILE'); },
  async updatePhone(userId: number, phone: string) { return (await repo.updatePhone(userId, phone)) ?? ownerMissing('PROFILE'); },
};
