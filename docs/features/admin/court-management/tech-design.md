# Feature Tech Design

## 1. Metadata

```text
Status: Ready
Owner: Platform Team
PRD: docs/features/admin/court-management/prd.md
Scope: Admin Court Management Implementation
Decision Status: Approved
```

## 2. Context

The Admin portal requires an interface for platform administrators to oversee registered facilities and their associated courts. This includes viewing lists, inspecting details, updating operational statuses, and deactivating facilities or courts within the behavior approved by the PRD.

## 3. Technical Problem

We need to provide secure REST API operations that allow only users with the `ADMIN` role to manage facilities and courts. The implementation must use the existing frozen schema without changing Booking state or bypassing the real-time Booking rules. Suspending or deactivating a facility/court affects only new availability; existing Bookings remain unchanged.

## 4. Goals

- Provide secure, `ADMIN`-only API operations for listing and managing facilities and courts.
- Represent facility/court deactivation using the existing schema capability, without adding schema objects.
- Support status updates only for Product-approved status values.
- Apply request-boundary validation, application authorization, and safe error handling according to the approved conventions.

## 5. Non-Goals

- Cancelling, refunding, or otherwise changing existing Bookings as a result of an Admin facility/court action.
- Building advanced facility analytics or reporting infrastructure.
- Implementing an approval workflow or state machine beyond basic status updates.

## 6. Upstream References

- Governing PRD: `docs/features/admin/court-management/prd.md`
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §4
- Global documentation rules: `docs/documentation-guide.md`
- Global architecture/technology: `docs/architecture/tech-stack.md`
- Global coding/API conventions: `docs/architecture/conventions.md`
- Business rules/configuration: `docs/business-rules-config-matrix.md` §2.4
- Global database schema: `docs/architecture/database-schema.md` §3.5, §3.6

## 7. Proposed Technical Design

- **Application/service boundary**: Keep Admin authorization and facility/court use-case orchestration in application/service code. Do not bypass authorization by relying only on hidden UI controls.
- **Persistence boundary**: Use explicit data-access operations for the existing `FACILITIES` and `COURTS` schema objects. The visibility of deactivated records must be consistent across list and detail operations.
- **Client/server boundary**: Expose RESTful JSON resources for Admin facility and court management under the feature-local `/admin/facilities` namespace.
- **Cross-cutting concerns**: Use the approved authentication boundary, enforce `ADMIN` authorization at the application boundary, validate input, and return safe stable errors. No new library, provider, or infrastructure component is selected here.

## 8. Behavior, State, and Flow

- **Status update**:
  - Allowed values are `ACTIVE` and `SUSPENDED`.
  - Preconditions: The target exists, is not deactivated, and the requested value is an allowed status.
  - Transition: `ACTIVE ↔ SUSPENDED`.
  - Postconditions: The target has the requested status. A `SUSPENDED` facility or court is unavailable for new Bookings.
- **Facility suspension**:
  - A suspended Facility makes all Courts in that Facility unavailable for new Bookings.
  - Court status values are not overwritten, so a Court's own status is preserved when the Facility is later reactivated.
- **Deactivation**:
  - Preconditions: The target exists and is not already deactivated.
  - A Facility deactivation also deactivates all of its Courts in the same transaction.
  - Deactivation is represented by the existing `deleted_at` capability and is not reversible through this MVP feature.
  - Deactivated records remain visible to Admin list/detail views with their deactivated state indicated.
- **Booking boundary**:
  - These operations do not cancel, refund, or otherwise mutate existing Bookings. Booking cancellation and refund behavior remains owned by the Booking feature.

## 9. API Design

- Resource and operation: Admin Facility and Court Management
- HTTP method/path: Use the feature-local `/admin/facilities` namespace:
  - `GET /admin/facilities?page=1&limit=20&status=ACTIVE&search=...`
  - `GET /admin/facilities/:id`
  - `PATCH /admin/facilities/:id` (body: `{ "status": "ACTIVE" | "SUSPENDED" }`)
  - `DELETE /admin/facilities/:id` (deactivate Facility and its Courts)
  - `PATCH /admin/facilities/:facilityId/courts/:courtId` (body: `{ "status": "ACTIVE" | "SUSPENDED" }`)
  - `DELETE /admin/facilities/:facilityId/courts/:courtId` (deactivate Court)
