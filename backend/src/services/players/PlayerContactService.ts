import { AppError } from '../../errors/AppError';
import { playerContactRepository as repo } from '../../repositories/players/PlayerContactRepository';
function required(row: { phone: string | null } | null) {
  if (!row) throw new AppError('PLAYER_NOT_FOUND', 404, 'Player profile not found');
  return row;
}
export const playerContactService = {
  async read(userId: number) { return required(await repo.find(userId)); },
  async update(userId: number, phone: string | null) { return required(await repo.update(userId, phone)); },
};
