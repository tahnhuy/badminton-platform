# Tournament Management - Technical Design

## Phạm vi thay thế và trạng thái thiết kế — 2026-11-08

Giải đấu có hai loại nghiệp vụ:

| Loại | Người tham gia | Tính trình độ và thành tích |
| --- | --- | --- |
| Phong trào | Không bắt buộc có tài khoản; công cụ mô hình giải/bracket và kết quả cho danh sách người tham gia | Không tính rank, không nâng trình |
| Chuyên nghiệp | Cần gắn người tham gia với tài khoản để ghi nhận trình độ/thành tích | Là cơ sở duy nhất để nâng trình; lưu thành tích trên Social và trang cá nhân |

Phân loại này khác với thể thức đơn/đôi hoặc loại bracket. Các quy tắc cũ bắt buộc mọi người tham gia đều là Player có tài khoản chỉ còn áp dụng cho giải chuyên nghiệp; không áp lên người tham gia phong trào. Không suy ra người tổ chức được miễn đăng nhập/quyền Organizer từ việc người tham gia không cần tài khoản.

Quyết định G0 ngày 2026-11-15:

- Giải phong trào: Organizer nhập thủ công hoặc import Excel; không tạo tài khoản giả và không gắn vào lịch sử Player. Organizer chọn free/paid; paid dùng payment pipeline hiện có. Hiển thị summary công khai; ẩn SĐT/ghi chú liên hệ.
- Giải chuyên nghiệp: Player đã đăng nhập + trong thời gian đăng ký + còn slot.
- Xác nhận thành tích, quyền xác nhận và công thức/ngưỡng nâng trình: **TBD**, defer cho đồng đội; revert tự động khi sửa/hủy kết quả đã nâng trình.

Không tự tạo tài khoản giả hoặc gắn người không tài khoản vào lịch sử Player.

Quyết định nghiệp vụ mới: **không dùng rating để nâng trình; chỉ việc tham gia giải chuyên nghiệp mới là cơ sở nâng trình**. Trận giao lưu, kèo đơn/đôi thông thường và giải phong trào không nâng trình. Khảo sát ban đầu vẫn là tự đánh giá ban đầu, không phải nâng trình hay chứng nhận.

Các quy tắc tự hiệu chỉnh từ điểm rating, cửa sổ trận, ngưỡng điểm và cooldown trong tài liệu cũ được thay thế. Điều kiện tham gia chuyên nghiệp và revert khi sửa/hủy kết quả đã chốt ngày 2026-11-15; xác nhận kết quả/thành tích và công thức/ngưỡng nâng trình vẫn **TBD** và được defer. Không mặc định cứ đăng ký/tham gia một giải là tăng một bậc. Giữ đánh giá kỹ năng và thái độ sau trận để tham khảo/hiển thị; cả hai loại điểm đều không được dùng để nâng trình.

Nội dung cũ trái với mục này là thiết kế legacy. Quyết định nghiệp vụ do người dùng xác nhận ngày 2026-11-08; G0 ngày 2026-11-15 đã chốt participant/fee/privacy/eligibility/revert. Công thức nâng trình và xác nhận thành tích vẫn **TBD**, chưa triển khai trong phạm vi release hiện tại.

---

## Status and Ownership

```text
Status: Ready
Owner: Tech Lead hiện tại
Related PRD: docs/features/tournament/prd.md
```

## 1. Architecture & Module Boundaries

The Tournament Management feature follows the global PERN stack architecture using the standard Controller-Service-Repository pattern. 

**Module Dependencies:**
- **TournamentModule**: Core module handling tournaments, registrations, and brackets.
- **MatchModule**: External dependency for creating base `MATCHES` entities when the bracket is generated and resolving them.
- **UserModule**: To resolve player profiles and enforce authentication.
- **PaymentModule**: Handles entry fee processing and webhook callbacks (to transition registration to `CONFIRMED`).

