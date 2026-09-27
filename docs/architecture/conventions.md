# Coding Conventions

## Status

**Status:** READY

This document defines global coding, API, documentation, and testing
conventions. It does not approve technologies that remain TBD in
`docs/architecture/tech-stack.md`.

## Purpose

Provide practical conventions for developers and AI coding agents working on
the PERN monolith. These conventions support consistency, maintainability,
security, and safe feature delivery without duplicating business rules or the
global database schema.

## Scope

These conventions apply across the React client, Express.js/Node.js server,
PostgreSQL access, REST API, tests, configuration, and documentation.

Authority remains separated by information type:

- `PROJECT-BRIEF.md`: project scope, roles, MVP boundaries, and confirmed project decisions.
- `docs/documentation-guide.md`: documentation ownership, lifecycle, and agent contract.
- `docs/architecture/tech-stack.md`: global technology decisions and architectural constraints.
- `docs/architecture/database-schema.md`: consolidated global schema and schema invariants.
- `docs/business-rules-config-matrix.md`: frozen business rules and configuration values.
- Feature PRDs: feature behavior and business rules.
- Feature Tech Designs: feature APIs, technical implementation, state transitions, and edge cases.

## General Principles

- Prefer the smallest clear design that satisfies the approved requirement.
- Keep business logic in explicit application/service code; do not hide it in controllers, UI components, or scattered database queries.
- Keep modules cohesive and dependencies directed toward stable boundaries.
- Make invalid states difficult to create through validation, transactions, and database constraints where appropriate.
- Preserve existing behavior unless the task explicitly changes it.
- Do not introduce a dependency, service, architectural pattern, or infrastructure component that is not approved in the relevant architecture or Tech Design document.
- Treat `TBD` as unresolved. Do not silently choose an implementation.
- A single file must not exceed 1000 lines.
- A single function must not exceed 50 lines.

## Naming Conventions

### General Code

- Use `camelCase` for variables, functions, methods, and object properties.
- Use `PascalCase` for React components, classes, and type/interface declarations when the language supports them.
- Use `UPPER_SNAKE_CASE` for true constants and immutable configuration keys, not for ordinary local variables.
- Use names that describe domain intent. Avoid generic names such as `data`, `item`, or `utils` when a more precise name is available.
- Prefer one concept per name. Do not use abbreviations unless they are established domain terms.

### React

- Components use `PascalCase`, for example `BookingSummary`.
- Hooks use `use` followed by `PascalCase`, for example `useBookingAvailability`.
- Prop type declarations use the component name followed by `Props`, for example `BookingSummaryProps`, when the language supports them.
- Event handlers use names such as `handleSubmit` or `onBookingCancelled` according to whether they handle or receive an event.

### Files and Folders

- Use `kebab-case` for feature folders and multi-word filenames unless the surrounding framework requires another convention.
- Keep a component, its test, and closely related styles or helpers together when that improves discoverability.
- Use feature-oriented folders for feature code; use shared folders only for genuinely cross-feature code.
- Avoid catch-all folders such as `misc` or `helpers` without a clear ownership boundary.

### API and Database Names

- Use plural, resource-oriented nouns for REST paths, for example `/bookings` and `/tournaments`.
- Use lowercase kebab-case for multi-word path segments, for example `/matchmaking-requests`.
- Use HTTP methods to express the operation; do not encode verbs in paths unless the operation is a genuine command that cannot be represented as resource state.
- Use `snake_case` for database columns, constraints, indexes, and migration identifiers.
- Use names from `docs/architecture/database-schema.md` exactly for existing schema objects. Do not rename or reinterpret schema objects in feature code.
- Type and interface names must describe the data contract or domain concept, not its storage implementation.

## Project Structure

Organize code by feature or bounded capability first, then by responsibility.

### Frontend

- Keep feature UI, feature hooks, feature API clients, and feature state near the feature that owns them.
- Place genuinely shared UI primitives and cross-feature utilities in shared areas with narrow responsibilities.
- Keep API transport code separate from presentation components.
- Keep route composition and application-wide providers at the application boundary.

### Backend

- Organize backend code by responsibility layer first, then by MVP capability folder:
  - `routes/<capability>/`, `controllers/<capability>/`, `services/<capability>/`, and `repositories/<capability>/`.
  - Examples: `routes/matchmaking/`, `services/tournaments/`, `repositories/booking/`.
