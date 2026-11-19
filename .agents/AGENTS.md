# Badminton Platform - AI Agent Instructions

This document provides essential instructions for AI coding agents working on the `badminton-platform` repository. Agents MUST read and follow these rules to ensure safety, consistency, and alignment with the project's architecture and business goals.

This document is NOT a replacement for the project's architecture, database, business-rules, PRD, or Tech Design documents. Keep detailed domain/business specifications in their authoritative documents.

## 1. Authoritative Document Hierarchy

Before planning or executing changes, consult the relevant authoritative documents. Do not invent rules or schemas. The hierarchy of authority is:

1. **`PROJECT-BRIEF.md`**: Project scope, MVP boundaries, system roles, and confirmed business decisions.
2. **`docs/documentation-guide.md`**: Documentation ownership, lifecycle, update rules, and the AI agent contract.
3. **`docs/architecture/tech-stack.md`**: Global technology decisions and architectural constraints.
4. **`docs/architecture/database-schema.md`**: Consolidated global schema and schema invariants. This remains the SINGLE authoritative database schema source. Do not create competing schema sources.
5. **`docs/architecture/conventions.md`**: Governs global coding, API, documentation, and testing conventions.
6. **`docs/architecture/frontend.md`**: Governs the frontend application architecture, route/navigation map, shared frontend layer, design system/tokens, and the Figma screen inventory (`P##`/`O##`/`A##`). Consult it before planning or changing any UI code.
7. **`docs/business-rules-config-matrix.md`**: Remains the authoritative business-rule and configuration source.
8. **Feature PRDs**: Govern feature-specific product decisions, behavior, user journeys, and business rules.
9. **Feature Tech Designs**: Govern feature-specific technical decisions, API design, technical implementation, state transitions, and edge cases.

## 2. Project Architecture

The system uses a monolith/client-server architecture. Confirmed technologies include:
- PERN Stack: PostgreSQL, Express.js, React, Node.js
- TypeScript
- Vite
- npm
- PostgreSQL is run locally through Docker Compose (CURRENT repository development setup; NOT a finalized project-wide architecture decision)
- RESTful API
- Drizzle ORM (`drizzle-orm`) with `drizzle-kit` SQL migrations
- Zod request-boundary validation
- Vitest + Supertest for unit/integration/API tests, and Playwright for main user flows
- Strict separation between `frontend/` and `backend/` directories.

Backend code is organized **layer-first by capability**: `routes/<capability>/`, `controllers/<capability>/`, `services/<capability>/`, `repositories/<capability>/`, with cross-module interfaces in `backend/src/contracts/` and Zod schemas in `validation/<capability>.ts`. Cross-cutting concerns live in `middleware/`, `errors/`, and `shared/`. Frontend feature code lives under `frontend/src/features/<capability>/`. See `docs/architecture/conventions.md`.

**IMPORTANT**: Do NOT promote currently-TBD technologies into mandatory project decisions. If a technology is TBD in authoritative documentation, AGENTS.md must not choose one.

## 3. Business and Product Constraints

Agents must preserve the following constraints:
- **System Roles**: Player, Court Owner, and Admin.
- **Tournament Organizer**: This is a contextual permission held by a Player within their own tournaments, NOT a separate system role.
- **MVP Focus**: Matchmaking, Court Booking, and Tournament. Do NOT introduce excluded/future functionality into the MVP without explicit approval.
- **Booking Flow**: Operates in real time. Do not introduce a "Pending -> Owner Approve/Reject" flow.
- **Business Rules**: Do not change established business rules merely to simplify implementation.

Consult `docs/business-rules-config-matrix.md` for detailed business rules.

## 4. AI Coding Safety Rules

AI agents MUST adhere to these safety rules:
1. Read the relevant documentation before changing code.
2. Inspect the existing implementation before proposing changes.
3. Preserve the current architecture unless explicitly instructed otherwise.
4. Preserve existing business behavior unless the requested change intentionally modifies it.
5. Never invent API contracts, database fields, statuses, configuration values, roles, or business rules.
6. Never resolve a TBD decision by guessing.
7. Never silently modify an authoritative document to justify an implementation.
8. Never introduce a new dependency unless it is explicitly approved or already established by project decisions.
9. Avoid unrelated refactoring.
10. Keep changes scoped to the requested task.
11. Update tests when behavior changes.
12. Update documentation when an approved architectural/business decision changes.
13. Surface contradictions instead of silently choosing one interpretation.
14. Prefer designs that make invalid states difficult to create.
15. Preserve transaction boundaries and data integrity.
16. Treat payment callbacks and similar external callbacks as potentially duplicated and require idempotent handling where applicable.
17. Do not use in-memory state as a source of truth for cross-request coordination.
18. Do not weaken authorization or validation to make implementation easier.
19. Do not expose internal errors or sensitive implementation details through API responses.
20. Never make destructive database or Git operations without explicit instruction.

