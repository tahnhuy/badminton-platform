# System Configuration — Tech Design

Technical design for the platform capability that stores and reads run-time
business configuration (the keys catalogued in
`docs/business-rules-config-matrix.md` §8) and exposes an `ADMIN`-only
management surface over it.

```text
Status: Draft
Owner: Platform team (TBD)
PRD: prd.md
Scope: Platform configuration store, typed read boundary, and Admin management surface
Decision Status: Proposed
```

A Tech Design with unresolved decisions that block implementation must not be
marked `Ready` (`docs/documentation-guide.md` §6.3).

## 1. Metadata

- Document status: `Draft`.
- Decision status: `Proposed`. The product scope (Admin management surface,
  change history) was approved by the human owner on 2026-10-10 and is recorded
  in the PRD §15. The former open questions (cache propagation delay, reader
  consolidation) were resolved by the human owner on 2026-10-10 (see §21);
  the registry constraint catalog (§7.3) is recorded with a pending
  Business Owner confirmation note. Final technical design review is still
  required before implementation.
- This design documents the capability as implemented today plus the approved
  write surface, and records the resolved decisions in §21.

## 2. Context

Several MVP features read numeric and boolean parameters at request time and
snapshot some of those values onto entities they create. The values and their
defaults are frozen by `docs/business-rules-config-matrix.md` §8, and §8.1
defines that a configuration change applies to new transactions/entities only.

Today the capability consists of:

- a persisted `SYSTEM_CONFIGS` table (`docs/architecture/database-schema.md`
  §3.26), seeded by migrations covering the key groups whose features exist
  today (Booking incl. `PLAYER_*`/`OWNER_*`/`REFUND_*`, Matchmaking,
  Tournament registration payment timeout, Authentication); keys documented in
  §8 without a seeding feature simply have no row yet (see §10);
- typed read boundaries under the shared configuration area:
  - `backend/src/shared/config/system-config.ts` for the `AUTH_*` keys;
  - `backend/src/shared/config/booking-config.ts` for the `BOOKING_*` keys;
- a separate environment boundary, `backend/src/shared/config/env.ts`, for
  process/secret configuration (not part of this capability).

Today there is no HTTP API and no user-facing management surface; values are
changed directly in the datastore. Per the approved scope (PRD §4, §15), this
design adds an `ADMIN`-only management API and screen, and an append-only
change-history table, without changing the read behavior that features depend
on.

## 3. Technical Problem

The design must provide a single, safe way for domain features to obtain a
configured value while:

- never hard-coding the value in feature code;
- falling back to the frozen default when a key is missing or invalid, without
  failing the request;
- surfacing misconfiguration through logs;
- keeping reads cheap (not a database round-trip on every call);
- preserving the §8.1 snapshot rule (the capability reports the current value;
  the owning feature must snapshot it at entity creation);
- keeping secrets and connection settings out of the business configuration
  store.

## 4. Goals

- One documented read boundary per key group, resolving every value from
  `SYSTEM_CONFIGS` with the §8 default as fallback.
- Deterministic handling of missing and invalid values with uniform, observable
  logs (`WARN` for missing, `ERROR` for invalid, every group).
- Bounded, memory-cached reads that still pick up changes within a short window.
- An `ADMIN`-only management surface (API and screen) to list, inspect, and
  update existing keys, with no behavior change for any consuming feature beyond
  the value it reads.
- Every update is validated against the registry (type/range/enum plus
  cross-key rules); an actual value change records one append-only history
  row (same-value writes are no-ops).

## 5. Non-Goals

- Defining or changing business rules, defaults, or the key catalog
  (owned by `docs/business-rules-config-matrix.md` §8).
- Persisting secrets or environment settings (owned by
  `shared/config/env.ts`).
- Creating new configuration keys or deleting keys through the management
  surface; new keys are introduced by the documented configuration process and a
  migration.
- Rolling back to a previous value from the change history (history is
  read-only in MVP).
- Cross-process cache invalidation and distributed cache infrastructure —
  decided against for the MVP (60 s propagation window accepted, §21);
  re-evaluate only when a multi-process deployment exists.
- Enforcing snapshot semantics inside this capability; snapshotting is owned by
  each consuming feature/entity lifecycle.

## 6. Upstream References

- Governing PRD: [prd.md](prd.md)
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §2, §4, §6
- Global documentation rules: `docs/documentation-guide.md` §5.3, §9
- Global architecture/technology: `docs/architecture/tech-stack.md`
- Global coding/API conventions: `docs/architecture/conventions.md` —
  Backend, API, Validation, Security Coding Practices, Configuration &
  Environment
- Business rules/configuration: `docs/business-rules-config-matrix.md` §8
  (especially §8.1 semantics and §8.2/§8.7 key groups)
