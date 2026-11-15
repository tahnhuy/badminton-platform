# Document Status and Purpose

## Ảnh hưởng của ví toàn sàn — 2026-11-08

Ví ảo do Admin quản lý đã được đưa vào phạm vi nghiệp vụ theo PROJECT-BRIEF.md ngày 2026-11-08. VNPAY và mock đang có không đồng nghĩa đã chọn phương thức nạp ví. Nhà cung cấp/cách nạp/rút và đối soát còn TBD; yêu cầu cũ không có stored balance đã được thay thế. Không thêm công nghệ hay nhà cung cấp trong lần cập nhật này.

---

**Status:** READY
**Purpose:** This document serves as the SOURCE OF TRUTH for global, system-level technical decisions for the Badminton Ecosystem Digital Platform. It defines the confirmed technology stack, outlines technical recommendations requiring approval, and tracks decisions that remain TBD. This document is the source of truth for global technical decisions.
It does not override business requirements, business rules, or the database
schema. When conflicts occur, they must be explicitly resolved rather than
silently overridden.

---

# Architecture Overview

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| System Architecture | Monolithic / Client-Server | CONFIRMED | The MVP does not require distributed services. A monolithic architecture keeps development, deployment, and maintenance simple while supporting the current system scope. |

# Frontend Technology

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Web Framework | React | CONFIRMED | Explicitly selected as part of the project's PERN stack. |
| Routing | `react-router-dom` | CONFIRMED | Needed for page routes and for the route guard used by authentication. |

# Backend Technology

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Runtime | Node.js | CONFIRMED | Explicitly selected as part of the project's PERN stack. |
| Web Framework | Express.js | CONFIRMED | Explicitly selected as part of the project's PERN stack. |

# Database Technology

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Relational DB | PostgreSQL | CONFIRMED | Explicitly selected as part of the project's PERN stack. |
| ORM / Data Access | Drizzle ORM (`drizzle-orm`) with `drizzle-kit`-generated SQL migrations | CONFIRMED | Already used across the repository (`backend/src/db/schema`, `backend/src/db/migrations`); matches the existing PERN implementation and keeps typed schema access consistent. |
| Concurrency Control | Range/Exclusion Constraints | RECOMMENDED | Preferred for enforcing non-overlapping bookings transactionally at the database level. |

# API Architecture

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| API Style | RESTful API | CONFIRMED | REST provides a simple and well-understood interface between the React client and Express.js backend and is sufficient for the MVP. |

# Authentication and Authorization Approach

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Authentication Mechanism | Opaque server-side session | CONFIRMED | Account status must be re-checked on every request, and all of a user's sessions must be revocable at once (Auth PRD Decisions #13, #14). A database-backed session does this directly; JWT would still need a database check on every request. |
| Token Strategy | One opaque session token per signed-in device; no access or refresh tokens | CONFIRMED | Role-based idle and absolute timeouts are stored on each session row (`database-schema.md` §3.27). |
| Token Storage | `HttpOnly; Secure; SameSite=Lax` cookie | CONFIRMED | Client-side JavaScript cannot read the session token, which limits XSS impact. The database stores only the token's SHA-256 hash. |
| CSRF Protection | Double-submit cookie with `X-CSRF-Token` header | CONFIRMED | Required because sessions use cookies; needs no server-side storage. |
| Authorization Model | RBAC + Contextual | RECOMMENDED | Role-Based Access Control (RBAC) covers global roles, while context-based authorization covers dynamic permissions like Tournament Organizer. |
| Password Hashing | HMAC-SHA-256 pre-hash with a secret pepper, then bcrypt (`bcryptjs`, cost 12) | CONFIRMED | `bcryptjs` needs no native build. The pre-hash keeps passwords longer than bcrypt's 72-byte input limit fully significant. |
| Authentication Rate Limiting | `express-rate-limit`, in-memory store, per IP | CONFIRMED | Extra throttle on sign-in, registration, and password change for a single-instance monolith. The persistent account lockout remains the business control. |

### 1. Authentication Mechanism
Sign-in creates a server-side session row and returns a random opaque token in a cookie. Every authenticated request looks up the session and re-reads the account's current status.

### 2. Token/Session Strategy
- One session token per signed-in device; there are no access or refresh tokens.
- Idle and absolute timeouts are role-based configuration values (`docs/business-rules-config-matrix.md` §8.7), snapshotted on each session.
- Sign-out revokes one session. An Admin setting a new password revokes all of that user's sessions.

### 3. Token Storage
The session token travels only in an `HttpOnly; Secure; SameSite=Lax` cookie and is never placed in `localStorage` or `sessionStorage`. The database stores only its SHA-256 hash.