## 5. Documentation Workflow

The feature workflow is:
`PROJECT-BRIEF -> PRD -> TECH DESIGN -> TASK -> IMPLEMENTATION`

- **PRD**: Defines WHAT and WHY.
- **Tech Design**: Defines HOW.
- **Task**: Defines an atomic/verifiable implementation unit.
- **Implementation**: Follows approved documentation.

For substantial feature implementation, agents must work from a governing document that is READY, or from an explicitly approved lightweight specification for changes that do not require the full PRD/Tech Design workflow.

Agents must NOT implement from:
- Draft documents
- Ambiguous requirements
- Unresolved decisions
- Documents blocked by unresolved `[TBD]` items

When the governing documentation is insufficient, the agent must surface the issue rather than silently deciding. Small changes do not necessarily require the full documentation workflow and may use a Task directly when appropriate.

**Human Approval for "Ready"**: AI agents may draft or revise documentation, but must NOT independently mark a PRD, Tech Design, or other governing document as READY unless explicit human confirmation/approval has been given. Do not invent a separate approval system.

**No-Doc-Debt Rule**: When an approved implementation changes documented behavior, API contracts, database schema, dependencies, configuration, or project-wide conventions, the owning authoritative documentation must be updated in the same working session, when applicable. Do not leave authoritative documentation knowingly stale after implementation.

Do not create an RFC/ADR workflow because this project does not currently use one.

## 6. Frontend / Backend Conventions

**Frontend (React + TypeScript + Vite)**:
- Read `docs/architecture/frontend.md` first for the frontend architecture, route map, shared layer, design tokens, and Figma screen mapping.
- Components and types follow the established naming conventions.
- API transport concerns should remain separate from UI components.
- Do not place backend business logic in frontend components.
- Feature code lives under `frontend/src/features/<capability>/` (UI, hooks, API clients, feature state). Route composition and application-wide providers go in `frontend/src/app/`.
- New shadcn/Radix primitives live in `frontend/src/components/ui/`; shared composed UI and legacy adapters live in `frontend/src/components/common/`. Do not reimplement per-feature. Frontend libraries confirmed on 2026-11-17 are listed in `tech-stack.md`; use only the subset needed by the active batch.
- Genuinely shared hooks and utilities live in `frontend/src/shared/hooks/` and `frontend/src/shared/utils/`. Do not duplicate these inside individual feature folders.
- Tables and filter controls are shared UI components (in the shared area); feature code composes them with feature-specific columns, data, and filter props. Do not fork or copy shared table/filter components.

**Backend (Express + Node.js + TypeScript)**:
- Route handlers should remain thin.
- Controllers translate transport concerns.
- Services contain business orchestration.
- Repositories handle persistence.
- Transaction boundaries must be explicit.
- Authorization must be enforced at the appropriate boundary.
- Cross-module interfaces consumed by more than one capability live in `backend/src/contracts/` as type/interface-only modules. Do not place a shared contract inside a single capability's folder.

**Database (PostgreSQL)**:
- Database identifiers use `snake_case`.
- Use migrations.
- Preserve database constraints and integrity rules.
- Use parameterized queries.
- Do not bypass constraints simply to make application code easier.
- PostgreSQL range/exclusion constraints are approved where required by the architecture/business rules.

## 7. API and Error Handling

- Follow REST resource-oriented API design.
- Keep request/response contracts stable.
- Keep application error codes stable.
- Use correct HTTP status semantics.
- Do not leak internal implementation details.
- Feature-specific API mappings belong in the relevant Tech Design.

Use the established API version prefix `/api/v1/` and the established JSON error shape and pagination (`page`/`limit` + `meta`) from `docs/architecture/conventions.md`. Do not invent a different version prefix, response envelope, or error-code names.

## 8. Validation, Security, and Data Integrity

- Validation exists at appropriate layers.
- Authentication and authorization are separate concerns.
- Use RBAC plus contextual authorization where required.
- Authentication uses an opaque server-side session token delivered in an `HttpOnly; Secure; SameSite=Lax` cookie (`sid`), with double-submit `X-CSRF-Token` CSRF protection. This is confirmed in `docs/architecture/tech-stack.md` and `docs/features/platform/authentication-authorization/tech-design.md`; there are no JWT access/refresh tokens.
- Security-sensitive changes require careful review.
- Input validation must not be bypassed.
- Database constraints are part of the integrity model.
- Cross-table invariants may require application transactions/triggers according to the architecture.
- Payment operations require idempotent handling.

