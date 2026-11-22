# System Configuration — Product Requirements Document

Platform capability that stores and reads configurable business parameters for
the MVP domains (Booking, Matchmaking, Tournament, Rating, Authentication, and Finance)
without a code change or redeploy. Admin can inspect and update these values
through an `ADMIN`-only management surface.

```text
Status: Draft
Owner: Platform team (TBD)
Fulfills: PROJECT-BRIEF.md §4 (Admin platform management), §6 (MVP focus), §7 (confirmed Booking behavior)
Business rules source: docs/business-rules-config-matrix.md §8
Scope: Platform-level run-time configuration of business parameters
```

An AI agent must not mark this document `Ready` without human confirmation
(`docs/documentation-guide.md` §6.3).

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Authoritative business rules and configuration values:
  `docs/business-rules-config-matrix.md` §8
- Global schema: `docs/architecture/database-schema.md` §3.26
- Related platform capabilities:
  `docs/features/platform/authentication-authorization/`
  (`AUTH_*` keys), `docs/features/booking/player-booking/` (`BOOKING_*` keys)

## Related Documents

- Parent or related PRD: `N/A — platform capability; per-domain PRDs own their
  domain behavior`
- Tech Design: [tech-design.md](tech-design.md)
- Task or issue: [tasks.md](tasks.md)

## 1. Problem

Many MVP business rules depend on numeric or boolean parameters: payment hold
timeouts, cancellation deadlines, session timeouts, lockout thresholds, matching
distance, invitation timeout, and the like. These values are expected to change
over time as the platform operates.

- Who is affected: the platform operator (Admin) who must tune platform
  behavior, and indirectly Player and Court Owner who experience that behavior.
- What is difficult today without this capability: the values would have to be
  hard-coded or changed in source code and redeployed, so tuning behavior would
  require a release instead of an operational change.
- Why it matters within MVP: the confirmed rules require snapshotted timeouts
  (for example Booking payment timeout and session timeouts), which implies a
  single, inspectable place where the configured value can be read.

## 2. Goals

- Provide one authoritative run-time source for the configurable business
  parameters listed in `docs/business-rules-config-matrix.md` §8.
- Let a configuration value change affect behavior without a code change or
  redeploy.
- Preserve the confirmed snapshot semantics: a change applies to new
  transactions/entities only, never to entities that already captured a deadline
  (`docs/business-rules-config-matrix.md` §8.1).
- Keep the documented defaults usable when a value is missing or invalid, so the
  platform keeps operating and the misconfiguration is visible in logs.

## 3. Non-Goals

- Owning business rules. The rules and default values are owned by
  `docs/business-rules-config-matrix.md`; this capability only stores and reads
  them.
- Managing environment/secret configuration (for example `DATABASE_URL`,
  `PASSWORD_PEPPER`, payment secrets). That is owned by the centralized
  environment boundary (`docs/architecture/conventions.md` — Configuration &
  Environment).
- System-wide content management (articles, banners, static content). This is
  distinct from configuration management and remains out of MVP
  (`PROJECT-BRIEF.md` §5).
- Introducing a new system role. The configuration management surface belongs
  to the existing `ADMIN` role.

## 4. Scope

### In Scope

- A persisted store of named configuration values with a description and
  change metadata.
- Reading the documented keys for each MVP domain through a single
  configuration boundary.
- Documented default fallback and invalid-value handling for read values.
- The §8.1 change semantics: new entities use the new value; existing entities
  keep their snapshotted deadline.
- An `ADMIN`-only management surface to list, inspect, and update existing
  configuration values, with validation against the documented key catalog and
  type.
- A change history for configuration updates.

### Out of Scope

- Creating arbitrary new configuration keys through the management surface. New
  keys are introduced through the documented configuration process and a
  migration, not by an operator.
- Editing values that are secrets or environment settings.
- Editing business rules that are not represented as configuration keys.
- Rollback/restore of a previous configuration value from the history (history
  is read-only; see §14).

## 5. Target Users and Roles

- Player: experiences configured behavior (for example cancellation deadline,
  session idle timeout). Does not manage configuration.
