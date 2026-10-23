import { courtOccupancyRepository } from '../facility/CourtOccupancyRepository';
import { db } from '../../db';
export type OwnerTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type OwnerExecutor = typeof db | OwnerTransaction;

export async function lockCourtDate(tx: OwnerTransaction, courtId: number, date: string): Promise<void> {
  await courtOccupancyRepository.lockDate(courtId, date, tx);
}
