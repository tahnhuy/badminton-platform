# Document Status and Purpose

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

# Backend Technology

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Runtime | Node.js | CONFIRMED | Explicitly selected as part of the project's PERN stack. |
| Web Framework | Express.js | CONFIRMED | Explicitly selected as part of the project's PERN stack. |

# Database Technology

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Relational DB | PostgreSQL | CONFIRMED | Explicitly selected as part of the project's PERN stack. |
| Concurrency Control | Range/Exclusion Constraints | RECOMMENDED | Preferred for enforcing non-overlapping bookings transactionally at the database level. |

# API Architecture

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| API Style | RESTful API | CONFIRMED | REST provides a simple and well-understood interface between the React client and Express.js backend and is sufficient for the MVP. |

# Authentication and Authorization Approach

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Authentication Mechanism | JWT-based Authentication | RECOMMENDED | Standard approach for a React SPA and Express.js backend. Avoids requiring server-side session storage for standard authentication flows, keeping the MVP simple. |
| Token Strategy | Access + Refresh Token | RECOMMENDED | Balances security (short-lived access tokens) with user experience (long-lived refresh tokens). |
| Token Storage | HTTPOnly/Secure/SameSite Cookies | RECOMMENDED | Storing tokens in HTTPOnly, Secure cookies mitigates Cross-Site Scripting (XSS) risks better than `localStorage`. |
| Authorization Model | RBAC + Contextual | RECOMMENDED | Role-Based Access Control (RBAC) covers global roles, while context-based authorization covers dynamic permissions like Tournament Organizer. |
| Password Hashing | TBD | TBD | Specific hashing algorithm (e.g., bcrypt vs. argon2) is not yet decided. |

### 1. Authentication Mechanism
JWT (JSON Web Token) authentication is recommended. Standard approach for a React SPA and Express.js backend. Avoids requiring server-side session storage for standard authentication flows, keeping the MVP simple.

### 2. Token/Session Strategy
An Access Token + Refresh Token strategy is recommended to maintain security without degrading user experience:
- **Access Token:** A short-lived token used to authenticate API requests.
- **Refresh Token:** A long-lived token used to obtain a new Access Token without requiring the user to re-enter credentials.

### 3. Token Storage
Both tokens should be stored in **HTTPOnly, Secure, SameSite cookies** rather than the browser's `localStorage` or `sessionStorage`. This prevents client-side JavaScript from accessing the tokens, significantly reducing the risk of XSS attacks.

### 4. Authentication Lifecycle
Authentication operations (login, refresh, logout) and standard API requests use the token strategy to maintain secure sessions. The specific request/response flow, error interception, and cookie handling are deferred to the technical design.

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
- **XSS Mitigation:** Addressed by the recommended cookie storage strategy.
- **CSRF Mitigation:** Required because of cookie-based storage.
- **Token Tampering:** Prevented by cryptographic signatures.

### 9. Explicitly TBD
The following authentication and authorization details remain TBD and require further technical design:
- Password hashing algorithm.

# Validation Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Validation Architecture | 3-Tier Validation | RECOMMENDED | Ensures data is validated at the boundary, business rules are enforced in the service layer, and data integrity is guaranteed by the database. |
| Validation Library | TBD | TBD | Specific library (e.g., Joi, Zod, express-validator) is not yet decided. |

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
| File Storage | TBD | TBD | Pending technical design (e.g., for avatar images). |

# Payment Integration Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Payment Flow | Idempotent | CONFIRMED | Payment callbacks/events and Booking confirmation must be processed idempotently to prevent duplicate state transitions or duplicate payment effects. |
| Refund Flow | Integrated into Payment Lifecycle | CONFIRMED | Refund handling is part of the payment lifecycle. An independent refund-management module is out of MVP. |
| Payment Provider | VNPAY | CONFIRMED | Selected for MVP tournament entry fees and refund processing; provider callbacks must be handled idempotently. |

# Notification Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Delivery Mechanism | TBD | TBD | Pending technical design. |

# Background Jobs / Scheduled Processing

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Job Queue/Scheduler | TBD | TBD | Required to handle payment timeouts and matchmaking timeouts, but the specific technology remains unconfirmed. |