- Global database schema: `docs/architecture/database-schema.md` §3.26
  (`SYSTEM_CONFIGS`) and §3.31 (`SYSTEM_CONFIG_AUDIT`)

## 7. Proposed Technical Design

### 7.1 Responsibility boundaries

- **Persistence boundary:** the `SYSTEM_CONFIGS` table
  (`docs/architecture/database-schema.md` §3.26) is the single store. Each row
  is `{ config_key (unique), config_value (text), description, updated_by,
  updated_at }`.
- **Shared read boundary:** `backend/src/shared/config/` holds typed readers.
  This is the cross-cutting `shared/` boundary named by
  `docs/architecture/conventions.md` — Backend. Feature code must read through
  a reader and must not query `SYSTEM_CONFIGS` directly.
- **Feature/application boundary:** each consuming feature reads its keys,
  validates the value against its own business rules, and snapshots the value
  onto the entity it creates as required by its own Tech Design.
- **Environment boundary:** `shared/config/env.ts` continues to own
  process/secret configuration and is out of scope here.
- **Admin management boundary:** an `ADMIN` capability
  (`routes/admin/`, `controllers/admin/`, `services/admin/`,
  `repositories/<capability>/`) plus the Admin UI. See §7.5 and §9.

### 7.2 Readers and registry

Per the approved consolidation decision (§21, 2026-10-10), the registry is the
single source of truth for every catalog entry (keys, types, ranges, enum
values, defaults, descriptions). The typed readers become thin facades over a
shared, registry-validated loader; their public API and behavior are preserved:

- `system-config.ts`: exposes `systemConfig` with
  `getLockoutThreshold()`, `getLockoutMinutes()`, `getLoginLockoutConfig()`, and
  `getSessionTimeouts(role)`, plus `clearCache()`.
- `booking-config.ts`: exposes `bookingConfig.get()` returning a typed
  `BookingConfig` assembled from the `BOOKING_*` and `PLAYER_*` keys, plus
  `clearCache()`.
- The management service reuses the same registry and loader; defaults are
  never duplicated between the read and write paths.

Each reader selects all configuration rows into an in-memory map and resolves
the keys it owns.

### 7.3 Read pipeline

```text
read key group
  → cache valid? → return cached map
  → load SYSTEM_CONFIGS rows
  → for each owned key (registry-validated):
        row present and valid   → use stored value
        row missing             → use §8 default and log WARN (key + default)
        row present but invalid → use §8 default and log ERROR (key + stored value)
  → store map in cache with TTL
  → return typed value(s)
```

Logging is uniform for every key group (missing → `WARN`, invalid → `ERROR`);
no group falls back silently.

**Registry constraint catalog.** The registry holds, per key, the §8 default
plus the validation rules below. Recorded 2026-10-10; *pending Business Owner
confirmation except Ratings-related bounds confirmed 2026-10-15* — flags/limits may be adjusted through the matrix §11 process.
Domains are exactly the §8 groups. Defaults are those of §8 (not repeated
here):

Booking (`booking`, §8.2, includes `PLAYER_*`, `OWNER_*`, `REFUND_*` keys):

| Key | Type | Range / values |
| --- | --- | --- |
| `BOOKING_ENABLED`, `PLAYER_CAN_CANCEL_BOOKING`, `OWNER_CAN_CANCEL_BOOKING`, `REFUND_ENABLED` | BOOLEAN | `true`/`false` |
| `BOOKING_ACTIVE_LIMIT_MODE` | ENUM | `LIMITED`, `UNLIMITED` (currently only `LIMITED` is used; pending confirm) |
| `BOOKING_MIN_DURATION_MINUTES`, `BOOKING_MAX_DURATION_MINUTES` | INTEGER | 1–1440 |
| `BOOKING_ADVANCE_WINDOW_DAYS` | INTEGER | 1–365 |
| `MAINTENANCE_ADVANCE_WINDOW_DAYS` | INTEGER | Positive integer; default 90 (Owner review approved 2026-10-23), independent of booking horizon |
| `BOOKING_MAX_ACTIVE_PER_PLAYER` | INTEGER | 1–50 |
| `PLAYER_CANCELLATION_DEADLINE_MINUTES`, `OWNER_CANCELLATION_DEADLINE_MINUTES` | INTEGER | 0–10080 (0 = cancel any time before start) |
| `BOOKING_PAYMENT_TIMEOUT_MINUTES`, `REFUND_PROCESSING_TIMEOUT_MINUTES` | INTEGER | 1–10080 |

Matchmaking (`matchmaking`, §8.3):

| Key | Type | Range / values |
| --- | --- | --- |
| `MATCHMAKING_ENABLED` | BOOLEAN | `true`/`false` |
| `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`, `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`, `MATCHMAKING_MIN_LEAD_TIME_MINUTES` | INTEGER | 1–10080 |
| `MATCHMAKING_MATCH_DURATION_MINUTES` | INTEGER | 1–1440 |

