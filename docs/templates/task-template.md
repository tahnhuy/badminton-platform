# Task Template

Use this template for an executable implementation work item under the
official hierarchy:

```text
PROJECT-BRIEF → PRD → Tech Design → Task
```

A task must be atomic enough to implement and verify without inventing
requirements. It may be a Markdown document or an issue in the task system.

## Task File Convention

All tasks for a feature live in a **single `tasks.md`** file that sits
alongside `prd.md` and `tech-design.md` inside the feature folder.
There is no separate `tasks/` subfolder.
A feature must not split tasks across multiple individual files.

The file must begin with a **header block** and a **Summary table**, followed
by individual task sections. Each task section uses an ID prefixed by the
feature abbreviation (e.g., `AUTH-01`, `CM-01`, `BK-01`).

### File Header (required)

```markdown
# <Feature Name> — Task List

Implementation tasks for the <Feature Name> feature.

- Linked PRD: [prd.md](../prd.md)
- Linked Tech Design: [tech-design.md](../tech-design.md)
- [Optional: Design Reference, Decision Gate date, other links]

**Task status values**

- `Approved`: reviewed and ready to start. Execution then moves through
  `IN_PROGRESS` and `DONE`.
- `BLOCKED`: cannot start; the blocker is named.
- [Additional values as needed, e.g., `Merged into XX-NN`]

**Definition of Done:** the task's acceptance criteria pass and the required
verification steps listed under "Verification" are complete.
```

### Summary Table (required)

```markdown
## Summary

| ID | Title | Status | Depends on | Size |
| --- | --- | --- | --- | --- |
| XX-01 | [Short task title] | Approved | — | S / M / L |
| XX-02 | [Short task title] | Approved | XX-01 | M |
```

### Execution Order (include when tasks have meaningful parallelism or ordering)

```markdown
## Execution Order

| Wave | Tasks | Waits for |
| --- | --- | --- |
| 1 | XX-01, XX-02 | — |
| 2 | XX-03 | XX-01 |
```

---

## Individual Task Section

Each task is a `##`-level heading with a **completion checkbox**, the task ID, and title:

```markdown
## [ ] XX-NN: [Task Title]

```text
Status: Approved
Size: S / M / L
Blocked by: N/A
```

**Objective:** [One or two sentences describing what this task achieves and why.]

**Scope**

- In scope:
  - [Concrete work included]
- Out of scope:
  - [Concrete work excluded]

The task must remain within the scope of its linked PRD and Tech Design.

**Implementation requirements**

1. [Implementation step]
2. [Implementation step]

**Files/areas affected**

- [Known file/module]
- `[Proposed — verify during implementation]`
- `[TBD — file/module not yet known]`

Do not invent a file list. Include a concrete path only when it is known
or specified by the Tech Design.

**API impact:** [None / contract summary]

**Schema/config impact:** [None / described delta]

**Verification**

- Unit: [Behavior or `N/A`]
- Integration: [Behavior or `N/A`]
- API-level: [Behavior or `N/A`]
- E2E for a critical flow: [Behavior or `N/A`]
- Edge/failure/concurrency: [Behavior or `N/A`]
- Manual: [Check or `N/A`]

**Acceptance criteria**

- **Given** [precondition]
  **When** [action]
  **Then** [expected result]

- **Given** [validation, authorization, state, or error precondition]
  **When** [action]
  **Then** [expected protected/error result]

Do not use "logic works correctly", "build passes", or "no regression" as the
only acceptance criterion.

---
```

### Rules

- **Every task heading must begin with `[ ]`** when created: `## [ ] XX-NN: Title`.
  Change to `[x]` when the task is done and acceptance criteria pass: `## [x] XX-NN: Title`.
  Only the implementer (human) may tick `[x]`. An AI agent generating the file must always write `[ ]`.
- Task execution status is separate from document readiness status. Use only:
  `Approved`, `IN_PROGRESS`, `BLOCKED`, or `DONE`.
- A dependency is unresolved → set task status to `BLOCKED` when work cannot
  proceed safely.
- Do not change global schema, architecture, business rules, or confirmed
  decisions from a task without the required documentation and approval.
- Prefer small, independently verifiable tasks. Split a task when its scope
  cannot be reasonably implemented or verified as one work item.
- A task cannot move to `DONE` until its automated tests exist and pass.

### Section: Completion Checklist (optional, add when useful)

```markdown
**Completion checklist**

- [ ] Scope matches the linked PRD and Tech Design.
- [ ] Acceptance criteria are satisfied.
- [ ] Required verification is complete.
- [ ] Relevant schema/API/configuration documentation is updated.
- [ ] No `TBD` was silently resolved.
- [ ] No unrelated files or refactors were included.
```
