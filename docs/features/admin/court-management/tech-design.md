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

The Admin portal requires an interface for platform administrators to oversee registered facilities and their associated courts across the ecosystem. This includes viewing paginated lists with high-level operational metric cards (total facilities, total courts, active facilities, suspended facilities), inspecting details, applying multi-dimensional filters, updating operational statuses (`ACTIVE ↔ SUSPENDED`), and deactivating facilities or courts within the behavior approved by the PRD and aligned with Figma Screen A04 (`Badminton SmashPro` / `Facility / Court Management List`).

## 3. Technical Problem

We need to provide secure REST API operations and frontend administrative components that allow only users with the `ADMIN` role to manage facilities and courts. The implementation must strictly adhere to the frozen database schema without altering Booking state or violating real-time booking rules. Suspending or deactivating a facility/court affects only new availability; existing Bookings remain unchanged.

## 4. Goals

- Provide secure, `ADMIN`-only API operations for listing, querying metrics, and managing facilities and courts.
- Return operational summary statistics (`stats`) to populate top KPI cards (Bento layout).
- Support multi-dimensional query filters: search keyword, city/region, operational status, and sorting.
- Provide DTO mapping for rich UI presentation (facility codes e.g. `#FAC-SGN-007`, owner contact, and court scale).
- Support status updates for approved status values (`ACTIVE` and `SUSPENDED`), including the "Thẩm định lại" (Re-evaluate/Reactivate) action.
- Support atomic cascade deactivation (`deleted_at`) for facilities and their child courts.
- Apply request-boundary validation, application authorization, safe error handling, and transaction boundaries according to established conventions.

## 5. Non-Goals

- Cancelling, refunding, or mutating existing Bookings upon administrative facility/court actions.
- Building a complex BI analytics or reporting pipeline (summary metrics are calculated via lightweight SQL aggregations).
- Unrelated schema changes; CM-05 consumes approved `COURT_OWNER_REVIEWS` (§3.33), implemented with CO-01.

## 6. Upstream References

- Governing PRD: `docs/features/admin/court-management/prd.md`
- Project scope/roles/MVP: `PROJECT-BRIEF.md` §4
- Global documentation rules: `docs/documentation-guide.md`
- Global architecture/technology: `docs/architecture/tech-stack.md`
- Global coding/API conventions: `docs/architecture/conventions.md`
- Business rules/configuration: `docs/business-rules-config-matrix.md` §2.4
- Global database schema: `docs/architecture/database-schema.md` §3.5, §3.6
- UI/UX Design: Figma Screen A04 (`node-id=13-150025`)

## 7. Proposed Technical Design

- **Application/Service Boundary**: Enforce `ADMIN` authorization and facility/court use-case orchestration in application/service code.
- **Persistence Boundary**: Use explicit data-access operations querying `FACILITIES`, `COURTS`, and `USERS`. All derived display fields (e.g., `#FAC-...` code and court counts) are computed or aggregated in the repository/service layer without modifying the database schema. Metrics must be backed by stored data; do not fabricate or estimate values.
- **Client/Server Boundary**: Expose RESTful JSON resources under `/api/v1/admin/facilities` (global `/api/v1/` prefix) returning a consistent `{ "data": { ..., "meta": { ... } } }` success envelope; pagination uses the global `meta: { page, limit, total, totalPages }` shape per `docs/architecture/conventions.md`.
- **Frontend Architecture**: Implement `/admin/courts` using modular components:
  - `FacilityMetricCards`: 4 Bento-style KPI cards.
  - `FacilityFiltersToolbar`: Quick search input, city filter, status filter, sorting, and reset button.
  - `FacilityTable`: Data table matching Figma A04 with columns for facility identity (thumbnail, name, `#FAC-...` code, address), owner contact, court scale, operational status badge, and contextual action buttons.
  - `FacilityStatusModal`: Modal for confirming suspension or re-evaluation/reactivation.
  - `FacilityComplianceBanner`: SLA v2.4 guidelines container at page bottom.
  - `CreateFacilityModal`: Modal for onboarding a new facility and its initial courts.

## 8. Behavior, State, and Flow

- **Status Update & Re-evaluation**:
  - Allowed values are `ACTIVE` and `SUSPENDED`.
  - Transition: `ACTIVE ↔ SUSPENDED`.
  - Suspending a facility (`SUSPENDED`) prevents new booking creations on player apps (`P06/P07`); child courts inherit ineligibility for new bookings while their own status values are preserved.
  - Reactivating / Re-evaluating a facility (`ACTIVE`) restores eligibility only for ACTIVE/not-deactivated child courts with pricing/opening-hour coverage; never auto-activates pending/rejected courts.