- Court Owner: experiences configured behavior (for example owner cancellation
  and refund timeouts). Does not manage configuration.
- Admin: the platform operator who owns configuration changes through the
  `ADMIN`-only management surface (`PROJECT-BRIEF.md` §4).
- Contextual permission: `N/A`.

## 6. User Journey

Admin manages configuration through the Admin management surface:

1. Admin opens the system configuration screen and sees the configuration keys
   grouped by domain, each with its current value, description, and last change
   information.
2. Admin filters or searches to the key group they need.
3. Admin edits a value using an input appropriate to the key's type (number,
   toggle, or choice) and confirms.
4. The system validates the value against the documented catalog; an invalid or
   unknown value is rejected with a clear message and nothing is saved.
5. On success the system saves the value and records the change (who, when,
   previous value, new value), and the Admin sees a confirmation.
6. The change applies to new transactions/entities; entities created earlier
   keep their already-snapshotted deadline. The screen warns about this.

## 7. Functional Requirements

- The platform can read each configured business parameter by its documented
  key.
- A missing key returns the default documented in
  `docs/business-rules-config-matrix.md` §8.
- An invalid value (for example a non-positive integer where a positive integer
  is expected) is treated like a missing key: the default is used and the
  problem is logged.
- A configuration read reflects changes within the documented cache window.
- A configuration change does not alter the deadline already captured by an
  existing pending entity.
- Secrets and connection strings are never read from this store; they remain in
  the environment boundary.
- Admin can list configuration values, filter them by domain/key, and inspect a
  single value with its description and last-change information.
- Admin can update an existing configuration value; the system rejects unknown
  keys and values that fail the type/range or cross-key rules for that key. A
  key that exists in the catalog but has no stored row is created (upsert) on
  the first update.
- Every successful update that actually changes the stored value records a
  change-history entry (actor, time, previous value, new value). An update
  whose value equals the stored value is a no-op and records no history entry.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §8.1 (change
  semantics), §8.2 (Booking), §8.3 (Matchmaking), §8.4 (Tournament),
  §8.5 (Team), §8.6 (Report), §8.7 (Authentication), §8.8 (Player skill
  adjustment).
- Feature rule: configuration values and their defaults are frozen by §8. This
  capability must not reinterpret or re-default them.
- Feature rule: a configuration change applies to new transactions/entities
  only; already-established deadlines are preserved (§8.1).
- Feature rule: misspelled or missing keys fall back to the documented default
  with a `WARN` log; stored values that fail validation fall back to the
  documented default with an `ERROR` log, uniformly for every key group.
- Feature rule: an update to the same value is a no-op; a history entry exists
  only for a real value change.
- Do not add technical validation design or constraint definitions here; those
  belong in the Tech Design.

## 9. UI/UX Behavior

- Entry points: an Admin-only "System Configuration" screen reached from the
  Admin area.
- Important states: loading, empty group, success, validation error, save
  error, and unauthorized/forbidden.
- User feedback:
  - The current value, description, and last-change summary are shown for each
    key.
  - A successful update shows a confirmation.
  - A rejected update shows which value is invalid and why; nothing is saved.
  - A visible note explains that changes apply to new transactions/entities
    only, while already-created entities keep their snapshotted deadline.
  - A visible note explains that a change becomes observable within the
    documented cache window (at most 60 seconds).
- Accessibility or content requirements: inputs must be labeled and usable by
  keyboard; configuration keys are shown as technical identifiers alongside a
  human-readable description.
- The screen is only one layer of protection; the system enforces `ADMIN`
  authorization on the server regardless of the UI.

## 10. Success Metrics

- `N/A — no product metric is required for this platform capability`.

## 11. Constraints

- Business rules and default values are frozen in
  `docs/business-rules-config-matrix.md` §8 and require the §11 rule-change
  process to change.
- Snapshot semantics are mandatory (`docs/business-rules-config-matrix.md`
  §8.1): this capability must not "fix up" existing entities after a change.
- The store is authoritative business data and must be distinguished from
  environment/secret configuration (`docs/architecture/conventions.md` —
  Configuration & Environment).
- Configuration-management access is restricted to the `ADMIN` system role
  (`PROJECT-BRIEF.md` §2, §4).