Cross-module interfaces are declared in `backend/src/contracts/`: `MatchModule.ts` (MatchModule), `PaymentService.ts` and `BookingService.ts` (PaymentModule), `NotificationService.ts`, `CourtService.ts`, and `PlayerProfileService.ts`.

## 2. State Flow

### 2.1 Tournament Lifecycle
Governed by `TOURNAMENTS.status` and `version` for optimistic concurrency.
- `DRAFT`: Initial state. Fully editable, including `entry_fee`.
- `OPEN_FOR_REGISTRATION`: Triggered by Organizer. Limited editing. `entry_fee` is locked once any registration is `CONFIRMED`.
- `REGISTRATION_CLOSED`: Triggered by Organizer. Registrations locked.
- `READY`: Triggered by Organizer upon successful bracket generation.
- `IN_PROGRESS`: Triggered when the Organizer starts the first match (`POST /api/v1/tournaments/:id/matches/:match_id/start`).
- `COMPLETED`: Triggered by Organizer via the status endpoint when the final match is resolved.
- `CANCELLED`: Terminal state. Reachable from `DRAFT`, `OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `READY` (by Organizer). Admins can transition to `CANCELLED` from any state.

### 2.2 Registration Lifecycle
Governed by `TOURNAMENT_REGISTRATIONS.status`.
- `PENDING_PAYMENT`: Initial state upon user submitting registration (if fee > 0). `expires_at` is snapshotted from `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`.
- `CONFIRMED`: Reached upon successful payment, or immediately if fee = 0.
- `CANCELLED`: Reached if the Player withdraws during the open period.
- `EXPIRED`: Reached if the payment timeout elapses while `PENDING_PAYMENT`.

### 2.3 Bracket Match Lifecycle
Governed by `TOURNAMENT_MATCHES.resolution` and `MATCHES.status`/`MATCH_GAMES`.
- `UNRESOLVED`: Initial state for all generated matches.
- `NONE`: Cancelled / no valid result. No automatic advancement.
- `WALKOVER`: Opponent no-show.
- `WINNER_DECLARED`: Standard completion, derived from the underlying Match Games.

## 3. API Design

RESTful endpoints namespaced under `/api/v1/tournaments`.

### 3.1 Tournament Core
- `POST /api/v1/tournaments` - Create Draft (Auth: Player). Configurable fields include `format`, `match_type`, `participant_limit`, `entry_fee` (>= 0), `facility_id` (nullable), `venue_note` (nullable), and the registration/tournament time window.
- `GET /api/v1/tournaments` - List with filtering (Auth: None/Public). Supported query parameters: `status`, `match_type`, `search`, `page`, `limit`.
- `GET /api/v1/tournaments/:id` - Details (Auth: None/Public)
- `PUT /api/v1/tournaments/:id` - Update info (Auth: Organizer). Editable fields depend on lifecycle state; `entry_fee` is locked once a registration is `CONFIRMED`.
- `POST /api/v1/tournaments/:id/status` - Transition state (`OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `COMPLETED`) (Auth: Organizer)
- `POST /api/v1/tournaments/:id/cancel` - Cancel tournament (Auth: Organizer/Admin)

### 3.2 Registration & Teams
- `POST /api/v1/tournaments/:id/registrations` - Register for Singles or Doubles (Auth: Player). Payload includes `type` and optional `team_id`. Creates `PENDING_PAYMENT` with a snapshotted `expires_at` when `entry_fee > 0`, or `CONFIRMED` when free.
- `GET /api/v1/tournaments/:id/registrations` - List participants.
- `POST /api/v1/tournaments/:id/registrations/:registration_id/cancel` - Withdraw before registration closes (Auth: owning Player for Singles, Team captain for Doubles). A paid `CONFIRMED` registration triggers a full refund.
- `POST /api/v1/registrations/:registration_id/payment` - Create or reuse the VNPAY payment URL for a `PENDING_PAYMENT` registration (Auth: owning Player for Singles, Team captain for Doubles).

