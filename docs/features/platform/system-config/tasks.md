# System Configuration — Task List

## Task completion review — 2026-11-01

Review requested by the owner. The per-task review notes below supersede older implementation-progress blockers only where explicitly stated. Verification: reviewed code at e760ed4; `npm test --prefix backend` PASS, 42/42 files and 515/515 tests (905.73s), on the separate `badminton_test` database; `npm run build --prefix backend` PASS. Full run log: `/tmp/social-task-review-tests.log`. Test-only BlockPort coverage is not production Messaging integration. Shared schema/document PR review before merge is unchanged. No governing business choice is approved by changing task status.

Implementation tasks for the System Configuration platform capability.

- Linked PRD: [prd.md](prd.md) (Draft)
- Linked Tech Design: [tech-design.md](tech-design.md) (Draft, Decision Status: Proposed)
- Documentation created: 2026-10-10
- Assignee: TBD for every open task

**Rules applied** (`.agents/AGENTS.md`, `docs/documentation-guide.md` §5.4): no task creates
a new design decision or changes the PRD, the Tech Design, `database-schema.md`, or
`docs/business-rules-config-matrix.md`. All former open scope questions in Tech Design §21
were resolved by the human owner on 2026-10-10 (PRD §14/§15, Tech Design §20/§21) before
write-surface implementation; the registry constraint catalog (Tech Design §7.3) carries a
pending Business Owner confirmation note and may be adjusted through the matrix §11 process.

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through `IN_PROGRESS` and
  `DONE` (`docs/templates/task-template.md`).
- `BLOCKED`: cannot start; the blocker is named.
- `DONE`: acceptance criteria pass and required verification is complete. The retrospective
  tasks below are already implemented in the repository and are recorded here for
  traceability; the human owner confirmed and ticked SC-01–SC-03 and SC-05 on 2026-10-10.

**Definition of Done:** the task's acceptance criteria pass and the verification steps under
"Verification" are complete. A task cannot move to `DONE` until its automated tests exist and
pass.

## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| SC-01 | `SYSTEM_CONFIGS` schema and configuration seed migrations | DONE | — | S |
| SC-02 | `AUTH_*` typed configuration reader with defaults, validation, and cache | DONE | SC-01 | M |
| SC-03 | `BOOKING_*` typed configuration reader | DONE | SC-01 | S |
| SC-04 | Dedicated configuration reader verification tests | DONE | SC-02, SC-03 | S |
| SC-05 | Author and verify the System Configuration feature documentation | DONE | — | S |
| SC-06 | Known-key registry and value/cross-key validation | DONE | SC-09 | M |
| SC-07 | Admin config list and detail API | DONE | SC-06 | M |
| SC-08 | Admin config update API with audit and cache invalidation | DONE | SC-06, SC-09 | M |
| SC-09 | `SYSTEM_CONFIG_AUDIT` schema delta and migration | DONE | SC-01 | S |
| SC-10 | Admin System Configuration screen | IN_PROGRESS (base UI, UI-REDO) | SC-07, SC-08 | M |
| SC-11 | Management surface tests (registry, API, audit, E2E) | IN_PROGRESS (E2E pending) | SC-07, SC-08, SC-09 | M |

## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | SC-01, SC-09 | SC-01 (for SC-09) |
| 2 | SC-02, SC-03, SC-04, SC-05, SC-06 | SC-01 (for SC-02/SC-03); SC-09 (for SC-06) |
| 3 | SC-07, SC-08 | SC-06 (and SC-09 for SC-08) |
| 4 | SC-10, SC-11 | SC-07, SC-08, SC-09 |

---

## Notes on the approved write surface

SC-06–SC-11 implement the Admin management surface approved on 2026-10-10 (PRD
§15, Tech Design §7.5, §9, §10). They do not introduce new business rules or a
new system role; all endpoints are `ADMIN`-only and validate against the catalog
in `docs/business-rules-config-matrix.md` §8.

