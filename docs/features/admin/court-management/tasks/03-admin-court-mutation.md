# Admin Court Mutation API

## 1. Task Metadata

```text
Task Title: Implement Admin Court Mutation API (Status & Deactivation)
Status: TODO
Owner/Assignee: TBD
Complexity/Size: Small
```

## 2. Context and Links

- Why this task is needed: Provide Admins the ability to suspend or deactivate a specific Court within a Facility without affecting the entire Facility.
- Linked PRD: `docs/features/admin/court-management/prd.md`
- Linked Tech Design: `docs/features/admin/court-management/tech-design.md`
- Relevant architecture/schema/convention reference: `docs/architecture/conventions.md`

## 3. Scope

### In Scope

- API endpoint `PATCH /admin/facilities/:facilityId/courts/:courtId` to update a court's status (`ACTIVE`, `SUSPENDED`).
- API endpoint `DELETE /admin/facilities/:facilityId/courts/:courtId` to deactivate a specific court.
- Parent-child relationship validation (Court must belong to the requested Facility).
- Transaction row locking for concurrent mutations.
- Logging the administrative action through the existing logging boundary.

### Out of Scope

- Facility-level mutations.
- Mutating existing Bookings.

## 4. Dependencies and Blockers

- Prerequisite task or decision: N/A.
- External/product dependency: N/A.
- Blocking TBD: N/A.

## 5. Implementation Details

1. **Routing & Validation**: Add routes under `/admin/facilities/:facilityId/courts/:courtId`. Validate payload `{"status": "ACTIVE" | "SUSPENDED"}` at the request boundary without adding a validation-library dependency.
2. **Service Layer**: Retrieve Court and assert it belongs to `facilityId` (throw `ADMIN_FACILITY_COURT_MISMATCH` / 404 if not).
3. **Mutation (PATCH)**: Lock the Court row, verify it is not deactivated, update its allowed status, and log the action.
4. **Mutation (DELETE)**: Lock the Court row. If already deactivated, return idempotent `204 No Content`; otherwise set `deleted_at = NOW()` and log the action.

### Affected Files / Modules

- `[Proposed — verify during implementation]` Admin facility/court routes/controller/service/data-access modules

## 6. Acceptance Criteria

- **Given:** An authenticated `ADMIN`.
  **When:** They request `DELETE` for a Court using a `facilityId` that does NOT own the court.
  **Then:** The system does not mutate the court and returns 404 Not Found (or approved safe mismatch error).
- **Given:** An authenticated `ADMIN` and an eligible Court.
  **When:** They request `PATCH` with `{"status": "SUSPENDED"}`.
  **Then:** The court status changes to `SUSPENDED`. Returns 200 OK.
- **Given:** An authenticated `ADMIN` and an eligible Court.
  **When:** They request Court deactivation.
  **Then:** Only that Court is deactivated, existing Bookings remain unchanged, and the API returns `204 No Content`.
- **Given:** An authenticated `ADMIN`.
  **When:** They send `DELETE` to an already deactivated court.
  **Then:** The API treats it as idempotent and returns 204 No Content without failing.

## 7. Verification / Test Cases

- Unit verification: Parent-child validation logic. Enforce allowed status enums.
- Integration verification: Verify single-row updates in `COURTS` table.
- API-level verification: Verify 404 mismatch errors, 400 validation, and 401/403 authorization.
- E2E verification for a critical flow: N/A.
- Edge/failure/concurrency verification: Concurrent mutations are serialized and do not silently overwrite data; database conflicts use the approved safe error contract.
- Manual verification: Check database to ensure only target court is modified.

## 8. Impact Checklist

- Schema impact: None.
- API impact: Adds `PATCH .../courts/:courtId` and `DELETE .../courts/:courtId`.
- Configuration impact: None.
- Security/authorization impact: Admin restricted.
- Documentation impact: N/A.

## 9. Completion Checklist

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `TBD` was silently resolved.
- [ ] No unrelated files or refactors were included.

## 10. Status

```text
Status: TODO
Blocked by: N/A
Verification completed: TBD
```