Do not invent specific security libraries if they remain TBD.

## 9. Testing

Follow the project's testing expectations from the authoritative documentation. Use the confirmed tools: Vitest + Supertest for unit/integration/API tests and Playwright for main user flows, against the separate test database defined in `docs/architecture/tech-stack.md`. Backend test files live under `backend/src/__tests__/`; frontend end-to-end tests live under `frontend/e2e/`. Do not maintain a second parallel test root (see `docs/architecture/conventions.md`).
Agents should add/update appropriate tests when behavior changes and should not claim tests passed unless they actually ran them.

## 10. Git and Change Discipline

- Keep changes focused.
- Do not rewrite unrelated history.
- Do not reset/revert user work without explicit permission.
- Do not create commits unless explicitly requested.
- Do not push to remote unless explicitly requested.
- Inspect `git diff` and `git status` before completing a task.
- Do not include generated build artifacts in source directories.
- Follow the repository's existing `.gitignore`.
- Changes to shared documents (`PROJECT-BRIEF.md`, `docs/architecture/*`, `docs/business-rules-config-matrix.md`, `docs/documentation-guide.md`, `.agents/AGENTS.md`) or the database schema must go through a pull request reviewed by the other team member before merge.

## 11. Handling Unknown or Conflicting Information

- **Known/confirmed**: Follow it.
- **TBD**: Do not invent a solution; surface it.
- **Contradiction**: Identify the conflict and ask for/seek an authoritative resolution.
- **Implementation detail not specified**: Choose the smallest reasonable implementation only if it does not create a new architectural/business decision.

If a decision affects architecture, database schema, API contract, security model, business rules, or project-wide conventions, do not silently make it.

## 12. Frontend batch execution — confirmed 2026-11-17

- **UI-only constraint, reiterated by the user 2026-11-19:** further frontend modernization may change presentation and extract presentation components/hooks, but must preserve existing behavior: workflows, validation/defaults, redirects/link destinations, permissions, session/auth, action availability, data grouping/filter/sort/pagination and pricing/state rules. Keep the existing service/API/data layer and request/cache/retry/realtime behavior. Record logic defects separately; do not fix them without a separately confirmed request. Existing historical exceptions do not authorize further behavior changes and must be disclosed as such during review, not described as presentation-only. Do not silently undo prior work.
- Follow `docs/architecture/plans/refactor_FE_add_lib/frontend-modernization-review-plan.md`: update the active stage/task status and evidence as work progresses. The status table identifies the active batch; historical scope does not authorize new work.
- **Sequential execution authorized by the user on 2026-11-19:** analyze, implement, clean up, verify, update status/evidence and commit each existing batch, then proceed to the next without requesting routine approval. Provide one consolidated final review. Stop and ask only for an unresolved decision, blocker or change of direction/scope. This supersedes the former per-batch approval stops; UI-only scope remains mandatory.
- Commit messages, when a commit is explicitly requested, must be in English with no author or co-author attribution trailer. Do not modify Git author metadata to satisfy this text preference; do not commit or push without authorization.

- During each frontend batch, remove replaced code/CSS only after checking all consumers. Do not append overriding legacy rules. Keep approved library primitives in `components/ui`, shared composed components in `components/common`, reusable hooks/utilities in `shared`, and feature-specific code within its feature. Record removals, retained legacy consumers and regression evidence in the batch handoff.
- For frontend stages from D02 onward, follow the compact plan §2.2 (updated 2026-11-19): briefly review the current UI/behavior from the end-user and designer perspectives, record the scope and essential findings in `reviews/Dxx-*.md`, and execute the established direction under the user’s sequential authorization; ask only when a new decision/blocker is required. New reports should be about one page, with at most three necessary decision questions and screenshots at 390/1280 px unless a breakpoint requires more. Do not add foundation stages or fix out-of-scope findings; record them in the backlog. Before handoff, check the changed flow with real backend/data and use mocked APIs for edge states; never seed/reset dev data merely for a UI review. Historical handoffs are archived; the compact plan owns current statuses.
- Rebuilt UI follows the DS01 design system in `docs/architecture/frontend.md` (confirmed 2026-11-18): semantic tokens only, the type/radius scale and the page templates. Add every rebuilt file to `frontend/ui-check.config.json`; `npm run lint` must pass `check:ui`. Do not add exceptions without a reason.
