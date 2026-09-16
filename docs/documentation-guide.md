# Documentation Guide

This document is the documentation contract for the Badminton Ecosystem Digital Platform. It applies to human developers and AI coding agents.

`PROJECT-BRIEF.md` is the source of truth for project scope and confirmed project decisions. This guide defines how project documentation is organized and maintained; it does not replace the brief.

## 1. Purpose and Core Principles

### 1.1 Single Source of Truth

Each important information type has one authoritative document. Other documents may link to or summarize that information, but must not create a competing writable copy.

### 1.2 Code Follows Specs

Implementation must follow a Ready PRD, Tech Design, or approved lightweight specification. If the required specification does not exist or is ambiguous, stop and clarify before coding.

### 1.3 Right-Sized Documentation

Create documentation when the work begins. Do not create empty directories or placeholder documents. Small changes may use a simplified documentation path when the behavior, acceptance criteria, and affected architecture are still clear.

### 1.4 AI-Agent Friendly

Documents must state ownership, scope, status, unresolved decisions, and links explicitly. AI agents must not invent requirements, technical decisions, or answers to `[TBD]` items.

### 1.5 Maintainable Documentation

Prefer short documents with clear boundaries and links. A change is not complete while the documentation that describes the changed behavior remains stale.

## 2. Confirmed Project Protections

The following are confirmed by `PROJECT-BRIEF.md` and are mandatory constraints for all documentation and implementation.

### 2.1 System Roles

The system roles are:

- Player
- Court Owner
- Admin

Tournament Organizer is **not** a system role. Organizer is contextual permission granted to a Player within tournaments that Player organizes. It applies only within those tournaments.

### 2.2 MVP Domains

The MVP focuses on:

1. Matchmaking
2. Court Booking
3. Tournament

Supporting capabilities may enter the MVP only when needed for these domains to operate completely.

### 2.3 Booking Rules

- Booking confirmation operates in real time.
- The normal flow is not `Player → Pending → Court Owner approves/rejects`.
- Court Owner supervises bookings, manages slots, and handles operational issues.
- If Court Owner cancels because of court-side problems or maintenance, the Player must be notified and the required refund flow must be handled.
- An independent refund-management module is outside the MVP, but the owner-cancellation refund flow required by Booking is in scope.

### 2.4 Out of MVP

The following remain outside the MVP:

- Split Bill
- Independent refund-management module
- Super Admin
- Match rescheduling
- Court rating
- System content management

Do not promote any of these into the MVP without an explicit change to `PROJECT-BRIEF.md`.

### 2.5 Confirmed Technology Stack

The confirmed stack is PERN:

- PostgreSQL
- Express.js
- React
- Node.js

Additional libraries, services, infrastructure, or architectural patterns are not confirmed merely because they are technically convenient. They require an explicit documented decision.

## 3. Documentation Directory Structure

The repository uses this practical structure. Directories are created when their first document is needed; no empty placeholder directories are required.

```text
PROJECT-BRIEF.md
AGENTS.md                         # Optional agent entry point when created
docs/
├── documentation-guide.md        # This contract
├── architecture/
│   ├── tech-stack.md             # Global technology contract
│   ├── database-schema.md        # Consolidated global schema
│   └── conventions.md            # Global coding, API, documentation, and test conventions
├── templates/                    # Created when reusable templates are first needed
│   ├── prd-template.md
│   ├── tech-design-template.md
│   └── task-template.md
└── features/
    ├── matchmaking/
    ├── booking/
    ├── tournament/
    ├── admin/
    └── platform/
        ├── authentication-authorization/
        ├── organizer-permission/
        ├── notifications/
        └── payments-refunds/
```

Feature folders contain feature PRDs, Tech Designs, and task documents. `platform/` is for capabilities shared by multiple domains. A capability that is used only by one feature belongs in that feature folder instead.

There is intentionally no `docs/requirements/` directory. `PROJECT-BRIEF.md` is the authoritative requirements and scope document.

## 4. Source of Truth and Document Hierarchy

### 4.1 Document Ownership