- Cross-module interfaces that are consumed by more than one capability live in `backend/src/contracts/` as type/interface-only modules (for example `PaymentService`, `MatchBookingPort`, `NotificationService`). Do not place a shared contract inside a single capability's folder.
- Keep validation schemas under `validation/<capability>.ts`.
- Keep cross-cutting concerns such as authentication, authorization, error handling, configuration, and logging at explicit shared boundaries such as `middleware/`, `errors/`, and `shared/`.
- Do not create a layer or abstraction only to satisfy a template. A small capability may combine files when responsibilities remain clear.
- Existing `admin` backend code already follows this structure; new capabilities must follow it.

### Separation of Concerns

- Routes map HTTP requests to application operations.
- Controllers translate HTTP input/output and delegate application work.
- Services/application code coordinates use cases, authorization checks, business validation, and transaction boundaries.
- Repositories or data-access modules own persistence queries and mapping to database records.
- UI components render state and dispatch user intent; they do not own server-side business rules.

## Frontend Conventions

- Keep components focused on one UI responsibility and split components when rendering, data loading, and interaction logic become difficult to reason about together.
- Define explicit props for component contracts. Avoid broad untyped objects and hidden dependencies.
- Keep reusable components presentational where possible. Feature components may coordinate feature behavior.
- Keep server data fetching behind feature API/query boundaries rather than issuing ad hoc requests throughout the component tree.
- Keep client state local unless it is shared across a meaningful component boundary or represents application/session state.
- Do not duplicate server truth in client state without an explicit synchronization strategy.
- Every user-visible asynchronous flow must define appropriate loading, success, error, and empty states. Use the states that apply; do not show an empty state while data is still loading.
- Handle authentication and authorization failures at the application boundary and feature boundary as appropriate. Do not infer permissions only from hidden UI controls.
- Avoid component files that combine unrelated screens, data access, complex state transitions, and reusable primitives. Split by responsibility when the boundary is clear.
- Tables and filter controls are global, shared UI: use the shared table and filter components placed in a shared UI area. Do not reimplement table rendering or filter UI independently per feature.
- Feature code composes the shared table and filter components by supplying feature-specific columns, data, and filter definitions as explicit props. Do not fork or copy the shared components to vary feature behavior.
- Keep the shared table and filter components presentational and feature-agnostic. They must not own server-side business rules or feature-specific data access.

Exact state-management and data-fetching libraries remain TBD unless approved in
`docs/architecture/tech-stack.md` or a relevant Tech Design.

## Backend Conventions

- Keep route handlers thin and deterministic. They should parse the HTTP boundary, call the application/service layer, and produce the HTTP response.
- Keep controllers free of complex business workflows and direct multi-step persistence logic.
- Put use-case orchestration, business validation, authorization decisions, and state transitions in the service/application layer.
- Keep database queries and persistence mapping in repositories or explicit data-access modules.
- Do not make repositories decide user-facing policy or silently perform unrelated side effects.
- Define the transaction boundary around the complete application operation that must be atomic.
- Pass transaction context explicitly through participating data-access operations when required.
- Keep authentication and authorization checks at a boundary that cannot be bypassed by alternate routes or service calls.
- Use feature Tech Designs for feature-specific workflows, state machines, and edge cases.

## API Conventions

### Resources and Methods

- Use RESTful resource-oriented paths and standard HTTP methods.
- Use `GET` for retrieval, `POST` for creation or an explicitly defined command, `PUT` for complete replacement when applicable, `PATCH` for partial update, and `DELETE` for deletion or deactivation when the resource contract supports it.
- Prefix all API paths with `/api/v1/` (e.g., `/api/v1/users`, `/api/v1/bookings`).
- Keep endpoint contracts, state transitions, and feature-specific commands in the relevant Tech Design.
- Do not expose database table names or internal service structure as an API contract by default.

### Requests and Responses

- Use JSON for REST request and response bodies unless a documented feature requirement requires another representation.
- Keep request and response shapes explicit and stable. Do not return internal database records indiscriminately.
- Use a consistent success shape within a feature and document deviations in its Tech Design.
- Return the HTTP status separately from any application error code. Application error codes must be stable enough for clients to handle without parsing human-readable messages.
- Do not expose stack traces, SQL, provider responses, secrets, or internal identifiers that are not part of the approved contract.

### Status Codes and Errors