- Only existing, documented keys can be updated; the management surface cannot
  introduce new keys or remove keys.
- A value must satisfy its key's type/range and any cross-key rule before it is
  saved; saving an invalid value must be impossible.

## 12. Risks

- Hard-coding a value instead of reading it through the boundary, which would
  silently disconnect behavior from the configuration matrix. Mitigation: a
  single read boundary per key group and documented defaults.
- Read caching causing an operator to believe a change has not applied.
  Mitigation: document the cache window and provide a cache-clear path used by
  tests.
- Invalid stored values silently changing behavior. Mitigation: fall back to the
  documented default and log the misconfiguration.
- A mistyped but syntactically valid value breaking platform behavior (for
  example setting a maximum below a minimum). Mitigation: validate type, range,
  and cross-key rules before saving; show the effective behavior in the UI.
- Configuration drift between the stored value and the documented default.
  Mitigation: the management surface shows the documented default and the
  current value together.

## 13. Dependencies

- The persisted configuration store defined in
  `docs/architecture/database-schema.md` §3.26.
- The configuration change-history store defined in
  `docs/architecture/database-schema.md` §3.31.
- The key catalog and defaults in `docs/business-rules-config-matrix.md` §8.
- Consuming domain features (Booking, Matchmaking, Tournament, Rating,
  Authentication) that read their keys.

## 14. Open Questions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| Is a user-facing Admin configuration management surface (API and/or screen) in MVP scope? | Business Owner / PM | Decided in scope (§4, §15); `PROJECT-BRIEF.md` §4 and §5 updated 2026-10-10 | RESOLVED |
| Should configuration changes require an audit trail beyond the store's change metadata? | Business Owner | Decided: record an append-only change history (`SYSTEM_CONFIG_AUDIT`, `database-schema.md` §3.31) | RESOLVED |
| Should an Admin be able to roll back to a previous value from the history? | Business Owner | Decided out of scope for MVP (§4); history is read-only | RESOLVED |
| Is there a required maximum time for a change to become effective across all running server processes? | Tech Lead | Resolved 2026-10-10: maximum propagation delay is the 60-second read-cache TTL; in-process invalidation on write is sufficient for the single-process MVP deployment. Cross-process invalidation (for example PostgreSQL `LISTEN/NOTIFY`) is deferred until a multi-process deployment exists. | RESOLVED |

## 15. Decisions Recorded

| Date | Decision | Authority/owner |
| --- | --- | --- |
| 2026-10-10 | Admin configuration management (list/inspect/update of existing keys) is in MVP scope; it is not "System Content Management". | Human owner (requested 2026-10-10) |
| 2026-10-10 | Every successful update records an append-only change-history entry. | Human owner |
| 2026-10-10 | Arbitrary key creation and value rollback are out of scope for MVP. | Human owner |
| 2026-10-10 | Access is restricted to the `ADMIN` role; the surface is a UI plus API. | Human owner |
| 2026-10-10 | A repeated update of the same value is a no-op and records no history entry; history entries exist only for actual value changes. (Refines the 2026-10-10 audit decision.) | Human owner |
| 2026-10-10 | All keys follow one uniform behavior notice: a change becomes observable within the documented cache window (at most 60 seconds); the screen does not advertise a separate "takes effect immediately" class of keys. | Human owner |
| 2026-10-10 | A key present in the documented catalog but absent from `SYSTEM_CONFIGS` is upserted by the first write; reads fall back to the documented default. | Human owner |
| 2026-10-31 | Social Matchmaking/Messaging deadlines and limits become configuration; keys, defaults, ranges and semantics are approved in `docs/business-rules-config-matrix.md` §8.9. Retiring/renaming keys requires a migration plan; keys used by current code are not removed directly. Storage technique is not decided. | Human owner |

## Phase 1 business review — Ready, 2026-10-31

The human owner approved the Phase 1 business changes in this document after review. This approval covers the Social Matchmaking/Messaging changes only; it does not approve unrelated Draft content, new routes, schema, API, technology, or implementation. The affected technical documents and Tasks must be updated before implementation.