### 4. Authentication Lifecycle
Sign-in, sign-out, session validation, cookie handling, CSRF handling, and authentication error codes are defined in `docs/features/platform/authentication-authorization/tech-design.md`.

### 5. Authorization Model
The system requires a hybrid model to handle the business rules:
- **Global Roles (RBAC):** Used for endpoints that are globally restricted by account type.
- **Resource/Context-Based:** Used for endpoints that depend on the user's relationship to the specific resource.

### 6. Enforcing Player, Court Owner, and Admin Roles
System roles (`PLAYER`, `COURT_OWNER`, `ADMIN`) are enforced through
role-based authorization.

Resource/context-based authorization is applied where access depends
on the user's relationship to a specific resource.

### 7. Enforcing Tournament Organizer Permission
Tournament Organizer is a contextual permission, not a distinct system role.

A Player may act as the Organizer of tournaments they are authorized to manage.
Access to tournament management operations is enforced through
resource/context-based authorization using the authenticated user's
relationship to the specific tournament.

### 8. Security Considerations
- **XSS Mitigation:** The session token is in an HttpOnly cookie.
- **CSRF Mitigation:** Double-submit cookie. The frontend and API are served from one origin, and open CORS is not enabled.
- **Token Guessing and Leaks:** Tokens are 32 random bytes; only their hash is stored, so a database leak does not yield usable tokens.
- **Password Storage:** The pepper `PASSWORD_PEPPER` is a required secret (see Environment/Configuration Management).

### 9. Explicitly TBD
None for authentication and authorization.

# Validation Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Validation Architecture | 3-Tier Validation | RECOMMENDED | Ensures data is validated at the boundary, business rules are enforced in the service layer, and data integrity is guaranteed by the database. |
| Validation Library | Zod | CONFIRMED | TypeScript-first validation for explicit request-boundary schemas. |

### 1. API/Request Boundary Validation
API/request boundary validation should validate request data such as body, query parameters, and URL parameters before business processing. This layer covers data types, required fields, and basic formats. Specific validation flow and response behavior may be refined in feature-specific Tech Design documents.

### 2. Application/Service/Business Validation
Business rules (as defined in `docs/business-rules-config-matrix.md`) are enforced at the service/application level. This includes checking state transitions and authorization boundaries. Applicable HTTP status codes follow the global API conventions, with exact mappings refined in feature-specific Tech Design documents.

### 3. Database-Level Integrity Constraints
The PostgreSQL database serves as the final integrity boundary. Constraints (e.g., foreign keys, unique constraints, and range/exclusion constraints) ensure that regardless of application flaws, the data remains consistent. These constraints are already defined in the database schema and do not need to be duplicated in the application validation logic unless required for UX purposes.

# Error Handling Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Error Handling | Centralized Middleware | RECOMMENDED | Express.js centralized error-handling middleware ensures all errors are processed uniformly and prevents sensitive stack traces from leaking to the client. |

### 1. Centralized Error Handling
The REST API uses centralized error handling so that errors are processed consistently and sensitive internal details are not exposed to clients.

### 2. HTTP Status Code Conventions
The API should use standard HTTP status codes consistently:

- **400 Bad Request:** Invalid request data or malformed input.
- **401 Unauthorized:** Authentication is required or authentication failed.
- **403 Forbidden:** The authenticated user does not have permission.
- **404 Not Found:** The requested resource does not exist.
- **409 Conflict:** The requested operation conflicts with the current resource state or business rules.
- **500 Internal Server Error:** Unexpected server-side errors.

These conventions are RECOMMENDED at the global architecture level and may be
refined by feature-specific Tech Design documents when necessary.

### 3. Consistent JSON Error Response Structure
All API error responses should follow a consistent JSON structure.

