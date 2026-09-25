# Tournament Management - Technical Design

## Status and Ownership

```text
Status: Ready
Owner: Tech Lead hiện tại
Related PRD: docs/features/admin/tournament-management/prd.md
```

## 1. Architecture & Module Boundaries

The Tournament Management feature follows the global PERN stack architecture using the standard Controller-Service-Repository pattern. 

**Module Dependencies:**
- **TournamentModule**: Core module handling tournaments, registrations, and brackets.
- **MatchModule**: External dependency for creating base `MATCHES` entities when the bracket is generated and resolving them.
- **UserModule**: To resolve player profiles and enforce authentication.
- **PaymentModule**: Handles entry fee processing and webhook callbacks (to transition registration to `CONFIRMED`).

## 2. State Flow

### 2.1 Tournament Lifecycle
Governed by `TOURNAMENTS.status` and `version` for optimistic concurrency.
- `DRAFT`: Initial state. Fully editable.
- `OPEN_FOR_REGISTRATION`: Triggered by Organizer. Limited editing.
- `REGISTRATION_CLOSED`: Triggered by Organizer. Registrations locked.
- `READY`: Triggered by Organizer upon successful bracket generation.
- `IN_PROGRESS`: Triggered automatically when the first match starts.
- `COMPLETED`: Triggered by Organizer when the final match is resolved.
- `CANCELLED`: Terminal state. Reachable from `DRAFT`, `OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `READY` (by Organizer). Admins can transition to `CANCELLED` from any state.

### 2.2 Registration Lifecycle
Governed by `TOURNAMENT_REGISTRATIONS.status`.
- `PENDING_PAYMENT`: Initial state upon user submitting registration (if fee > 0).
- `CONFIRMED`: Reached upon successful payment or immediately if fee = 0.
- `CANCELLED`: Reached if payment timeouts or if Player withdraws during the open period.

### 2.3 Bracket Match Lifecycle
Governed by `TOURNAMENT_MATCHES.resolution`.
- `UNRESOLVED`: Initial state for all generated matches.
- `NONE`: No valid result (e.g., both disqualified).
- `WALKOVER`: Opponent no-show.
- `WINNER_DECLARED`: Standard completion.

## 3. API Design

RESTful endpoints namespaced under `/api/v1/tournaments`.

### 3.1 Tournament Core
- `POST /api/v1/tournaments` - Create Draft (Auth: Player)
- `GET /api/v1/tournaments` - List with filtering (Auth: None/Public)
- `GET /api/v1/tournaments/:id` - Details (Auth: None/Public)
- `PUT /api/v1/tournaments/:id` - Update info (Auth: Organizer)
- `POST /api/v1/tournaments/:id/status` - Transition state (`OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `COMPLETED`) (Auth: Organizer)
- `POST /api/v1/tournaments/:id/cancel` - Cancel tournament (Auth: Organizer/Admin)

### 3.2 Registration & Teams
- `POST /api/v1/tournaments/:id/registrations` - Register for Singles or Doubles (Auth: Player). Payload includes `type` and optional `team_id`.
- `GET /api/v1/tournaments/:id/registrations` - List participants.

*(Note: Doubles Team creation and invitations are handled by the generic `TeamModule` endpoints, but `TournamentModule` verifies them during registration).*

### 3.3 Bracket Management
- `POST /api/v1/tournaments/:id/bracket/generate` - Generates `TOURNAMENT_MATCHES` (Auth: Organizer).
- `GET /api/v1/tournaments/:id/bracket` - Returns the tree structure.
- `PUT /api/v1/tournaments/:id/matches/:match_id/result` - Update match result and advance winner (Auth: Organizer). Payload: `{ resolution }`; the winner is derived from and validated against the underlying Match result.

### 3.4 API Contract
- Namespace: `/api/v1/tournaments`.
- Successful responses use JSON `{ data: ... }`. Collection responses may include `{ data: [...], pagination: ... }` when pagination is used.
- Create operations return `201`; reads, updates, and commands return `200`.
- Expected errors use `400`, `401`, `403`, `404`, or `409` according to the failure cause and the global JSON shape: `{ error: { code, message, details } }`.
- Payment callbacks use `POST /api/v1/payments/vnpay/webhook`; the endpoint validates the VNPAY signature and returns `200` for an already-processed callback.
- Unread notifications use `GET /api/v1/notifications/unread` and return `{ data: [...] }` using the same error contract.
- Responses do not expose SQL, provider responses, secrets, or internal implementation details.
- Decision: Chosen by the Tech Lead on 2026-09-13. Rationale: provides an explicit stable REST contract while following the global API conventions.

## 4. Data/Schema Impact

