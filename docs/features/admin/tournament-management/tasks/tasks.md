# Tournament Management - Task Breakdown

**Status:** Approved for Implementation  
**Feature:** Tournament Management  
**References:** 
- `docs/features/admin/tournament-management/prd.md`
- `docs/features/admin/tournament-management/tech-design.md`

---

## Task 1: Database Schema Migration for Payments
**Task ID:** `TRN-01`
**Title:** Implement database migration for Tournament Entry Fee Payments
**Status:** Approved
**Objective:** Add relational link in the `PAYMENTS` table to support tournament entry fees.
**Scope:** Migration script only.
**Implementation requirements:**
- Create a new migration script adding a nullable `registration_id` column to `PAYMENTS`.
- Add a foreign key constraint linking `PAYMENTS.registration_id` to `TOURNAMENT_REGISTRATIONS.id`.
- Ensure `booking_id` remains intact for booking payments.
- Add necessary indexes for `registration_id`.
**Dependencies:** None.
**Files/areas affected:** 
- `backend/migrations/`
- `docs/architecture/database-schema.md` (Update required to reflect the applied delta).
**API impact:** None.
**Schema/config impact:** `PAYMENTS` table schema updated.
**Testing requirements:** Verify migration UP and DOWN scripts run successfully.
**Acceptance criteria:** Migration runs without data loss; new `registration_id` column exists with correct FK constraints.

---

## Task 2: Tournament Core CRUD & Lifecycle API
**Task ID:** `TRN-02`
**Title:** Implement Tournament CRUD and State Transitions
**Status:** Approved
**Objective:** Provide backend APIs for creating, viewing, updating, cancelling, and changing the state of tournaments.
**Scope:** Backend APIs for `TOURNAMENTS` table.
**Implementation requirements:**
- Implement `POST /api/v1/tournaments` (Create Draft).
- Implement `GET /api/v1/tournaments` (List with filters) and `GET /api/v1/tournaments/:id`.
- Implement `PUT /api/v1/tournaments/:id` (Update info, allowed only in Draft/Open).
- Implement `POST /api/v1/tournaments/:id/status` for transitioning to `OPEN_FOR_REGISTRATION`, `REGISTRATION_CLOSED`, `COMPLETED`.
- Implement `POST /api/v1/tournaments/:id/cancel` (Organizer can cancel before IN_PROGRESS, Admin can cancel anytime).
- Enforce Optimistic Concurrency Control using `TOURNAMENTS.version`.
**Dependencies:** None.
**Files/areas affected:** 
- `backend/src/modules/tournaments/` (Controllers, Services, Repositories).
**API impact:**
- New endpoints as specified in Tech Design Section 3.1.
**Schema/config impact:** Uses existing `TOURNAMENTS` schema.
**Testing requirements:** Unit tests for state transitions; Integration tests for Organizer vs Admin authorization.
**Acceptance criteria:** All CRUD and state transition endpoints work according to business rules and authorization policies.

---

## Task 3: Tournament Registration Logic
**Task ID:** `TRN-03`
**Title:** Implement Tournament Registrations API
**Status:** Approved
**Objective:** Allow players to register for Singles and Doubles.
**Scope:** Registration API and validation.
**Implementation requirements:**
- Implement `POST /api/v1/tournaments/:id/registrations` (Accepts `type` and `team_id`).
- Validate Singles registration (no duplicate player).
- Validate Doubles registration (Team must have exactly 2 valid members, the invitation must be accepted, requester must be captain, and there must be no duplicate team).
- Enforce the configured registration period, tournament lifecycle state, and participant limit before creating a registration.
- Implement `GET /api/v1/tournaments/:id/registrations`.
- Create registration in `PENDING_PAYMENT` state (if fee > 0) or `CONFIRMED` (if fee = 0).
**Dependencies:** `TRN-02` (Tournament exists).
**Files/areas affected:**
- `backend/src/modules/tournaments/` (Registrations Controller/Service).
**API impact:**
- New endpoints as specified in Tech Design Section 3.2.
**Schema/config impact:** None.
**Testing requirements:** Unit tests for participant limits and registration validations (Singles vs Doubles).
**Acceptance criteria:** Players can register correctly, and validation rules strictly enforce participant constraints.