| Document | Authoritative ownership |
| --- | --- |
| `PROJECT-BRIEF.md` | Project scope, system roles, confirmed business decisions, MVP boundaries, and confirmed stack summary |
| `docs/documentation-guide.md` | Documentation structure, document boundaries, lifecycle, traceability, update rules, and AI-agent contract |
| `docs/architecture/tech-stack.md` | Confirmed and approved technologies, brief rationale, and relevant environment/configuration requirements |
| `docs/architecture/database-schema.md` | Consolidated global database schema and global schema conventions |
| `docs/architecture/conventions.md` | Global coding, naming, API, documentation, and minimal testing conventions |
| Feature PRD | Feature user journeys, business behavior, business rules, and UI/UX behavior |
| Feature Tech Design | Feature API design, technical implementation design, schema deltas/rationale, state machines, validation, technical edge cases, and acceptance criteria |
| Task document or issue | Concrete implementation work, dependencies, affected files, and links to the governing feature documents |
| `docs/templates/` | Reusable document headings and guidance; templates do not create requirements |

### 4.2 Brief Versus Feature Documents

`PROJECT-BRIEF.md` owns the project-level scope, roles, confirmed decisions, and out-of-MVP items. Feature PRDs must not become duplicate copies of its capability lists.

A PRD must link to the relevant brief sections and add only feature-specific detail. A detail belongs in the brief only when it changes project scope, a system role, a confirmed project decision, or the MVP boundary.

### 4.3 Document Precedence and Conflicts

Authority is determined by information type, not by file length or creation date:

1. Scope, roles, confirmed decisions, and MVP boundaries: `PROJECT-BRIEF.md`.
2. Documentation process and document ownership: this guide.
3. Global technologies: `tech-stack.md`.
4. Global schema: `database-schema.md`.
5. Global conventions: `conventions.md`.
6. Feature behavior: the relevant Ready PRD.
7. Feature technical implementation: the relevant Ready Tech Design.
8. Work execution: the relevant Task.

If two documents conflict:

1. Do not silently choose a version.
2. Stop the affected work.
3. Report both documents, the conflicting statements, and the affected decision.
4. Request human clarification when the correct authority or required update is not obvious.
5. Update all affected documents in the same working session after the conflict is resolved.

A lower-level document must not override a higher-level confirmed scope or global decision. A feature document may refine a requirement without changing it; a change to scope or a confirmed decision requires an explicit update to `PROJECT-BRIEF.md`.

## 5. Document Types and Boundaries

### 5.1 Project Brief

Answers: what the project includes and what is confirmed.

Contains scope, roles, core domains, confirmed business decisions, technology-stack confirmation, and out-of-MVP items. It does not contain feature implementation details.

### 5.2 PRD

Answers: why the feature is needed and how it behaves from the user's and business's perspective.

Owns:

- Problem and goal
- In-scope and feature-specific out-of-scope behavior
- User journeys
- Business behavior and business rules
- UI/UX behavior
- Open business questions marked `[TBD]`

Does not own API contracts, database schema, code structure, or technology choices.

Every PRD must include a status and a traceability line such as:

```text
Status: Draft
Fulfills: PROJECT-BRIEF.md §3.2 and §7
```

### 5.3 Tech Design

Answers: how the feature will be implemented within the approved architecture.

Owns:

- Technical approach and boundaries
- API contracts
- Technical implementation design
- Feature schema changes as deltas from `database-schema.md`
- State machines and state transitions
- Validation and technical edge cases
- Error and failure behavior
- Security and performance considerations when relevant
- Acceptance criteria and verifiable behavior
- Links to the governing PRD

The consolidated schema remains authoritative in `database-schema.md`. A Tech Design records only the feature-specific delta, rationale, and link to the global schema.

### 5.4 Tasks

Answers: what concrete work must be performed.

A task may be a file in the feature folder or an issue in the team's task system. It must link to the relevant PRD and Tech Design when they exist, state its scope, identify dependencies, and include the relevant acceptance or test work.

Tasks should be small enough to complete in a focused work session. Do not create task documents merely to split trivial work if the issue tracker already provides sufficient clarity.

### 5.5 Architecture Documents

Architecture documents describe cross-feature technical decisions. They must not become a second home for feature business rules.

- `tech-stack.md`: approved technologies, short rationale, and relevant configuration/environment notes.
- `database-schema.md`: one consolidated global schema and global schema conventions.
- `conventions.md`: global coding, naming, API, documentation, and testing conventions.

Create additional architecture documents only when a real cross-feature concern requires one. Mark a proposed document or decision `[TBD]` rather than filling it with assumptions.