This feature requires a schema delta for tournament entry-fee payments. The delta
must be applied through an ordered migration and reflected in the authoritative
`docs/architecture/database-schema.md` before implementation.

**Key Tables Utilized:**
- `TOURNAMENTS`: Core entity.
- `TOURNAMENT_REGISTRATIONS`: Tracks participants (Singles/Doubles).
- `TOURNAMENT_MATCHES`: Tree structure. Self-referencing via `next_match_id`.
- `MATCHES`: Backing entity for time/location of the game.
- `PAYMENTS`: Tracks booking payments through `booking_id` and tournament entry fees through nullable `registration_id`.

### 4.1 Migration Decision
- Add nullable `PAYMENTS.registration_id` as a foreign key to `TOURNAMENT_REGISTRATIONS`.
- Keep `PAYMENTS.booking_id` for booking payments; each payment belongs to the applicable payment domain.
- Add the required index and nullability/domain constraints in the migration so a payment is linked to its applicable booking or tournament registration.
- Decision: Chosen by the Tech Lead on 2026-09-13. Rationale: preserves existing booking payment data while giving tournament payments an explicit relational link.

## 5. Security & Authorization

- **Authentication**: Required for all mutations. JWT-based authentication follows the current documented direction; detailed authentication implementation remains an external platform decision.
- **Contextual Organizer**: Verified by checking `TOURNAMENTS.creator_id == req.user.id`.
- **Admin Override**: Verified by `req.user.role == 'ADMIN'`. Admins bypass the `creator_id` check for cancellation.
- **Registration Integrity**: For Doubles, the system verifies that the `team_id` has exactly 2 members and the requesting user is the captain.

## 6. Validation Rules

- **Bracket Size Constraint**: The number of registrations `N` determines bracket size `S = 2^ceil(log2(N))`.
- **BYE Calculation**: `BYEs = S - N`.
- **Minimum Participants**: `N >= 2`. If `N < 2` at registration close, bracket generation fails, and the tournament must be `CANCELLED`.
- **Seeding Algorithm** (Per PRD): 
  1. Retrieve skill rankings for `CONFIRMED` registrations.
  2. Sort registrations by skill (high to low). Randomize ties/unranked.
  3. Distribute top seeds to opposite ends of the bracket tree.
  4. Assign BYEs to the highest seeds first.
- **Advancement Logic**: Updating a match result with `WINNER_DECLARED` or `WALKOVER` copies the `winner_registration_id` into the `registration1_id` or `registration2_id` of the row identified by `next_match_id`.

## 7. Concurrency & Idempotency

- **Bracket Generation**: Generating `S - 1` matches requires a single atomic PostgreSQL transaction. If it fails, rollback completely.
- **State Transitions**: The `TOURNAMENTS.version` column must be used for Optimistic Concurrency Control. `UPDATE tournaments SET status = $1, version = version + 1 WHERE id = $2 AND version = $3`.
- **Payment Callbacks**: Webhooks for registration payments must be idempotent. If the registration is already `CONFIRMED`, return `200 OK` without processing again.

## 8. Failure Handling & Edge Cases

- **Prime/Odd Registrations**: Mathematically handled by BYEs. A valid power of 2 tree is always strictly maintained.
- **Organizer Deactivation**: Tournament remains active. Admin can cancel it via the portal.
- **Payment Timeout**: Registrations stuck in `PENDING_PAYMENT` beyond the timeout will be marked `EXPIRED`/`CANCELLED`.
- **Cancelled Tournament Match**: If an Organizer sets a match to `NONE` (Cancelled), the system will **not** automatically advance anyone. The `next_match_id` slot remains empty (null). The Organizer must resolve it manually.

## 9. Performance

- **Bracket Retrieval**: Fetching a bracket involves loading all `TOURNAMENT_MATCHES` for a `tournament_id`. Since max participants are realistically bounded (e.g., 64, 128), a simple `SELECT * FROM tournament_matches WHERE tournament_id = $1` is highly efficient. The tree is built in-memory on the backend or frontend.
- **Indexes**: The existing schema provides FK indexes which are sufficient for MVP performance.

## 10. Events & Background Jobs

- **Registration Expiry**: A custom cron poller runs every minute and sweeps `PENDING_PAYMENT` registrations that exceed the timeout. Database locking claims work before processing so multiple application instances cannot process the same registration concurrently.
- **Team Invitation Expiry**: The same custom cron poller runs every minute to expire `PENDING` team invitations after `TEAM_INVITATION_TIMEOUT_MINUTES` (24h). Claiming and processing are idempotent.
- **Refund Processing**: When an Admin/Organizer cancels a paid tournament, an event `TournamentCancelled` is emitted. A background worker picks this up to initiate 100% refunds for all paid registrations via the Payment Provider API.
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