## [x] SC-01: `SYSTEM_CONFIGS` schema and configuration seed migrations

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide the persisted configuration store and idempotently seed the documented
configuration keys.

**Scope**

- In scope:
  - `system_configs` table (`docs/architecture/database-schema.md` §3.26).
  - Seed `BOOKING_*`/`PLAYER_*`/`OWNER_*`/`REFUND_*` keys, `MATCHMAKING_*` keys,
    `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`, and the eight `AUTH_*` keys.
- Out of scope:
  - Keys for features whose Tech Designs do not yet exist (Tournament beyond registration
    payment timeout, Team invitation, Report, Player skill adjustment).

**Implementation requirements**

1. Create the `system_configs` table with `config_key` unique and nullable `updated_by`.
2. Seed each documented key with `ON CONFLICT (config_key) DO NOTHING` so a stored value is
   never overwritten by a migration.

**Files/areas affected**

- `backend/src/db/schema/config.ts`
- `backend/src/db/migrations/0000_black_cassandra_nova.sql` (table)
- `backend/src/db/migrations/0002_public_ronan.sql`, `0003_careless_karma.sql`,
  `0004_lyrical_junta.sql`, `0005_auth_tables.sql` (seeds)

**API impact:** None

**Schema/config impact:** Creates `SYSTEM_CONFIGS`; seeds configuration rows.

**Verification**

- Integration: migrations apply cleanly and re-apply idempotently against the test database.
- Manual: confirm each §8 key group has corresponding seeded rows.

**Acceptance criteria**

- **Given** a fresh database
  **When** migrations run
  **Then** `system_configs` exists and contains the documented keys for Booking, Matchmaking,
  Tournament registration payment timeout, and Authentication.

- **Given** a seeded database
  **When** migrations run again
  **Then** no stored value is overwritten.

---

## [x] SC-02: `AUTH_*` typed configuration reader with defaults, validation, and cache

```text
Status: DONE
Size: M
Blocked by: SC-01
```

**Objective:** Provide a typed server-side reader for the eight `AUTH_*` keys with documented
defaults, invalid-value handling, and a short in-memory cache.

**Scope**

- In scope: `AUTH_CONFIG_DEFAULTS`, positive-integer validation, default fallback with logging,
  60-second cache, `clearCache()`, and role-based session timeout accessors.
- Out of scope: any HTTP endpoint; persisting values.

**Implementation requirements**

1. Define the eight `AUTH_*` defaults matching `docs/business-rules-config-matrix.md` §8.7.
2. Load owned keys from `SYSTEM_CONFIGS`; missing → default + `WARN`; invalid → default +
   `ERROR` with key and stored value.
3. Expose `getLockoutThreshold`, `getLockoutMinutes`, `getLoginLockoutConfig`,
   `getSessionTimeouts(role)`, and `clearCache()`.

**Files/areas affected**

- `backend/src/shared/config/system-config.ts`

**API impact:** None

**Schema/config impact:** Reads `SYSTEM_CONFIGS`; no schema change.

**Verification**

- Unit: default fallback, invalid numeric handling, per-role timeouts.
- Integration: value change followed by `clearCache()` is observed.

**Acceptance criteria**

- **Given** a missing `AUTH_*` row
  **When** a reader accessor is called
  **Then** the §8.7 default is returned and a `WARN` is logged.

- **Given** an invalid `AUTH_*` value
  **When** the reader loads configuration
  **Then** the §8.7 default is used, an `ERROR` with the key and value is logged, and the
  caller still receives a usable value.

---

## [x] SC-03: `BOOKING_*` typed configuration reader

```text
Status: DONE
Size: S
Blocked by: SC-01
```

**Objective:** Provide a typed server-side reader for the Booking configuration keys with
documented defaults, validation, and a short in-memory cache.

**Scope**

- In scope: `BOOKING_CONFIG_DEFAULTS`, integer/boolean parsing with minimums, default fallback
  with logging, 60-second cache, `get()` and `clearCache()`.