- **Facility Creation**:
  - The Admin provides facility, owner-contact, and initial court-scale data in a single request.
  - Owner resolution is performed via `ownerEmail`; the owner user and `COURT_OWNER` profile are created if absent.
  - Facility and initial child courts are inserted in a single transaction and default to `ACTIVE`.
- **Deactivation**:
  - Preconditions: The target exists and is not already deactivated.
  - A Facility deactivation also deactivates all of its Courts in the same transaction.
  - Deactivation sets `deleted_at = CURRENT_TIMESTAMP` and is irreversible in this MVP flow.
  - Deactivated records remain visible to Admin views with explicit deactivation indicators.
- **Booking Boundary**:
  - These operations do not cancel, refund, or mutate existing Bookings. Existing confirmed bookings remain held.

## 9. API Design

### Endpoints

- `GET /api/v1/admin/facilities`: List facilities with pagination, filters, and summary stats.
- `GET /api/v1/admin/facilities/:id`: Get detailed information of a facility and its child courts.
- `POST /api/v1/admin/facilities`: Onboard a new facility with its owner contact and initial child courts.
- `PATCH /api/v1/admin/facilities/:id`: Update facility status (`ACTIVE` | `SUSPENDED`).
- `DELETE /api/v1/admin/facilities/:id`: Deactivate a facility and its courts.
- `PATCH /api/v1/admin/facilities/:facilityId/courts/:courtId`: Update court status (`ACTIVE` | `SUSPENDED`).
- `DELETE /api/v1/admin/facilities/:facilityId/courts/:courtId`: Deactivate a specific court.

### Request Contracts

- **Query Parameters (`GET /api/v1/admin/facilities`)**:
  - `page` (number, optional, default: 1)
  - `limit` (number, optional, default: 10)
  - `search` (string, optional): search across name, owner name, address, or facility code.
  - `status` (string, optional): `ACTIVE` | `SUSPENDED` | `PENDING_APPROVAL` | `REJECTED` | `DISABLED`. `DISABLED` selects soft-deleted records; every other value excludes soft-deleted records.
  - `city` (string, optional): canonical city or alias; matching uses the shared city normalization map.

  - `sort` (string, optional): `courtCount_desc` | `courtCount_asc` | `newest` | `oldest`

- **Status Update Body (`PATCH /api/v1/admin/facilities/:id`)**:
  ```json
  {
    "status": "ACTIVE", // or "SUSPENDED"
    "reason": "PCCC_EXPIRED", // optional, only meaningful when status is SUSPENDED
    "note": "Biên bản kiểm tra số 12/2026" // optional, only meaningful when status is SUSPENDED
  }
  ```

  Field rules:
  - `status`: required; `ACTIVE` | `SUSPENDED`.
  - `reason`: optional string; accepted only when `status` is `SUSPENDED`. Allowed values: `PCCC_EXPIRED` | `LIGHTING_STANDARD_FAILED` | `TOS_VIOLATION` | `DISPUTE_INVESTIGATION`.
  - `note`: optional string (internal Admin note); maximum 500 characters.
  - **Persistence**: a real transition (previous status differs) writes `FACILITY_STATUS_AUDITS` with the acting Admin, previous/next status, reason code, note and timestamp in the same transaction (`0035`). A no-op request does not write an audit row.

- **Create Facility Body (`POST /api/v1/admin/facilities`)**:
  ```json
  {
    "name": "CLB Cầu Lông Cầu Giấy Arena",
    "address": "35 Trần Thái Tông, Dịch Vọng Hậu",
    "city": "Hà Nội",
    "district": "Cầu Giấy",
    "ward": "Dịch Vọng Hậu",
    "phone": "0987654321",
    "description": "Cụm sân tiêu chuẩn thi đấu",
    "ownerName": "Nguyễn Văn Bách",
    "ownerPhone": "0987654321",
    "ownerEmail": "bach.caugiay@badminton.com",
    "courtCount": 6,
    "openingTime": "05:30:00",
    "closingTime": "23:00:00"
  }
  ```

  Field rules:
  - `name`: required, minimum 2 characters.
  - `address`: required, minimum 5 characters.
  - `city`: required, minimum 2 characters.
  - `ownerName`: required, minimum 2 characters.
  - `ownerPhone`: required, minimum 8 characters.
  - `ownerEmail`: required, valid email address.
  - `courtCount`: optional integer, 1–50, default 4.
  - `district`, `ward`, `phone`, `description`, `openingTime`, `closingTime`: optional.

  Behavior:
  - The owner is resolved by `ownerEmail`. If the user exists, an existing `COURT_OWNER` profile is reused; otherwise a new `COURT_OWNER` user and profile are created within the same transaction.
  - The facility and its initial child courts are created atomically. On success the endpoint returns `201 Created` with the facility DTO.

