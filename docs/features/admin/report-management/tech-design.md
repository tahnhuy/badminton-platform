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

## 1. Architecture and Module Boundaries

- **Frontend boundary:** The Admin Portal owns report list and detail views. API transport remains separate from presentation.
- **Backend boundary:** Routes translate HTTP requests, controllers translate input/output, services coordinate authorization and use cases, and repositories own persistence queries.
- **Persistence boundary:** Use the existing `REPORTS` schema object. Do not create a moderation-action store or a competing report schema.
- **Cross-cutting boundary:** Authentication, centralized error handling, validation, and logging are consumed through existing platform boundaries. No new library, provider, service, or infrastructure component is introduced.

## 2. API Design

The feature uses the feature-local resource namespace `/admin/reports`. No API version prefix is introduced by this feature.

### 2.1 Retrieve List of Reports

`GET /admin/reports`

Query parameters:

- `target_type` (optional): `PLAYER | FACILITY | TOURNAMENT`
- `page` (optional, default `1`): positive integer
- `limit` (optional, default `20`): positive integer capped at `100`

Status filtering supports `OPEN` and `RESOLVED`.

Success response (`200 OK`):

```json
{
  "data": [
    {
      "id": "123",
      "reporter_id": "456",
      "target_type": "PLAYER",
      "reported_player_id": "789",
      "reason_code": "SPAM",
      "description": "User sent abusive messages.",
      "status": "OPEN",
      "created_at": "2026-09-13T10:00:00Z",
      "updated_at": "2026-09-13T10:00:00Z"
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20 }
}
```

The response exposes an explicit allowlist and does not serialize database rows indiscriminately.

### 2.2 Retrieve Report Details

`GET /admin/reports/:id`

Success response (`200 OK`) uses `{ "data": ... }` and includes the report target, reason, description, current status, timestamps, and only approved target display data.

### 2.3 Update Report Status

`PATCH /admin/reports/:id/status`

Request body:

```json
{ "status": "RESOLVED" }
```

Only the `OPEN → RESOLVED` transition is supported in MVP. `RESOLVED` is terminal. No resolution note or moderation-action linkage is accepted.

### 2.4 Common API Rules

- All endpoints require an authenticated request and the `ADMIN` system role.
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
- **Data mapping:** Map the three nullable target columns to an explicit product-level `target_type`; do not expose all nullable target columns in list responses unless required by the approved contract.

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
- **Input validation:** Validate path identifiers, query parameter types, `target_type`, pagination bounds, and request size at the API boundary. Do not add a validation-library dependency.
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
| Invalid `target_type` | Request validation | Return `400 Bad Request` | Safe validation details |
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

- No user notification, event, scheduled job, or background processing is required for Admin report review or resolution.

## 10. Testing Considerations

- **Unit:** Query parsing, pagination bounds, `target_type` mapping, target invariant mapping, allowlisted response mapping, and authorization decisions.
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
  **Then:** The report becomes `RESOLVED`, `resolved_at` is recorded, and the API returns `200 OK`.

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
| API version prefix | Resolved: no feature-specific version prefix | Authority forbids inventing a global API version prefix; use the feature-local resource path. |
| Pagination | Resolved: offset pagination using `page` and `limit`, default `1/20`, maximum `100` | Sufficient for MVP Admin workload without new infrastructure. |
| Success response | Resolved: `{ "data": ..., "meta": ... }` for collection and `{ "data": ... }` for detail | Explicit, stable local contract consistent with API conventions. |
| Validation library | Resolved: no new library; use the existing project boundary-validation approach | A global library choice is outside this feature and no dependency is added. |
| Authentication mechanism | Resolved for this feature: consume platform authentication boundary; mechanism not selected here | The platform authentication mechanism is outside this feature. |
| Error-code names | Resolved: `ADMIN_REPORT_NOT_FOUND`, `ADMIN_REPORT_INVALID_STATUS`, and `ADMIN_REPORT_INVALID_TRANSITION` | Stable feature-local codes make client handling deterministic. |
| Report statuses and transitions | Resolved: `OPEN → RESOLVED`; `RESOLVED` terminal | Minimal workflow matches the MVP review goal and avoids unapproved states. |
| Resolution note/comment | Resolved: not supported | Frozen schema has no note field and PRD does not require one. |
| External moderation-action linkage | Resolved: not supported | No moderation-action entity exists and moderation is owned by other Admin features. |
| Notification mechanism | Resolved for this feature: none required | PRD requires only in-product feedback; no system notification is defined. |
| Background jobs | Resolved: none | Report review/status resolution has no timeout or scheduled processing. |
| Testing tool | Resolved for this feature: no framework selection | Scenarios are specified by observable behavior; global tooling is outside this feature. |
| Logging implementation | Resolved: existing application logging boundary, no new library | Preserves architecture and avoids unapproved observability tooling. |

## 15. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the requesting Tech Lead
Approved decision/reference: Decisions recorded in §14 and aligned with the governing PRD
```