- Out of scope: owner/refund keys consumed by other features; any HTTP endpoint.

**Implementation requirements**

1. Define `BOOKING_CONFIG_DEFAULTS` matching `docs/business-rules-config-matrix.md` §8.2.
2. Parse numeric keys against per-key minimums and boolean keys as exact `true`/`false`.
3. Return a typed `BookingConfig`; uniform logging: a missing row falls back with a
   `WARN` (key + default), an invalid stored value falls back with an `ERROR`
   (key + stored value).

**Files/areas affected**

- `backend/src/shared/config/booking-config.ts`

**API impact:** None

**Schema/config impact:** Reads `SYSTEM_CONFIGS`; no schema change.

**Verification**

- Integration: Booking write/availability tests that seed and clear configuration observe the
  configured values (`backend/src/__tests__/booking-write.test.ts`).

**Acceptance criteria**

- **Given** a valid stored `BOOKING_*` value
  **When** `bookingConfig.get()` is called after `clearCache()`
  **Then** the typed value reflects the stored value.

- **Given** an invalid stored value
  **When** `bookingConfig.get()` is called
  **Then** the documented default is returned and an `ERROR` (key + stored value)
  is logged; a missing row logs `WARN`.

---

## [x] SC-04: Dedicated configuration reader verification tests

```text
Status: DONE
Size: S
Blocked by: SC-02, SC-03
```

**Objective:** Add focused tests for the configuration readers so missing/invalid/cache
behavior is verified directly rather than only indirectly through consuming features.

**Scope**

- In scope:
  - missing-key default fallback (`WARN` asserted);
  - invalid numeric and boolean handling (`ERROR` asserted, uniformly for both
    readers);
  - cache hit within TTL and reload after `clearCache()`;
  - per-role `getSessionTimeouts` mapping.
- Out of scope:
  - changing reader behavior;
  - the Admin management surface (see SC-06–SC-11).

**Implementation requirements**

1. Add backend tests under `backend/src/__tests__/` using the existing test database setup.
2. Seed/override `SYSTEM_CONFIGS` rows per case and call `clearCache()` between cases.
3. Assert returned values, the asserted log levels (`WARN` missing / `ERROR`
   invalid for both readers), and that no exception is thrown for invalid input.

**Files/areas affected**

- `backend/src/__tests__/` (new system-config test file)
- `[Proposed — verify during implementation]`

**API impact:** None

**Schema/config impact:** None

**Verification**

- Unit: reader default/validation/cache behavior.
- Integration: reader observes seeded and updated rows against the test database.

**Acceptance criteria**

- **Given** the test suite
  **When** it runs
  **Then** missing (`WARN`), invalid (`ERROR`), and cache scenarios pass for both
  readers with the asserted log levels.

---

## [x] SC-05: Author and verify the System Configuration feature documentation

```text
Status: DONE
Size: S
Blocked by: N/A
```

**Objective:** Provide the PRD, Tech Design, and Task list that document the existing
capability and record the scope decisions.

**Scope**

- In scope: this document set under `docs/features/platform/system-config/`; traceability links
  to `docs/business-rules-config-matrix.md` §8 and `docs/architecture/database-schema.md` §3.26;
  recording of the scope decisions confirmed by the human owner on 2026-10-10
  (PRD §14/§15, Tech Design §21).
- Out of scope: changing business rules or schema.

**Implementation requirements**

1. Describe the capability and its snapshot semantics without redefining §8 values.
2. Keep document status `Draft` until a human confirms it.
3. Never resolve a `TBD` by assumption; every resolved question must cite its
   deciding authority and date.

**Files/areas affected**

- `docs/features/platform/system-config/prd.md`
- `docs/features/platform/system-config/tech-design.md`
- `docs/features/platform/system-config/tasks.md`

**API impact:** None

**Schema/config impact:** None

**Verification**

- Manual: links resolve; the key groups referenced match
  `docs/business-rules-config-matrix.md` §8.

**Acceptance criteria**

