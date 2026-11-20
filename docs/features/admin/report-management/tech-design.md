# Technical Design Document (Tech Design)

## Status and Ownership

```text
Status: Ready
Owner: Platform Team
Fulfills: PROJECT-BRIEF.md §4, docs/features/admin/report-management/prd.md
Scope: Admin Report Management
Decision Status: Approved
```

## Authoritative References

- Governing PRD: `docs/features/admin/report-management/prd.md`
- Project scope, roles, and MVP: `PROJECT-BRIEF.md` §4 and §5
- Documentation lifecycle and boundaries: `docs/documentation-guide.md` §4–§6
- Business rules/configuration: `docs/business-rules-config-matrix.md` §7 and §8.6
- Global technology: `docs/architecture/tech-stack.md`
- Global database schema: `docs/architecture/database-schema.md` §3.25
- Global conventions: `docs/architecture/conventions.md` §5, §7, §10, and §12

## G0 decision — API casing (2026-11-15)

Admin Reports uses `camelCase` for object properties and query parameters, per `conventions.md`. The `snake_case` fields in the §2.1 example are legacy and must be replaced during RP-01/RP-02; the response shape and target fields are otherwise unchanged.

## 1. Architecture and Module Boundaries

- **Frontend boundary:** The Admin Portal owns report list and detail views. API transport remains separate from presentation.
- **Backend boundary:** Routes translate HTTP requests, controllers translate input/output, services coordinate authorization and use cases, and repositories own persistence queries.
- **Persistence boundary:** Use the existing `REPORTS` schema object. Do not create a moderation-action store or a competing report schema.
- **Cross-cutting boundary:** Authentication, centralized error handling, validation, and logging are consumed through existing platform boundaries. No new library, provider, service, or infrastructure component is introduced.

## 2. API Design

The feature endpoints are served under `/api/v1/admin/reports`.

### 2.1 Retrieve List of Reports

`GET /api/v1/admin/reports`

Query parameters:

- `targetType` (optional): `PLAYER | FACILITY | TOURNAMENT | POST | COMMENT | MESSAGE`
- `status` (optional): `OPEN | RESOLVED`
- `page` (optional, default `1`): positive integer
- `limit` (optional, default `20`): positive integer capped at `100`

Status filtering supports `OPEN` and `RESOLVED`.

Success response (`200 OK`):

```json
{
  "data": [
    {
      "id": "123",
      "reporterId": "456",
      "targetType": "PLAYER",
      "reportedPlayerId": "789",
      "reasonCode": "SPAM",
      "description": "User sent abusive messages.",
      "status": "OPEN",
      "resolvedAt": null,
      "createdAt": "2026-09-13T10:00:00Z",
      "updatedAt": "2026-09-13T10:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 10, "totalPages": 1 }
}
```

The response exposes an explicit allowlist and does not serialize database rows indiscriminately.

### 2.2 Retrieve Report Details

`GET /api/v1/admin/reports/:id`

Success response (`200 OK`) uses `{ "data": ... }` and includes the report target, reason, description, current status, `resolvedAt` (nullable), timestamps, and only approved target display data. The Social Matchmaking extension (§16) adds `evidence { text, media[] }` to this detail response. RP-10 adds `target`, a read-only discriminated union for verification:

- Shared fields: `type`, `available`, and `reportHistory { total, open, last30Days, distinctReporters, byReason[], recent[] }`.
- `PLAYER`: account summary (display name, email, phone, avatar, role, status, joined date, skill level) plus `recentContent { posts[], comments[], hiddenPostCount, hiddenCommentCount }`. Player reports have no content snapshot, so verification relies on the reporter description, report history and recent public activity.
- `POST` / `COMMENT`: current content, author summary, timestamps, and `hiddenAt` / `deletedAt` flags so Admin sees whether moderation already acted.
- `MESSAGE`: sender, body snapshot metadata and timestamps only. The response never includes `conversationId`, participants or surrounding messages.
- `FACILITY` / `TOURNAMENT`: summary of the reported target (owner/creator, status, key fields).
- If the target row cannot be loaded, the detail still returns `200` with `available: false`; only Admin can call the endpoint.

### 2.3 Update Report Status

`PATCH /api/v1/admin/reports/:id/status`

Request body:

```json
{ "status": "RESOLVED" }
```

Only the `OPEN → RESOLVED` transition is supported in MVP. `RESOLVED` is terminal. No resolution note or moderation-action linkage is accepted.

### 2.4 Common API Rules

