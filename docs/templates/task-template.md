# Task Template

Use this template for an executable implementation work item under the
official hierarchy:

```text
PROJECT-BRIEF → PRD → Tech Design → Task
```

A task must be atomic enough to implement and verify without inventing
requirements. It may be a Markdown document or an issue in the task system.

## 1. Task Metadata

```text
Task Title: [Short, specific title]
Status: TODO
Owner/Assignee: [Person or `TBD`]
Complexity/Size: [Small / Medium / Large / `TBD`]
```

Task execution status is separate from document readiness status. Use only:
`TODO`, `IN_PROGRESS`, `BLOCKED`, or `DONE`.

## 2. Context and Links

- Why this task is needed: [Short context]
- Linked PRD: [Required link when applicable]
- Linked Tech Design: [Required link when applicable]
- Relevant architecture/schema/convention reference: [Link or `N/A`]

Do not use a deprecated Domain Spec, Feature Spec, or RFC as an official
parent document.

## 3. Scope

### In Scope

- [Concrete work included]

### Out of Scope

- [Concrete work excluded]

The task must remain within the scope of its linked PRD and Tech Design.

## 4. Dependencies and Blockers

- Prerequisite task or decision: [Link or `N/A`]
- External/product dependency: [Dependency or `N/A`]
- Blocking TBD: [Decision or `N/A`]

If a dependency is unresolved, set task status to `BLOCKED` when work cannot
proceed safely.

## 5. Implementation Details

Describe the smallest implementation steps needed to satisfy the approved
PRD and Tech Design.

1. [Implementation step]
2. [Implementation step]

### Affected Files / Modules

- [Known file/module]
- `[Proposed — verify during implementation]`
- `[TBD — file/module not yet known]`

Do not invent a file list. Include a concrete path only when it is known or
specified by the Tech Design.

## 6. Acceptance Criteria

Acceptance criteria must be observable, specific, and verifiable.

- **Given:** [Precondition]
  **When:** [Action]
  **Then:** [Expected result]

- **Given:** [Validation, authorization, state, or error precondition]
  **When:** [Action]
  **Then:** [Expected protected/error result]

Do not use “logic works correctly”, “build passes”, or “no regression” as the
only acceptance criterion. Those belong in verification in addition to
behavioral criteria.

## 7. Verification / Test Cases

- Unit verification: [Behavior or `N/A`]
- Integration verification: [Behavior or `N/A`]
- API-level verification: [Behavior or `N/A`]
- E2E verification for a critical flow: [Behavior or `N/A`]
- Edge/failure/concurrency verification: [Behavior or `N/A`]
- Manual verification: [Check or `N/A`]

Testing frameworks and tooling remain TBD unless approved in the relevant
architecture or Tech Design document.

## 8. Impact Checklist

- Schema impact: [None / described delta and link / `TBD`]
- API impact: [None / contract and link / `TBD`]
- Configuration impact: [None / key or behavior and link / `TBD`]
- Security/authorization impact: [None / description / `TBD`]
- Documentation impact: [Documents to update or `N/A`]

Do not change global schema, architecture, business rules, or confirmed
decisions from a task without the required documentation and approval.

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
Blocked by: [Dependency or `N/A`]
Verification completed: [Date/person or `TBD`]
```

Prefer small, independently verifiable tasks. Split a task when its scope
cannot be reasonably implemented or verified as one work item; do not enforce a
fixed time limit.
