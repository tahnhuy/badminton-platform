# DEPRECATED: Feature Specification Template

**Status:** DEPRECATED / REFERENCE ONLY

Feature Spec is not an official document type and is not a required layer in
the project lifecycle. Its behavioral content is now placed in the PRD and
Tech Design according to the documentation guide.

The official hierarchy is:

```text
PROJECT-BRIEF → PRD → Tech Design → Task
```

Place content in the correct official document:

- Problem, goals, user stories, user journey, business behavior, business
  rules, and UI/UX behavior: governing PRD.
- Technical state machines, API contract, validation edge cases, schema delta,
  concurrency, failure handling, testing considerations, and verifiable
  acceptance criteria: governing Tech Design.
- Concrete implementation work and verification checklist: Task.

Do not use this file to create `PRD → Feature Spec → RFC`, and do not use it as
an authority for API, schema, architecture, or implementation decisions.

Reference the governing PRD and Tech Design instead. Mark unresolved behavior
or technical choices as `TBD / NEEDS DECISION`; do not infer them from this
deprecated template.