- Use standard HTTP status codes consistently according to the global API conventions. Common mappings include `400`, `401`, `403`, `404`, `409`, and `500` where applicable.
- Feature-specific status-code mappings may be refined in the relevant Tech Design when the feature requires a different mapping.
- Use the global JSON error shape recommended by `tech-stack.md`:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  }
}
```

#### Global Error Codes

Every module uses these codes. Feature Tech Designs define codes for other cases.

| Code | HTTP | Use |
| --- | --- | --- |
| `VALIDATION_FAILED` | 400 | The request is malformed or fails validation. If every failing field has the same feature-specific code, that code is the top-level code instead. If failing fields have different codes, the top-level code is `VALIDATION_FAILED`. In both cases `details` lists `{ field, code }` for every failing field. |
| `INTERNAL_ERROR` | 500 | Any unexpected error. The message is generic and `details` is empty. The original error is logged on the server only. |

### Authentication

- Authentication uses the opaque session cookie `sid`. There is no `Authorization: Bearer` header.
- Protected routes use the shared `authenticate` middleware, followed by `requireRole(...)` when a system role is required. Contextual rules, such as Tournament Organizer, stay in the feature's service layer.
- `POST`, `PUT`, `PATCH`, and `DELETE` requests made with a session must send the `X-CSRF-Token` header.
- Shared authentication errors use the `AUTH_*` codes in `docs/features/platform/authentication-authorization/tech-design.md` §9.3, for example `401 AUTH_SESSION_INVALID` and `403 AUTH_FORBIDDEN_ROLE`.

### Pagination, Filtering, and Sorting

- Add pagination, filtering, or sorting only when required by the resource use case.
- Use offset-based pagination with `page` (1-indexed) and `limit` query parameters. Responses include a `meta` object: `{ page, limit, total, totalPages }`.
- Keep query parameter names and response metadata consistent across all paginated endpoints. Feature-specific deviations must be documented in the relevant Tech Design.

## Database Conventions

- Treat `docs/architecture/database-schema.md` as the consolidated schema source of truth.
- Store schema changes in migrations. A migration must be reviewable, ordered, and safe to apply in the target environments.
- Do not modify frozen schema structure, constraints, or invariants without an explicit schema decision and corresponding documentation update.
- Keep SQL and query construction in repository/data-access modules rather than controllers or UI code.
- Prefer parameterized queries and explicit column selection over string-built SQL and unrestricted record selection.
- Use database constraints for structural integrity and uniqueness. Use PostgreSQL Range/Exclusion Constraints where appropriate and approved for concurrency-sensitive intervals.
- Keep business workflows in application code unless a database constraint, trigger, or transaction is deliberately required for integrity and documented in the schema or Tech Design.
- Use transactions for multi-step operations that must succeed or fail together.
- Handle constraint and transaction failures at the application boundary without exposing database internals.
- Do not duplicate the schema or business-rule matrix in this document.

## Validation Conventions

Use the 3-tier validation model recommended by `tech-stack.md`:

1. **Request/API boundary validation:** Validate shape, types, required fields, and basic formats before application processing.
2. **Application/business validation:** Apply authorization boundaries, allowed operations, and business invariants through the service/application layer. The authoritative business rules remain in `docs/business-rules-config-matrix.md` and feature documents.
3. **Database integrity:** Enforce structural invariants through PostgreSQL constraints and transactions as defined by `docs/architecture/database-schema.md`.

- Do not treat request validation as a replacement for authorization or business validation.
- Do not treat application checks as a replacement for database integrity where a database constraint is required.
- Avoid duplicating business-rule tables, state machines, or configuration values here.
- Use Zod for request-boundary validation (`docs/architecture/tech-stack.md`, CONFIRMED).

## Error Handling

- Use centralized error handling at the Express API boundary.
- Represent expected application failures with safe, stable application error codes and appropriate HTTP statuses.
- Treat unexpected failures as internal errors, log diagnostic context on the server, and return a generic safe response with the global code `INTERNAL_ERROR`.
- Preserve the original error cause internally where supported, but do not expose stack traces, SQL, credentials, provider secrets, or infrastructure details to clients.
- Log at the boundary where the error is classified. Avoid logging the same error repeatedly at every layer.
- Do not use exceptions as ordinary control flow for expected validation outcomes when a clearer result is available.

## Async & Concurrency

- Prefer `async`/`await` for asynchronous application code.
- Handle every promise deliberately. Do not create unawaited promises unless the fire-and-forget behavior is intentional, safe, and observable.
- Define ownership for retries, timeouts, cancellation, and error propagation in the relevant application operation or Tech Design.
- Keep transaction-sensitive operations atomic and use the database as a concurrency boundary where appropriate.
- Design payment callbacks/events and other repeatable external operations to be idempotent, consistent with the confirmed payment decision.
- Protect read-modify-write operations from race conditions through transactions, constraints, locking, version checks, or another documented mechanism appropriate to the use case.
- Do not assume in-memory state is a reliable coordination mechanism across requests or processes.
- Background scheduling technology remains TBD; time-based behavior must still have an explicit owner and failure policy in the relevant Tech Design.

## Testing Conventions

Testing scope is recommended as follows:

- **Unit tests:** Focus on deterministic functions and isolated application/domain behavior.
- **Integration tests:** Verify cooperation with persistence and other real application boundaries where relevant.
- **API-level tests:** Verify REST contracts, status codes, validation, authorization, and error responses.
- **E2E tests:** Cover critical user flows and cross-boundary behavior, not every internal branch.

- Name tests by observable behavior and expected outcome.
- Prefer testing public behavior and contracts over private implementation details.
- Keep test data explicit, isolated, and safe to run repeatedly.
- Cover success, validation failure, authorization failure, relevant conflict, and important time/concurrency behavior for complex operations.
- Keep tests close to the owning feature or use a clearly documented project-wide test structure.
- Use Vitest with Supertest for unit, integration, and API tests, and Playwright for main user flows only, against a separate test database (`tech-stack.md`). Coverage percentage and fixture layout are not mandated.

## Git Conventions

- Keep branches focused on one feature, fix, documentation change, or refactor.
- Use short branch names that identify the work, for example `feature/booking-availability` or `fix/payment-idempotency`.
- Write commits as small, coherent changes with an imperative subject and an optional scope, for example `fix(booking): prevent duplicate confirmation`.
- Keep unrelated formatting, generated files, and drive-by refactors out of a change.
- Pull requests must describe scope, linked documentation, important behavior changes, schema or configuration impact, and verification performed.
- A pull request that changes global architecture, schema, conventions, scope, or confirmed decisions must identify the affected source-of-truth documents and required approval.

Exact branch and commit tooling is not enforced by this document; teams may refine it without changing application architecture.

## Configuration & Environment

- Read configuration through a centralized configuration boundary rather than accessing environment variables throughout the codebase.
- Validate required configuration at startup and fail clearly when the application cannot operate safely.
- Never hard-code credentials, tokens, private keys, payment secrets, or environment-specific URLs in source code or committed test data.
- Keep `.env` files containing secrets out of version control. Commit only safe examples with non-sensitive placeholder values when useful.
- Distinguish configuration from business data. Configuration defaults and snapshot semantics must follow the authoritative business/configuration documents.
- Do not log secrets or full authentication/payment credentials.
- Environment-specific deployment and container configuration remain TBD unless approved in the relevant architecture or deployment document.

## Comments & Documentation

- Prefer clear names and small functions over explanatory comments.
- Comment **why** a non-obvious decision exists, especially around concurrency, security, compatibility, or an intentional constraint.
- Do not comment obvious statements or restate the code line by line.
- Update the owning documentation when behavior, API contracts, schema, architecture, or global conventions change.
- Link feature implementation to its governing PRD, Tech Design, and task when those documents exist.
- Mark unresolved decisions as `TBD`; do not hide assumptions in comments.

## Security Coding Practices

- Treat all client input, query parameters, headers, uploaded content, and external provider responses as untrusted.
- Validate input at the API boundary and enforce authorization in application operations, not only by hiding UI controls.
- Apply RBAC for the system roles `PLAYER`, `COURT_OWNER`, and `ADMIN`, and contextual authorization for resource relationships such as Tournament Organizer permission.
- Keep authentication and authorization decisions separate from presentation concerns.
- Use the confirmed session cookie (`HttpOnly; Secure; SameSite=Lax`) and never copy session tokens into browser storage.
- Protect every state-changing request with the shared CSRF middleware; clients send the `csrf_token` cookie value in the `X-CSRF-Token` header.
- Encode or safely render user-controlled content according to its output context to reduce XSS risk.
- Minimize sensitive data collection, access, logging, and retention.
- Use parameterized database access and least-privilege credentials for runtime connections.
- Do not weaken authorization, validation, or security checks to make a test or UI flow pass.

Authentication, password hashing, and CSRF are defined in `tech-stack.md` and `docs/features/platform/authentication-authorization/tech-design.md`. Secret management and security tooling remain subject to `tech-stack.md`.

## Formatting & Linting

- Keep formatting, import ordering, whitespace, and naming consistent within each language and existing project area.
- Prefer automated formatting and linting when approved and available; do not add a formatter or linter dependency without documenting the decision.
- Do not mix unrelated formatting changes with behavior changes.
- Generated files must follow their generator's format and should not be manually edited unless the workflow explicitly requires it.
- Exact formatter, linter, parser, and pre-commit tooling remain TBD.

## Decision Boundaries / TBD

The following must not be silently decided in this document or in code:

- Authentication behavior beyond `docs/features/platform/authentication-authorization/tech-design.md`.
- Payment provider and provider-specific refund execution details.
- Deployment, CI/CD, observability tooling (APM, log aggregation), and security tooling.
- Formatter, linter, and pre-commit tooling (`tech-stack.md`).

Feature-specific API contracts, state machines, concurrency edge cases, and acceptance criteria belong in the relevant Tech Design. Changes to scope, roles, MVP boundaries, business rules, confirmed decisions, or the frozen schema require updates to their authoritative documents and human review.

## AI Coding Agent Guidelines

Before changing code, an AI coding agent must:

1. Read `PROJECT-BRIEF.md`, `docs/documentation-guide.md`, the relevant architecture documents, and the relevant feature PRD/Tech Design when present.
2. Check document status and implement only from a Ready document or explicitly approved lightweight specification.
3. Identify the authoritative document for each requirement before making a change.
4. Inspect existing code and tests before introducing a new pattern.

The agent must:

- Preserve the PERN stack, monolithic/client-server architecture, REST API, MVP boundaries, and system roles.
- Treat Tournament Organizer as contextual permission of Player, never as a fourth system role.
- Not invent or change business rules, configuration semantics, schema structure, API contracts, or state transitions.
- Not introduce a technology, dependency, service, framework, or infrastructure component that is not approved.
- Not answer a `TBD` item by assumption. Flag it and stop the affected work when resolution is required.
- Keep changes within the requested scope and avoid broad refactors unless explicitly required.
- Follow existing conventions before creating a new local convention.
- Update tests and the owning documentation when behavior or a documented contract changes.
- Keep unrelated files and generated output unchanged.
- Flag contradictions between documents, code, and tests instead of silently selecting a version.
- Report verification performed, remaining risks, and unresolved decisions.

If a request conflicts with a higher-authority document, stop the affected work,
identify both statements, and request clarification according to
`docs/documentation-guide.md`.

## Known Documentation Notes

- The repository's consolidated schema document is `docs/architecture/database-schema.md`; references to `docs/database-schema.md` should be interpreted as that authoritative architecture document unless the documentation structure is explicitly changed.
- No business-rule or architecture conflict was identified while creating this document. Feature documents must still be checked before feature implementation.

## Change Log

| Date | Change | Approved by | Reference |
| --- | --- | --- | --- |
| 2026-09-16 | Added API "Authentication" conventions; Zod set as the validation library. | Tech Lead (Decision Gate) | `docs/features/platform/authentication-authorization/tech-design.md` §21.1 |
| 2026-09-16 | Added Global Error Codes `VALIDATION_FAILED` and `INTERNAL_ERROR`; testing tools set per `tech-stack.md`. | Tài (Tech Lead) | `docs/features/platform/authentication-authorization/tasks.md` (Decisions Applied, Q1–Q3) |
| 2026-09-22 | Added Frontend convention: tables and filter controls are global shared UI, composed per feature. | Human owner (explicit request) | This document, Frontend Conventions |
| 2026-09-25 | Added API versioning prefix `/api/v1/`. Replaced TBD pagination note with confirmed offset-based convention (`page`, `limit`, `meta`). Updated Decision Boundaries to remove resolved items. | Tài (Tech Lead) | `docs/architecture/tech-stack.md` Confirmed Decisions |
| 2026-09-26 | Standardized backend structure on responsibility layers namespaced by capability (`routes/`, `controllers/`, `services/`, `repositories/`, `validation/<capability>.ts`) and added `backend/src/contracts/` as the home for cross-module interfaces. Resolves the Booking/Matchmaking vs Tournament structure mismatch. | Human owner | `docs/features/booking/player-booking/tech-design.md` §7.1, `docs/features/matchmaking/matchmaking/tech-design.md` §7.1, `docs/features/tournament/tech-design.md` §1 |