### 3.3 Bracket Management
- `GET /api/v1/tournaments/:id/bracket/seeds` - Returns the confirmed registrations with the system's skill-based seed suggestion (Auth: Organizer).
- `PUT /api/v1/tournaments/:id/bracket/seeds` - Sets the Organizer's seed order before the draw. Payload: `{ seeds: [{ registrationId, seedNo }] }`; omitted registrations remain unseeded. Only allowed while the tournament is `REGISTRATION_CLOSED`/`READY` and before the bracket is generated (Auth: Organizer).
- `POST /api/v1/tournaments/:id/bracket/generate` - Triggers the draw and generates `TOURNAMENT_MATCHES`: seeded registrations are placed by seed, unseeded registrations are randomized, and BYEs are placed with priority to high seeds (Auth: Organizer).
- `GET /api/v1/tournaments/:id/bracket` - Returns the tree structure.
- `PUT /api/v1/tournaments/:id/matches/:match_id/schedule` - Assigns the Court and scheduled time before the match starts (Auth: Organizer). Creates a system-created, non-payment booking for the Court/time so the Booking no-overlap rule protects the slot; re-scheduling after the match starts is rejected.
- `PUT /api/v1/tournaments/:id/matches/:match_id/games` - Records game scores in `MATCH_GAMES` (Auth: Organizer); the winner is derived from these games.
- `POST /api/v1/tournaments/:id/matches/:match_id/start` - Starts the match; the first started match moves the Tournament to `IN_PROGRESS` (Auth: Organizer).
- `PUT /api/v1/tournaments/:id/matches/:match_id/result` - Updates the match resolution and advances the winner (Auth: Organizer). Payload: `{ resolution }`; `WINNER_DECLARED` is derived from and validated against the underlying Match Games, while `WALKOVER`/`NONE` are set explicitly.

### 3.4 API Contract
- Namespace: `/api/v1/tournaments`.
- Successful responses use JSON `{ data: ... }`. Collection responses include the global pagination object `{ data: [...], meta: { page, limit, total, totalPages } }` when pagination is used.
- Create operations return `201`; reads, updates, and commands return `200`.
- Expected errors use `400`, `401`, `403`, `404`, or `409` according to the failure cause and the global JSON shape: `{ error: { code, message, details } }`.
- Payment callbacks use `POST /api/v1/payments/vnpay/webhook`; the endpoint validates the VNPAY signature and returns `200` for an already-processed callback.
- Unread notifications use `GET /api/v1/notifications/unread` and return `{ data: [...] }` using the same error contract.
- Responses do not expose SQL, provider responses, secrets, or internal implementation details.
- Decision: Chosen by the Tech Lead on 2026-09-13. Rationale: provides an explicit stable REST contract while following the global API conventions.

### 3.5 Feature Error Codes
Feature-specific codes follow the global error shape and `conventions.md`. Request-shape failures use the global `VALIDATION_FAILED`.

