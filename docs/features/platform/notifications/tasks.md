## [x] NTF-08: Court Owner inbox — DONE (2026-11-23)

Added the five P0 and six P1 Owner notification types, the Owner resource
resolver allowlist, transaction-aware producers and the owner-facing inbox UI
(`/owner/notifications`, header bell, 30-second polling). Recipient resolution,
dedup keys and links are recorded in the Tech Design extension and
[plan 19](../../../plans/19_thong-bao-chu-san.md).

**Evidence:** `owner-notifications.test.ts` 10/10 PASS; `booking-notifications`,
`owner-cancellation`, `notification-resolvers`, `owner-earning-settlement`,
`wallet-payout`, `admin-notifications`, `booking-payment`,
`matchmaking-payment-lock` and `match-booking-split` targeted suites PASS;
backend/frontend builds PASS; owner Playwright specs PASS (owner-notifications
5/5, owner shell/schedule/facilities 40/40). Frontend lint is blocked only by a
pre-existing `OwnerWalletPage` radius warning outside this task.

# In-app Notifications — Tasks

> **Progress 2026-11-17 (plan 06):** BK-10 booking producers (`BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_EXPIRED`, `BOOKING_REFUNDED`, `BOOKING_REFUND_FAILED`, dedup `booking:<id>:<event>`) and the `MM_BOOKING_CANCELLED` Matchmaking producer are implemented in the producing transactions. See `docs/plans/06_booking-chu-san-matchmaking.md` §8.

> **Progress 2026-11-18 (Admin inbox):** `ADMIN_REPORT_CREATED` (report submission) and `ADMIN_FACILITY_SUBMITTED` (facility/court onboarding, resubmission, address change) are implemented with Admin-only resolvers `ADMIN_REPORT` and `ADMIN_FACILITY`. `NTF-06` extends the same inbox with financial, config, risk and security alerts.

## [x] NTF-07: Received-rating notification — DONE (2026-11-23)

Added `RATING_RECEIVED` from `RatingService.createRatings` in the caller transaction.
Recipient is the rated Player; resource is `PROFILE` resolving to `/profile` only for the
owning active Player; dedup key `rating-received:<ratingId>`. Duplicate rating replays emit
nothing. The content never includes the rater identity or scores. Evidence:
`ratings.test.ts` and `notification-resolvers.test.ts`.

## [x] NTF-06: Admin operational alerts — DONE (2026-11-18)

```text
Status: DONE
Size: M/L, delivered P0–P2
Blocked by: none; reuses NTF-02/03/05
Plan/evidence: docs/plans/13_thong-bao-van-hanh-admin.md
```

Implemented types: `ADMIN_PAYOUT_PENDING`, `ADMIN_REFUND_FAILED`, `ADMIN_PAYOUT_FAILED`, `ADMIN_PAYMENT_MISMATCH`, `ADMIN_CONFIG_CHANGED`, `ADMIN_HIGH_RISK_REPORT`, `ADMIN_SECURITY_EVENT`. New allowlisted resources: `ADMIN_PAYOUT`, `ADMIN_REFUND`, `ADMIN_PAYMENT`, `ADMIN_CONFIG_AUDIT`, `ADMIN_USER`. Transactional producers cover payout/refund/config/report-risk; webhook and security alerts use the best-effort helper so they never change the domain response.

Verification on `badminton_test`: `admin-notifications.test.ts` 9/9 PASS; `wallet-payout`, `wallet-top-up`, `admin-config-api`, `report-submission` and `notification-resolvers` 34/34 PASS; `npm run build --prefix backend` PASS; `npm run build --prefix frontend` PASS; `npm run lint --prefix frontend` PASS (warnings only).

## Task completion review — 2026-11-16 (Track C / plan 04)

Verification on `badminton_test`: `npm test --prefix backend -- --run src/__tests__/notification-resolvers.test.ts` 6/6 PASS; `notification-producers.test.ts` 6/6 PASS; `notification-api.test.ts` + `notification-service.test.ts` 13/13 PASS; `npm run build --prefix backend` PASS; `npm run build --prefix frontend` PASS; `npm run lint --prefix frontend` PASS (warnings only).

| Task | Status | Evidence |
| --- | --- | --- |
| NTF-04 | PARTIAL / UI-REDO | Base `features/notifications/` (dropdown, `/notifications`, `/notifications/:id`, 30s polling with hidden-tab pause, mark-read without reload, All/Unread, empty/loading/error) exists. UI is being edited in parallel, so visual completion, P05/P45/P81 Playwright, and mobile/keyboard polish are marked UI-REDO in `docs/plans/04_thong-bao.md`. |
| NTF-05 | DONE | Allowlisted resolver `backend/src/services/notifications/NotificationResourceResolver.ts`: POST/COMMENT/MATCHMAKING_REQUEST/MATCH/CONVERSATION/BOOKING re-check the owning module and return `null` (no link) when missing/hidden/deleted/unauthorized. `GET /notifications/:id` adds `resourcePath`; list responses do not. TOURNAMENT intentionally has no resolver (no real detail route). Tests cover hidden/deleted posts, hidden comments, non-participant Match, non-member Conversation, non-owner Booking, cross-user notification 404 and unknown types. |

Producers: existing Social comment and Matchmaking producers are covered; MM-10 request cancel/withdraw emit in the lifecycle transaction. `MM_BOOKING_CANCELLED` remains absent because MM-19/MM-20 (booking cancellation) are not delivered; this is recorded as a cross-task dependency.

## Task completion review — 2026-11-01

Requested by the owner; supersedes the historical progress notes below. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Shared schema/document PR review before merge is unchanged; no teammate PR approval is claimed.

