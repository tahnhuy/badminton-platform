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