### Response Contract (`GET /api/v1/admin/facilities`)

```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "facilityCode": "#FAC-SGN-007",
        "name": "CLB Cầu Lông Phúc Thịnh",
        "address": "18D Huỳnh Tấn Phát, Tân Thuận Đông, Quận 7, TP.HCM",
        "city": "TP. Hồ Chí Minh",
        "owner": {
          "id": 12,
          "name": "Trần Quốc Bảo",
          "phone": "0908 123 456",
          "email": "baotq.phucthinh@gmail.com"
        },
        "courtStats": {
          "totalCourts": 10,
          "activeCourts": 8
        },
        "status": "ACTIVE",
        "isDisabled": false,
        "dataSource": "GOOGLE_PLACES_IMPORT",
        "sourceRef": "ChIJ...",
        "confirmedAt": null,
        "imageUrl": null,
        "deletedAt": null,
        "createdAt": "2026-01-15T08:00:00Z",
        "updatedAt": "2026-03-20T10:00:00Z"
      }
    ],
    "stats": {
      "totalFacilities": 142,
      "provincesCovered": 18,
      "newFacilitiesThisQuarter": 7,
      "totalActiveCourts": 860,
      "activeFacilities": 136,
      "activeFacilityRate": 95.8,
      "suspendedFacilities": 6,
      "unconfirmedSampleFacilities": 58
    },
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 142,
      "totalPages": 15
    }
  }
}
```

### Error Responses

Errors use the global contract: `{ "error": { "code": "...", "message": "...", "details": [] } }`.
- `ADMIN_FACILITY_NOT_FOUND` (404)
- `ADMIN_COURT_NOT_FOUND` (404)
- `ADMIN_FACILITY_COURT_MISMATCH` (404)
- `ADMIN_INVALID_STATUS` (400)
- `ADMIN_CONCURRENT_UPDATE` (409)

## 10. Data Model & Schema Mapping

- Schema objects utilized: `FACILITIES`, `COURTS`, `USERS`, `FACILITY_STATUS_AUDITS`.
- Schema delta (`0035`): `data_source`, `source_ref`, `confirmed_at`, `confirmed_by` on `FACILITIES` and `COURTS`; `FACILITY_STATUS_AUDITS`.
- Derived mapping rules:
  - `facilityCode`: Formatted string generated as `#FAC-{CITY_CODE}-{ID_PAD}` (e.g. `#FAC-SGN-007`).
  - `owner`: Joined from `USERS` on `FACILITIES.owner_id = USERS.id`; a missing name is returned as `Chưa khai báo`, never invented.
  - `courtStats.totalCourts`: Count of non-deleted child courts.
  - `courtStats.activeCourts`: Child courts with `status = ACTIVE` and `deleted_at IS NULL`.
  - `isDisabled`: `FACILITIES.deleted_at IS NOT NULL`.
  - Statistics (`4.2` decisions): total facilities excludes soft-deleted records; active/suspended excludes soft-deleted records; total active courts require court and facility ACTIVE and both non-deleted; new facilities use the Asia/Ho_Chi_Minh calendar quarter; active rate is `active / total` (0 when total is 0); province coverage uses the shared city normalization map.
  - No DTO field is derived from court count (no Grade, surface type, thickness, or operational note).

## 11. Security

- Enforce `ADMIN` role check via authentication and authorization middleware at application boundary.
- For nested court operations, verify that `COURTS.facility_id === requested facilityId`.
- Controlled response allowlisting to protect sensitive backend fields.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| Non-admin attempting access | Auth Middleware | `403 Forbidden` | Standard error response |
| Target facility/court not found | Repository query | `404 Not Found` | Standard error response |
| Court does not belong to requested Facility | Application/service validation | Return `404 Not Found` / Mismatch error; no mutation | Standard error response |
| Deactivating already deactivated record | Application validation | Idempotent `204 No Content` | No new state transition |
| Invalid status value | Input validation | `400 Bad Request` | Validation error details |
| Concurrent update conflict | Row-lock check | `409 Conflict` | Standard error response |
| Active Bookings on suspended facility | Product SLA policy | Existing Bookings untouched | Booking state preserved |