- **Given** a reader of the docs
  **When** they open the System Configuration folder
  **Then** the PRD, Tech Design, and Task list exist and link to the authoritative matrix and
  schema sections.

- **Given** a resolved scope question
  **When** the docs are reviewed
  **Then** it is recorded with its decision, authority, and date (PRD §14/§15,
  Tech Design §21).

- **Given** an unresolved scope question
  **When** the docs are reviewed
  **Then** it is recorded as `TBD` rather than decided.

**Completion checklist**

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `TBD` was silently resolved.
- [ ] No unrelated files or refactors were included.

---

## [x] SC-06: Known-key registry and value/cross-key validation

```text
Status: DONE
Size: M
Blocked by: SC-09
```

**Objective:** Provide the server-side registry of manageable keys and the
validation used by the management API, sourced from
`docs/business-rules-config-matrix.md` §8.

**Scope**

- In scope:
  - registry entry per key: `domain`, `valueType`, `min`, `max`, `enumValues`,
    `documentedDefault`, `description`;
  - the registry as the single source of truth — both the read readers and the
    management service load keys/types/ranges/enum values/defaults/
    descriptions from it; no duplicated default maps;
  - validation for type, range, enum, and cross-key rules against the
    constraint catalog (Tech Design §7.3);
  - the cross-key rules `BOOKING_MIN_DURATION_MINUTES <=
    BOOKING_MAX_DURATION_MINUTES` and, per role,
    `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_<ROLE> <=
    AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_<ROLE>`;
  - the seven domains `booking`, `auth`, `matchmaking`, `tournament`, `team`,
    `report`, `player-skill-adjustment`.
- Out of scope:
  - creating new keys; reading values for domain features (SC-02/SC-03).

**Implementation requirements**

1. Place the registry as the single catalog source; refactor the readers to
   import defaults/validation from it while preserving their public APIs
   (behavior-preserving consolidation per Tech Design §7.2/§21).
2. Validate in the order defined by Tech Design §7.5.
3. Return stable, machine-readable failure reasons for type/range/enum and
   cross-key violations.

**Files/areas affected**

- `backend/src/shared/config/` and/or `backend/src/services/admin/`
- `[Proposed — verify during implementation]`

**API impact:** None directly; consumed by SC-07 and SC-08.

**Schema/config impact:** None (reads the catalog, does not change it).

**Verification**

- Unit: registry lookup; valid/invalid type, range, enum, and cross-key cases.

**Acceptance criteria**

- **Given** the registry
  **When** a value satisfies its key's type/range/enum and cross-key rules
  **Then** validation passes.

- **Given** an unknown key or an invalid value
  **When** validation runs
  **Then** it fails with a specific reason and no value is written.

---

## [x] SC-07: Admin config list and detail API

```text
Status: DONE
Size: M
Blocked by: SC-06
```

**Objective:** Expose read-only Admin endpoints to list and inspect configuration
values.

**Scope**

- In scope: `GET /api/v1/admin/configs` (with `domain` filter — one of the
  seven registry domains, unknown value rejected `400 VALIDATION_FAILED` — and
  offset pagination, default `limit` 100) and
  `GET /api/v1/admin/configs/:configKey`; both include registry keys that have
  no stored row (`usingDefault: true`, `configValue` = documented default,
  `description` served from the registry).
- Out of scope: writes (SC-08); UI (SC-10).

**Implementation requirements**

1. Add thin routes, a controller, and a service that reads through the data
   layer and joins with the registry metadata (registry is the source of
   `description`, `valueType`, `domain`, `documentedDefault`).
2. Enforce `authenticate` + `requireRole('ADMIN')`.
3. Use the global `meta` pagination contract with default `limit` 100.

**Files/areas affected**

- `backend/src/routes/admin/`, `backend/src/controllers/admin/`,
  `backend/src/services/admin/`
- `[Proposed — verify during implementation]`

**API impact:** New `GET /api/v1/admin/configs` and
`GET /api/v1/admin/configs/:configKey` (Tech Design §9.1, §9.2).