Tournament (`tournament`, §8.4):

| Key | Type | Range / values |
| --- | --- | --- |
| `TOURNAMENT_ENABLED`, `TOURNAMENT_RATING_ENABLED` | BOOLEAN | `true`/`false` |
| `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT` | INTEGER | 2–128 |
| `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES` | INTEGER | 1–1440 |

Team / Report / Player skill adjustment (`team` §8.5, `report` §8.6,
`player-skill-adjustment` §8.8):

| Key | Type | Range / values |
| --- | --- | --- |
| `TEAM_INVITATION_TIMEOUT_MINUTES` | INTEGER | 1–10080 |
| `REPORT_ENABLED` | BOOLEAN | `true`/`false` |
| `PLAYER_SKILL_ADJUSTMENT_ENABLED` | BOOLEAN | `true`/`false` (legacy; `false` since 2026-11-15 and must stay `false`: the rating mapping targets the former six-level catalog, matrix §6) |
| `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` | INTEGER | 1–100 |
| `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` | INTEGER | 1–6 (legacy six-level bound; the catalog has seven ranks since 2026-11-15 and adjustment is disabled) |
| `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` | INTEGER | 0–365 |

Authentication (`auth`, §8.7):

| Key | Type | Range / values |
| --- | --- | --- |
| `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD` | INTEGER | 1–100 |
| `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES` | INTEGER | 1–1440 |
| `AUTH_SESSION_{IDLE,ABSOLUTE}_TIMEOUT_MINUTES_{PLAYER,COURT_OWNER,ADMIN}` | INTEGER | 1–525600 (365 days) |

- INTEGER values are compared after strict integer parsing; booleans must be
  exactly `true`/`false` (case-insensitive) after trim; enum membership is
  case-sensitive after trim.
- `clearCache()` exists for tests and explicit invalidation; it is not exposed
  through any API.

