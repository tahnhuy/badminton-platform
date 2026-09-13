# Feature Tech Design

Use this template for technical implementation design within the approved
architecture. A Tech Design answers **how** a feature will be implemented. It
must link to a governing PRD and must not override higher-authority scope,
roles, business rules, global technology decisions, or the consolidated
database schema.

## 1. Metadata

```text
Status: Draft
Owner: [Person or team]
PRD: [Link to the governing PRD]
Scope: [Feature/capability scope]
Decision Status: Proposed
```

Use document statuses from `docs/documentation-guide.md`: `Draft`, `Ready`, or
`Implemented`. `Decision Status` may be `Proposed`, `Approved`, `Rejected`, or
`TBD / NEEDS DECISION` as applicable. A Tech Design with unresolved decisions
that block implementation must not be marked `Ready`.

## 2. Context

Summarize the product behavior and technical context from the PRD. Identify
the affected feature boundaries without duplicating the PRD.

## 3. Technical Problem

Describe the implementation problem, constraints, and failure conditions this
design must address.

## 4. Goals

- [Technical outcome]
- [Technical outcome]

## 5. Non-Goals

- [Technical concern intentionally not addressed]
- `N/A — no additional technical non-goals`

## 6. Upstream References

- Governing PRD: [Link]
- Project scope/roles/MVP: `PROJECT-BRIEF.md` [section]
- Global documentation rules: `docs/documentation-guide.md` [section]
- Global architecture/technology: `docs/architecture/tech-stack.md` [section]
- Global coding/API conventions: `docs/architecture/conventions.md` [section]
- Business rules/configuration: `docs/business-rules-config-matrix.md` [section]
- Global database schema: `docs/architecture/database-schema.md` [section]

If two references conflict, record the conflict as `TBD / NEEDS DECISION`; do
not silently choose one.

## 7. Proposed Technical Design

Describe the proposed design within the PERN monolith and RESTful API. Define
responsibility boundaries, data flow, and important design rationale.

- Application/service boundary: [Design]
- Persistence boundary: [Design]
- Client/server boundary: [Design or `N/A`]
- Cross-cutting concerns: [Design or `N/A`]

Do not introduce dependencies, services, providers, or architectural patterns
that are not approved by the authoritative documents or this design's
explicitly approved decision.

## 8. Behavior, State, and Flow

Describe technical state transitions and flow details required to implement
the PRD behavior.

```text
[State] → [State] → [State]
```

- Preconditions: [Conditions]
- State transitions: [Transition rules]
- Postconditions: [Results]
- `N/A — no stateful flow`

Feature business rules remain authoritative in the PRD and
`docs/business-rules-config-matrix.md`.

## 9. API Design

Describe only the API contract required by this feature. Follow global API
conventions in `docs/architecture/conventions.md`.

- Resource and operation: [Resource/operation]
- HTTP method/path: [Approved contract or `TBD`]
- Request contract: [Fields/semantics or `N/A`]
- Response contract: [Fields/semantics or `N/A`]
- Authentication/authorization boundary: [Requirement]
- HTTP status behavior: [Contract or `TBD`]
- Application error codes: [Codes or `TBD`]

Do not assume an API version prefix, response envelope, pagination format, or
provider-specific contract unless it is confirmed by an authoritative
document or explicitly approved for this design.

## 10. Data Model / Schema Delta

`docs/architecture/database-schema.md` is the global schema authority.

- Existing schema objects affected: [Names and links, or `N/A`]
- Schema delta: [Change, or `N/A — no schema change`]
- Constraints/indexes affected: [Change or `N/A`]
- Migration/data backfill impact: [Impact or `N/A`]
- Rationale and compatibility: [Explanation]

Do not reproduce the full global schema. Any schema change requires the
appropriate schema decision and documentation update.

## 11. Security

- Authentication boundary: [Reference approved global principle and feature behavior]
- Authorization boundary: [RBAC/contextual/resource rule]
- Input and output protection: [Design]
- Sensitive data handling: [Design or `N/A`]
- CSRF/XSS considerations: [Design or `TBD`]

Do not treat a `RECOMMENDED` technology in `tech-stack.md` as a confirmed
implementation detail.

## 12. Failure Handling / Edge Cases

| Case | Detection | Expected behavior | Recovery/visibility |
| --- | --- | --- | --- |
| [Failure or edge case] | [How detected] | [Safe result] | [Retry, user result, or `N/A`] |

Use `N/A — no additional failure behavior` only when justified.

## 13. Concurrency / Idempotency

- Concurrency-sensitive operation: [Operation and protection, or `N/A`]
- Idempotency requirement: [Key/operation and behavior, or `N/A`]
- Transaction boundary: [Boundary and rollback behavior]
- Race-condition handling: [Design or `N/A`]

Payment handling must preserve the confirmed idempotency requirement. Do not
invent feature-specific concurrency rules; reference the applicable business
and schema authority.

## 14. Performance

- Expected workload or latency consideration: [Requirement or `N/A — not applicable`]
- Relevant bottleneck: [Risk or `N/A`]
- Design response: [Approach or `N/A`]

Do not introduce scaling infrastructure without an approved decision.

## 15. Events / Notifications

- Event or notification behavior: [Contract or `N/A`]
- Trigger and recipient: [Behavior or `N/A`]
- Delivery/retry implications: [Design or `TBD`]
- Background/scheduled processing: [Design or `TBD`]

Notification delivery, background-job technology, and realtime transport remain
TBD unless resolved by an approved decision.

## 16. Testing Considerations

- Unit behavior: [Cases or `N/A`]
- Integration/persistence behavior: [Cases or `N/A`]
- API-level behavior: [Cases or `N/A`]
- Critical E2E flow: [Cases or `N/A`]
- Concurrency/idempotency verification: [Cases or `N/A`]

Name behavior to verify without selecting a testing framework or tooling that
remains TBD.

## 17. Migration / Rollout

- Migration steps: [Steps or `N/A — no migration`]
- Rollout sequencing: [Plan or `N/A`]
- Backward compatibility: [Requirement or `N/A`]
- Rollback/recovery: [Plan or `N/A`]

## 18. Alternatives Considered

Include this section only when there is a meaningful technical trade-off.

- Option: [Option]
- Rejected/selected because: [Rationale]
- `N/A — no meaningful alternative for this scope`

Do not force a fixed number of alternatives.

## 19. Observability / Monitoring

- Logs: [Required diagnostic information or `N/A`]
- Metrics: [Metric or `N/A`]
- Alerts/operational signals: [Signal or `N/A`]

Observability tooling remains TBD unless approved.

## 20. Acceptance / Verification Considerations

Acceptance criteria must be observable and tied to the governing PRD and this
design.

- **Given:** [Precondition]
  **When:** [Action]
  **Then:** [Expected observable result]

- **Given:** [Error/authorization/state precondition]
  **When:** [Action]
  **Then:** [Expected error or protected result]

Verification must identify relevant tests, manual checks, documentation
updates, and migration checks without relying only on “build passes” or “no
regression”.

## 21. Open Questions / TBD

| Question or decision | Authority/owner | Implementation impact | Status |
| --- | --- | --- | --- |
| [Question] | [Owner/source] | [Impact] | TBD / NEEDS DECISION |

## 22. Decision Status

```text
Decision Status: Proposed
Approval needed from: [Human owner/team]
Approved decision/reference: [Link or N/A]
```

This template does not create a new approval workflow. It follows the human
readiness gate in `docs/documentation-guide.md`.