## 13. Concurrency & Idempotency

- Use transaction row locks (`FOR UPDATE`) for facility status updates and cascade deactivations.
- Deactivation is idempotent (`204 No Content` if already deactivated).

## 14. Performance

- Use offset-based pagination (`page`, `limit`).
- Aggregate stats using optimized SQL queries (`COUNT`, `FILTER`).

## 15. Testing Considerations

- Unit tests: Query parsing, DTO mapping, status validations, and role checks.
- Integration tests: Facility/Court queries, cascade soft-deletes, and transaction boundaries against PostgreSQL.
- Frontend tests: Render verification for KPI cards, table rows, filter dropdowns, modals, and Excel export.

## 16. Decision Status

```text
Decision Status: Approved
Approval needed from: N/A — approved by the requesting project owner
Approved decision/reference: Aligned with PRD and Figma Screen A04
```

## Owner review integration — approved 2026-10-23

CM-05 implements onboarding and post-approval location reviews using schema §3.33, with mandatory rejection reason, reviewer and timestamp. Initial/pending onboarding is immutable; Owner explicit resubmission creates a new attempt on the same resource ID. Existing operational ACTIVE↔SUSPENDED endpoints remain separate.

- `POST /api/v1/admin/facilities/:id/approve` or `/reject` and `POST /api/v1/admin/facilities/:facilityId/courts/:courtId/approve` or `/reject` decide the current pending ONBOARDING attempt. Body `{ reviewId, reason? }`, reason required for reject; lock/check review target and PENDING state. Apply resource status and retain result atomically. Stale/already-decided attempts return 409 `REVIEW_NOT_PENDING`.
- `GET /api/v1/admin/facilities/:id/reviews?page=&limit=` and court equivalents return `{ data: [...], meta }` with submitted snapshot, kind, review outcome, reason and timestamps. Include pending address proposals in the facility detail view with approved/proposed values side by side.
- `POST /api/v1/admin/facilities/:id/address-change-requests/:reviewId/approve` or `/reject`, body `{ reason? }`, mandatory for reject. Approval copies only approved location fields into the facility in the same transaction; rejection retains the live location. Never change moderation status as part of address approval.
- All endpoints require ADMIN, CSRF on writes, 404 for missing/mismatched targets, 400 for missing reason, 409 for non-pending attempts. Approval does not bypass parent eligibility, pricing or opening hours.

Test repeated/stale decisions, missing reason, review history across resubmission, approved address retention on rejection, and suspended facility staying suspended after address approval. CM-05 is not DONE. Shared-document/schema updates require teammate PR review before merge.

### Admin review queue sorting — 2026-11-21

`GET /api/v1/admin/facilities/reviews` accepts optional `sort=newest|oldest` (default `newest`). Order by review `created_at`, then `id`, both descending for newest or ascending for oldest, before pagination. Existing search, status, target and date filters remain applicable. `/admin/approvals` resets to page 1 when sorting changes. The date controls occupy a separate responsive toolbar row.

### Court profile and standard review — 2026-11-24

- `GET /api/v1/admin/facilities` accepts `condition=NORMAL|NEEDS_MAINTENANCE|UNDER_MAINTENANCE|UNSPECIFIED` and `surfaceType=PVC|WOOD|PU_ACRYLIC|OTHER`. Both use `EXISTS` over non-deleted courts, so a facility is counted once. The list DTO adds `courtStats.activeCourts` and `courtStats.conditionSummary` (`NORMAL`, `NEEDS_MAINTENANCE`, `UNDER_MAINTENANCE`, `UNSPECIFIED`).
- `GET /api/v1/admin/facilities/:id` returns court profile fields: `surfaceType`, `surfaceBrand`, `surfaceModel`, `surfaceThicknessMm`, `condition`, `conditionNote`, `profileVersion`.
- `PATCH /api/v1/admin/facilities/:facilityId/courts/:courtId/profile` requires `reason` (1–1000) and `profileVersion`; it writes the same `COURT_PROFILE_CHANGES` history as the Owner path, in one transaction.
- `GET /api/v1/admin/facilities/:facilityId/courts/:courtId/profile-changes?page=&limit=` returns the paginated history.
- `GET /api/v1/admin/standards/claims?status=&page=&limit=` lists claims with court/facility context and evidence media IDs. `POST /api/v1/admin/standards/claims/:id/approve|reject` requires a reason on reject; approval sets `VERIFIED`, rejection `REJECTED`, and both notify the owning Owner. Invalid/expired claims are excluded from the public facility detail.