**Schema/config impact:** None.

**Verification**

- API: authorization, pagination `meta`, `domain` filter (valid and unknown
  values), key with no stored row (`usingDefault`), `404` for unknown key.

**Acceptance criteria**

- **Given** an `ADMIN` session
  **When** they list configs filtered by `domain`
  **Then** the response returns the filtered page with a valid `meta`; an
  unknown `domain` value is rejected with `400 VALIDATION_FAILED`.

- **Given** a registry key with no stored row
  **When** an `ADMIN` lists or inspects it
  **Then** `configValue` is the documented default and `usingDefault` is
  `true`.

- **Given** a non-`ADMIN` user
  **When** they call the list or detail endpoint
  **Then** the response is `403 AUTH_FORBIDDEN_ROLE`.

---

## [x] SC-08: Admin config update API with audit and cache invalidation

```text
Status: DONE
Size: M
Blocked by: SC-06, SC-09
```

**Objective:** Let an Admin update an existing configuration value safely, with
validation, change history, and cache invalidation.

**Scope**

- In scope: `PATCH /api/v1/admin/configs/:configKey` (CSRF required — shared
  `AUTH_CSRF_TOKEN_INVALID` failure code); validation via SC-06; one
  transaction upserting the value (inserting the row for a registry key with
  none, audit `old_value` = `NULL`) and the audit row; in-process
  cache invalidation after commit; no-op (no write, no audit row) when the
  value is unchanged.
- Out of scope: creating/deleting keys; rollback; cross-process invalidation
  (deferred per Tech Design §21 — re-evaluate when a multi-process deployment
  exists).

**Implementation requirements**

1. Validate the key and value (SC-06) before writing.
2. Detect the no-op case (new value equals stored value, or equals the
   documented default when the key has no row) and return `200` with the
   unchanged item without writing.
3. In one transaction, upsert `SYSTEM_CONFIGS` and insert a
   `SYSTEM_CONFIG_AUDIT` row (`old_value` = `NULL` for a first write).
4. After commit, call `clearCache()` on both readers.
5. Reject with `404 CONFIG_KEY_NOT_FOUND` or `400 CONFIG_VALUE_INVALID` as
   defined in Tech Design §9.3.

**Files/areas affected**

- `backend/src/routes/admin/`, `backend/src/controllers/admin/`,
  `backend/src/services/admin/`, `backend/src/repositories/`
- `[Proposed — verify during implementation]`

**API impact:** New `PATCH /api/v1/admin/configs/:configKey` (Tech Design §9.3).

**Schema/config impact:** Writes `SYSTEM_CONFIGS` and `SYSTEM_CONFIG_AUDIT`;
no schema change beyond SC-09.

**Verification**

- API: success, `404`, `400`, CSRF failure (`AUTH_CSRF_TOKEN_INVALID`),
  same-value no-op, `403` for non-`ADMIN`.
- Integration: value and exactly one audit row committed together; the first
  write to a row-less key upserts it with `old_value` = `NULL`.

**Acceptance criteria**

- **Given** a valid update by an `ADMIN`
  **When** they `PATCH`
  **Then** the value is stored, one audit row is written, caches are cleared,
  and the response is `200`.

- **Given** a `PATCH` whose value equals the stored value
  **When** they `PATCH`
  **Then** the response is `200` with the unchanged item, nothing is written,
  and no audit row exists.

- **Given** an invalid or cross-key-violating value
  **When** they `PATCH`
  **Then** the response is `400 CONFIG_VALUE_INVALID` and neither the value nor
  an audit row changes.

---

## [x] SC-09: `SYSTEM_CONFIG_AUDIT` schema delta and migration

```text
Status: DONE
Size: S
Blocked by: SC-01
```

**Objective:** Persist an append-only history of configuration changes.

**Scope**

- In scope: a new ordered migration after `0006` creating
  `SYSTEM_CONFIG_AUDIT` (`docs/architecture/database-schema.md` §3.31) and the
  index `(config_key, changed_at)`.