---

## Task 4: Payment Provider Integration (VNPAY)
**Task ID:** `TRN-04`
**Title:** Integrate VNPAY for Tournament Registration Fees
**Status:** Approved
**Objective:** Process payments and handle VNPAY webhooks for registrations.
**Scope:** Backend payment module adapter.
**Implementation requirements:**
- Integrate VNPAY to generate payment URLs for `PENDING_PAYMENT` registrations.
- Create a local payment record linked through `PAYMENTS.registration_id`, storing the full entry-fee amount.
- Implement the PaymentModule VNPAY webhook endpoint and document its exact route and request/response contract before implementation.
- Validate webhook signature and handle idempotency (if registration already `CONFIRMED`, return 200).
- Update registration status to `CONFIRMED` on successful payment.
**Dependencies:** `TRN-01`, `TRN-03`.
**Files/areas affected:**
- `backend/src/modules/payments/`
**API impact:**
- VNPAY Webhook endpoint.
**Schema/config impact:** Uses the `registration_id` migration from `TRN-01`.
**Testing requirements:** Mock VNPAY webhook calls to test idempotency and signature validation.
**Acceptance criteria:** Registration transitions to `CONFIRMED` upon receiving valid VNPAY callback. Duplicate callbacks are ignored safely.

---

## Task 5: Bracket Generation Algorithm & API
**Task ID:** `TRN-05`
**Title:** Implement Single-Elimination Bracket Generation
**Status:** Approved
**Objective:** Automatically generate a valid power-of-2 tournament tree.
**Scope:** Backend algorithm and `TOURNAMENT_MATCHES` creation.
**Implementation requirements:**
- Implement `POST /api/v1/tournaments/:id/bracket/generate`.
- Validate `N >= 2` participants.
- Calculate bracket size `S = 2^ceil(log2(N))` and `BYEs = S - N`.
- Implement seeding algorithm: use skill ranking when sufficient information exists; randomize ties and unranked registrations; distribute high seeds to opposite ends; allocate BYEs to top seeds.
- Create `MATCHES` and `TOURNAMENT_MATCHES` in a single atomic database transaction.
- Update tournament state to `READY`.
**Dependencies:** `TRN-02`, `TRN-03`.
**Files/areas affected:**
- `backend/src/modules/tournaments/services/BracketService.ts`
**API impact:**
- New endpoint `POST /api/v1/tournaments/:id/bracket/generate`.
**Schema/config impact:** None.
**Testing requirements:** Extensive pure-function unit tests for the bracket generation algorithm (power of 2, BYE placement, seed distribution).
**Acceptance criteria:** Bracket tree is generated correctly in the DB as a power of 2, transaction rollback works on failure.

---

## Task 6: Match Resolution & Winner Advancement
**Task ID:** `TRN-06`
**Title:** Implement Tournament Match Resolution
**Status:** Approved
**Objective:** Allow Organizer to resolve matches and automatically advance winners.
**Scope:** Backend API for match resolution.
**Implementation requirements:**
- Implement `PUT /api/v1/tournaments/:id/matches/:match_id/result`.
- Validate resolution payload (`WALKOVER`, `WINNER_DECLARED`, `NONE`).
- Derive and validate the winner from the underlying Match result.
- If `WINNER_DECLARED` or `WALKOVER`, find the `next_match_id` record and populate the winner into the next available registration slot (`registration1_id` or `registration2_id`).
- If resolution is `NONE`, do not automatically advance any registration.
- Update the base `MATCHES` status correspondingly.
**Dependencies:** `TRN-05`.
**Files/areas affected:**
- `backend/src/modules/tournaments/`
**API impact:**
- New endpoint `PUT /api/v1/tournaments/:id/matches/:match_id/result`.
**Schema/config impact:** None.
**Testing requirements:** Integration tests for winner advancement logic.
**Acceptance criteria:** Organizer can update match results. Winners automatically appear in the next round's match record.