| Code | HTTP | Use |
| --- | --- | --- |
| `TOURNAMENT_NOT_FOUND` | 404 | Tournament id does not exist or is not visible. |
| `TOURNAMENT_FORBIDDEN_ORGANIZER` | 403 | The authenticated user is not the Organizer or an Admin. |
| `TOURNAMENT_NOT_EDITABLE` | 409 | Update attempted in a lifecycle state that locks the field. |
| `TOURNAMENT_ENTRY_FEE_LOCKED` | 409 | `entry_fee` change attempted after a registration is `CONFIRMED`. |
| `TOURNAMENT_INVALID_TRANSITION` | 409 | Requested status transition is not allowed. |
| `TOURNAMENT_REGISTRATION_CLOSED` | 409 | Registration or Team/invitation action attempted outside the open period/state. |
| `TOURNAMENT_ALREADY_REGISTERED` | 409 | Duplicate Singles player or Doubles team registration. |
| `TOURNAMENT_PARTICIPANT_LIMIT_REACHED` | 409 | The competitive registration limit is reached. |
| `TOURNAMENT_REGISTRATION_NOT_CANCELLABLE` | 409 | Withdrawal attempted after registration closes or by a non-owner. |
| `TOURNAMENT_TEAM_INVALID` | 409 | Doubles team is not exactly 2 members, is not accepted, or requester is not captain. |
| `TOURNAMENT_MIN_PARTICIPANTS_NOT_MET` | 409 | Bracket generation attempted with fewer than 2 registrations. |
| `TOURNAMENT_BRACKET_ALREADY_GENERATED` | 409 | Bracket generation or seed update attempted after the draw. |
| `TOURNAMENT_SEED_INVALID` | 400 | Seed order is invalid (duplicate seed number, non-confirmed registration, or out-of-range). |
| `TOURNAMENT_MATCH_NOT_FOUND` | 404 | Tournament match id does not belong to the tournament. |
| `TOURNAMENT_MATCH_ALREADY_RESOLVED` | 409 | Result/start attempted on an already resolved match. |
| `TOURNAMENT_MATCH_RESULT_INVALID` | 409 | Winner cannot be derived from the underlying Match Games. |
| `TOURNAMENT_MATCH_SCHEDULE_LOCKED` | 409 | Schedule change attempted after the match starts. |
| `TOURNAMENT_COURT_UNAVAILABLE` | 409 | The Court/time is not bookable or overlaps an active booking, so the system booking cannot be created. |
| `TOURNAMENT_PAYMENT_NOT_PENDING` | 409 | Payment requested for a registration that is not `PENDING_PAYMENT`. |
| `TOURNAMENT_TEAM_NOT_FOUND` | 404 | Team id does not exist in the tournament. |
| `TOURNAMENT_TEAM_CAPTAIN_REQUIRED` | 403 | The caller is not the captain of the referenced team. |
| `TOURNAMENT_TEAM_ALREADY_FULL` | 409 | A member or invitation is added to a team that already has 2 members. |
| `TOURNAMENT_TEAM_ALREADY_REGISTERED` | 409 | Membership change attempted after the team is registered. |
| `TOURNAMENT_INVITATION_NOT_FOUND` | 404 | Invitation id does not exist. |
| `TOURNAMENT_INVITATION_NOT_PENDING` | 409 | Accept/decline/cancel attempted on a non-pending invitation. |
| `TOURNAMENT_INVITEE_INELIGIBLE` | 409 | Invitee is the captain, is not a Player, or already belongs to a Doubles Team in the tournament. |

### 3.6 Team & Invitation
Doubles Team formation is part of this feature (tables `TOURNAMENT_TEAMS`, `TOURNAMENT_TEAM_PLAYERS`, `TEAM_INVITATIONS`).

- `POST /api/v1/tournaments/:id/teams` - Create a Doubles Team; the creator becomes captain and first member (Auth: Player).
- `GET /api/v1/tournaments/:id/teams/:team_id` - Team detail with members (Auth: public read, same visibility as tournament detail).
- `POST /api/v1/tournaments/:id/teams/:team_id/invitations` - Captain invites exactly one Player (Auth: captain).
- `POST /api/v1/invitations/:invitation_id/accept` - Invitee accepts (Auth: invitee).
- `POST /api/v1/invitations/:invitation_id/decline` - Invitee declines (Auth: invitee).
- `POST /api/v1/invitations/:invitation_id/cancel` - Captain cancels a pending invitation (Auth: captain).
- `GET /api/v1/me/invitations` - List the caller's pending invitations.

Invitation lifecycle (`TEAM_INVITATIONS.status`): `PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`.

