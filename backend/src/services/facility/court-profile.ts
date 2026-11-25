import { AppError } from '../../errors/AppError';
import { courtProfileRepository, CourtRow } from '../../repositories/facility/CourtProfileRepository';
import type { OwnerTransaction } from '../../repositories/owner/owner-db';
import { courtStandardRepository } from '../../repositories/facility/CourtStandardRepository';

export const SURFACE_TYPE_VALUES = ['PVC', 'WOOD', 'PU_ACRYLIC', 'OTHER'] as const;
export const CONDITION_VALUES = ['NORMAL', 'NEEDS_MAINTENANCE', 'UNDER_MAINTENANCE'] as const;
export const MAINTENANCE_CONDITIONS = ['NEEDS_MAINTENANCE', 'UNDER_MAINTENANCE'] as const;

const PROFILE_KEYS = ['surfaceType', 'surfaceBrand', 'surfaceModel', 'surfaceThicknessMm'] as const;
const CONDITION_KEYS = ['condition', 'conditionNote'] as const;

export interface CourtProfileInput {
  profileVersion: number;
  surfaceType?: string | null;
  surfaceBrand?: string | null;
  surfaceModel?: string | null;
  surfaceThicknessMm?: number | string | null;
  condition?: string | null;
  conditionNote?: string | null;
}

type ProfileKey = (typeof PROFILE_KEYS)[number];
type ConditionKey = (typeof CONDITION_KEYS)[number];
type CourtProfileValues = Pick<CourtRow, ProfileKey | ConditionKey>;

function normalizeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeThickness(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new AppError('VALIDATION_FAILED', 400, 'Độ dày mặt sân không hợp lệ');
  // The column is numeric(4,1) and PostgreSQL returns it as "4.0". Normalizing to one
  // decimal keeps "4" and "4.0" equal so an unchanged value is not logged as a change.
  return parsed.toFixed(1);
}

/** Returns a snapshot containing only the fields that belong to the change type. */
export function profileSnapshot(row: CourtProfileValues) {
  return {
    surfaceType: row.surfaceType ?? null,
    surfaceBrand: row.surfaceBrand ?? null,
    surfaceModel: row.surfaceModel ?? null,
    surfaceThicknessMm: row.surfaceThicknessMm ?? null,
  };
}

export function conditionSnapshot(row: CourtProfileValues) {
  return {
    condition: row.condition ?? null,
    conditionNote: row.conditionNote ?? null,
  };
}

function buildNextValues(current: CourtRow, input: CourtProfileInput): CourtProfileValues {
  const next: CourtProfileValues = {
    surfaceType: current.surfaceType,
    surfaceBrand: current.surfaceBrand,
    surfaceModel: current.surfaceModel,
    surfaceThicknessMm: current.surfaceThicknessMm,
    condition: current.condition,
    conditionNote: current.conditionNote,
  };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(input, key);

  if (has('surfaceType')) next.surfaceType = normalizeText(input.surfaceType);
  if (has('surfaceBrand')) next.surfaceBrand = normalizeText(input.surfaceBrand);
  if (has('surfaceModel')) next.surfaceModel = normalizeText(input.surfaceModel);
  if (has('surfaceThicknessMm')) next.surfaceThicknessMm = normalizeThickness(input.surfaceThicknessMm);
  if (has('condition')) next.condition = normalizeText(input.condition);
  if (has('conditionNote')) next.conditionNote = normalizeText(input.conditionNote);
  return next;
}

function sameValues(a: CourtProfileValues, b: CourtProfileValues, keys: readonly (ProfileKey | ConditionKey)[]) {
  return keys.every((key) => (a[key] ?? null) === (b[key] ?? null));
}

function updatePatch(next: CourtProfileValues): Record<string, unknown> {
  return {
    surfaceType: next.surfaceType,
    surfaceBrand: next.surfaceBrand,
    surfaceModel: next.surfaceModel,
    surfaceThicknessMm: next.surfaceThicknessMm,
    condition: next.condition,
    conditionNote: next.conditionNote,
  };
}

export function courtProfileDto(row: CourtRow) {
  return {
    id: row.id,
    facilityId: row.facilityId,
    name: row.name,
    status: row.status,
    description: row.description,
    surfaceType: row.surfaceType,
    surfaceBrand: row.surfaceBrand,
    surfaceModel: row.surfaceModel,
    surfaceThicknessMm: row.surfaceThicknessMm,
    condition: row.condition,
    conditionNote: row.conditionNote,
    profileVersion: row.profileVersion,
    dataSource: row.dataSource,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Applies a court profile/condition change inside the caller's transaction.
 * - Rejects stale `profileVersion` writes.
 * - Writes `court_profile_changes` only for values that actually changed.
 * - Never touches status, pricing, bookings or slot blocks.
 */
export async function applyCourtProfileUpdate(
  current: CourtRow,
  actorId: number,
  input: CourtProfileInput,
  tx: OwnerTransaction,
  reason?: string | null
) {
  const next = buildNextValues(current, input);

  if (
    next.condition &&
    (MAINTENANCE_CONDITIONS as readonly string[]).includes(next.condition) &&
    !next.conditionNote
  ) {
    throw new AppError('VALIDATION_FAILED', 400, 'Ghi chú là bắt buộc khi sân cần hoặc đang bảo trì');
  }

  const profileChanged = !sameValues(current, next, PROFILE_KEYS);
  const conditionChanged = !sameValues(current, next, CONDITION_KEYS);
  if (!profileChanged && !conditionChanged) {
    return { court: current, changed: false as const };
  }

  const updated = await courtProfileRepository.updateVersioned(
    current.id,
    input.profileVersion,
    updatePatch(next),
    tx
  );
  if (!updated) {
    throw new AppError(
      'COURT_PROFILE_VERSION_CONFLICT',
      409,
      'Thông số sân đã được cập nhật bởi người khác. Vui lòng tải lại.'
    );
  }

  const changes = [];
  if (profileChanged) {
    changes.push({
      courtId: current.id,
      actorId,
      changeType: 'PROFILE' as const,
      beforeValues: profileSnapshot(current),
      afterValues: profileSnapshot(updated),
      reason: reason ?? null,
    });
  }
  if (conditionChanged) {
    changes.push({
      courtId: current.id,
      actorId,
      changeType: 'CONDITION' as const,
      beforeValues: conditionSnapshot(current),
      afterValues: conditionSnapshot(updated),
      reason: reason ?? null,
    });
  }
  await courtProfileRepository.insertChanges(changes, tx);

  if (
    (next.surfaceBrand ?? null) !== (current.surfaceBrand ?? null) ||
    (next.surfaceModel ?? null) !== (current.surfaceModel ?? null)
  ) {
    await courtStandardRepository.invalidateForCourt(current.id, tx);
  }

  return { court: updated, changed: true as const, profileChanged, conditionChanged };
}