### 5.6 Templates

Templates are short reusable headings and guidance, not approval forms. The adopted templates are:

- PRD: Status, Fulfills, problem/goal, scope, users, journey, business rules, UI/UX behavior, acceptance link, TBDs.
- Tech Design: Status, PRD link, context, technical approach, API, schema delta, state machine, validation/edge cases, acceptance criteria, test considerations, TBDs.
- Task: linked documents, objective, scope, dependencies, implementation work, acceptance/test checklist, status.

Templates may be stored under `docs/templates/` when the first feature begins. A feature may omit a section that is genuinely not applicable, but must not omit acceptance criteria for behavior that needs verification.

## 6. Feature Documentation Lifecycle

The normal lifecycle is:

```text
Requirement → PRD → Tech Design → Task → Code → Test → Documentation Update
```

### 6.1 Required Documents

- **PRD required:** Any user-visible feature, business behavior, role/permission behavior, or change to a business rule.
- **Tech Design required:** Any feature that changes or adds APIs, database schema, state transitions, validation, integrations, concurrency behavior, or cross-feature architecture.
- **Tasks required:** Work involving multiple implementation steps, multiple contributors, dependencies, or meaningful test/documentation work. A task may be an issue rather than Markdown.

### 6.2 Lightweight Path

For a genuinely small change, one short feature specification may combine PRD and Tech Design content when all of the following are true:

- It has no new API or schema design.
- It does not alter global architecture, roles, scope, or business rules.
- Its behavior and acceptance criteria are unambiguous.
- The document links to the relevant brief or existing feature document.

The combined document still follows the ownership rules and status lifecycle. When uncertainty exists, use separate PRD and Tech Design documents.

### 6.3 Status Lifecycle and Human Gate

Use these document statuses:

- **Draft:** Being prepared or changed. Not authoritative for implementation.
- **Ready:** A human team member has reviewed and confirmed the document is sufficiently clear for implementation. AI agents may implement against it.
- **Implemented:** The described behavior has been implemented and verified, and required documentation updates are complete.

An AI agent may draft or revise a document, but must not mark it `Ready` without human confirmation. A document containing unresolved `[TBD]` items cannot become Ready if those items affect its dependent implementation.

## 7. Source-of-Truth Matrix

| Information | Authoritative document |
| --- | --- |
| Project scope and MVP focus | `PROJECT-BRIEF.md` |
| System roles and Organizer contextual permission | `PROJECT-BRIEF.md`; detailed permission behavior in the relevant Ready platform/feature document |
| Confirmed project decisions | `PROJECT-BRIEF.md` |
| Out-of-MVP scope | `PROJECT-BRIEF.md` §5 |
| Documentation rules | `docs/documentation-guide.md` |
| Technology stack and global technology decisions | `docs/architecture/tech-stack.md` |
| Global coding and naming conventions | `docs/architecture/conventions.md` |
| Global API conventions | `docs/architecture/conventions.md` |
| Consolidated global database schema | `docs/architecture/database-schema.md` |
| Feature business rules and user journeys | Relevant Ready feature PRD |
| Feature UI/UX behavior | Relevant Ready feature PRD |
| Feature API and technical design | Relevant Ready feature Tech Design |
| Feature schema delta and rationale | Relevant feature Tech Design; consolidated result in `database-schema.md` |
| State machines and technical edge cases | Relevant feature Tech Design |
| Acceptance criteria | Relevant feature Tech Design, or the combined lightweight specification |
| Concrete implementation work | Relevant Task or task-system issue |
| Test conventions | `docs/architecture/conventions.md`; feature-specific verifiable behavior in Tech Design |

## 8. Traceability

Use ordinary Markdown links and section references. Do not introduce FR, NFR, TB, QĐ, or equivalent requirement-ID systems.

Minimum links:

- PRD → relevant `PROJECT-BRIEF.md` sections using `Fulfills:`.
- Tech Design → its PRD.
- Task or pull request → its PRD and Tech Design when applicable.
- Feature schema delta → affected section of `database-schema.md`.

At a milestone boundary, perform a lightweight manual check that active PRDs link to the brief sections they fulfill and that the links resolve. This is a coverage check, not a requirements traceability matrix process.

## 9. Documentation Update Rules

The no-doc-debt rule applies: a change is not complete until required documentation updates are made in the same working session.