- All endpoints require the `authenticate` middleware followed by `requireRole(['ADMIN'])` at the route boundary.
- Successful reads use `200 OK`.
- Malformed identifiers/query parameters use `400 Bad Request`.
- Missing reports use `404 Not Found`.
- Unexpected failures use `500 Internal Server Error` with no internal details.
- Errors use the global shape:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  }
}
```

- Application error codes are `ADMIN_REPORT_NOT_FOUND`, `ADMIN_REPORT_INVALID_STATUS`, and `ADMIN_REPORT_INVALID_TRANSITION`.

## 3. Database and Schema Impact

- **Existing schema objects:** `REPORTS` as defined in `docs/architecture/database-schema.md` §3.25.
- **Schema delta:** None.
- **Integrity:** Preserve the exactly-one-target invariant and self-report prohibition. These are not weakened by Admin reads.
- **Indexes:** No new index is required for the MVP task. Query ordering is `created_at DESC`.
- **Migration/backfill:** None. No migration or data backfill is required.
- **Data mapping:** Map the six nullable target columns to an explicit product-level `targetType`; do not expose all nullable target columns in list responses unless required by the approved contract.

## 4. State and Business Flow

The implementation scope is report review and the approved status transition:

```text
REPORT EXISTS → ADMIN REVIEWS REPORT
OPEN → RESOLVED
```

- Preconditions: The report exists and the caller is an authenticated `ADMIN`.
- Report target: Every returned report has exactly one target: Player, Facility, or Tournament.
- Configuration: `REPORT_ENABLED` governs report submission availability. Admin review and resolution of existing reports remain available and do not bypass authorization.
- Only Admin review and the `OPEN → RESOLVED` transition are performed.
- No automatic moderation, banning, appeal workflow, resolution note, or cross-module moderation side effect is performed.

## 5. Security and Authorization

- **Authentication:** Consume the approved platform authentication boundary. This feature does not select JWT, token storage, or another authentication mechanism.
- **Authorization:** Enforce `ADMIN` through the application/service boundary, not only through UI visibility or route middleware.
- **Input validation:** Validate path identifiers, query parameter types, `targetType`, pagination bounds, and request size at the API boundary. Do not add a validation-library dependency.
- **Output protection:** Use explicit response field allowlists. Do not expose internal database details, stack traces, SQL, or unapproved reporter/target data.
- **User-controlled content:** Safely render report descriptions and target text in the Admin UI.
- **CSRF/security tooling:** Follow the approved platform security design; no feature-specific security tooling is selected.

## 6. Failure Handling and Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Missing or invalid authentication | Platform authentication boundary | Reject request with `401 Unauthorized` | Global safe error shape |
| Non-Admin caller | Application authorization | Reject request with `403 Forbidden` | No report data returned |
| Malformed report ID or query parameter | Request validation | Reject request with `400 Bad Request` | No repository query for an invalid resource |
| Report does not exist | Repository/service lookup | Return `404 Not Found` | Do not reveal unrelated report data |
| Invalid `targetType` | Request validation | Return `400 Bad Request` | Safe validation details |
| Empty result set | Repository query | Return `200 OK` with an empty `data` collection and pagination metadata | Admin UI shows an empty state |
| Database or unexpected application failure | Centralized error boundary | Roll back any active read transaction and return `500 Internal Server Error` | Log diagnostic context without sensitive data |
| Report status mutation uses an invalid value or starts from `RESOLVED` | Application/service validation | Return `400 Bad Request` with the relevant report error code; do not mutate the report | Safe error response |

## 7. Concurrency and Idempotency

- Current list/detail operations are reads and have no cross-request mutation coordination requirement.
- No payment callback, webhook, background job, or external provider is used by this feature.
- Read queries must use parameterized inputs and explicit selected fields.
- Status mutation uses one transaction with a state-transition guard. Repeating `OPEN → RESOLVED` is idempotent; any other transition is rejected.

## 8. Performance

- Use offset pagination with `page` and `limit` to avoid unbounded list responses.
- Apply filtering before pagination and order results by `created_at DESC`.
- Do not add a search engine, cache, queue, or other scaling infrastructure for the MVP.
- Revisit indexes only after observed query volume justifies a schema decision.

## 9. Events, Notifications, and Background Processing

- No scheduled job or background processing is required for Admin report review or resolution.
- Admin inbox (implemented 2026-11-18): creating a report notifies every `ACTIVE`, non-deleted Admin inside the same transaction (`ADMIN_REPORT_CREATED`, resource `ADMIN_REPORT`). Replay is deduplicated by `admin-report:<reportId>` per recipient. The link resolves to `/admin/reports?reportId=<id>` only for Admin viewers.
- High-risk alert (implemented 2026-11-18): when the distinct reporters on one target reach `REPORT_HIGH_RISK_THRESHOLD` within `REPORT_HIGH_RISK_WINDOW_HOURS`, the submission transaction also emits one `ADMIN_HIGH_RISK_REPORT` per target/window (`admin-report-risk:<targetType>:<targetId>:<windowStart>`). It links to the triggering report via `ADMIN_REPORT`.
- This is a one-way operational alert; resolving or hiding a report does not notify the reporter in MVP.

## 10. Testing Considerations

- **Unit:** Query parsing, pagination bounds, `targetType` mapping, target invariant mapping, allowlisted response mapping, and authorization decisions.
- **Integration:** Facility/Player/Tournament target retrieval through the frozen `REPORTS` relationships; empty results; missing report; parameterized filtering.
- **API-level:** `401`, `403`, `400`, `404`, `500`, successful `200` responses, response shape, pagination, target filtering, and safe error shape.
- **Security:** Verify non-Admin users receive no report data and response payloads do not leak unapproved fields.
- **E2E:** Verify an Admin can open the report list, filter by target type, open a report detail, and see the correct single target.
- **Mutation:** Verify `OPEN → RESOLVED`, terminal `RESOLVED`, invalid transitions, idempotent repeat, and absence of resolution-note/moderation linkage.
- Testing is specified by behavior; no testing framework or runner is selected by this feature.

## 11. Migration and Rollout

- **Migration:** None.
- **Rollout:** Deploy Admin report review and status resolution with the existing application and database.
- **Backward compatibility:** Existing `REPORTS` rows remain readable; no data rewrite is required.
- **Rollback:** Application deployment rollback is sufficient; no database rollback is needed.

## 12. Observability

- Log Admin report-list/detail access failures and unexpected application failures through the existing application logging boundary.
- Do not log report descriptions, credentials, provider data, or other sensitive content unnecessarily.
- No new logging library, storage system, metric, or alerting infrastructure is introduced.

## 13. Acceptance / Verification Considerations

- **Given:** An authenticated user with the `ADMIN` role.
  **When:** They request the Admin report list.
  **Then:** The system returns `200 OK`, paginated report data, and only the approved response fields.

- **Given:** An authenticated `PLAYER` or `COURT_OWNER`.
  **When:** They request any Admin report endpoint.
  **Then:** The system returns `403 Forbidden` and no report data.

- **Given:** An authenticated `ADMIN`.
  **When:** They filter reports by `PLAYER`, `FACILITY`, or `TOURNAMENT`.
  **Then:** Every returned report has exactly one matching target type.

- **Given:** A report with exactly one valid target.
  **When:** An Admin opens its detail view.
  **Then:** The target, reason, description, current status, and timestamps are displayed without exposing unapproved fields.

- **Given:** An authenticated `ADMIN`.
  **When:** They request a non-existent report or submit malformed query input.
  **Then:** The system returns the appropriate `404` or `400` safe error response.

- **Given:** An authenticated `ADMIN` and an `OPEN` report.
  **When:** They submit `{ "status": "RESOLVED" }` to the report status operation.
  **Then:** The report becomes `RESOLVED`, `resolvedAt` is recorded, and the API returns `200 OK`.

- **Given:** An authenticated `ADMIN` and a `RESOLVED` report.
  **When:** They submit another status update.
  **Then:** The system rejects the transition with `400 Bad Request` and leaves the report unchanged.

- **Given:** An Admin attempts an invalid report-resolution operation.
  **When:** The request is processed.
  **Then:** The system returns `400 Bad Request` with `ADMIN_REPORT_INVALID_TRANSITION` and changes neither report state nor moderation data.

## 14. Technical Decisions and Register

| Item | Decision/status | Rationale or dependency |
| --- | --- | --- |
| Schema impact | Resolved: no schema change or migration | Frozen `REPORTS` schema already supports report review and status resolution. |
| API version prefix | Resolved: all endpoints use the confirmed global prefix `/api/v1/admin/reports` | Required by `docs/architecture/conventions.md` and `docs/architecture/tech-stack.md`. |
| Pagination | Resolved: offset pagination using `page` and `limit`, default `1/20`, maximum `100` | Sufficient for MVP Admin workload without new infrastructure. |
| Success response | Resolved: `{ "data": ..., "meta": ... }` for collection and `{ "data": ... }` for detail | Explicit, stable local contract consistent with API conventions. |
| Validation library | Resolved: no new library; use the existing project boundary-validation approach | A global library choice is outside this feature and no dependency is added. |
| Authentication mechanism | Resolved for this feature: consume platform authentication boundary; mechanism not selected here | The platform authentication mechanism is outside this feature. |
| Error-code names | Resolved: `ADMIN_REPORT_NOT_FOUND`, `ADMIN_REPORT_INVALID_STATUS`, and `ADMIN_REPORT_INVALID_TRANSITION` | Stable feature-local codes make client handling deterministic. |
| Report statuses and transitions | Resolved: `OPEN → RESOLVED`; `RESOLVED` terminal | Minimal workflow matches the MVP review goal and avoids unapproved states. |
| Resolution note/comment | Resolved: not supported | Frozen schema has no note field and PRD does not require one. |
| External moderation-action linkage | Resolved: not supported | No moderation-action entity exists and moderation is owned by other Admin features. |
| Notification mechanism | Resolved: Admin-only in-app alert on report creation (`ADMIN_REPORT_CREATED`); no reporter notification | Human-requested 2026-11-18; reuses the existing transactional in-app notification service, no new infrastructure. |
| Background jobs | Resolved: none | Report review/status resolution has no timeout or scheduled processing. |
| Testing tool | Resolved for this feature: no framework selection | Scenarios are specified by observable behavior; global tooling is outside this feature. |
| Logging implementation | Resolved: existing application logging boundary, no new library | Preserves architecture and avoids unapproved observability tooling. |

## 15. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the requesting Tech Lead
Approved decision/reference: Decisions recorded in §14 and aligned with the governing PRD
```