- Request contract: Status updates use `{ "status": "ACTIVE" | "SUSPENDED" }`; deactivation uses an empty request body.
- Response contract: Successful responses use `{ "data": ... }`; only approved Facility/Court fields are returned. List responses use `{ "data": { "items": [...], "meta": { "page": number, "limit": number, "total": number } } }`.
- Authentication/authorization boundary: The request must be authenticated, and the application operation must require the `ADMIN` system role. Authentication mechanism remains platform-owned.
- HTTP status behavior: `200 OK` for GET/PATCH; `204 No Content` for DELETE; `400 Bad Request` for malformed input or invalid status; `401 Unauthorized`; `403 Forbidden`; `404 Not Found` for missing resources or parent mismatch; `409 Conflict` for an approved concurrency conflict; `500 Internal Server Error` for unexpected failures. Errors use `{ "error": { "code": "...", "message": "...", "details": [] } }`.
- Application error codes: `ADMIN_FACILITY_NOT_FOUND`, `ADMIN_COURT_NOT_FOUND`, `ADMIN_FACILITY_COURT_MISMATCH`, `ADMIN_INVALID_STATUS`, and `ADMIN_CONCURRENT_UPDATE`.

## 10. Data Model / Schema Delta

- Existing schema objects affected: `FACILITIES`, `COURTS`.
- Schema delta: N/A — no schema change. The required `status` and `deleted_at` columns already exist in the frozen schema.
- Constraints/indexes affected: N/A for the current scope. Existing Facility-Court foreign-key integrity remains authoritative.
- Migration/data backfill impact: N/A
- Rationale and compatibility: Fully compatible with the existing `database-schema.md`.

## 11. Security

- Authentication boundary: Consume the approved platform authentication boundary; this feature does not select or implement an authentication mechanism.
- Authorization boundary: Enforce the `ADMIN` role in application/service operations, not only at the route or UI boundary. For nested Court operations, verify that the Court belongs to the requested Facility.
- Input and output protection: Validate path identifiers, request shape, and approved status values at the request boundary without adding a validation-library dependency. Return only approved response fields and safe error details.
- Sensitive data handling: Treat owner contact information and facility location data as controlled output; define the Admin response allowlist and avoid unrestricted record serialization.
- CSRF/XSS considerations: Follow the approved authentication/security design. Safely render user-controlled facility/court text in the client.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Non-admin attempting access | Auth Middleware | `403 Forbidden` | Standard error response |
| Target facility/court not found | Repository query | `404 Not Found` | Standard error response |
| Court does not belong to the requested Facility | Application/service validation | Treat as not found or another approved safe error; do not mutate the Court | Standard error response |
| Deactivating an already deactivated record | Application/service validation | Treat the operation as idempotent; do not create a new state transition | `204 No Content` |
| Invalid status value provided | Input Validation | `400 Bad Request` | Validation details returned |
| Update conflicts with a concurrent administrative update | Transaction/row-lock check | Serialize the mutation and do not silently overwrite the competing update | Standard safe error response |
| Existing Booking is affected by an Admin facility/court action | Product policy | Do not cancel, refund, or otherwise mutate the existing Booking | Existing Booking remains unchanged |

## 13. Concurrency / Idempotency

- Concurrency-sensitive operation: Facility/Court status and deactivation mutations can race when multiple Admins act on the same target.
- Idempotency requirement: Repeating the same deactivation request must not create another state transition. Status updates are idempotent only when repeating the same approved target status; conflicting updates must not be silently lost.
- Transaction boundary: Each single-target mutation is atomic. Facility deactivation and its Court deactivations occur in one transaction.
- Race-condition handling: Lock the target row, and for Facility deactivation lock its Court rows in the same transaction. Serialize competing mutations and do not use last-write-wins.

## 14. Performance