# Real-Time Communication

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Real-Time Booking | TBD | TBD | Booking is defined as real-time, but the specific implementation technology (e.g., polling vs. WebSockets) remains TBD as no specific technology is confirmed. |

# Testing Strategy

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Testing Scope | Unit, Integration, API, E2E | RECOMMENDED | Testing should cover unit, integration, and API-level behavior, with end-to-end testing applied to critical user flows. |
| Testing Tools | TBD | TBD | Specific testing frameworks and tooling remain TBD. |

# Development Environment

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Local Setup | TBD | TBD | Pending technical design. |

# Environment/Configuration Management

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Config Strategy | TBD | TBD | Pending technical design. |

# Logging/Monitoring

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Observability | TBD | TBD | Pending technical design. |

# Docker Usage

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Containerization | TBD | TBD | Pending technical design. |

# Deployment-Related Decisions

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Deployment | TBD | TBD | Pending technical design. |

# Security-Related Technical Decisions

| Area | Decision | Status | Rationale |
|------|----------|--------|-----------|
| Security Implementation | TBD | TBD | Pending technical design. |

# Technical Decisions That Remain TBD

- Password hashing algorithm.
- Specific API validation library (e.g., Joi, Zod, express-validator).
- File and storage strategy.
- Rating scale.
- Notification delivery mechanism.
- Background jobs / scheduled processing technology.
- Real-time communication technology for booking.
- Testing frameworks and tooling.
- Development and environment configuration management.
- Logging and monitoring solutions.
- Docker usage and deployment infrastructure.
- Security practices and tools.

---

## Confirmed Decisions

- **PERN Stack:** PostgreSQL, Express.js, React, Node.js.
- **Monolithic / Client-Server Architecture:** Simple and sufficient for the MVP scope.
- **RESTful API Architecture:** Interface between React client and Express.js backend.
- **Payment Processing:** Payment handling must be idempotent.
- **Refunds:** The refund flow is integrated into the payment lifecycle.
- **Payment Provider:** VNPAY is confirmed for MVP tournament entry fees and refunds.
- **Refund Processing Timeout:** `REFUND_PROCESSING_TIMEOUT_MINUTES` is `1440` minutes.

## Recommended Decisions Requiring Approval

- **PostgreSQL Range/Exclusion Constraints:** Preferred for enforcing non-overlapping bookings at the database level.
- **JWT-based Authentication:** Standard approach for the tech stack.
- **Access + Refresh Token Strategy:** Balances security with user experience.
- **HTTPOnly/Secure/SameSite Cookie Storage:** Mitigates XSS risks.
- **RBAC + Contextual Authorization:** Handles global roles and specific resource permissions.
- **3-Tier Validation:** Request-boundary validation, application/service-level business validation, and database-level integrity constraints.
- **Centralized Error Handling Middleware:** Express.js centralized error handling for consistent API error processing.
- **Consistent HTTP Status Code Conventions:** Standard HTTP status codes for common API error categories.
- **Consistent JSON Error Response Structure:** A standardized error response format across REST APIs.
- **Testing Strategy:** Testing should cover unit, integration, and API-level behavior, with end-to-end testing applied to critical user flows.

## Explicitly TBD

- Password hashing algorithm.
- Specific validation library.
- Rating scale.
- All implementation technologies regarding File Storage, Notifications, Background Jobs, Real-time Communication, Testing Frameworks/Tooling, Config Management, Logging/Monitoring, Docker, Deployment, and Security.

## Architectural Constraints

- **MVP Focus:** Core modules are Matchmaking, Court Booking, and Tournament.
- **Roles:** The only system roles are Player, Court Owner, and Admin. Tournament Organizer is a contextual permission of Player, not a separate system role.
- **Out of MVP:** Split Bill, Super Admin, Independent refund-management module, Match Rescheduling, Court Rating, and System Content Management.
- **Simplicity:** The project must avoid unnecessary architectural complexity.
- **Avoid Over-engineering:** Do not add microservices. Do not add Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes, GraphQL, WebSockets, S3, Firebase, or other complex technologies merely because they are common, unless explicitly required and justified.
