# Admin Facility Mutation API

## 1. Task Metadata

```text
Task Title: Implement Admin Facility Mutation API (Status & Deactivation)
Status: Approved
Owner/Assignee: TBD
Complexity/Size: Medium
```

## 2. Context and Links

- Why this task is needed: Provide Admins the ability to update facility status (`ACTIVE`, `SUSPENDED`) and deactivate facilities (which inherently deactivates its courts for new availability).
- Linked PRD: `docs/features/admin/court-management/prd.md`
- Linked Tech Design: `docs/features/admin/court-management/tech-design.md`
- Relevant architecture/schema/convention reference: `docs/architecture/conventions.md`

## 3. Scope

### In Scope

- API endpoint `PATCH /admin/facilities/:id` to update status.
- API endpoint `DELETE /admin/facilities/:id` to deactivate a facility and all its courts via atomic transaction.
- Request payload validation (enforcing only `ACTIVE` or `SUSPENDED`).
- Transaction row locking for concurrent mutations.
- Logging the administrative action through the existing logging boundary.

### Out of Scope

- Mutating existing Bookings.
- Court-level specific mutations (handled in a separate task).
- Auto-cancellation or refunding logic.

## 4. Dependencies and Blockers

- Prerequisite task or decision: Task 01 (Admin Facility Query API) is recommended but not strictly required.
- External/product dependency: N/A.
- Blocking TBD: N/A.

## 5. Implementation Details

1. **Routing & Validation**: Add `PATCH` and `DELETE` routes under `/admin/facilities/:id`. Validate `{"status": "ACTIVE" | "SUSPENDED"}` at the request boundary without adding a validation-library dependency.
2. **Controller Layer**: Parse the payload and delegate to the service layer.
3. **Service Layer (PATCH)**: Check that the Facility exists and is not deactivated. Validate the requested allowed value, lock the Facility row, update its status, and log the action.
4. **Service Layer (DELETE)**: Open a DB transaction. Lock the Facility row and all child Court rows. If already deactivated, return the idempotent `204 No Content` result. Otherwise set the Facility and all child Court `deleted_at` values atomically, commit, and log the action.
5. **Data Access (Repository)**: Implement transaction and row-lock support for the cascade deactivation.

### Affected Files / Modules

- `[Proposed — verify during implementation]` Admin facility routes/controller/service/data-access modules

## 6. Acceptance Criteria

- **Given:** An authenticated `ADMIN` and an eligible Facility.
  **When:** They send `DELETE /admin/facilities/:id`.
  **Then:** The facility AND its courts have `deleted_at` populated. Returns 204 No Content. Existing bookings are untouched.
- **Given:** An authenticated `ADMIN`.
  **When:** They send `PATCH /admin/facilities/:id` with `{"status": "INVALID_STATUS"}`.
  **Then:** The API returns 400 Bad Request with validation errors.
- **Given:** An authenticated `ADMIN` and an active Facility.
  **When:** They send `PATCH /admin/facilities/:id` with `{"status": "SUSPENDED"}`.
  **Then:** The Facility becomes unavailable for new Bookings while existing Bookings remain unchanged, and the API returns `200 OK`.
- **Given:** Two concurrent `ADMIN` requests to update the same facility.
  **When:** Both requests are processed.
  **Then:** Both operations are serialized by the transaction/row-lock strategy and no update is silently lost. A database conflict is mapped to the approved safe error contract if one occurs.
- **Given:** An authenticated `ADMIN`.
  **When:** They send `DELETE` to an already deactivated facility.
  **Then:** The API treats it as idempotent and returns 204 No Content without failing.

## 7. Verification / Test Cases

- Unit verification: Service enforces allowed statuses, deactivation idempotency, Booking immutability, and authorization boundary.
- Integration verification: Verify atomic Facility/Court deactivation and rollback if any mutation fails.
- API-level verification: Verify 400 validation, 401/403 authorization, 404 not found, 204 deactivation, 200 status update, and safe conflict handling.
- E2E verification for a critical flow: N/A.
- Edge/failure/concurrency verification: Ensure concurrent mutations are serialized and do not silently overwrite data; verify repeated DELETE is idempotent.
- Manual verification: Verify Facility/Court state and unchanged Booking records through approved inspection procedures.

## 8. Impact Checklist

- Schema impact: None. (Uses existing `status` and `deleted_at`).
- API impact: Adds `PATCH /admin/facilities/:id` and `DELETE /admin/facilities/:id`.
- Configuration impact: None.
- Security/authorization impact: Requires `ADMIN` role. Uses proper logging for audit.
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
Status: Approved
Blocked by: N/A
Verification completed: Not yet run; task is approved for implementation.
```