Team rules:
- A Team has exactly 2 members before registration; the captain must be a member.
- A Player may belong to at most one Doubles Team in the same Tournament.
- The invitee must be an eligible Player, must not be the captain, and must not already belong to a Doubles Team in the same Tournament.
- `expires_at` is snapshotted from `TEAM_INVITATION_TIMEOUT_MINUTES`; later configuration changes do not alter an existing pending invitation.
- Team membership is locked once the team is registered; changes after that are rejected.
- Team and invitation actions are available only while the Tournament is `OPEN_FOR_REGISTRATION`.
- When the Tournament becomes `REGISTRATION_CLOSED` or is `CANCELLED`, remaining `PENDING` invitations transition to `CANCELLED` automatically in the same transaction as the status change.

## 4. Data/Schema Impact

This feature requires the tournament schema deltas described in §4.1. They are
recorded in the authoritative `docs/architecture/database-schema.md` and must be
applied through ordered migrations before implementation.

**Key Tables Utilized:**
- `TOURNAMENTS`: Core entity, including `entry_fee`, `facility_id`, and `venue_note`.
- `TOURNAMENT_REGISTRATIONS`: Tracks participants (Singles/Doubles), status lifecycle, and payment `expires_at`.
- `TOURNAMENT_MATCHES`: Tree structure. Self-referencing via `next_match_id`.
- `MATCHES`: Backing entity for time/location of the game; `court_id` may be unassigned until the match is scheduled.
- `PAYMENTS`: Tracks booking payments through `booking_id` and tournament entry fees through nullable `registration_id`.

### 4.1 Migration Decision
- Make `PAYMENTS.booking_id` nullable and add nullable `PAYMENTS.registration_id` as a foreign key to `TOURNAMENT_REGISTRATIONS`.
- Enforce that a payment references exactly one of `booking_id`/`registration_id` with a CHECK constraint.
- Add `TOURNAMENTS.entry_fee` (`NOT NULL DEFAULT 0`, `CHECK >= 0`), `TOURNAMENTS.facility_id`, and `TOURNAMENTS.venue_note`.
- Add `TOURNAMENT_REGISTRATIONS.expires_at` for the payment timeout snapshot.
- Allow `MATCHES.court_id` to be nullable so a tournament match can be scheduled after bracket generation.
- Tournament match scheduling creates a system-created, non-payment `BOOKINGS` row linked through `MATCHES.booking_id` (the existing one-to-zero/one relationship, `database-schema.md` §3.13/§5.9). The booking uses the standard pricing snapshot and overlap protection but is not paid and is not Player-cancellable; cancellation of the tournament match releases the booking.
- Add the required indexes and constraints in ordered migrations.
- Decision: Chosen by the Tech Lead on 2026-09-13; the tournament field additions were approved by the human owner on 2026-09-25. Rationale: preserves existing booking payment data while giving tournament payments an explicit relational link and completing the tournament schema.

## 5. Security & Authorization

- **Authentication**: Required for all mutations. Authentication follows `docs/architecture/tech-stack.md` and `docs/features/platform/authentication-authorization/tech-design.md`; this feature does not define its own authentication mechanism.
- **Contextual Organizer**: Verified by checking `TOURNAMENTS.creator_id == req.user.id`.
- **Admin Override**: Verified by `req.user.role == 'ADMIN'`. Admins bypass the `creator_id` check for cancellation.
- **Registration Integrity**: For Doubles, the system verifies that the `team_id` has exactly 2 members and the requesting user is the captain.
- **Team/Invitation Ownership**: only a Team captain may invite or cancel invitations; only the invited Player may accept or decline. Membership and invitation mutations are rejected once the Team is registered.

## 6. Validation Rules

