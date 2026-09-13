# Admin Facility Query Endpoints

## 1. Task Metadata

```text
Task Title: Implement Admin Facility Query API (List & Detail)
Status: Approved
Owner/Assignee: TBD
Complexity/Size: Medium
```

## 2. Context and Links

- Why this task is needed: Provide Admins the ability to view all registered facilities and courts, including deactivated ones, to fulfill oversight capabilities.
- Linked PRD: `docs/features/admin/court-management/prd.md`
- Linked Tech Design: `docs/features/admin/court-management/tech-design.md`
- Relevant architecture/schema/convention reference: `docs/architecture/conventions.md`, `docs/architecture/database-schema.md`

## 3. Scope

### In Scope

- API endpoint `GET /admin/facilities` with offset-based pagination (`page`, `limit`) and optional `status`/`search` filtering.
- API endpoint `GET /admin/facilities/:id` returning facility details and associated courts.
- Platform authentication boundary and `ADMIN` role authorization for these endpoints.
- Returning active and deactivated facilities for Admin views, with deactivated state indicated.

### Out of Scope

- Modifying (PATCH/DELETE) facilities or courts.
- Advanced facility analytics.
- UI implementation.

## 4. Dependencies and Blockers

- Prerequisite task or decision: N/A (Decision Gate completed).
- External/product dependency: N/A.
- Blocking TBD: N/A.

## 5. Implementation Details

1. **Routing & Middleware**: Create the `/admin/facilities` route namespace. Apply the global authentication middleware and an authorization middleware enforcing `role === 'ADMIN'`.
2. **Controller Layer**: Create a controller to handle collection/detail retrieval, parsing `page`/`limit`/`status`/`search` from query parameters.
3. **Service Layer**: Implement Admin-specific read methods. Ensure they do NOT filter out `deleted_at IS NOT NULL` records, unlike public endpoints.
4. **Data Access (Repository)**: Use the existing Facility/Court schema objects to fetch data. Map results to the approved allowlisted response shape `{ "data": ... }`, including the approved list pagination metadata.
5. **Error Handling**: Return `400` for malformed identifiers/query parameters and `ADMIN_FACILITY_NOT_FOUND` with `404` for a well-formed but non-existent Facility.

### Affected Files / Modules

- `[Proposed — verify during implementation]` Admin facility routes/controller/service/data-access modules

## 6. Acceptance Criteria

- **Given:** An authenticated user with the `ADMIN` role.
  **When:** They request `GET /admin/facilities?page=1&limit=10`.
  **Then:** The system returns `200 OK` with the approved `{ "data": { "items": [...], "meta": { "page": number, "limit": number, "total": number } } }` shape, including deactivated facilities with their state indicated.
- **Given:** An authenticated user with the `PLAYER` or `COURT_OWNER` role.
  **When:** They request `GET /admin/facilities`.
  **Then:** The system returns `403 Forbidden` using the global safe error shape.
- **Given:** An authenticated `ADMIN` user.
  **When:** They request `GET /admin/facilities/9999` (non-existent ID).
  **Then:** The system returns `404 Not Found` with error code `ADMIN_FACILITY_NOT_FOUND`.

- **Given:** An authenticated `ADMIN` user.
  **When:** They request a Facility detail containing Courts.
  **Then:** The response includes only approved Facility/Court fields and the Courts associated with that Facility.

- **Given:** An authenticated `ADMIN` user.
  **When:** They submit malformed pagination, filter, or identifier input.
  **Then:** The system returns `400 Bad Request` without accessing an unintended resource.

## 7. Verification / Test Cases

- Unit verification: Verify query parsing, allowlisted mapping, status/search filtering, and inclusion of deactivated records for Admin views.
- Integration verification: Verify Facility/Court reads and nested parent-child data against the frozen schema.
- API-level verification: Verify 401/403 authorization, 200 response shape, pagination calculations, filters, empty results, malformed input, and not-found behavior.
- E2E verification for a critical flow: N/A.
- Edge/failure/concurrency verification: Verify an invalid or mismatched resource cannot expose another Facility's Courts.
- Manual verification: Exercise collection/detail retrieval with an approved API client and verify loading/empty/error response behavior at the client boundary.

## 8. Impact Checklist

- Schema impact: None.
- API impact: Adds `GET /admin/facilities` and `GET /admin/facilities/:id`.
- Configuration impact: None.
- Security/authorization impact: Exposes facility list to Admins only.
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
