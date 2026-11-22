import type { AnyColumn, SQL } from 'drizzle-orm';
import type { TransactionContext } from './TransactionContext';

// Matchmaking Tech Design §24.2: RecruitmentPort. Provider: Matchmaking (MM-23).
// Consumer: Social (SOC-04 canonical creation, SOC-05 feed/detail/visibility).
// Every operation takes the caller's transaction (or a read handle) and never opens,
// commits or rolls back its own transaction.

export type RecruitmentMatchType = 'SINGLES' | 'DOUBLES' | 'GROUP';

/** Recruitment part of a match-finding creation payload, as received from the client. */
export interface RecruitmentDraftInput {
  matchType: RecruitmentMatchType;
  /** ISO instant of the post start. */
  startAt: string;
  /** GROUP only (60–180, default 90). Singles/Doubles snapshot MATCHMAKING_MATCH_DURATION_MINUTES. */
  durationMinutes?: number;
  /** GROUP only (MATCHMAKING_GROUP_MIN_SLOTS…MAX_SLOTS). Singles/Doubles are fixed at 2/4. */
  capacity?: number;
  /** GROUP only (2…capacity). Singles/Doubles equal capacity. */
  minPlayers?: number;
  /** GROUP only; Singles/Doubles cannot declare companions. */
  companionCount?: number;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  costNote?: string | null;
  /**
   * Optional court at creation (MM-28). EXTERNAL is supported; BOOKING returns
   * 409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE until MM-19/BK-15.
   */
  court?: RecruitmentCourtInput | null;
}

export interface ExternalCourtInput {
  kind: 'EXTERNAL';
  name: string;
  city: string;
  district: string;
  address: string;
}

export interface BookingCourtInput {
  kind: 'BOOKING';
  bookingId: number;
  sameVenueConfirmed?: boolean;
}

export type RecruitmentCourtInput = ExternalCourtInput | BookingCourtInput;

export interface NormalizedExternalCourt {
  name: string;
  city: string;
  district: string;
  address: string;
}

/** Validated, normalized draft. Its field order is stable for the Social creation hash. */
export interface NormalizedRecruitmentDraft {
  matchType: RecruitmentMatchType;
  startAt: string;
  durationMinutes: number;
  capacity: number;
  minPlayers: number;
  companionCount: number;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  costNote: string | null;
  externalCourt: NormalizedExternalCourt | null;
}

export interface ValidateDraftOptions {
  /**
   * Default true. Social computes the immutable creation hash with `false`, so an identical
   * retry still normalizes after the lead time has passed (replay is resolved before the
   * time-dependent guards, which createForPost re-runs under the host lock).
   */
  checkLeadTime?: boolean;
}

export interface CreateForPostInput {
  postId: number;
  hostId: number;
  draft: RecruitmentDraftInput;
  /** Run the publish guards and mark the post published in the same transaction. */
  publish: boolean;
}

export interface CreatedRecruitment {
  requestId: number;
  publishedAt: Date | null;
  draft: NormalizedRecruitmentDraft;
}