- **Entry Fee**: `entry_fee` must be a non-negative amount; `0` means the tournament is free. It may be changed while `DRAFT` and is locked once a registration is `CONFIRMED`.
- **Registration Payment**: When `entry_fee > 0`, registration is created as `PENDING_PAYMENT` with `expires_at = now + TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`; when `entry_fee = 0`, it is created directly as `CONFIRMED` with `expires_at = NULL`.
- **Bracket Size Constraint**: The number of registrations `N` determines bracket size `S = 2^ceil(log2(N))`.
- **BYE Calculation**: `BYEs = S - N`.
- **Minimum Participants**: `N >= 2`. If `N < 2` at registration close, bracket generation fails, and the tournament must be `CANCELLED`.
- **Seeding Algorithm** (Per PRD; Organizer-controlled draw):
  1. Start from the Organizer's stored seed order when present.
  2. For registrations without an Organizer seed, suggest an order by skill ranking (high to low), randomizing ties/unranked.
  3. On draw, place seeded registrations by seed; randomize all remaining unseeded registrations.
  4. Distribute top seeds to opposite ends of the bracket tree.
  5. Assign BYEs to the highest seeds first.
  6. After the draw, the bracket and seed are locked; seed updates are rejected.
- **Advancement Logic**: Updating a match result with `WINNER_DECLARED` or `WALKOVER` copies the `winner_registration_id` into the `registration1_id` or `registration2_id` of the row identified by `next_match_id`.

## 7. Concurrency & Idempotency

- **Bracket Generation**: Generating `S - 1` matches requires a single atomic PostgreSQL transaction. If it fails, rollback completely.
- **State Transitions**: The `TOURNAMENTS.version` column must be used for Optimistic Concurrency Control. `UPDATE tournaments SET status = $1, version = version + 1 WHERE id = $2 AND version = $3`.
- **Payment Callbacks**: Webhooks for registration payments must be idempotent. If the registration is already `CONFIRMED`, return `200 OK` without processing again. A late payment for an `EXPIRED` registration must not reopen it; if the provider charged the Player, a refund is required.
- **Registration Withdrawal**: Withdrawing a `CONFIRMED` registration and triggering its refund must be atomic and idempotent; repeated withdrawal requests must not issue a second refund.

## 8. Failure Handling & Edge Cases

- **Prime/Odd Registrations**: Mathematically handled by BYEs. A valid power of 2 tree is always strictly maintained.
- **Organizer Deactivation**: Tournament remains active. Admin can cancel it via the portal.
- **Payment Timeout**: Registrations stuck in `PENDING_PAYMENT` beyond the snapshotted `expires_at` (`TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`) are marked `EXPIRED`.
- **Player Withdrawal**: A Player who withdraws a paid `CONFIRMED` registration before registration closes receives a full refund; after registration closes, withdrawal is rejected.
- **Cancelled Tournament Match**: If an Organizer sets a match to `NONE` (Cancelled), the system will **not** automatically advance anyone. The `next_match_id` slot remains empty (null). The Organizer must resolve it manually.

## 9. Performance

- **Bracket Retrieval**: Fetching a bracket involves loading all `TOURNAMENT_MATCHES` for a `tournament_id`. Since max participants are realistically bounded (e.g., 64, 128), a simple `SELECT * FROM tournament_matches WHERE tournament_id = $1` is highly efficient. The tree is built in-memory on the backend or frontend.
- **Indexes**: The existing schema provides FK indexes which are sufficient for MVP performance.

## 10. Events & Background Jobs

- **Registration Expiry**: A custom cron poller runs every minute and sweeps `PENDING_PAYMENT` registrations that exceed the timeout. Database locking claims work before processing so multiple application instances cannot process the same registration concurrently.
- **Team Invitation Expiry**: The same custom cron poller runs every minute to expire `PENDING` team invitations after `TEAM_INVITATION_TIMEOUT_MINUTES` (24h). Claiming and processing are idempotent.
- **Refund Processing**: When an Admin/Organizer cancels a paid tournament, an event `TournamentCancelled` is emitted. A background worker picks this up to initiate 100% refunds for all paid registrations via the Payment Provider API. When a Player withdraws a paid `CONFIRMED` registration, a `RegistrationWithdrawn` event is emitted and processed idempotently by the same worker.
- Decision: Custom cron polling, every minute with database locking, chosen by the Tech Lead on 2026-09-13. Rationale: meets MVP scheduling needs without adding a queue dependency or separate infrastructure, while database locking preserves cross-request correctness.

