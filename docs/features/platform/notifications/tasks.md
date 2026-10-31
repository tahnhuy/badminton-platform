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

## Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

NTF-01…NTF-04 unchanged.

## [ ] NTF-05: Social Matchmaking notification types and link resolution

```text
Status: BLOCKED
Size: S
Blocked by: NTF-02, NTF-03
```

**Objective:** Register the new types/resource types (Tech Design extension table) and resolve links to posts, recruitments and conversations with owning-module access checks.

**Scope**

- In scope: type constants, resource resolvers, frontend navigation targets.
- Out of scope: producing events (MM-31, SOC-06).

**Implementation requirements**

1. A link never grants access; resolvers call `canView`/Messaging access.

**Files/areas affected**

- `backend/src/services/notifications/`, `frontend/src/features/notifications/` `[Proposed — verify during implementation]`

**API impact:** `resourceType` values extended.

**Schema/config impact:** None.

**Verification**

- API: link to a hidden post resolves as unavailable; conversation link for a revoked member is 404.

**Acceptance criteria**

- **Given** a notification for a post later hidden **When** opened **Then** the neutral unavailable state is shown.
