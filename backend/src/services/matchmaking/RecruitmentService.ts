import { db } from '../../db';
import { AppError, NotFoundError, ValidationError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { recruitmentRepository, RecruitmentFieldUpdate } from '../../repositories/matchmaking/RecruitmentRepository';
import { matchmakingConfig, MatchmakingConfig } from '../../shared/config/matchmaking-config';
import { findPublishedPostIds, isPostPublished, postContentPort } from '../social/recruitment-post';
import { addMinutes } from './matchmaking-time.util';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { recruitmentLifecycleService } from './RecruitmentLifecycleService';
import type {
  BookingAction,
  CreateForPostInput,
  CreatedRecruitment,
  NormalizedExternalCourt,
  NormalizedRecruitmentDraft,
  RecruitmentCardProjection,
  RecruitmentPort,
  RecruitmentDraftInput,
  ValidateDraftOptions,
  RecruitmentFeedFilter,
  RecruitmentMatchType,
  RecruitmentProjectionAccess,
  RecruitmentViewerRelation,
} from '../../contracts/RecruitmentPort';

// MM-23: recruitment side of the canonical creation flow, edit and publish
// (Matchmaking Tech Design §24.2, §24.4, §24.7.3, §24.9, §24.10, §24.14).
// `cancelForAuthorDeletion` delegates to the MM-25 host cancellation (AUTHOR_DELETED).

type Executor = any;

const FIXED_SLOTS: Record<'SINGLES' | 'DOUBLES', number> = { SINGLES: 2, DOUBLES: 4 };
/** Casual group duration (matrix §3.12, approved 2026-10-31): 60–180, default 90. */
const GROUP_DURATION = { min: 60, max: 180, default: 90 } as const;
const COST_NOTE_MAX = 200;
/** database-schema.md §13.3 lengths; city/district bounded like the feed filters (100). */
const COURT_LIMITS = { name: 120, city: 100, district: 100, address: 200 } as const;

const badRequest = (code: string, message: string) => new AppError(code, 400, message);
const conflict = (code: string, message: string) => new AppError(code, 409, message);
const requestNotFound = () => new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);

interface ValidateOptions {
  now: Date;
  checkLeadTime: boolean;
  config: MatchmakingConfig;
}

export interface RecruitmentPatch {
  matchType?: RecruitmentMatchType;
  startAt?: string;
  durationMinutes?: number;
  capacity?: number;
  minPlayers?: number;
  companionCount?: number;
  minSkillLevelId?: number;
  maxSkillLevelId?: number;
  costNote?: string | null;
}

/** Exact field allowlist per projection tier (contracts/RecruitmentPort.ts). */
export const RECRUITMENT_PROJECTION_FIELDS: Record<RecruitmentProjectionAccess, readonly string[]> = (() => {
  const base = ['access', 'postId', 'requestId', 'viewerRelation'];
  const context = [...base, 'hostId', 'matchType', 'status', 'startAt', 'durationMinutes', 'capacity', 'minPlayers',
    'companionCount', 'filledSlots', 'hasOpenSlots', 'ended', 'skillRange', 'costNote'];
  const card = [...context, 'acceptedCount', 'externalCourt', 'members'];
  return { NONE: base, INVITEE: context, PUBLIC: card, FULL: card };
})();

/**
 * §24.9 tier decision shared by the Social projection and GET /matchmaking-requests/:id:
 * host, or accepted member while membership is active → FULL; published → PUBLIC; pending
 * invitee of an unpublished post → INVITEE (response context); otherwise NONE. Social
 * visibility (hidden/deleted) is applied by the caller.
 * `memberActive` mirrors GET /matchmaking-requests/:id: an ACCEPTED row counts while the
 * request is effectively OPEN or MATCHED (Match participant), not after CANCELLED/EXPIRED.
 */
export function recruitmentAccess(relation: RecruitmentViewerRelation, published: boolean, memberActive = true): RecruitmentProjectionAccess {
  if (relation === 'HOST' || (relation === 'ACCEPTED' && memberActive)) return 'FULL';
  if (published) return 'PUBLIC';
  if (relation === 'PENDING') return 'INVITEE';
  return 'NONE';
}