### 10.1 Notifications
- Tournament cancellation and relevant tournament updates are persisted in `NOTIFICATIONS`.
- Clients poll an unread-notifications endpoint every 30 seconds.
- Decision: Database persistence plus polling, chosen by the Tech Lead on 2026-09-13. Rationale: reuses the existing schema and avoids introducing realtime infrastructure for this feature.

## 11. Testing Strategy

- **Unit Tests**: 
  - Bracket generation pure functions (Tree building, BYE placement, Seed distribution).
  - State machine transitions.
- **Integration Tests**: 
  - Transactional bracket generation against PostgreSQL.
  - Registration flows (Singles vs Doubles limits).
  - Admin override cancellation vs Organizer cancellation.

## 12. External Technical Decisions

- **Payment Provider API**: VNPAY is used for tournament entry fees and refunds. The PaymentModule adapter sends the registration/payment reference and amount, validates the VNPAY callback signature, maps the provider transaction to the local payment, and processes callbacks idempotently. Provider-specific credentials remain configuration, never source code.
- **`REFUND_PROCESSING_TIMEOUT_MINUTES`**: `1440` minutes. Refund processing is timed out after 24 hours and remains observable for retry/manual operational handling.
- Decision: Chosen by the Tech Lead on 2026-09-13. Rationale: VNPAY is appropriate for the Vietnamese MVP market; a 24-hour refund timeout provides an operational window without leaving refunds unbounded.

Global technical decisions outside this feature are governed by the relevant
architecture documents and are not feature-level dependencies.

## Shared Match core readiness alignment — approved 2026-10-10

Status: Ready (Human owner). MatchModule is the single writer of MATCHES and
MATCH_PLAYERS, accepting the caller-owned transaction. Tournament writes only
its own links. At bracket creation, known participants are inserted through
createMatchWithPlayers; unresolved future slots are not represented by fabricated
Player rows. On progression, populate the next Match's actual participants through
MatchModule, from registrations/team members with team_no 1/2, before play/result.
Retain completed-match participants for Ratings. Matchmaking list/detail/leave,
booking linkage and scheduler scope exclusively through MATCHMAKING_MATCHES;
Tournament start/result lifecycle remains organizer-driven. When scheduling known
participants, use the shared ascending Player locks and reject overlap against
casual request/partial-group and Match reservations; interval comes from the
scheduled tournament booking, never current matchmaking duration config.

## Ratings integration alignment — approved 2026-10-15

Completed Tournament Matches are ratable only when actually played with valid standard result (`WINNER_DECLARED`) and `TOURNAMENT_RATING_ENABLED` permits it. `WALKOVER`, `UNRESOLVED` and `NONE` are not ratable. Preserve actual completed-match participants for Ratings. Rating eligibility does not depend solely on Tournament completion or populated participant rows.

Ratings RT-05 integrates the reusable ratings component into the real participant-facing Tournament Match Detail (P32), using the underlying Match ID for Ratings APIs, not the bracket-link ID. Keep Tournament and casual host routes separate; do not widen casual Matchmaking endpoints. Implement the Tournament host in its own feature scope; its absence is an explicit RT-05 dependency. Ratings owns error/response contracts and UI behavior: see Ratings PRD §15, Tech Design §9 and §23, tasks RT-05. These additions do not authorize implementing unrelated Tournament work as part of Ratings.

Court Owner integration, 2026-10-23: scheduling a system booking uses BookingModule’s shared creation primitive with facility-row then court-date advisory lock, active maintenance-block check and effective opening-hours/parent eligibility check (Booking Tech Design §7.2.1). Owner reads show tournament/match context rather than a paid Player booking; Owner cancellation returns OWNER_TOURNAMENT_BOOKING_NOT_CANCELLABLE. Organizer handles linked-match changes through Tournament; do not directly mutate the system booking from Owner or fabricate a refund.
