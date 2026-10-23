import { AppError } from '../../errors/AppError';
export function ownerMissing(kind: 'FACILITY' | 'COURT' | 'PRICING' | 'BOOKING' | 'SLOT_BLOCK'): never {
  throw new AppError(`OWNER_${kind}_NOT_FOUND`, 404, 'Resource not found');
}
export function ownerConflict(code: string, message: string): never { throw new AppError(code, 409, message); }
export function databaseErrorCode(error: unknown): string | undefined {
  const value = error as { code?: string; cause?: { code?: string } };
  return value?.cause?.code ?? value?.code;
}
export function paginated<T>(rows: T[], total: number, page: number, limit: number) {
  return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}
