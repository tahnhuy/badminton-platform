# In-app Notifications — Tasks

Documentation Status: Ready. Approved by Human owner, 2026-10-10.
Implementation status: Approved; no task is implemented by this update.

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
- NTF-03/04/05 and all producers are not started.

## Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

NTF-01…NTF-04 unchanged.

## [ ] NTF-05: Social Matchmaking notification types and link resolution

```text
Status: BLOCKED
Size: S
Blocked by: NTF-02, NTF-03
```

**Objective:** Register the new types/resource types (Tech Design extension table) and resolve links to posts and recruitments with owning-module access checks.

**Scope**

- In scope: type constants, resource resolvers, frontend navigation targets.
- Out of scope: producing events (MM-31, SOC-06); CONVERSATION resolver (deferred by human approval 2026-11-01 because no approved notification producer targets conversations).

**Implementation requirements**

1. A link never grants access; resolvers call the owning Social/recruitment access checks; links never grant access.

**Files/areas affected**

- `backend/src/services/notifications/`, `frontend/src/features/notifications/` `[Proposed — verify during implementation]`

**API impact:** `resourceType` values extended.

**Schema/config impact:** None.

**Verification**

- API: link to a hidden post resolves as unavailable; recruitment links enforce the owning module access rules. No conversation-link acceptance is required in this delivery.

**Acceptance criteria**

- **Given** a notification for a post later hidden **When** opened **Then** the neutral unavailable state is shown.