**Cross-key rules** (validated server-side before any write, against the
candidate values being written and the other keys' stored/default values):

1. `BOOKING_MIN_DURATION_MINUTES <= BOOKING_MAX_DURATION_MINUTES`.
2. For each role: `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_<ROLE> <=
   AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_<ROLE>`.
3. Future rules are added with their keys (documented candidates: cancellation
   deadlines vs `BOOKING_ADVANCE_WINDOW_DAYS`, `BOOKING_MAX_ACTIVE_PER_PLAYER`
   relevance when the mode is not `LIMITED`).

### 7.4 Design rationale

- Reading the key group once and caching it keeps request handling off the
  database on the hot path, which matters for authentication reads on every
  request.
- Falling back to the §8 default (rather than throwing) keeps the platform
  available while making the misconfiguration observable.
- Delegating snapshotting to the owning feature keeps this capability stateless
  and respects the boundary between platform configuration and domain entity
  lifecycle (`docs/business-rules-config-matrix.md` §8.1).

### 7.5 Admin management surface (approved write path)

**Known-key registry.** The write path must not accept arbitrary keys. The
registry described in §7.3 describes every manageable key — the full §8
catalog, including keys that have no `SYSTEM_CONFIGS` row yet. A key absent
from the registry is not manageable (`404`). The registry is the single source
of truth for keys, types, ranges, enum values, defaults, and descriptions;
`SYSTEM_CONFIGS.description` is not the API source of truth (see §9.1).

**Validation order (server-side, before any write):**

1. Key must exist in the registry.
2. Value must parse to the registry type (integer in range; boolean exactly
   `true`/`false`; enum membership).
3. Cross-key rules (§7.3) must hold, comparing the candidate value with the
   other keys' stored or default values.
4. Only then is the change persisted.

**Write transaction.** In one transaction: upsert `SYSTEM_CONFIGS` (insert the
row when the registry key has no stored row; otherwise update `config_value`,
`updated_by = current Admin`, `updated_at = now()`) and insert one append-only
`SYSTEM_CONFIG_AUDIT` row (`config_key`, `old_value`,
`new_value`, `changed_by`, `changed_at`). When the write creates the first row
for a key, `old_value` is `NULL`. `database-schema.md` §3.31/§5.16 owns the
table and integrity notes. The MVP write path always supplies `changed_by`
(the acting Admin); the column stays nullable as documented, with the null
case reserved for potential future migration/seed tooling (no seed or
migration writes audit rows in the MVP).

**No-op semantics.** A `PATCH` whose value equals the stored value (or, when
the row is absent, the documented default) is a no-op: nothing is written, no
audit row is created, and the request returns `200` with the unchanged item.

**Cache invalidation.** After the transaction commits, the service calls
`clearCache()` on both readers so the next read observes the new value. The
maximum propagation delay is the 60-second cache TTL (decided 2026-10-10,
§21); this is acceptable for the current single-process deployment. A
cross-process mechanism (for example PostgreSQL `LISTEN/NOTIFY`) is deferred
until a multi-process deployment exists and is not introduced now.

**Admin UI.** A screen under the Admin feature area lists keys grouped by the
seven registry domains, shows current value, documented default, description,
and last change, and edits via a type-aware input (number with range, toggle,
or select). The UI must not advertise a separate "takes effect immediately"
key class; the only timing note is the ≤60 s propagation window. The UI is a
convenience layer only; the server enforces `ADMIN` authorization and
validation. See §9 and the PRD §9.

**Boundaries.** The write path manages existing business configuration only. It
never writes secrets/environment settings. It does not expose or mutate the
readers' behavior beyond returning the stored value. Typed readers for key
groups without a consuming feature yet (team, report, player-skill-adjustment,
full matchmaking/tournament groups) are added when those features need them;
the registry and management surface cover all §8 keys regardless.

## 8. Behavior, State, and Flow

```text
[not cached] → [loaded from SYSTEM_CONFIGS] → [cached for TTL]
    ↑                                              │ TTL expires or clearCache()
    └──────────────────────────────────────────────┘
```

- Preconditions: the `SYSTEM_CONFIGS` table exists and is reachable.
- State transitions: a read either serves from cache or reloads; a reload always
  produces a fully populated map because every owned key has a default.
- Postconditions: a typed value is returned; no exception is thrown for a
  missing or invalid stored value.
- `N/A — no user-visible stateful flow`. Entity-level snapshot transitions are
  owned by each consuming feature.

## 9. API Design

All endpoints are under `/api/v1/admin/configs`, require `authenticate` +
`requireRole('ADMIN')`, and follow `docs/architecture/conventions.md` (success
shape within the feature, global error shape, offset pagination).

### 9.1 List configuration values

- Operation: list manageable configuration values (the full registry catalog,
  including keys with no stored row).
- `GET /api/v1/admin/configs`
- Query: `domain` (optional; one of `booking`, `auth`, `matchmaking`,
  `tournament`, `team`, `report`, `player-skill-adjustment`; any other value is
  rejected `400 VALIDATION_FAILED`), `page` (1-indexed), `limit` (default
  `100`; the \~30-key catalog fits a single page when the UI passes no limit).
  Pagination follows the global `{ page, limit, total, totalPages }` `meta`
  contract.
- Response `200`:
  `{ data: [ConfigItem], meta: { page, limit, total, totalPages } }` where
  `ConfigItem = { configKey, configValue, valueType, domain, description,
  documentedDefault, usingDefault, updatedAt, updatedBy }`.
  - `description` comes from the registry (the single source of truth); the
    `SYSTEM_CONFIGS.description` column is not returned.
  - `usingDefault` is `true` when the key has no stored row; `configValue`
    then shows the documented default and `updatedAt`/`updatedBy` are `null`.
- Authentication/authorization: `ADMIN` only.
- Errors: `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`,
  `400 VALIDATION_FAILED` for an unknown `domain`.

### 9.2 Get one configuration value

- Operation: inspect one key.
- `GET /api/v1/admin/configs/:configKey`
- Response `200`: `{ data: ConfigItem }` (same shape as §9.1, including the
  `usingDefault` fallback for a key with no stored row).
- Errors: `401`, `403`, `404 CONFIG_KEY_NOT_FOUND` when the key is not in the
  registry.

### 9.3 Update a configuration value

- Operation: update an existing key's value.
- `PATCH /api/v1/admin/configs/:configKey`
- CSRF: required (`X-CSRF-Token`).
- Request: `{ "value": <string | number | boolean> }`.
- Behavior: validate against the registry (§7.5), then write the value and the
  audit row in one transaction (upsert), then invalidate reader caches. When
  the value equals the stored (or default) value the request is a no-op:
  nothing is written, no audit row is created.
- Response `200`: `{ data: ConfigItem }` for the updated key.
- Errors:
  - `400 VALIDATION_FAILED` — missing/malformed body.
  - `400 CONFIG_VALUE_INVALID` — value fails type, range, enum, or a cross-key
    rule; `details` lists `{ field, code }`.
  - `404 CONFIG_KEY_NOT_FOUND` — key not in the registry.
  - `401 AUTH_SESSION_INVALID`, `403 AUTH_FORBIDDEN_ROLE`,
    `403 AUTH_CSRF_TOKEN_INVALID`.
- Idempotency: `PATCH` with the same stored value is idempotent and writes no
  audit row; an audit row is written only when the value actually changes
  (see §13).

The UI consumes §9.1–§9.3; no other contract is introduced.

## 10. Data Model / Schema Delta

- Existing schema objects affected: `SYSTEM_CONFIGS`
  (`docs/architecture/database-schema.md` §3.26).
- Schema delta: add `SYSTEM_CONFIG_AUDIT`
  (`docs/architecture/database-schema.md` §3.31) as an append-only change
  history:
  - `id` (PK), `config_key` (varchar, no FK so history survives key removal),
    `old_value` (text, nullable — `NULL` when the write creates the key's first
    row), `new_value` (text, not null),
    `changed_by` (bigint, FK → `USERS.id`, nullable; the MVP write path always
    supplies the acting Admin, and the null case is reserved for potential
    future migration/seed tooling),
    `changed_at` (timestamp).
  - `SYSTEM_CONFIGS` itself is unchanged.
- Constraints/indexes affected: supporting index
  `SYSTEM_CONFIG_AUDIT (config_key, changed_at)`; append-only is enforced
  application-side (no code path updates or deletes audit rows; no DB trigger
  in MVP) per `database-schema.md` §5.16.
- Migration/data backfill impact: a new ordered migration after `0006` creates
  `SYSTEM_CONFIG_AUDIT`. No backfill is required. Existing key-seed migrations
  remain idempotent:
  - `0003` seeds the `BOOKING_*`, `PLAYER_CANCELLATION_DEADLINE_MINUTES`,
    `OWNER_*`, and `REFUND_*` keys;
  - `0004` seeds the `MATCHMAKING_*` keys;
  - `0002` seeds `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`;
  - `0005` seeds the eight `AUTH_*` keys.
- Rationale and compatibility: keeping `config_value` as `text` and validating
  through the registry keeps the schema stable; the audit table is additive and
  does not affect read behavior. `database-schema.md` and its Change Log were
  updated in the same session. Registry keys not covered by any seed migration
  (`TEAM_INVITATION_TIMEOUT_MINUTES`, `REPORT_ENABLED`, the remaining
  `TOURNAMENT_*`, and the `PLAYER_SKILL_ADJUSTMENT_*` keys) simply have no row:
  reads fall back to the documented default and the first Admin write upserts
  the row.

## 11. Security

- Authentication boundary: the management endpoints use the shared
  `authenticate` middleware (opaque `sid` cookie); reads inside feature
  operations remain server-side.
- Authorization boundary: management endpoints use
  `requireRole('ADMIN')`. The registry and write path reject anything a
  non-`ADMIN` caller attempts; the UI hide-state is not the control.
- Input and output protection: the `configKey` path parameter is matched against
  the registry (not used as raw SQL); the `value` is type/range/enum validated
  before persistence. Stored values remain untrusted when read.
- Sensitive data handling: secrets, credentials, tokens, and connection strings
  must never be stored in `SYSTEM_CONFIGS`; they belong to
  `shared/config/env.ts`. The management surface must not accept secret-like
  keys because they are not in the registry.
- CSRF/XSS considerations: `PATCH` requires `X-CSRF-Token`; responses render
  values as data and the UI must not inject `config_value` as raw HTML.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Key row missing (read) | Key not found in loaded rows | Use the matrix §8 default | `WARN` log with key and default, for every key group; request succeeds |
| Registry key not yet stored (write) | Key in registry, no row | Upsert creates the row | `SYSTEM_CONFIG_AUDIT.old_value` = `NULL`; history reflects the first write |
| Registry key not yet stored (read API) | Key in registry, no row | `GET` returns the documented default | `ConfigItem` shows `usingDefault: true`, `updatedBy`/`updatedAt` = `null` |
| Stored value fails type/range/enum (read) | Registry validation fails on load | Use the §8 default | `ERROR` log with key and stored value, for every key group; request succeeds |
| Blank or empty value | Trim yields empty | Treat as invalid/missing → default | `ERROR` log with key; request succeeds |
| Numeric value below/above its key range | Value outside the registry range | Use the default | `ERROR` log with key; request succeeds |
| Cache holds a pre-change value | Value changed in DB | Old value is used until TTL expires or `clearCache()` | Documented cache window (≤60 s); `clearCache()` for tests |
| `SYSTEM_CONFIGS` unreachable | Data-access error | Error propagates as an internal error at the boundary | Existing centralized error handling; log diagnostics |
| Unknown key on write | Key not in the registry | Reject, no write | `404 CONFIG_KEY_NOT_FOUND` |
| Value fails type/range/enum | Registry validation fails | Reject, no write | `400 CONFIG_VALUE_INVALID` with `details` |
| Cross-key rule violated | Cross-key validation fails | Reject, no write | `400 CONFIG_VALUE_INVALID`; message names the conflicting key |
| Concurrent update to the same key | Two Admins submit near-simultaneously | Last committed write wins; each successful commit writes its own audit row | History shows both changes; no partial write |
| Repeated write of the same value | New value equals stored value (or default when no row) | No-op; no audit row | `200` returns the unchanged item |

## 13. Concurrency / Idempotency

- Concurrency-sensitive operation: updating a configuration value. The update
  and its audit row are one transaction; a concurrent update uses last-commit-wins
  semantics and is not a partial write. Read-modify-write of the same key does
  not require optimistic locking in MVP because the value set is small and Admin
  edits are rare.
- Idempotency requirement: `PATCH` with the same value is a no-op and writes no
  audit row; a distinct value produces exactly one audit row per change.
- Transaction boundary: `UPDATE SYSTEM_CONFIGS` and `INSERT SYSTEM_CONFIG_AUDIT`
  commit together or roll back together. Cache invalidation happens after commit
  and never inside the transaction.
- Race-condition handling: readers are read-only; a reload replaces the cached
  map atomically. A write is observed by subsequent reads after cache
  invalidation (current process) or TTL expiry.
- Snapshot protection for entities is owned by each consuming feature and must
  be implemented there, not here.

## 14. Performance

- Expected workload/latency consideration: authentication reads occur on most
  requests, so configuration reads must avoid a database round-trip per request.
- Relevant bottleneck: a full `SYSTEM_CONFIGS` select per read.
- Design response: a 60-second in-memory cache per reader, cleared explicitly in
  tests. The table is small, so a full select on cache miss is acceptable. The
  60-second TTL is the decided maximum propagation delay (§21).

## 15. Events / Notifications

- Event or notification behavior: `N/A`.
- Trigger and recipient: `N/A`.
- Delivery/retry implications: `N/A`.
- Background/scheduled processing: `N/A`.

## 16. Testing Considerations

- Unit behavior: default fallback when a key is missing (`WARN`) and when a
  stored value is invalid (`ERROR`), uniformly for both readers; typed mapping
  (for example `getSessionTimeouts(role)` per role); cache behavior (second call
  within TTL does not reload; `clearCache()` forces a reload); registry
  validation (type, range, enum, cross-key rules §7.3) and the no-op
  same-value path.
- Integration/persistence behavior: values seeded by migrations are readable;
  values from the registry with no seeded row fall back to defaults; updating
  a row and clearing the cache yields the new value; a successful change writes
  exactly one `SYSTEM_CONFIG_AUDIT` row in the same transaction; the first
  write to a registry key with no row upserts it with `old_value = NULL`.
- API-level behavior: list/detail/update authorization (`ADMIN` only), the
  `domain` enum validation (unknown domain → `400 VALIDATION_FAILED`),
  pagination `meta`, `usingDefault` fallback for a key with no row,
  `404 CONFIG_KEY_NOT_FOUND` for unknown keys, `400 CONFIG_VALUE_INVALID`
  for bad values and cross-key violations, CSRF enforcement on `PATCH` with
  the shared `AUTH_CSRF_TOKEN_INVALID` code, and the unchanged-value no-op.
- Critical E2E flow: an Admin opens the System Configuration screen, filters to a
  domain, updates a value, sees the confirmation, and the new value is reflected
  for a subsequent read; a non-`ADMIN` user cannot reach the screen or the API.
- Concurrency/idempotency verification: repeated identical `PATCH` writes no
  audit row; two different values produce two audit rows with last-commit-wins.
- Existing indirect coverage: `backend/src/__tests__/booking-write.test.ts`
  seeds and clears `SYSTEM_CONFIGS`/`bookingConfig`; authentication tests cover
  lockout and session timeout behavior. Dedicated reader and management tests
  are tracked in [tasks.md](tasks.md).

## 17. Migration / Rollout

- Migration steps: add one ordered migration after `0006` creating
  `SYSTEM_CONFIG_AUDIT` (and its index). Existing seed migrations remain
  idempotent. The migration does not alter `SYSTEM_CONFIGS`.
- Rollout sequencing: the audit migration is independent of the reader changes;
  the read path keeps working before and after.
- Backward compatibility: adding a key or an audit row is additive; a missing
  key falls back to the documented default; older code ignores the audit table.
- Rollback/recovery: dropping the audit table loses history only and does not
  affect behavior; removing a seeded config row is safe because readers fall
  back to defaults.

## 18. Alternatives Considered

- **Environment variables per business parameter.** Rejected: business
  configuration must be inspectable and changeable without a redeploy, and
  `docs/architecture/conventions.md` separates configuration from secrets.
- **Database read on every access (no cache).** Rejected for the authentication
  hot path.
- **Single generic reader returning raw strings.** Rejected as the only
  boundary: per-group typed facades encode the documented shape consumers need;
  the shared loader under them applies the registry validation (see the
  adopted consolidation above).
- **A generic reader without per-key ranges.** Rejected: the registry
  (§7.3) validates type/range/enum before any write, which the fallback-only
  approach would leave to luck.
- **Consolidating both readers into one generic loader.** Adopted on
  2026-10-10 (§21): the registry (§7.3) is the single source of keys, types,
  ranges, enum values, defaults, and descriptions; a shared registry-validated
  loader serves both the readers and the management surface; the public
  facades `systemConfig` and `bookingConfig` and their behavior are preserved,
  so the refactor remains behavior-preserving.
- **Reuse only `updated_by`/`updated_at` instead of an audit table.** Rejected:
  the approved scope requires a change history (actor, time, old value, new
  value), which a single repeatedly-overwritten row cannot provide.
- **Free-form key creation from the UI.** Rejected: keys are introduced through
  the documented configuration process and a migration, so the management
  surface only updates existing registry keys.

## 19. Observability / Monitoring

- Logs: missing key (`WARN` with key and default); invalid stored value
  (`ERROR` with key and stored value); successful change (`INFO` with key and
  Admin id). No §8 key is treated as sensitive: the audit table already stores
  the old/new values, so update logs may reference them. Logs must never
  include secrets — secrets never exist in `SYSTEM_CONFIGS` (§11).
- Metrics: `N/A` unless monitoring tooling is approved
  (`docs/architecture/conventions.md` — Decision Boundaries).
- Alerts/operational signals: repeated invalid-value `ERROR` logs indicate a
  misconfiguration that should be corrected.

## 20. Acceptance / Verification Considerations

- **Given** a key row is absent from `SYSTEM_CONFIGS`
  **When** a feature reads that key (any key group)
  **Then** the documented matrix §8 default is returned and a `WARN` with the
  key and default is logged.

- **Given** a stored value that fails its registry validation (for example a
  non-numeric or out-of-range value)
  **When** the reader loads configuration
  **Then** the §8 default is used, an `ERROR` with the key and stored value is
  logged, and the consuming request still succeeds.

- **Given** an `ADMIN` calls `GET /api/v1/admin/configs/:configKey` for a
  registry key with no stored row
  **When** the response returns
  **Then** `configValue` is the documented default, `usingDefault` is `true`,
  and `updatedAt`/`updatedBy` are `null`.

- **Given** an authenticated `ADMIN`
  **When** they `PATCH` a registry key that has no stored row with a valid
  value
  **Then** the row is created (upsert), the audit row records
  `old_value = NULL`, and a subsequent read observes the new value.

- **Given** a valid value is stored and the cache has been cleared
  **When** a feature reads the key
  **Then** the stored value is returned.

- **Given** a value changed in `SYSTEM_CONFIGS` while a cached value is in fresh
  cache
  **When** a feature reads before TTL expiry
  **Then** the previous value is returned until TTL expiry or `clearCache()`.

- **Given** a Booking was created under a previous `BOOKING_PAYMENT_TIMEOUT_MINUTES`
  **When** the configured value changes
  **Then** the existing Booking keeps its snapshotted `expires_at` (verified in
  the Booking feature, not in this capability).

- **Given** an authenticated `ADMIN`
  **When** they `PATCH` an existing key with a valid value
  **Then** the response is `200`, the stored value becomes the new value, one
  `SYSTEM_CONFIG_AUDIT` row is written, and a subsequent read observes the new
  value.

- **Given** an authenticated `ADMIN`
  **When** they `PATCH` a key with the value that is already stored
  **Then** the response is `200` with the unchanged item, no write occurs, and
  no audit row is written.

- **Given** an authenticated `ADMIN`
  **When** they `PATCH` with an unknown key or an invalid/cross-key-violating
  value
  **Then** the response is `404 CONFIG_KEY_NOT_FOUND` or
  `400 CONFIG_VALUE_INVALID`, no value changes, and no audit row is written.

- **Given** an authenticated non-`ADMIN` user
  **When** they call any `/api/v1/admin/configs` endpoint
  **Then** the response is `403 AUTH_FORBIDDEN_ROLE` and no value changes.

- **Given** an authenticated `ADMIN` updating without a valid `X-CSRF-Token`
  **When** they `PATCH`
  **Then** the request is rejected with the shared CSRF error and no value
  changes.

## 21. Open Questions / TBD

| Question or decision | Authority/owner | Implementation impact | Status |
| --- | --- | --- | --- |
| Is an Admin configuration management surface (read and write API/UI) in MVP scope? | Business Owner / PM | Decided in scope (PRD §4, §15; `PROJECT-BRIEF.md` §4, §5 updated 2026-10-10) | RESOLVED |
| Should configuration changes be audited beyond `updated_by`/`updated_at`? | Business Owner | Decided: append-only `SYSTEM_CONFIG_AUDIT` (`database-schema.md` §3.31); additionally, a repeated write of the same value records no audit row | RESOLVED |
| Is a 60-second read cache acceptable as the maximum propagation delay, and is cross-process invalidation required? | Tech Lead | Resolved 2026-10-10: 60 s TTL + in-process `clearCache()` on write is sufficient for the single-process MVP deployment; maximum propagation delay is 60 s. Cross-process invalidation (for example PostgreSQL `LISTEN/NOTIFY`) is deferred until a multi-process deployment exists | RESOLVED |
| Should the two typed readers be consolidated into one generic, validated loader? | Tech Lead | Resolved 2026-10-10: yes — the registry (§7.3) is the single source of types/ranges/enum values/defaults/descriptions; a shared registry-validated loader serves both the readers and the management surface; the public facades `systemConfig` and `bookingConfig` and their behavior are preserved (behavior-preserving refactor) | RESOLVED |
| Where do per-key ranges and enum values come from? | Business Owner | Resolved 2026-10-10: the registry constraint catalog in §7.3 is adopted (recorded there with a pending-Business-Owner-confirmation note); adjustments follow the matrix §11 process | RESOLVED (pending confirm) |
| What is listed for a registry key that has no `SYSTEM_CONFIGS` row? | Tech Lead | Resolved 2026-10-10: reads fall back to the documented default (`usingDefault: true`); the first `PATCH` upserts the row with `old_value = NULL` in the audit row | RESOLVED |

No `TBD` items remain. Document status stays `Draft` until the human
readiness gate (§22) is passed.

## 22. Decision Status

```text
Decision Status: Proposed
Approval needed from: Human owner (scope — granted 2026-10-10) / Tech Lead (design)
Approved decision/reference: PRD §15; §21 resolutions 2026-10-10; database-schema.md Change Log 2026-10-10
```

All previously open questions in §21 were resolved by the human owner on
2026-10-10 (per the §21 table). This document follows the human readiness
gate in `docs/documentation-guide.md` §6.3 and intentionally stays `Draft`
until that gate is passed.

## Ratings reader alignment — approved 2026-10-15

The human owner confirmed the existing catalog bounds for `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` (1–100), `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` (1–6), `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` (0–365), and boolean semantics for `PLAYER_SKILL_ADJUSTMENT_ENABLED` / `TOURNAMENT_RATING_ENABLED`. Unrelated pending bounds are unaffected.

Ratings consumes these five keys through typed shared readers backed by the shared registry/validated loader, never feature-repository queries. Extend cache invalidation to every reader/facade that serves these keys; shared loader cache invalidation may satisfy this without duplicate caches. Preserve ≤60-second propagation, missing WARN/default, invalid ERROR/default. Capture one config bundle for a rating request; writes do not trigger retroactive adjustment. If registry consolidation is not yet implemented, Ratings includes the minimal shared integration required for these keys and must not create a competing config registry.

Defaults/ranges remain owned by the matrix and catalog above. Implementation: Ratings RT-01 and RT-06.


Ratings reader implementation audit, 2026-10-15: `shared/config/config-registry.ts` owns the five Ratings-key definitions/defaults/bounds and validated cached loader; `ratings-config.ts` is a thin typed facade. Tests cover strict parsing, missing/invalid fallback/logging, TTL and explicit invalidation. This is the approved minimal Ratings integration, not completion of the broader Auth/Booking/Matchmaking registry consolidation or Admin configuration UI. Future management writes for these keys must reuse these definitions and clear the shared cache.

2026-10-23: Court Owner review adds MAINTENANCE_ADVANCE_WINDOW_DAYS=90 to the registry/read/seed scope, owned by CO-01; use business-rules §8.2. Applies to new block creation, not existing block dates. This approved key does not change this document’s Draft status or resolve unrelated registry constraints.

## Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

Status: Ready, Decision Status Approved. Source of keys and semantics: `docs/business-rules-config-matrix.md` §8.8–§8.9.

- Registry: add every §8.9 key and `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` to `shared/config/config-registry.ts` definitions (type, default, min, max), extending the existing Ratings pattern; SC-06 later consumes the same definitions. Domains add `social` and `messaging`. Cross-key rule: `MATCHMAKING_GROUP_MIN_SLOTS ≤ MATCHMAKING_GROUP_MAX_SLOTS`.
- `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` range becomes 15–10080. A stored value outside the range would fall back to the default, so the migration preflight reports it and stops for a human decision; it never rewrites a stored value.
- Seeding: `INSERT … ON CONFLICT (config_key) DO NOTHING` only. Existing values, including `15`, are kept because `SYSTEM_CONFIG_AUDIT` (SC-09) does not exist and defaults cannot be distinguished from Admin choices. New defaults apply only when a key is absent.
- `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`: no longer read after the Matchmaking cutover; row kept; marked deprecated in the registry; removed by a later task.
- `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES`: seeded from the stored `MIN_RATINGS` value only when absent (Ratings §25.5).
- Cache: existing 60-second readers; gate checks happen in services (no middleware).


### Final Phase 2 approval — 2026-10-31

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.