---

## Task 7: Background Cron Pollers & Refunds
**Task ID:** `TRN-07`
**Title:** Implement Cron Jobs for Expirations and Refund Processing
**Status:** Approved
**Objective:** Handle timeouts for registrations/invitations and process refunds via background worker.
**Scope:** Custom cron poller and refund worker.
**Implementation requirements:**
- Create a cron poller running every minute with DB locking to expire `PENDING_PAYMENT` registrations.
- Create a cron poller for `TEAM_INVITATION_TIMEOUT_MINUTES` expiry.
- Listen to `TournamentCancelled` event and initiate VNPAY refunds for all paid `CONFIRMED` registrations.
- Implement the 24-hour timeout (`REFUND_PROCESSING_TIMEOUT_MINUTES`) logic for refunds.
- Process refunds idempotently and use database locking/claiming so multiple workers cannot process the same refund concurrently.
**Dependencies:** `TRN-02`, `TRN-04`.
**Files/areas affected:**
- `backend/src/jobs/` or `backend/src/workers/`
**API impact:** None.
**Schema/config impact:** Relies on application config for timeouts.
**Testing requirements:** Test DB locking mechanism and timeout boundaries.
**Acceptance criteria:** Expired entities are marked `CANCELLED`. Cancelled paid tournaments successfully trigger the refund workflow idempotently.

---

## Task 8: Notification System
**Task ID:** `TRN-08`
**Title:** Implement Tournament Notifications and Client Polling
**Status:** Approved
**Objective:** Notify users of tournament cancellations and updates.
**Scope:** Backend `NOTIFICATIONS` persistence and polling API.
**Implementation requirements:**
- Persist notification records to `NOTIFICATIONS` table on `TournamentCancelled` event.
- Implement `GET /api/v1/notifications/unread` with the request/response contract defined in the feature API contract.
- Cover tournament cancellation and relevant tournament-update events, with recipients limited to affected tournament participants and Organizer/Admin where applicable.
**Dependencies:** `TRN-02`.
**Files/areas affected:**
- `backend/src/modules/notifications/`
**API impact:**
- New endpoint for fetching unread notifications.
**Schema/config impact:** Uses existing `NOTIFICATIONS` table.
**Testing requirements:** Unit tests for notification creation on event trigger.
**Acceptance criteria:** Users receive persisted notifications when their tournament is cancelled, retrievable via 30s polling.

---

## Task 9: Frontend - Tournament Portal & Bracket View
**Task ID:** `TRN-09`
**Title:** Implement Tournament Frontend Views
**Status:** Approved
**Objective:** Build UI for listing, creating, registering, and viewing brackets.
**Scope:** React frontend components.
**Implementation requirements:**
- Create Tournament List and Detail pages.
- Create Organizer forms (Create Draft, Edit Settings).
- Implement Singles and Doubles registration flows, including VNPAY redirection.
- Build Bracket Visualization component (fetching tree from `GET /api/v1/tournaments/:id/bracket`).
- Build Organizer UI for updating match results.
**Dependencies:** `TRN-02`, `TRN-03`, `TRN-04`, `TRN-05`, `TRN-06`.
**Files/areas affected:**
- `frontend/src/pages/tournaments/`
- `frontend/src/components/tournaments/`
**API impact:** Consumes Tournament APIs.
**Schema/config impact:** None.
**Testing requirements:** Component/API behavior tests for bracket rendering and form validation, following the project testing conventions without selecting a specific framework.
**Acceptance criteria:** Players can complete the end-to-end journey (View -> Register -> Pay -> View Bracket). Organizer can manage tournament lifecycle and input match results via the UI.