Example:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": []
  }
}
```

### 4. Security and Server-Side Logging
- **Preventing Sensitive Leaks:** The centralized error handler must not expose internal implementation details, database queries, stack traces, or other sensitive information in API responses.

- **Server-Side Logging:** Errors should be logged appropriately on the server. Unexpected internal errors must include sufficient diagnostic information for debugging while sensitive information remains protected.

# File/Storage Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| File Storage | Local filesystem (`/uploads` directory, served via Express static middleware) | CONFIRMED | Simplest approach for MVP with no additional infrastructure. Not scalable beyond a single server; to be revisited post-MVP if scaling is required. |

# Payment Integration Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Payment Flow | Idempotent | CONFIRMED | Payment callbacks/events and Booking confirmation must be processed idempotently to prevent duplicate state transitions or duplicate payment effects. |
| Refund Flow | Integrated into Payment Lifecycle | CONFIRMED | Refund handling is part of the payment lifecycle. An independent refund-management module is out of MVP. |
| Payment Provider | VNPAY (production); development-only mock adapter | CONFIRMED | VNPAY is the only production provider, selected for MVP tournament entry fees and refund processing; provider callbacks must be handled idempotently. A mock adapter (selected by configuration, never in production) is built first to unblock Booking/Matchmaking/Tournament; VNPAY sandbox follows (`docs/features/platform/payments-refunds/prd.md` §14). |

# Notification Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Delivery Mechanism | In-app notifications stored in a `NOTIFICATIONS` database table; frontend polls for unread items | CONFIRMED | No additional infrastructure required for MVP. Sufficient for notifying Players of owner-side booking cancellations. Push/email delivery deferred post-MVP. |

# Background Jobs / Scheduled Processing

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Job Queue/Scheduler | In-process `setInterval`/`setTimeout` within Node.js | CONFIRMED | No additional infrastructure required for MVP. Handles payment timeouts and matchmaking request/invitation timeouts (Matchmaking is invitation-only; there is no automatic matching tick) within the single-process monolith. To be revisited if reliability across restarts becomes a concern. |

# Real-Time Communication

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Real-Time Booking | HTTP Polling — frontend polls every 5–10 seconds for slot availability | CONFIRMED | No additional infrastructure required for MVP. Sufficient for real-time slot availability updates within the monolith. |
| Real-Time Messaging | WebSocket (`ws` on the Node.js HTTP server at `/api/v1/ws/messaging`, authenticated via the `sid` session cookie on upgrade) + REST API | CONFIRMED | Approved by human owner (2026-11-01) for standalone real-time Messaging (new messages, reactions, read markers, online presence, typing indicators) inside the single-instance monolith; REST handles history, uploads, and gapless `seq` catch-up on reconnect. |

# Testing Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Testing Scope | Unit, Integration, API, E2E | RECOMMENDED | Testing should cover unit, integration, and API-level behavior, with end-to-end testing applied to critical user flows. |
| Unit, Integration, and API Test Tools | Vitest + Supertest | CONFIRMED | Vitest matches the Vite-based frontend tooling; Supertest drives HTTP-level tests against the Express app. |
| Test Database | A separate database on the existing Docker PostgreSQL (port 5433), migrated with `db:migrate` | CONFIRMED | Same engine and migrations as development, with no new infrastructure. |
| End-to-End Test Tool | Playwright, for main user flows only | CONFIRMED | Covers the most critical flows without a broad UI suite. For authentication: sign-in, forced password change, and role-based denial. |

# Development Environment

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Local Setup | Backend and frontend run natively (`npm run dev`); PostgreSQL runs in Docker Compose | CONFIRMED | Aligns with the existing `docker-compose.yml` setup. No additional containerization required for local development. |

# Environment/Configuration Management

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Config Strategy | `dotenv` (`.env` file) + Zod validation at startup (`shared/config/env.ts`) | CONFIRMED | Already implemented in AUTH-01. Validates required variables at startup and exits with a clear message on failure. |
| Password Pepper | `PASSWORD_PEPPER` environment variable, at least 32 random bytes, required at startup | CONFIRMED | Losing or changing it makes every stored password unverifiable, so it must be backed up with the production secrets. Rotation is not supported in MVP. |

# Logging/Monitoring

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Logging | Console-based JSON logger (`shared/logging/logger.ts`) with `info`/`warn`/`error` levels | CONFIRMED | Already implemented in AUTH-01. No additional logging library dependency. Observability tooling (APM, log aggregation) deferred post-MVP. |

# Docker Usage

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Containerization | PostgreSQL only, via `docker-compose.yml`; backend and frontend run natively | CONFIRMED | Aligns with the current repository setup. Full containerization deferred post-MVP. |

# Deployment-Related Decisions

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Deployment | TBD | TBD | Pending technical design. |
| Origin Topology | Frontend and `/api` served from one origin (development: Vite dev-server proxy) | CONFIRMED | Required by the session cookie and CSRF design. The rest of the deployment design remains TBD. |

# Security-Related Technical Decisions

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Security Implementation | TBD | TBD | Security tooling (e.g., SAST, dependency scanning) deferred post-MVP. Core security practices (CSRF, session, input validation, password hashing) are defined in the Authentication/Authorization documents. |

# Technical Decisions That Remain TBD

- Deployment infrastructure (hosting, CI/CD, environment promotion).
- Security tooling (SAST, dependency scanning).

---

## Confirmed Decisions

- **PERN Stack:** PostgreSQL, Express.js, React, Node.js.
- **Monolithic / Client-Server Architecture:** Simple and sufficient for the MVP scope.
- **RESTful API Architecture:** Interface between React client and Express.js backend.
- **API Versioning Prefix:** `/api/v1/` — confirmed from existing implementation.
- **Pagination:** Offset-based (`page` + `limit`); response includes `meta: { page, limit, total, totalPages }`.
- **Payment Processing:** Payment handling must be idempotent.
- **Refunds:** The refund flow is integrated into the payment lifecycle.
- **Payment Provider:** VNPAY is confirmed for MVP tournament entry fees and refunds. A development-only mock adapter is built first (selected by configuration, never in production); VNPAY sandbox follows.
- **Refund Processing Timeout:** `REFUND_PROCESSING_TIMEOUT_MINUTES` is `1440` minutes.
- **Authentication:** Opaque server-side session in an `HttpOnly; Secure; SameSite=Lax` cookie; CSRF protection with a double-submit cookie.
- **Password Hashing:** HMAC-SHA-256 pepper pre-hash, then bcrypt (`bcryptjs`, cost 12).
- **Approved Authentication Dependencies:** `bcryptjs` and `express-rate-limit` (backend); `react-router-dom` (frontend).
- **Origin Topology:** Frontend and API served from one origin.
- **Real-Time Booking:** HTTP Polling — frontend polls every 5–10 seconds for slot availability.
- **Real-Time Messaging:** WebSocket (`ws` + `@types/ws` on the Express HTTP server, same origin, session-cookie authenticated) for real-time chat events, online presence, and typing indicators, paired with REST API for persistence/uploads/catch-up.
- **Notifications:** In-app only — stored in a `NOTIFICATIONS` DB table; frontend polls for unread items. Push/email deferred post-MVP.
- **Background Jobs:** In-process `setInterval`/`setTimeout` within Node.js for payment and matchmaking request/invitation timeouts.
- **File Storage:** Local filesystem (`/uploads` directory served via Express static middleware). Post-MVP revisit if scaling is required.
- **Config Management:** `dotenv` (`.env`) + Zod validation at startup (`shared/config/env.ts`). Implemented in AUTH-01.
- **Logging:** Console-based JSON logger (`shared/logging/logger.ts`) with `info`/`warn`/`error` levels. Implemented in AUTH-01.
- **Containerization:** PostgreSQL only via `docker-compose.yml`; backend and frontend run natively. Full containerization deferred post-MVP.
- **Local Setup:** `npm run dev` for backend and frontend; `docker-compose up` for PostgreSQL.
- **ORM / Data Access:** Drizzle ORM (`drizzle-orm`) with `drizzle-kit`-generated SQL migrations, aligned with the existing `backend/src/db` implementation.
- **Rating Scale:** 1–5 integer scale for post-match player ratings (skill and attitude), covering matchmaking and Tournament Matches.
- **Testing Tools:** Vitest + Supertest for unit, integration, and API tests; Playwright for main user flows only; a separate test database on the existing Docker PostgreSQL. Approved test dependencies: `vitest`, `supertest`, `@types/supertest`, `@playwright/test`.

## Recommended Decisions Requiring Approval

- **PostgreSQL Range/Exclusion Constraints:** Preferred for enforcing non-overlapping bookings at the database level.
- **RBAC + Contextual Authorization:** Handles global roles and specific resource permissions.
- **3-Tier Validation:** Request-boundary validation, application/service-level business validation, and database-level integrity constraints.
- **Centralized Error Handling Middleware:** Express.js centralized error handling for consistent API error processing.
- **Consistent HTTP Status Code Conventions:** Standard HTTP status codes for common API error categories.
- **Consistent JSON Error Response Structure:** A standardized error response format across REST APIs.
- **Testing Strategy:** Testing should cover unit, integration, and API-level behavior, with end-to-end testing applied to critical user flows.

## Explicitly TBD

- Deployment infrastructure (hosting, CI/CD, environment promotion).
- Security tooling (SAST, dependency scanning).

## Architectural Constraints

- **MVP Focus:** Core modules are Matchmaking, Court Booking, and Tournament.
- **Roles:** The only system roles are Player, Court Owner, and Admin. Tournament Organizer is a contextual permission of Player, not a separate system role.
- **Out of MVP:** Split Bill, Super Admin, Independent refund-management module, Match Rescheduling, Court Rating, and System Content Management.
- **Simplicity:** The project must avoid unnecessary architectural complexity.
- **Avoid Over-engineering:** Do not add microservices. Do not add Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes, GraphQL, S3, Firebase, or other complex external infrastructure merely because they are common, unless explicitly required and justified. (In-process WebSocket via `ws` is approved specifically for Messaging.)

## Change Log

| Date | Change | Approved by | Reference |
|------|--------|-------------|-----------|
| 2026-09-16 | Authentication mechanism, token strategy, token storage, CSRF protection, password hashing, authentication rate limiting, routing, origin topology, and password pepper set to CONFIRMED. JWT and access/refresh token recommendations removed. | Tech Lead (Decision Gate) | `docs/features/platform/authentication-authorization/tech-design.md` §21.1 |
| 2026-09-16 | Testing tools set to CONFIRMED: Vitest + Supertest, Playwright for main user flows only, separate test database on the existing Docker PostgreSQL. | Tài (Tech Lead) | `docs/features/platform/authentication-authorization/tasks.md` (Decisions Applied, Q1) |
| 2026-09-25 | Resolved multiple TBDs: File Storage (local filesystem), Notifications (in-app DB + poll), Background Jobs (in-process setInterval), Real-time Booking (HTTP polling 5-10s), Config Strategy (dotenv + Zod, CONFIRMED from AUTH-01), Logging (console JSON logger, CONFIRMED from AUTH-01), Containerization (PostgreSQL-only Docker Compose, CONFIRMED), Local Setup (native dev servers, CONFIRMED), Rating scale (1–5, CONFIRMED), API versioning prefix `/api/v1/` (CONFIRMED from existing implementation). Deployment and security tooling remain TBD. | Tài (Tech Lead) | — |
| 2026-09-26 | Confirmed Drizzle ORM (`drizzle-orm`) with `drizzle-kit` migrations as the data-access technology. | Human owner | `docs/features/matchmaking/matchmaking/tech-design.md` §21 Q1 |
| 2026-09-27 | Clarified the confirmed Rating Scale (1–5 integer, skill and attitude) to cover matchmaking and Tournament Matches, gated by `TOURNAMENT_RATING_ENABLED`. | Human owner | `docs/features/matchmaking/ratings/prd.md` §14 |

### Social Matchmaking and Messaging — 2026-10-31 (Phase 2; shared-doc PR review pending)

Approved by the human owner (Phase 2 question batches 1–2). Not implemented.

| Area | Decision | Status |
| --- | --- | --- |
| Messaging delivery, online and typing | WebSocket (`ws` attached to the Node.js HTTP server at `/api/v1/ws/messaging`, authenticated by the existing `sid` `HttpOnly` session cookie on upgrade) for real-time push of messages, reactions, read markers, online presence and typing indicators; REST endpoints handle history pagination, multipart uploads, and `afterSeq` gap-recovery on reconnect. Presence/typing persisted in dedicated DB tables with throttled writes. | CONFIRMED (updated 2026-11-01 per human owner decision) |
| Private media | Post images and message attachments stored on the local filesystem under a private root `PRIVATE_UPLOADS_DIR`, never served by `express.static`; downloaded through an authorized API with per-request permission checks. Validated at startup (absolute, writable, outside every public static root); no fallback to `/uploads`. Deployment must provide write permission, capacity and backup together with the database. Avatars stay on public `/uploads`. | CONFIRMED (T5, Q7) |
| Upload parsing and image normalization | Extend the existing `multer` and `sharp` usage to post images and message attachments. No other new dependency is approved by this row. | CONFIRMED (T5) |
| DOCX/XLSX inspection | `yauzl@3.4.0` (MIT; exact version pin) to read the ZIP central directory without extraction (Messaging Tech Design §7.6). | Library and exact version CONFIRMED by the human owner in the final Phase 2 review (2026-10-31); verify backend lockfile/audit during MSG-05 — historical evidence in Messaging Tech Design §21.3 |
| Per-Player business quotas | Counted from stored rows inside the write transaction under the actor's `USERS` row lock; not `express-rate-limit`. `express-rate-limit` stays for authentication IP throttling only. | CONFIRMED (T6) |

The "Avoid Over-engineering" constraint is unchanged for external infrastructure (in-process `ws` is approved for Messaging): Redis, S3 and
similar remain excluded.

### Player Profile avatar upload — 2026-10-19

Implementation selection under user-authorized completion of PP-06: Multer 2.4.0 (bounded multipart), Sharp 0.35.5 (JPEG/PNG/WebP decode and normalization), @types/multer 2.3.0 (development). Local `/uploads` storage remains the confirmed storage model. This is a scoped addition, not authorization for cloud storage or unrelated dependencies. Details: Player Profile Tech Design §9.6.
