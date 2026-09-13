# DEPRECATED: Domain Specification Template

**Status:** DEPRECATED / REFERENCE ONLY

Domain Specification is not an official document type in this project and is
not part of the documentation lifecycle. Do not create a hierarchy such as
`Domain → PRD` and do not use this file as an authority for implementation.

The official hierarchy is:

```text
PROJECT-BRIEF → PRD → Tech Design → Task
```

Useful domain-level content should be placed in the appropriate official
document:

- Domain boundary, business capabilities, user language, and product behavior:
  relevant PRD.
- Technical domain model, state transitions, schema delta, API, concurrency,
  and implementation design: relevant Tech Design.
- Project scope, roles, MVP boundaries, and confirmed decisions:
  `PROJECT-BRIEF.md`.
- Frozen business rules/configuration: `docs/business-rules-config-matrix.md`.
- Global schema: `docs/architecture/database-schema.md`.

Do not use this deprecated template for:

- Database schema drafts or field definitions.
- API requirements or endpoint contracts.
- Technical sequence diagrams.
- Technology, provider, framework, or infrastructure decisions.
- Business rules that override the authoritative project documents.

If a domain concept is needed, record it in the governing PRD or Tech Design
and link to the relevant authoritative references. Unresolved matters remain
`TBD / NEEDS DECISION`.