| Change | Required documentation review/update |
| --- | --- |
| New feature or user-visible behavior | Relevant PRD, Tech Design when needed, Task, acceptance criteria |
| Business-rule change | Relevant PRD and Tech Design/Task if affected; update `PROJECT-BRIEF.md` if scope, role, confirmed decision, or MVP boundary changes |
| UI/UX behavior change | Relevant PRD and affected acceptance criteria |
| API contract change | Relevant Tech Design; update global API conventions only when a global convention changes |
| Feature database change | `database-schema.md` consolidated schema plus feature Tech Design schema delta/rationale |
| Global schema convention change | `database-schema.md`; affected Tech Designs and conventions as needed |
| Technology, dependency, or infrastructure change | `tech-stack.md` and affected Tech Design; stop for human confirmation before a global change |
| Global coding/API/documentation convention change | `conventions.md`; affected documents as needed |
| Role, Organizer permission model, confirmed decision, or MVP scope change | `PROJECT-BRIEF.md`; affected PRDs, Tech Designs, and Tasks |
| Implementation discovers a specification mismatch | Stop, report the mismatch, resolve documents, then update code and tests |

## 10. AI Coding Agent Contract

Before planning or changing code, an AI agent MUST:

1. Read `AGENTS.md` if it exists.
2. Read `PROJECT-BRIEF.md`.
3. Read this `docs/documentation-guide.md`.
4. Read the relevant architecture documents.
5. Read `docs/architecture/tech-stack.md` and `docs/architecture/conventions.md`.
6. Read the relevant feature PRD.
7. Read the relevant Tech Design before implementation when one exists.
8. Check document status and implement only from a Ready document or an explicitly approved lightweight specification.

The agent MUST:

- Treat `[TBD]` as unresolved and never invent its answer.
- Stop and report conflicting documents; never silently select one.
- Ask for clarification when requirements or technical behavior are ambiguous.
- Keep all listed out-of-MVP items out of the MVP.
- Preserve Player, Court Owner, and Admin as the system roles.
- Treat Organizer only as contextual permission for a Player within that Player's tournaments.
- Preserve real-time Booking confirmation.
- Never introduce the normal `Pending → Court Owner approval/rejection` Booking flow.
- Preserve owner-side cancellation notification and required refund handling.
- Keep Split Bill outside the MVP.
- Use the PERN stack and not add an undocumented global dependency or architectural pattern.
- Apply the complete update matrix and leave no documentation stale.

The agent MUST stop and request human confirmation before changing:

- `PROJECT-BRIEF.md`
- `docs/architecture/tech-stack.md`
- Global database schema or schema conventions
- Global API, coding, documentation, or testing conventions
- Global architecture or a cross-feature architectural pattern
- Any out-of-MVP boundary or confirmed project decision

Feature-level implementation choices may be made only within the approved PRD, Tech Design, and global conventions. They must be recorded in the relevant feature Tech Design. Scope decisions and global architectural decisions cannot be made unilaterally by an agent.

## 11. Status and Decision Markers

Use markers only when they communicate a real distinction:

- `[CONFIRMED]`: Confirmed by `PROJECT-BRIEF.md` or an explicitly approved project decision.
- `[MANDATORY]`: Must be followed; deviation requires human confirmation and documentation.
- `[STANDARD]`: Team-wide expected convention; deviation must be explained and documented.
- `[RECOMMENDED]`: Suggested practice that may be omitted with reason.
- `[OPTIONAL]`: Not required for the current scope.
- `[TBD]`: Unresolved; no implementation may silently decide it.

`[CONFIRMED]` describes authority. `[MANDATORY]`, `[STANDARD]`, `[RECOMMENDED]`, and `[OPTIONAL]` describe the strength of a rule. `[TBD]` overrides assumptions: dependent implementation waits until it is resolved.

When a `[TBD]` is resolved, record the decision in the owning document with the date and update affected documents in the same working session.

## 12. Technology and Architecture Rules

### `tech-stack.md`

This is the global technology contract. It must record the confirmed PERN stack, approved additions, a brief rationale, and relevant environment/configuration notes. A new dependency, service, or architectural pattern is not approved merely because it appears in code; it must be confirmed and documented first.

### `database-schema.md`

This is the one consolidated source for the global database schema and global schema conventions. Feature Tech Designs describe deltas and rationale, then link back to the consolidated schema. Do not maintain two complete competing schema definitions.

