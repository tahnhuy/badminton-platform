# Product Requirements Document (PRD)

Use this template for a feature or user-visible capability. A PRD defines
**what** is needed and **why**. It owns product behavior, user journeys,
business rules, and UI/UX behavior. It does not define technical
implementation.

## Status and Ownership

```text
Status: Draft
Owner: [Person or team]
Fulfills: PROJECT-BRIEF.md §[section]
Scope: [Feature/domain scope]
```

Status must use the documentation lifecycle from
`docs/documentation-guide.md`: `Draft`, `Ready`, or `Implemented`. An AI
agent must not mark a PRD `Ready` without human confirmation.

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`
- Related feature/domain references: [Link or `N/A — reason`]

## Related Documents

- Parent or related PRD: [Link or `N/A — reason`]
- Tech Design: [Link when it exists, otherwise `TBD`]
- Task or issue: [Link when it exists, otherwise `TBD`]

## 1. Problem

Describe the user or business problem.

- Who is affected?
- What is difficult or unavailable today?
- Why does this problem matter within the approved MVP scope?

## 2. Goals

Describe the desired product outcomes. Use measurable outcomes when they are
known; use `TBD — metric needs product decision` when they are not.

- [Goal]
- [Goal]

## 3. Non-Goals

List behavior explicitly excluded from this PRD. Do not promote items outside
the MVP defined by `PROJECT-BRIEF.md`.

- [Non-goal]
- [Non-goal]

## 4. Scope

### In Scope

- [User-visible capability or business behavior]

### Out of Scope

- [Capability excluded from this PRD]

## 5. Target Users and Roles

List the affected users using the project roles from `PROJECT-BRIEF.md`:

- Player: [How this role is affected, or `N/A`]
- Court Owner: [How this role is affected, or `N/A`]
- Admin: [How this role is affected, or `N/A`]
- Contextual permission, if applicable: [Describe the context, or `N/A`]

Do not introduce a new system role in a PRD. Changes to system roles require
an explicit update to `PROJECT-BRIEF.md`.

## 6. User Journey

Describe the normal user-visible journey from the user's perspective.

1. [User action]
2. [System-visible response]
3. [Next user action]
4. [Expected outcome]

Include relevant alternative journeys when they change user behavior. Do not
describe endpoints, database operations, services, or implementation layers.

## 7. Functional Requirements

Describe observable product capabilities. Each requirement should identify the
actor, action, relevant condition, and expected outcome.

- [The user/system can ...]
- [The user/system can ...]

Use `TBD — requirement needs clarification` when behavior is unresolved.

## 8. Business Rules

Record only feature-level product/business rules. Reference the authoritative
rule instead of copying the complete business-rules matrix.

- Source reference: [Section/link in `docs/business-rules-config-matrix.md`]
- Feature rule: [Rule or `TBD — business decision needed`]

Do not add database constraints, API status mappings, algorithms, or technical
validation design here.

## 9. UI/UX Behavior

Describe user-visible behavior without prescribing frontend framework,
component structure, or implementation files.

- Entry points: [Where the user starts]
- Important states: [Loading, empty, success, error, unavailable, or `N/A`]
- User feedback: [Messages, confirmations, or `N/A`]
- Accessibility or content requirements: [Requirement or `N/A`]

## 10. Success Metrics

- [Metric and target, if approved]
- `N/A — no product metric is required for this scope`, or
- `TBD — product metric needs decision`

## 11. Constraints

List product, scope, legal, operational, or already-confirmed architecture
constraints. Reference their authority instead of redefining them.

- [Constraint and source]
- [Constraint and source]

Do not select frameworks, libraries, providers, endpoints, database fields, or
file structures in this section.

## 12. Risks

- [Product, operational, or user risk]
- [Risk mitigation or `TBD`]

## 13. Dependencies

List product/business dependencies only, such as another user capability,
approved policy, data availability, or external business commitment.

- [Dependency]
- `N/A — no product dependency`

Technical dependencies belong in the Tech Design.

## 14. Open Questions / TBD / Needs Decision

| Question or unresolved behavior | Authority/owner | Impact | Status |
| --- | --- | --- | --- |
| [Question] | [Owner or source] | [Impact] | TBD / NEEDS DECISION |

Do not resolve a TBD by assumption. A question requiring technical design is
linked to the Tech Design rather than answered here.

## Output Rules

This PRD must not contain:

- Database schema, SQL, migrations, indexes, or database field definitions.
- API endpoints, request/response payloads, status-code contracts, or API versioning.
- Framework, library, provider, infrastructure, or file-structure decisions.
- Controllers, services, repositories, component designs, or implementation code.

Examples in this template are **illustrative only** and are not requirements
or confirmed decisions.