- Expected workload or latency consideration: Administrative list/detail reads should avoid unbounded responses.
- Relevant bottleneck: Collection size and nested court data.
- Design response: Use offset-based pagination with `page` and `limit` query parameters. No new scaling infrastructure is introduced.

## 15. Events / Notifications

- Event or notification behavior: No cross-feature event or user notification is defined by this feature; only in-product operation feedback is required.
- Trigger and recipient: `N/A`.
- Delivery/retry implications: `N/A`.
- Background/scheduled processing: `N/A` for the current single-target operations.

## 16. Testing Considerations

- Unit behavior: Verify authorization decisions, approved status transition checks, deactivation idempotency, parent-child Court validation, and safe not-found/conflict results.
- Integration/persistence behavior: Verify Facility/Court status and deactivation persistence using the frozen schema, without changing Booking records. Verify no schema migration is introduced.
- API-level behavior: Verify Admin access, denial for Player/Court Owner, list/detail operations, filters when approved, invalid input, not-found, parent-child mismatch, repeated deactivation, response field allowlists, and fixed success/error contracts.
- Critical E2E flow: Admin views a Facility with its Courts, updates an approved status, and deactivates a Facility or Court with the defined confirmation and feedback behavior.
- Concurrency/idempotency verification: Verify repeated deactivation and competing status updates do not silently overwrite data.

## 17. Migration / Rollout

- Migration steps: N/A — no migration
- Rollout sequencing: N/A
- Backward compatibility: N/A
- Rollback/recovery: Transaction rollback applies when a mutation fails. There is no restore operation in this MVP feature.

## 18. Alternatives Considered

- N/A — no meaningful alternative for this scope.

## 19. Observability / Monitoring

- Logs: Record the administrative action and target through the existing application logging boundary, without sensitive data. No logging library or storage mechanism is selected by this feature.
- Metrics: N/A
- Alerts/operational signals: N/A

## 20. Acceptance / Verification Considerations

 - **Given:** An authenticated user with the `ADMIN` role and an eligible Facility.
   **When:** They submit the approved Facility deactivation operation.
   **Then:** The Facility is deactivated according to the approved representation and the operation returns the fixed success contract.

 - **Given:** An authenticated user with the `PLAYER` or `COURT_OWNER` role.
   **When:** They submit any Admin facility/court operation.
   **Then:** The operation is rejected with the approved authorization error contract and no data is changed.

 - **Given:** An Admin updates a Facility or Court.
   **When:** They submit a status that is not an approved value.
   **Then:** The operation is rejected before persistence and returns the approved validation error contract.

 - **Given:** An Admin addresses a Court through a Facility that does not own it.
   **When:** They submit a Court status/deactivation operation.
   **Then:** The operation does not mutate the Court and returns the approved safe not-found/relationship error.

 - **Given:** Two Admins update the same target concurrently.
   **When:** Both operations are processed.
   **Then:** The concurrency strategy prevents an unintended silent overwrite and returns the approved conflict result when required.

## 21. Decisions / TBD

| Question or decision | Authority/owner | Implementation impact | Status |
| --- | --- | --- | --- |
| What are the specific allowed values for Facility and Court `status`? | Product | Medium (Validation enums) | DECIDED: `ACTIVE` and `SUSPENDED`. |
| Should deactivating a Facility automatically deactivate its Courts (cascade)? | Product / Tech | High (Transaction boundary update) | DECIDED: Yes, atomically; suspension affects effective availability without overwriting Court status. |
| What happens to active Bookings when an Admin suspends a Facility? | Product | High (Booking behavior) | DECIDED: Existing Bookings remain unchanged; no automatic cancellation or refund. |
| Are deactivated facilities/courts visible in Admin list/detail views, and is deactivation reversible? | Product | High (Read and mutation behavior) | DECIDED: Visible to Admins; no restore operation in MVP. |
| What audit/diagnostic logging and retention policy applies to administrative actions? | Product / Architecture | Medium (Privacy/Legal) | DECIDED: Log action and target through the existing logging boundary; retention follows platform policy. |

## 22. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the requesting project owner
Approved decision/reference: Current user-approved feature review and implementation decision
```