### `conventions.md`

This owns project-wide coding, naming, API, documentation, and minimal testing conventions. Feature-specific exceptions belong in the relevant feature documents and must not silently become global rules.

No separate ADR system is required at this stage. A meaningful architectural rationale may be recorded briefly in `tech-stack.md`, `database-schema.md`, `conventions.md`, or the affected Tech Design. Create a separate architecture document only when the information is genuinely cross-feature and too large for those homes.

## 13. Testing and Acceptance

The project does not use a heavyweight `docs/qa/` system, RTM, or formal QA bureaucracy.

Acceptance criteria belong in the relevant Tech Design or lightweight combined specification. They must describe observable, verifiable behavior. Tasks should identify the tests or verification work needed to satisfy them.

Behaviorally complex work must explicitly document and verify relevant transitions and edge cases, including:

- Real-time Booking slot availability and competing confirmation attempts
- Booking cancellation, owner-side cancellation, Player notification, and required refund handling
- Tournament registration, draw, bracket progression, match/result transitions, and completion
- Matchmaking invitation, participation, leaving, group, and post-match rating states

Do not name a testing framework, library, or infrastructure as confirmed unless it is documented in `tech-stack.md`. The actual test locations and naming conventions belong in `conventions.md` when implementation begins.

## 14. Practical Completion Checklist

Before considering work complete, the developer or AI agent should verify:

- [ ] The requirement and relevant brief sections were understood.
- [ ] The work is inside MVP scope and does not add a listed out-of-MVP item.
- [ ] The correct architecture and feature documents were read.
- [ ] No `[TBD]` item was invented.
- [ ] Implementation used a Ready document or approved lightweight specification.
- [ ] Acceptance criteria are explicit and satisfied.
- [ ] Required tests or verification were performed.
- [ ] The complete documentation update matrix was applied in the same session.
- [ ] No global architecture, dependency, schema, convention, or scope change was made without human confirmation.
- [ ] Documentation status is updated to Implemented only after verification.

## 15. Reference Guide Adaptation

The reference guide influenced this project's methodology, not its implementation.

Retained ideas:

- Clear separation between business requirements, feature behavior, technical design, and tasks.
- A technology contract and explicit documentation update obligations.
- Lightweight traceability through links.
- State machines, edge cases, acceptance criteria, templates, and quality checks where they provide practical value.
- A no-doc-debt rule and a human readiness gate.

Deliberately not imported:

- Drizzle, BullMQ, Flutter-specific rules, or any other reference-project technology.
- The reference project's domains, architecture, database naming, or operational processes.
- `docs/specs/srs-fdd/`, core-domain registries, or other deeply nested domain structures.
- FR/NFR/TB/QĐ identifiers or another heavyweight ID system.
- A mandatory four-file PRD/RFC/SPEC/TASK structure for every feature.
- A dedicated heavyweight `docs/qa/` system, RTM, formal approval workflow, or ADR process.

The current project uses one PRD, one Tech Design, and Tasks as needed. This is a deliberate simplification; the behavioral content formerly separated as SPEC is explicitly owned by the Tech Design, especially state machines and acceptance criteria.

## 16. Remaining Open Decisions

The following are intentionally not decided by this guide:

- Test framework, test runner, and test infrastructure: resolved on 2026-09-16; see `docs/architecture/tech-stack.md` (Testing Strategy).
- Exact API versioning, authentication mechanism, pagination, and error contract: `[TBD]` until documented in `conventions.md`.
- Exact real-time implementation technology for Booking: `[TBD]` until approved in `tech-stack.md` and the Booking Tech Design.
- Exact payment provider and refund execution mechanism: `[TBD]` until approved in the relevant Tech Design and `tech-stack.md` if it adds technology.
- Whether a separate living system map is useful after APIs exist: `[TBD]`; it is not required now.

These open decisions must not be silently resolved by an AI agent. They must be resolved before dependent implementation begins.

## 17. Change Log

| Date | Change | Approved by | Reference |
| --- | --- | --- | --- |
| 2026-09-16 | §16: test framework, runner, and infrastructure marked resolved (see `tech-stack.md`). | Tài (Tech Lead) | `docs/features/platform/authentication-authorization/tasks/tasks.md` (Decisions Applied, Q1, A4) |