/**
 * MM-28 external court validation, shared by creation and PUT /:id/court. All four fields
 * are required and trimmed (all-or-none CHECK, §13.3); invalid → 400 MATCHMAKING_INVALID_COURT.
 */
export function normalizeExternalCourt(input: unknown): NormalizedExternalCourt {
  const source = (input ?? {}) as Record<string, unknown>;
  const court: Record<string, string> = {};
  for (const field of ['name', 'city', 'district', 'address'] as const) {
    const value = typeof source[field] === 'string' ? (source[field] as string).trim() : '';
    if (!value || [...value].length > COURT_LIMITS[field]) {
      throw badRequest('MATCHMAKING_INVALID_COURT', 'Thông tin sân không hợp lệ: cần tên sân, tỉnh/thành, quận/huyện và địa chỉ');
    }
    court[field] = value;
  }
  return { name: court.name, city: court.city, district: court.district, address: court.address };
}

function pickFields(source: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(allowed.filter(key => key in source).map(key => [key, source[key]]));
}

function intervalEnd(start: Date, minutes: number): Date {
  return addMinutes(start, minutes);
}

function effectiveStatus(request: { status: string; expiresAt: Date | null }, now: Date): string {
  if (request.status === 'OPEN' && request.expiresAt && request.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return request.status;
}

export class RecruitmentService implements RecruitmentPort {
  // ------------------------------------------------------------ validation

  async validateDraft(hostId: number, draft: RecruitmentDraftInput, reader?: TransactionContext, options: ValidateDraftOptions = {}): Promise<NormalizedRecruitmentDraft> {
    void hostId;
    const config = await matchmakingConfig.get();
    return this.normalize(draft, { now: new Date(), checkLeadTime: options.checkLeadTime ?? true, config }, reader ?? db);
  }

  private async normalize(draft: RecruitmentDraftInput, options: ValidateOptions, reader: Executor): Promise<NormalizedRecruitmentDraft> {
    const { config, now } = options;
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      throw new ValidationError('Thông tin tìm kèo không hợp lệ', [{ field: 'recruitment', code: 'invalid_type' }]);
    }
    const matchType = draft.matchType;
    if (matchType !== 'SINGLES' && matchType !== 'DOUBLES' && matchType !== 'GROUP') {
      throw new ValidationError('Loại kèo không hợp lệ', [{ field: 'matchType', code: 'invalid_value' }]);
    }
    const start = new Date(draft.startAt);
    if (typeof draft.startAt !== 'string' || Number.isNaN(start.getTime())) {
      throw new ValidationError('Giờ bắt đầu không hợp lệ', [{ field: 'startAt', code: 'invalid_date' }]);
    }
    if (options.checkLeadTime && start.getTime() < addMinutes(now, config.minLeadTimeMinutes).getTime()) {
      throw badRequest('MATCHMAKING_START_TOO_SOON', `Giờ bắt đầu phải sau ít nhất ${config.minLeadTimeMinutes} phút kể từ bây giờ`);
    }

    let capacity: number;
    let minPlayers: number;
    let companionCount: number;
    let durationMinutes: number;
    if (matchType === 'GROUP') {
      capacity = draft.capacity as number;
      if (!isInt(capacity) || capacity < config.groupMinSlots || capacity > config.groupMaxSlots) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', `Kèo giao lưu phải có từ ${config.groupMinSlots} đến ${config.groupMaxSlots} chỗ`);
      }
      minPlayers = draft.minPlayers as number;
      if (!isInt(minPlayers) || minPlayers < 2 || minPlayers > capacity) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', 'Số người tối thiểu phải từ 2 đến tổng số chỗ');
      }
      companionCount = draft.companionCount ?? 0;
      if (!isInt(companionCount) || companionCount < 0 || 1 + companionCount > capacity) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', 'Số người đi cùng vượt quá số chỗ');
      }
      durationMinutes = draft.durationMinutes ?? GROUP_DURATION.default;
      if (!isInt(durationMinutes) || durationMinutes < GROUP_DURATION.min || durationMinutes > GROUP_DURATION.max) {
        throw badRequest('MATCHMAKING_INVALID_DURATION', 'Thời lượng kèo giao lưu phải từ 60 đến 180 phút');
      }
    } else {
      const slots = FIXED_SLOTS[matchType];
      if ((draft.capacity !== undefined && draft.capacity !== slots) || (draft.minPlayers !== undefined && draft.minPlayers !== slots)) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', `Kèo ${matchType === 'SINGLES' ? 'đơn' : 'đôi'} có đúng ${slots} người chơi`);
      }
      if (draft.companionCount !== undefined && draft.companionCount !== 0) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', 'Kèo đơn/đôi không khai báo người đi cùng');
      }
      if (draft.durationMinutes !== undefined && draft.durationMinutes !== config.matchDurationMinutes) {
        throw badRequest('MATCHMAKING_INVALID_DURATION', 'Kèo đơn/đôi dùng thời lượng trận mặc định');
      }
      capacity = slots;
      minPlayers = slots;
      companionCount = 0;
      durationMinutes = config.matchDurationMinutes;
    }

    if (!isInt(draft.minSkillLevelId) || !isInt(draft.maxSkillLevelId)) {
      throw badRequest('MATCHMAKING_INVALID_SKILL_RANGE', 'Khoảng trình độ không hợp lệ');
    }
    const levels = await recruitmentRepository.findSkillLevels([draft.minSkillLevelId, draft.maxSkillLevelId], reader);
    const min = levels.find((level: any) => level.id === draft.minSkillLevelId);
    const max = levels.find((level: any) => level.id === draft.maxSkillLevelId);
    if (!min || !max || min.rank > max.rank) {
      throw badRequest('MATCHMAKING_INVALID_SKILL_RANGE', 'Khoảng trình độ không hợp lệ: trình độ tối thiểu phải thấp hơn hoặc bằng tối đa');
    }

    const trimmed = typeof draft.costNote === 'string' ? draft.costNote.trim() : null;
    const costNote = trimmed ? trimmed : null;
    if (costNote && [...costNote].length > COST_NOTE_MAX) {
      throw new ValidationError('Ghi chú chi phí tối đa 200 ký tự', [{ field: 'costNote', code: 'too_big' }]);
    }

    let externalCourt: NormalizedExternalCourt | null = null;
    if (draft.court != null) {
      const kind = (draft.court as { kind?: unknown }).kind;
      if (kind === 'BOOKING') {
        throw conflict('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE', 'Chưa hỗ trợ liên kết lịch đặt sân cho bài tìm kèo');
      }
      if (kind !== 'EXTERNAL') throw badRequest('MATCHMAKING_INVALID_COURT', 'Loại sân không hợp lệ');
      externalCourt = normalizeExternalCourt(draft.court);
    }

    return {
      matchType,
      startAt: start.toISOString(),
      durationMinutes,
      capacity,
      minPlayers,
      companionCount,
      minSkillLevelId: draft.minSkillLevelId,
      maxSkillLevelId: draft.maxSkillLevelId,
      costNote,
      externalCourt,
    };
  }

  // -------------------------------------------------------------- creation

  async createForPost(input: CreateForPostInput, tx: TransactionContext): Promise<CreatedRecruitment> {
    const config = await matchmakingConfig.get();
    if (!config.enabled) throw conflict('MATCHMAKING_DISABLED', 'Tính năng ghép trận đang tạm khóa');
    // Re-entrant: the caller already holds the host lock taken before the post insert.
    await matchmakingRepository.lockUsersAscending([input.hostId], tx);
    const now = new Date();
    const draft = await this.normalize(input.draft, { now, checkLeadTime: true, config }, tx);

    const open = await recruitmentRepository.countOpenPostsForHost(input.hostId, tx);
    if (open >= config.maxOpenPostsPerPlayer) {
      throw conflict('MATCHMAKING_OPEN_POST_LIMIT', `Bạn chỉ có thể có tối đa ${config.maxOpenPostsPerPlayer} bài tìm kèo đang mở`);
    }
    const start = new Date(draft.startAt);
    if (await matchmakingRepository.hasOverlappingCommitment(input.hostId, start, intervalEnd(start, draft.durationMinutes), null, tx)) {
      throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Bạn đã có lịch chơi trùng với khung giờ này');
    }
    if (input.publish && 1 + draft.companionCount >= draft.capacity) {
      throw conflict('MATCHMAKING_REQUEST_FULL', 'Bài tìm kèo phải còn ít nhất một chỗ trống khi công khai');
    }

    const requestId = await recruitmentRepository.insertRecruitment({
      playerId: input.hostId,
      postId: input.postId,
      matchType: draft.matchType,
      startAt: start,
      durationMinutes: draft.durationMinutes,
      capacity: draft.capacity,
      minPlayers: draft.minPlayers,
      companionCount: draft.companionCount,
      minSkillLevelId: draft.minSkillLevelId,
      maxSkillLevelId: draft.maxSkillLevelId,
      costNote: draft.costNote,
      externalCourt: draft.externalCourt,
    }, tx);
    const publishedAt = input.publish ? await postContentPort.markPublished(input.postId, now, tx) : null;
    return { requestId, publishedAt, draft };
  }

  // ------------------------------------------------------- edit / publish

  /**
   * §24.7.3 "Edit recruitment / publish": users(10, host + members snapshot) →
   * requests(30) → posts(100, publish only). Retries when the member set changed.
   */
  private async withHostAndMembersLocked<T>(requestId: number, actorId: number,
    work: (tx: TransactionContext, request: any, accepted: number) => Promise<T>): Promise<T> {
    // Same retry pattern as MembershipService.acceptMembership (§24.7.1 rule 3).
    for (;;) {
      const snapshot = await matchmakingRepository.findRequestById(requestId);
      if (!snapshot || snapshot.playerId !== actorId) throw requestNotFound();
      const members = await matchmakingRepository.findAcceptedInvitees(requestId);
      const userIds: number[] = [snapshot.playerId, ...members.map((m: any) => m.playerId)];
      const outcome = await db.transaction(async tx => {
        await matchmakingRepository.lockUsersAscending(userIds, tx);
        const locked = await matchmakingRepository.lockRequestById(requestId, tx);
        if (!locked || locked.playerId !== actorId) throw requestNotFound();
        const current = await matchmakingRepository.findAcceptedInvitees(requestId, tx);
        if (current.some((m: any) => !userIds.includes(m.playerId))) return { retry: true as const };
        return { retry: false as const, value: await work(tx, locked, current.length) };
      });
      if (!outcome.retry) return outcome.value;
    }
  }

  private assertEditable(request: any, now: Date): void {
    if (effectiveStatus(request, now) !== 'OPEN' || request.startAt.getTime() <= now.getTime()) {
      throw conflict('MATCHMAKING_REQUEST_NOT_OPEN', 'Yêu cầu không còn mở');
    }
  }

  async publish(actorId: number, requestId: number) {
    const config = await matchmakingConfig.get();
    if (!config.enabled) throw conflict('MATCHMAKING_DISABLED', 'Tính năng ghép trận đang tạm khóa');
    return this.withHostAndMembersLocked(requestId, actorId, async (tx, request, accepted) => {
      const now = new Date();
      if (await isPostPublished(request.postId, tx)) {
        const publishedAt = await postContentPort.markPublished(request.postId, now, tx);
        return { id: request.id, postId: request.postId, publishedAt };
      }
      this.assertEditable(request, now);
      if (request.startAt.getTime() < addMinutes(now, config.minLeadTimeMinutes).getTime()) {
        throw badRequest('MATCHMAKING_START_TOO_SOON', `Giờ bắt đầu phải sau ít nhất ${config.minLeadTimeMinutes} phút kể từ bây giờ`);
      }
      if (1 + request.companionCount + accepted >= request.capacity) {
        throw conflict('MATCHMAKING_REQUEST_FULL', 'Bài tìm kèo phải còn ít nhất một chỗ trống khi công khai');
      }
      const publishedAt = await postContentPort.markPublished(request.postId, now, tx);
      return { id: request.id, postId: request.postId, publishedAt };
    });
  }

  async edit(actorId: number, requestId: number, patch: RecruitmentPatch) {
    const config = await matchmakingConfig.get();
    return this.withHostAndMembersLocked(requestId, actorId, async (tx, request, accepted) => {
      const now = new Date();
      this.assertEditable(request, now);
      const startChanged = patch.startAt !== undefined && new Date(patch.startAt).getTime() !== request.startAt.getTime();
      const typeChanged = patch.matchType !== undefined && patch.matchType !== request.matchType;
      const capacityChanged = patch.capacity !== undefined && patch.capacity !== request.capacity;
      // Matrix §3.12 / §24.9: start time, post type and capacity lock at the first acceptance.
      if ((startChanged || typeChanged || capacityChanged)
        && await recruitmentRepository.hasAcceptanceHistory(requestId, tx)) {
        throw conflict('MATCHMAKING_FIELD_LOCKED', 'Không thể đổi giờ bắt đầu, loại kèo hoặc số chỗ sau khi đã có thành viên');
      }
      const matchType = patch.matchType ?? request.matchType;
      const carry = !typeChanged && matchType === 'GROUP';
      const draft = await this.normalize({
        matchType,
        startAt: patch.startAt ?? request.startAt.toISOString(),
        durationMinutes: patch.durationMinutes ?? (carry ? request.durationMinutes : undefined),
        capacity: patch.capacity ?? (carry ? request.capacity : undefined),
        minPlayers: patch.minPlayers ?? (carry ? request.minPlayers : undefined),
        companionCount: patch.companionCount ?? (carry ? request.companionCount : undefined),
        minSkillLevelId: patch.minSkillLevelId ?? request.minSkillLevelId,
        maxSkillLevelId: patch.maxSkillLevelId ?? request.maxSkillLevelId,
        costNote: patch.costNote === undefined ? request.costNote : patch.costNote,
      }, { now, checkLeadTime: startChanged, config }, tx);
      // The court is changed only through PUT /:id/court (MM-28), never by PATCH.
      // Singles/Doubles keep the duration snapshot taken at creation unless the type changes.
      const durationMinutes = matchType !== 'GROUP' && !typeChanged ? request.durationMinutes : draft.durationMinutes;

      const filled = 1 + draft.companionCount + accepted;
      // Filling capacity still requires a separate host confirmation. Never exceed it.
      if (filled > draft.capacity) {
        throw badRequest('MATCHMAKING_INVALID_CAPACITY', 'Số chỗ không đủ cho thành viên hiện tại');
      }

      const start = new Date(draft.startAt);
      if (startChanged || durationMinutes !== request.durationMinutes) {
        const end = intervalEnd(start, durationMinutes);
        const members = await matchmakingRepository.findAcceptedInvitees(requestId, tx);
        for (const playerId of [request.playerId, ...members.map((m: any) => m.playerId)]) {
          if (await matchmakingRepository.hasOverlappingCommitment(playerId, start, end, requestId, tx)) {
            throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Chủ kèo hoặc thành viên đã có lịch chơi trùng với khung giờ này');
          }
        }
      }

      const update: RecruitmentFieldUpdate = {
        matchType: draft.matchType,
        startAt: start,
        durationMinutes,
        capacity: draft.capacity,
        minPlayers: draft.minPlayers,
        companionCount: draft.companionCount,
        minSkillLevelId: draft.minSkillLevelId,
        maxSkillLevelId: draft.maxSkillLevelId,
        costNote: draft.costNote,
      };
      await recruitmentRepository.updateRecruitmentFields(requestId, update, tx);
      return { id: requestId };
    });
  }

  // ------------------------------------------------------------ projection

  /**
   * Batched, tiered projection (§24.9 tiers, same decision as GET /matchmaking-requests/:id):
   * fields outside the viewer's tier are never built, then the result is cut to the tier's
   * allowlist so no extra field can leak through the shared type.
   */
  async getCardProjection(postIds: readonly number[], viewerId: number, reader?: TransactionContext) {
    const executor = reader ?? db;
    const rows = await recruitmentRepository.findCardRows(postIds, executor);
    const result = new Map<number, RecruitmentCardProjection>();
    if (rows.length === 0) return result;
    const requestIds = rows.map(row => Number(row.id));
    const [memberships, published] = await Promise.all([
      recruitmentRepository.findViewerMemberships(requestIds, viewerId, executor),
      findPublishedPostIds(rows.map(row => Number(row.post_id)), executor),
    ]);
    const tiers = new Map<number, RecruitmentProjectionAccess>();
    const relations = new Map<number, RecruitmentViewerRelation>();
    for (const row of rows) {
      const requestId = Number(row.id);
      const membership = memberships.find(m => Number(m.request_id) === requestId);
      const relation: RecruitmentViewerRelation = Number(row.player_id) === viewerId ? 'HOST' : membership?.status ?? null;
      relations.set(requestId, relation);
      const status = row.effective_status as string;
      tiers.set(requestId, recruitmentAccess(relation, published.has(Number(row.post_id)), status === 'OPEN' || status === 'MATCHED'));
    }
    // The roster is read only for requests whose tier includes it.
    const rosterIds = requestIds.filter(id => tiers.get(id) === 'FULL' || tiers.get(id) === 'PUBLIC');
    const members = await recruitmentRepository.findAcceptedMembers(rosterIds, executor);
    for (const row of rows) {
      const requestId = Number(row.id);
      const access = tiers.get(requestId)!;
      const accepted = Number(row.accepted_count);
      const companions = Number(row.companion_count);
      const capacity = Number(row.capacity);
      const filled = 1 + companions + accepted;
      const candidate: Record<string, unknown> = {
        access,
        postId: Number(row.post_id),
        requestId,
        viewerRelation: relations.get(requestId) ?? null,
      };
      if (access !== 'NONE') {
        Object.assign(candidate, {
          hostId: Number(row.player_id),
          matchType: row.match_type,
          status: row.effective_status,
          startAt: new Date(row.start_at),
          durationMinutes: Number(row.duration_minutes),
          capacity,
          minPlayers: Number(row.min_players),
          companionCount: companions,
          filledSlots: filled,
          hasOpenSlots: Boolean(row.effective_open) && filled < capacity,
          ended: Boolean(row.ended),
          skillRange: {
            min: { id: Number(row.min_skill_level_id), name: row.min_skill_name ?? null },
            max: { id: Number(row.max_skill_level_id), name: row.max_skill_name ?? null },
          },
          costNote: row.cost_note ?? null,
        });
      }
      if (access === 'FULL' || access === 'PUBLIC') {
        Object.assign(candidate, {
          acceptedCount: accepted,
          externalCourt: row.external_court_name
            ? { name: row.external_court_name, city: row.external_court_city, district: row.external_court_district, address: row.external_court_address, verified: false }
            : null,
          members: members
            .filter((m: any) => m.requestId === requestId)
            .map((m: any) => ({ playerId: m.playerId, displayName: m.displayName ?? null, avatarUrl: m.avatarUrl ?? null })),
        });
      }
      result.set(Number(row.post_id), pickFields(candidate, RECRUITMENT_PROJECTION_FIELDS[access]) as unknown as RecruitmentCardProjection);
    }
    return result;
  }

  feedFilterSql(postIdColumn: Parameters<RecruitmentPort['feedFilterSql']>[0], filter: RecruitmentFeedFilter) {
    return recruitmentRepository.feedFilter(postIdColumn, filter);
  }

  // ------------------------------------------------------- author deletion

  cancelForAuthorDeletion(postId: number, actorId: number, bookingAction: BookingAction, tx: TransactionContext) {
    return recruitmentLifecycleService.cancelForAuthorDeletion(postId, actorId, bookingAction, tx);
  }
}

export const recruitmentService = new RecruitmentService();
/** RecruitmentPort provider (MM-23 core + MM-25 author deletion), consumed by Social. */
export const recruitmentPort: RecruitmentPort = recruitmentService;