| Task | Status | Review evidence |
| --- | --- | --- |
| NTF-01 | DONE | Migration 0013 adds only the approved nullable reference/dedup columns and indexes; fresh/populated migration history preservation, legacy NULL keys and per-recipient uniqueness are exercised in social-step1-migrations.test.ts. |
| NTF-02 | DONE | Reviewed caller-owned transaction enforcement, propagated failure/rollback, deterministic insert order, per-recipient dedup and retry. notification-service.test.ts exercises concurrent commit/rollback and recipient isolation. |
| NTF-03 | DONE | Reviewed session-derived recipient, route validation, pagination/filter/allowlist, non-owned/missing 404, side-effect-free GET and COALESCE first read_at with CSRF-protected mutation. notification-api.test.ts exercises those acceptance paths. |

NTF-04 UI/navigation and NTF-05 owning-resource link resolution are separate unfinished tasks. Producers do exist now (SOC-06 and partial MM-31); the older “all producers are not started” note is obsolete. Test setup uses a BlockPort double; no Messaging integration completion is inferred.

## Implementation history — before completion review

Documentation Status: Ready. Approved by Human owner, 2026-10-10.
Current implementation status: NTF-01, NTF-02 and NTF-03 DONE after the completion review above; NTF-04 is not started and NTF-05 remains BLOCKED.

- NTF-01: Add approved reference/dedup columns and indexes via the next migration;
  coordinate MM-01 to avoid duplicate migrations. Verify history preservation.
- NTF-02: Implement transaction-aware persistence and NotificationService contract;
  dedup event keys, rollback and recipient scoping. Depends on NTF-01.
- NTF-03: Implement list/unread/detail/read APIs with auth/CSRF and pagination.
  Verify other-user 404 and idempotent read. Depends on NTF-02.
- NTF-04: Integrate notification list/unread indicator and resource navigation in
  the existing Player shell, 30-second polling. Depends on NTF-03.

MM-10 consumes NTF-02; MM-16 consumes NTF-03/04. Booking/Payment/Tournament use the
same platform contract. Verify recipient isolation, transactional rollback,
deduplication under concurrent retries and existing resource authorization.

Implementation status (2026-11-01, branch `feat/social`): NTF-01 and NTF-02 are IN_PROGRESS, not DONE.

- NTF-01: migration `0013_notification_references` adds the §3.24 columns and indexes. Existing rows are unchanged; no earlier migration added them.
- NTF-02: the contract (`contracts/NotificationService.ts`) becomes `notify(tx, events)`. Each event has `recipientId`, type, title, content, optional `resource { type, id }` and a required `dedupKey`. The transaction type is the new `contracts/TransactionContext.ts`.
- The implementation (`services/notifications/`, `repositories/notifications/`) rejects the root db handle and never opens or commits a transaction. It inserts with `ON CONFLICT DO NOTHING` in sorted order and propagates errors.
- The old `notify(userIds, message)` had no consumers in code.
- `notification-service.test.ts` passed: caller-transaction visibility, rollback, FK failure propagation, recipient isolation, dedup within a call and across retries, concurrent retries, and retry after a rolled-back first attempt.
- Missing before DONE: a full regression run (skipped at the owner's request).
- NTF-03 (2026-11-01, IN_PROGRESS, not DONE): `GET /notifications`, `GET /notifications/unread`, `GET /notifications/:id`, `POST /notifications/:id/read` (`routes/notifications/`, `NotificationQueryService`). Recipient always from the session; non-owned and missing ids share `404 NOTIFICATION_NOT_FOUND`; GET never changes read state; read is idempotent and keeps the first `read_at`; page/limit/meta; no bulk read. `notification-api.test.ts` 5/5 (isolation, pagination, session/CSRF, replay). Any authenticated role can read its own notifications (Tech Design: caller-scoped). Missing before DONE: full regression.
- Historical status before Social producers were implemented: NTF-04/05 and all producers were not started. See the current completion review above.

## Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

NTF-01…NTF-04 unchanged.

## [x] NTF-05: Social Matchmaking notification types and link resolution — DONE (2026-11-16)

```text
Status: DONE
Size: S
Blocked by: none; NTF-02/03 are DONE
```

**Objective:** Register the new types/resource types (Tech Design extension table) and resolve links to posts and recruitments with owning-module access checks.

**Scope**

- In scope: type constants, resource resolvers, frontend navigation targets.
- Out of scope: producing events (MM-31, SOC-06).
- CONVERSATION: resolver shipped in the allowlist, but no producer targets conversations (human approval 2026-11-01). TOURNAMENT remains without a resolver until a real detail route and producer exist.

**Implementation requirements**

1. A link never grants access; resolvers call the owning Social/recruitment access checks; links never grant access.

**Files/areas affected**

- `backend/src/services/notifications/`, `frontend/src/features/notifications/` `[Proposed — verify during implementation]`

**API impact:** `resourceType` values extended.

**Schema/config impact:** None.

**Verification**

- API: link to a hidden/deleted post resolves as unavailable; recruitment links enforce the owning module access rules. `notification-resolvers.test.ts` covers POST/COMMENT/MATCHMAKING_REQUEST/MATCH/CONVERSATION/BOOKING and cross-user notification 404.

**Acceptance criteria**

- **Given** a notification for a post later hidden **When** opened **Then** the neutral unavailable state is shown (`resourcePath: null`, content preserved).


## MM-24 producer update — 2026-11-01

MM-24 adds `MM_APPLICATION_RECEIVED` and `MM_APPLICATION_ACCEPTED`/`DECLINED` through the existing caller-owned notification transaction and the approved `mm-app-received:<rowId>` / `mm-app-decided:<rowId>` keys. Tests cover exactly-once decision replay and rollback of acceptance/Match formation when notification persistence fails. This does not close NTF-04/05 or real BlockPort acceptance; no conversation producer or resolver was added.