- Out of scope: changing `SYSTEM_CONFIGS`; rollback features.

**Implementation requirements**

1. Add the table exactly as documented in `database-schema.md` §3.31
   (append-only is enforced application-side, per Tech Design §10 — no DB
   trigger).
2. Add the supporting index and the append-only integrity note (§5.16).
3. Record the migration in `database-schema.md` Change Log when applied.

**Files/areas affected**

- `backend/src/db/migrations/` (new file after `0006`)
- `backend/src/db/schema/` (if represented in Drizzle)

**API impact:** None.

**Schema/config impact:** New `SYSTEM_CONFIG_AUDIT` table and index.

**Verification**

- Integration: migration applies and is idempotent against the test database.

**Acceptance criteria**

- **Given** a fresh database
  **When** the migration runs
  **Then** `SYSTEM_CONFIG_AUDIT` and its index exist and `SYSTEM_CONFIGS` is
  unchanged.

---

## [ ] SC-10: Admin System Configuration screen (base UI implemented; UI-REDO pending)

```text
Status: IN_PROGRESS
Size: M
Blocked by: SC-07, SC-08
```

**Objective:** Provide the Admin UI to inspect and update configuration values.

**Scope**

- In scope: a screen in the Admin area listing keys grouped by the seven
  registry domains (including keys with no stored row, shown in their
  `usingDefault` state), with a type-aware editor, last-change summary,
  snapshot-semantics notice, ≤60 s propagation note, loading /
  empty / error / success / forbidden states.
- Out of scope: creating/deleting keys; rollback UI; any "takes effect
  immediately" key class (removed per PRD §9/§15 — every change becomes
  observable within the ≤60 s cache window).

**Implementation requirements**

1. Build the screen under `frontend/src/features/admin/` using the shared table
   and filter components per `docs/architecture/conventions.md`.
2. Use type-aware inputs (number with range, toggle, select) driven by the
   registry metadata returned by the API.
3. Show the notices defined by Tech Design §7.5: changes apply to new
   transactions/entities only, and a changed value becomes observable within
   the ≤60 s cache window.
4. Rely on server authorization; do not treat hidden UI as the control.

**Files/areas affected**

- `frontend/src/features/admin/`
- `[Proposed — verify during implementation]`

**API impact:** Consumes SC-07 and SC-08 endpoints.

**Schema/config impact:** None.

**Verification**

- E2E: Admin updates a value and sees it reflected; non-Admin cannot reach it.
- Manual: loading, empty, error, success, and forbidden states.

**Acceptance criteria**

- **Given** an Admin on the screen
  **When** they change a value and confirm
  **Then** the value is saved, the screen confirms, and the new value is shown.

- **Given** a non-Admin
  **When** they navigate to the screen
  **Then** access is denied.

---

## [ ] SC-11: Management surface tests (registry, API, audit, E2E) — registry/API/audit done; E2E pending

```text
Status: IN_PROGRESS
Size: M
Blocked by: SC-07, SC-08, SC-09
```

**Objective:** Verify the management surface end to end.

**Scope**

- In scope: registry validation tests (type, range, enum, both cross-key
  rules); API authorization/validation (including unknown `domain` → `400`)/
  pagination/`usingDefault` fallback; transaction + audit assertions
  (`old_value` = `NULL` on first write); same-value no-op; one Playwright flow
  for the Admin screen.
- Out of scope: load/performance testing.

**Implementation requirements**

1. Add backend tests under `backend/src/__tests__/`.
2. Assert audit rows are created only on real changes and committed with the
   value; assert the no-op path writes nothing and the row-less-key upsert path
   records `old_value` = `NULL`.
3. Add the E2E flow under `frontend/e2e/`.

**Files/areas affected**

- `backend/src/__tests__/`, `frontend/e2e/`
- `[Proposed — verify during implementation]`

**API impact:** None.

**Schema/config impact:** None.

**Verification**

- Unit, API, integration, and E2E as listed above.