export interface RecruitmentMemberCard {
  playerId: number;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Viewer relation to a recruitment, used by Social canView (Social Tech Design §7.3). */
export type RecruitmentViewerRelation = 'HOST' | 'ACCEPTED' | 'PENDING' | null;

/**
 * Detail tier (Matchmaking Tech Design §24.9), shared with GET /matchmaking-requests/:id:
 * - FULL: host or accepted member — card fields, roster and court;
 * - PUBLIC: post published (any Player who can see it) — card fields, accepted members (name,
 *   avatar, Social PRD §8.3) and court;
 * - INVITEE: pending invitee of an unpublished post — response context only, no roster or court;
 * - NONE: no access — identifiers and the (null) viewer relation only.
 * Applicants and management data are never part of the projection.
 */
export type RecruitmentProjectionAccess = 'FULL' | 'PUBLIC' | 'INVITEE' | 'NONE';

export interface RecruitmentProjectionBase {
  access: RecruitmentProjectionAccess;
  postId: number;
  requestId: number;
  viewerRelation: RecruitmentViewerRelation;
}

/** Response context: what a pending invitee needs to decide. */
export interface RecruitmentResponseContext extends RecruitmentProjectionBase {
  hostId: number;
  matchType: RecruitmentMatchType;
  /** Effective status (lazy evaluation of expiry). */
  status: string;
  startAt: Date;
  durationMinutes: number;
  capacity: number;
  minPlayers: number;
  companionCount: number;
  filledSlots: number;
  hasOpenSlots: boolean;
  /** Terminal, past start, or MATCHED whose Match is terminal. */
  ended: boolean;
  skillRange: { min: { id: number; name: string | null }; max: { id: number; name: string | null } };
  costNote: string | null;
}

export interface RecruitmentCardFields extends RecruitmentResponseContext {
  acceptedCount: number;
  externalCourt: { name: string; city: string; district: string; address: string; verified: false } | null;
  members: RecruitmentMemberCard[];
}

export type RecruitmentCardProjection =
  | (RecruitmentProjectionBase & { access: 'NONE' })
  | (RecruitmentResponseContext & { access: 'INVITEE' })
  | (RecruitmentCardFields & { access: 'PUBLIC' | 'FULL' });


/** Feed filters that apply to match-finding posts only (Social Tech Design §7.6). */
export interface RecruitmentFeedFilter {
  matchType?: RecruitmentMatchType;
  /** YYYY-MM-DD in Asia/Ho_Chi_Minh. */
  date?: string;
  /** HH:mm in Asia/Ho_Chi_Minh; local start time within [timeFrom, timeTo]. */
  timeFrom?: string;
  timeTo?: string;
  city?: string;
  district?: string;
  skillLevelId?: number;
  hasOpenSlots?: boolean;
  includeEnded: boolean;
  asOf: Date;
}

export type BookingAction = 'KEEP' | 'CANCEL';

export interface RecruitmentPort {
  /** Validates and normalizes a draft without writing (lead time against `now` unless disabled). */
  validateDraft(hostId: number, draft: RecruitmentDraftInput, reader?: TransactionContext, options?: ValidateDraftOptions): Promise<NormalizedRecruitmentDraft>;
  /**
   * Inserts the recruitment for a new, uncommitted MATCH_FINDING post (§24.7.3 "Create
   * match-finding post"). The caller must already hold the host's USERS lock (rank 10)
   * from before the post insert; validation, open-post limit and host schedule are
   * re-checked under it.
   */
  createForPost(input: CreateForPostInput, tx: TransactionContext): Promise<CreatedRecruitment>;
  /**
   * Author deletion of a match-finding post (§24.4 "Author deletes the post"; MM-25/SOC-04).
   * Called in the caller's transaction BEFORE the caller locks the post (rank 100): locks
   * users(10) → requests(30) → invitations(40) → matches(50). An active recruitment is
   * host-cancelled with AUTHOR_DELETED (`cancelled: true`, members notified); a terminal one
   * is left unchanged (`cancelled: false`). Errors: `CANCEL` on an active post →
   * 409 MATCHMAKING_BOOKING_ACTION_UNAVAILABLE (until MM-20); a started, non-terminal post →
   * 409 MATCHMAKING_REQUEST_NOT_CANCELLABLE. Throws TransactionRetryError (errors/AppError)
   * when its lock set changed while waiting; the caller rolls back and retries.
   */
  cancelForAuthorDeletion(postId: number, actorId: number, bookingAction: BookingAction, tx: TransactionContext): Promise<{ cancelled: boolean }>;
  /** Batched card projection for a page of posts; posts without recruitment are absent. */
  getCardProjection(postIds: readonly number[], viewerId: number, reader?: TransactionContext): Promise<Map<number, RecruitmentCardProjection>>;
  /** Condition over the given post id column restricting to matching match-finding posts. */
  feedFilterSql(postIdColumn: AnyColumn | SQL, filter: RecruitmentFeedFilter): SQL;
  /** Ascending play-start expression for the same post id column ("Sắp diễn ra"). */
  feedOrderSql(postIdColumn: AnyColumn | SQL): SQL;
}