## 16. Social Matchmaking extension — Ready (Phase 2, human-approved 2026-10-31)

```text
Status: Ready
Decision Status: Approved
PRD: prd.md §15 (Ready, business scope)
Schema authority: docs/architecture/database-schema.md §13.8 (REPORTS targets, REPORT_EVIDENCE)
```

- Targets add `POST`, `COMMENT`, `MESSAGE` (+ optional attachment). `targetType` filter gains these values. Exactly-one-target CHECK covers six columns.
- Player creation endpoint (new; none exists today): `POST /api/v1/reports` (Player, CSRF) `{ targetType, targetId, attachmentId?, reasonCode, description? }`. Authorization: the reporter can currently see the post/comment (Social `canView`) or read the message (Messaging §7.2); not own content; `REPORT_ENABLED` gate. Errors: `REPORT_TARGET_NOT_FOUND` (404, also for no access), `REPORT_SELF_FORBIDDEN` (409), `REPORT_DISABLED` (409), `REPORT_ATTACHMENT_MISMATCH` (400).
- Evidence: the same transaction inserts `REPORT_EVIDENCE` (text at report time) and `REPORT_EVIDENCE_MEDIA` (media referenced at report time). Media referenced by evidence are never collected.
- Admin detail adds `evidence { text, media[] }`. Admin downloads evidence media via `GET /api/v1/admin/reports/:id/evidence/media/:mediaId` (Admin only; the media must be in that report's evidence). For messages, only the reported message and the reported attachment are shown, never the conversation.
- Hiding posts/comments is performed through Social's Admin routes; the report detail links to them. Resolution stays `OPEN → RESOLVED`.
- Retention: at least 180 days after `RESOLVED`; no automatic deletion in MVP.
- Reason codes (approved 2026-10-31; `docs/business-rules-config-matrix.md` §7): for `POST`/`COMMENT`/`MESSAGE` targets `reasonCode` must be one of `SPAM`, `HARASSMENT`, `INAPPROPRIATE_CONTENT`, `SCAM`, `PRIVACY_VIOLATION`, `OTHER`; values follow the `UPPER_SNAKE_CASE` constant convention (`conventions.md`, General Code). `OTHER` requires a non-empty trimmed `description` (`400 REPORT_DESCRIPTION_REQUIRED`); an unknown code is `400 REPORT_INVALID_REASON`. Validation is per target type so existing codes for Player/Facility/Tournament (`HARASSMENT`, `FACILITY_ISSUE` in seed data) are unchanged. `reason_code` stays `varchar`; no schema change.
- Verification: no-access reporter gets 404; evidence unchanged after author edit/delete; Admin cannot fetch media outside the evidence; message report never exposes other messages.


### Final Phase 2 approval — 2026-10-31

The human owner approved this Social Matchmaking extension as Ready after the final review. This approval supersedes conflicting baseline requirements only for the extension; it does not mark unrelated Draft scope Ready or claim implementation/tests complete. Follow the approved global lock order in Matchmaking §24.7 and the current task dependencies. Shared-document/schema changes still require teammate PR review before merge.