**Acceptance criteria**

- **Given** the test suites
  **When** they run
  **Then** registry, API, audit, and E2E scenarios pass.

**Completion checklist**

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `TBD` was silently resolved.
- [ ] No unrelated files or refactors were included.

## Ratings integration note — approved 2026-10-15

Ratings RT-01/RT-06 consume the shared registry/typed-reader boundary. Coordinate ownership of the shared loader to avoid parallel registries or duplicated defaults. Ratings-related bounds in Tech Design are now confirmed; cache invalidation must cover the tournament gate and skill-adjustment facades. The remaining configuration tasks retain their existing status; no implementation completion is implied.

---

# Social Matchmaking extension — tasks (Approved design, Phase 2, 2026-10-31)

Governing design: Tech Design "Social Matchmaking extension" (Ready). SC-01…SC-11 keep their status.

## [ ] SC-12: Register and seed Social Matchmaking/Messaging keys with preflight

**Completion review (2026-11-01):** Keep IN_PROGRESS: registry, seed preflight, preservation/default/copy behavior and typed cache are implemented and tested. The previously required teammate review has no recorded evidence; agent review and regression do not substitute for it.

```text
Status: IN_PROGRESS
Size: M
Blocked by: None — extension Ready, human-approved 2026-10-31
```

**Objective:** Make the matrix §8.9 keys and `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` readable with defaults, ranges and caching, without overwriting stored values.

**Implementation status (2026-11-01, not DONE):**

- `config-registry.ts` holds all definitions (domains `social`, `messaging`, `matchmaking`, `player-skill-adjustment`, `tournament`), strict parsing, `validateConfigCrossKeyRules`, and one shared 60-second cache (`loadConfigValues`, `clearConfigCache`). The Ratings API (`ratingConfigDefinitions`, `loadRatingConfigValues`, `clearRatingConfigCache`) is unchanged.
- `matchmaking-config.ts` is a facade over the registry. Existing baseline keys keep their old reader bounds (catalog bounds §7.3 still pending). `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` is marked deprecated. `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` now uses 15–10080, default 1440.
- New `social-config.ts`. No Messaging reader: Messaging consumes `loadConfigValues([...MESSAGING keys] as const)` / `configKeysForDomain('messaging')`.
- Migration `0012_social_matchmaking_config_seed` (preflight + seed + MIN_MATCHES copy rule). The Ratings reader still uses `MIN_RATINGS`; switching it is RT-10.
- `config-registry.test.ts` and the SC-12 cases in `social-step1-migrations.test.ts` passed.
- Missing before DONE: full backend regression after the change (skipped at the owner's request) and teammate review.

**Scope**

- In scope: registry definitions in `config-registry.ts` (domains `social`, `messaging`, `matchmaking`, `player-skill-adjustment`); cross-key `GROUP_MIN_SLOTS ≤ GROUP_MAX_SLOTS`; seed migration `ON CONFLICT DO NOTHING`; `MIN_MATCHES` copied from stored `MIN_RATINGS` only when absent; preflight reporting out-of-range stored values (notably `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` < 15) and stopping; mark `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` deprecated.
- Out of scope: Admin management API/UI (SC-07/SC-08/SC-10); removing deprecated keys.

**Implementation requirements**

1. Never update an existing `SYSTEM_CONFIGS` row.
2. Readers fall back to the documented default with a logged error for invalid values (existing pattern).

**Files/areas affected**

- `backend/src/shared/config/config-registry.ts`, `backend/src/shared/config/matchmaking-config.ts`, `backend/src/db/migrations/`

**API impact:** None.

**Schema/config impact:** New config rows when absent.

**Verification**

- Integration: existing `15` stays `15`; absent key gets `1440`; `MIN_MATCHES` copy rule; out-of-range preflight stops.

**Acceptance criteria**

- **Given** a database with `MATCHMAKING_INVITATION_TIMEOUT_MINUTES = 15` **When** the migration runs **Then** the value is still `15`.
