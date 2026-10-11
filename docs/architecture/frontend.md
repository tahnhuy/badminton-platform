# Frontend Architecture & Design System

**Status:** Draft
**Owner:** Frontend
**Design source:** Figma file **“Badminton SmashPro”** (`fileKey: D9NrjgxLpE066BcE5Sk8HD`)
**Implemented source:** `frontend/src/`

This document is the single consolidated reference for the React frontend: its
application architecture, route/navigation map, shared layer, design system,
feature module map, and the Figma screen inventory that the UI implements.

It does not replace higher-authority documents. Where a statement here conflicts
with an authoritative document, that document wins and this file must be
corrected (see `docs/documentation-guide.md` §4.3).

## 1. Purpose, Scope, and Authority

### 1.1 What this document owns

- Frontend application architecture: folder layout, app boundary, providers,
  routing, route guards, and the per-role navigation model.
- The shared frontend layer: HTTP client, auth/session handling, shared hooks,
  shared utilities, and shared presentational UI.
- The design system: design tokens, typography scale, color palette, radii,
  shadows, and reusable UI patterns as derived from Figma and implemented in
  `frontend/src/index.css`.
- The Figma screen inventory (screen codes `P##` / `O##` / `A##`) mapped to
  features and routes.
- Frontend cross-cutting behavior: async state handling, polling, modal
  accessibility, formatting, and responsive rules.

### 1.2 What this document does NOT own

- Global technology decisions (React, `react-router-dom`, same-origin topology,
  polling intervals): `docs/architecture/tech-stack.md`.
- Global coding, naming, API, and testing conventions: `docs/architecture/conventions.md`.
- Business rules and configuration values: `docs/business-rules-config-matrix.md`.
- Feature API contracts, state machines, and acceptance criteria: the relevant
  feature Tech Design under `docs/features/`.
- Business behavior and user journeys: the relevant feature PRD.
- The consolidated database schema: `docs/architecture/database-schema.md`.

This document summarizes how the frontend implements approved decisions. It must
not introduce new business rules, API contracts, or global technology choices.

### 1.3 Authority order for frontend work

1. Global scope, roles, MVP boundaries: `PROJECT-BRIEF.md`.
2. Documentation process and ownership: `docs/documentation-guide.md`.
3. Global technology and constraints: `docs/architecture/tech-stack.md`.
4. Global schema: `docs/architecture/database-schema.md`.
5. Global conventions: `docs/architecture/conventions.md`.
6. This document: frontend architecture, routes, shared layer, design system.
7. Feature PRD and Tech Design: feature-specific behavior, API mapping, states.
8. `docs/business-rules-config-matrix.md`: business rules and configuration.

### 1.4 Relationship to the Figma design

- The Figma file **“Badminton SmashPro”** is a **design/UX reference**, not an
  authority for scope or behavior. Scope and behavior are owned by
  `PROJECT-BRIEF.md`, the feature PRD/Tech Design, and
  `docs/business-rules-config-matrix.md`.
- The delivered Figma contains screen content that is **outside the approved
  MVP** (for example ELO/MMR ranking, OTP email verification, OAuth/social
  sign-in, “remember me”, password reset, MFA/2FA, wallet/SmashPay, escrow,
  KYC/CCCD identity verification, court/facility rating, ELO-based seeding, and
  admin system configuration). This content **must not be implemented**; it is
  catalogued in §9.4 so agents recognize and exclude it.
- When Figma and the specs disagree, the specs win. The divergence must be
  surfaced (Figma corrected or a scope change approved), not silently resolved
  (`.agents/AGENTS.md` §11, `docs/documentation-guide.md` §4.3).
- Figma is authoritative **only** for visual design (layout, spacing, color,
  typography, component styling) within approved scope.

## 2. Confirmed Frontend Stack and Constraints

From `docs/architecture/tech-stack.md` and `docs/architecture/conventions.md`
(do not re-decide these here):

| Area | Decision | Source |
| --- | --- | --- |
| Web framework | React (TSX) | `tech-stack.md` Frontend Technology |
| Routing | `react-router-dom` | `tech-stack.md` Frontend Technology |
| Build tool | Vite (dev server port `5173`) | `tech-stack.md`, `frontend/vite.config.ts` |
| Language | TypeScript | `tech-stack.md` |
| Auth | Opaque server-side session cookie `sid`; no JWT | `tech-stack.md`, Auth Tech Design |
| CSRF | Double-submit cookie `csrf_token` → `X-CSRF-Token` header | `tech-stack.md`, `conventions.md` |
| Origin | Frontend and `/api` on one origin (dev: Vite proxy `/api` → `http://localhost:3000`) | `tech-stack.md` |
| API prefix | `/api/v1/` | `conventions.md` |
| Pagination | Offset-based `page` + `limit`; response `meta: { page, limit, total, totalPages }` | `conventions.md` |
| Error shape | `{ error: { code, message, details } }` | `tech-stack.md`, `conventions.md` |
| Real-time | HTTP polling 5–10s (booking/monitoring); in-app notification polling | `tech-stack.md` |
| E2E tests | Playwright under `frontend/e2e/` | `tech-stack.md`, `conventions.md` |
| Lint | `oxlint` | `frontend/.oxlintrc.json`, `frontend/package.json` |

Explicitly **not** approved as global frontend dependencies (do not add without a
documented decision): Tailwind, CSS Modules, styled-components, any state
management library (Redux/Zustand/…), any data-fetching library (React Query/SWR),
any external charting library, any UI component library. Per the Auth Tech
Design, authentication state uses **React Context** (`useAuth`); this is a
feature-approved choice, not a global state-management decision.

## 3. Directory Layout and Conventions

Feature-first, with an application boundary and a shared area. This is enforced
by `docs/architecture/conventions.md` (Frontend Conventions).

```text
frontend/
├── e2e/                      # Playwright end-to-end tests
├── public/                   # static assets (favicon, icons.svg, avatar images)
├── src/
│   ├── app/                  # route composition + app-wide providers + role home
│   │   ├── router.tsx
│   │   ├── role-home.ts
│   │   └── placeholder-pages.tsx
│   ├── components/
│   │   └── common/           # feature-agnostic shared UI primitives
│   │       ├── DataTable.tsx
│   │       ├── FilterToolbar.tsx
│   │       └── Icons.tsx
│   ├── features/
│   │   ├── admin/            # pages, components, services, types, utils
│   │   ├── auth/             # pages, auth-api, auth-provider, auth-context
│   │   ├── booking/          # pages, components, hooks, services, types, utils
│   │   └── player/           # shared player shell (PlayerLayout/Header/Footer)
│   ├── shared/
│   │   ├── api/http-client.ts
│   │   ├── auth/require-auth.tsx
│   │   ├── hooks/useModalA11y.ts
│   │   └── utils/formatDate.ts
│   ├── index.css             # global design tokens + shared classes
│   └── main.tsx              # entry: StrictMode → AuthProvider → RouterProvider
├── index.html                # lang="vi", title "SmashPro - Badminton Platform"
├── vite.config.ts
├── playwright.config.ts
└── .env.example              # VITE_SUPPORT_CONTACT
```

Rules:

- Feature code lives under `frontend/src/features/<capability>/` (UI, hooks, API
  clients, feature state).
- Route composition and application-wide providers live in `frontend/src/app/`.
- Feature-agnostic UI primitives live in `frontend/src/components/common/`.
- Genuinely shared hooks/utilities live in `frontend/src/shared/hooks/` and
  `frontend/src/shared/utils/`; do not duplicate them per feature.
- Use `kebab-case` for feature folders and multi-word filenames; React components
  and types use `PascalCase`; hooks use `usePascalCase`.
- A file must not exceed 1000 lines; a function must not exceed 50 lines
  (`conventions.md`). Files that approach this limit must be split.
- Tables and filter controls are shared UI (`DataTable`, `FilterToolbar`).
  Features compose them via props; do not fork or copy them.

## 4. Application Boundary (`frontend/src/app/`)

### 4.1 Entry and providers

`main.tsx` composes: `StrictMode` → `AuthProvider` → `RouterProvider`.
`AuthProvider` (`features/auth/auth-provider.tsx`) owns session state and calls
`GET /api/v1/auth/me` once on mount. It registers the global auth-error handler
on the shared HTTP client only after the initial `/me` settles, so a logged-out
visitor’s expected `401` does not surface as “session expired”.

### 4.2 Route map

Routes are defined in `frontend/src/app/router.tsx`. Guards are enforced by
`RequireAuth` (`shared/auth/require-auth.tsx`), which is UX shaping only — the
server remains the authority.

| Path | Access | Element | Figma screens | Governing spec |
| --- | --- | --- | --- | --- |
| `/sign-in` | public | `SignInPage` | P01 | `docs/features/platform/authentication-authorization/` |
| `/register` | public | `RegisterPage` | P02 | same (registration; no OTP step — see §9.4) |
| `/change-password` | any authenticated | `ChangePasswordPage` | P43 | same (password policy §8 / Decision #8) |
| `/` (index) | `PLAYER` + `PlayerLayout` | `PlayerPlaceholderPage` (home not yet wired) | P04 | Player profile (`docs/features/player/profile/`) partially; home dashboard not yet specified |
| `/courts` | `PLAYER` | `CourtSearchPage` | P06 (facility P07) | `docs/features/booking/player-booking/` |
| `/courts/:courtId` | `PLAYER` | `CourtDetailPage` | P08 / P09 / P10 | same |
| `/bookings` | `PLAYER` | `MyBookingsPage` | P39 | same |
| `/bookings/:bookingId` | `PLAYER` | `BookingDetailPage` | P14 | same |
| `/matchmaking` | `PLAYER` | `PlayerPlaceholderPage` | P19/P20/P22… | `docs/features/matchmaking/matchmaking/` |
| `/tournaments` | `PLAYER` | `PlayerPlaceholderPage` | P26/P27… | `docs/features/tournament/` |
| `/owner` | `COURT_OWNER` | `OwnerHomePage` (dark placeholder) | O01… | `docs/features/court-owner/` |
| `/admin` | `ADMIN` | `<Outlet/>` → redirect to `/admin/users` | — | — |
| `/admin/users` | `ADMIN` | `UserManagementPage` | A02 (A03, A15) | `docs/features/admin/user-management/` |
| `/admin/courts` | `ADMIN` | `CourtManagementPage` | A04 (A05, A16) | `docs/features/admin/court-management/` |
| `/admin/dashboard` | `ADMIN` | `AdminPlaceholderPage` | A01 | `docs/features/admin/dashboard/` |
| `/admin/tournaments` | `ADMIN` | `AdminPlaceholderPage` | A06 (A07, A14) | `docs/features/tournament/` + `PROJECT-BRIEF.md` §4 |
| `/admin/reports` | `ADMIN` | `AdminPlaceholderPage` | A08 (A09) | `docs/features/admin/report-management/` |
| `*` | — | `<Navigate to="/" replace/>` | — | — |

The `Figma screens` column is the target screen and is a design reference only;
some screen content is outside approved scope (§9.4) and must not be implemented.
Several routes are not yet implemented and are listed in §9.

### 4.3 Guard behavior (`RequireAuth`)

- `status === 'loading'` → render a loading screen; no redirect.
- unauthenticated / no user → `<Navigate to="/sign-in" state={{ from }} replace/>`.
- `status === 'passwordChangeRequired'` → force `/change-password` (unless already there).
- authenticated but role not in `allowedRoles` → render `AccessDeniedPage` (not a
  redirect to sign-in).
- otherwise → render children/`Outlet`.

### 4.4 Role home (`app/role-home.ts`)

`getRoleHomePath(role)`: `ADMIN → /admin`, `COURT_OWNER → /owner`, else `PLAYER → /`.
Used after sign-in/registration/password change to land each role on its portal.

## 5. Shared Layer

### 5.1 HTTP client (`shared/api/http-client.ts`)

The approved transport boundary for auth, booking, and (target) all features.

- `ApiError` carries `statusCode`, stable `code`, and `details[]`.
- Reads the CSRF token from the `csrf_token` cookie and sends `X-CSRF-Token` on
  `POST`/`PUT`/`PATCH`/`DELETE`.
- `credentials: 'same-origin'`; JSON body/content-type handling; `204` → `undefined`.
- Non-OK responses are parsed into `ApiError` from `{ error: { code, message, details } }`.
- CSRF retry: on `403 AUTH_CSRF_TOKEN_INVALID`, it calls `GET /api/v1/auth/me`
  once to refresh the cookie, then retries the original request once.
- Global auth signaling: `401 AUTH_SESSION_INVALID|AUTH_SESSION_EXPIRED` →
  `SESSION_INVALID` handler; `403 AUTH_PASSWORD_CHANGE_REQUIRED` →
  `PASSWORD_CHANGE_REQUIRED` handler. Handlers are registered by `AuthProvider`.
- Base URL is relative (`/api/v1/...`); the single-origin rule lets Vite proxy
  `/api` to the backend in development.

### 5.2 Auth handling

- `AuthProvider` holds `{ status, user, sessionMessage, signIn, register, signOut,
  changePassword, refreshUser }`.
- `features/auth/auth-api.ts` exposes `authApi` (`register`, `signIn`, `signOut`,
  `me`, `changePassword`, `listSkillLevels`) via `httpClient`.
- User-facing auth messages are chosen from `error.code`, never the server
  `message` string (Auth Tech Design).
- The session token is never placed in `localStorage`/`sessionStorage`.

### 5.3 Shared hooks and utilities

- `shared/hooks/useModalA11y.ts` — while a modal is open: close on Escape, lock
  body scroll, trap focus, and focus the dialog. New modals should use this.
- `shared/utils/formatDate.ts` — `vi-VN` `dd/mm/yyyy`, or `—` for null/invalid.
- Feature formatting that is genuinely cross-feature should graduate to
  `shared/utils/`; feature-only formatting stays in the feature.

### 5.4 Shared UI primitives (`components/common/`)

- `DataTable<T>` — typed table with `ColumnDef<T>`, loading skeleton rows, empty
  state, optional selection (select-all + indeterminate), optional row click.
- `FilterToolbar` — search input, `FilterSelectConfig[]`, active-filter chips,
  clear-all, result count, and a `rightActions` slot.
- `Icons.tsx` — inline SVG icon set used across the app.

These components are presentational and feature-agnostic. Feature code supplies
feature-specific columns, data, and filter props; it must not reimplement table
or filter UI.

## 6. Design System

### 6.1 Source of truth for tokens

Design intent is in the Figma file **“Badminton SmashPro”**. Runtime tokens are
declared as CSS custom properties in `frontend/src/index.css` `:root`. New UI
must consume these variables rather than hard-coding colors/spacing.

### 6.2 Typography

- Sans: **Inter** (weights 400/500/600/700/800), fallback system stack.
- Mono: **JetBrains Mono** (500/700); Figma uses `Liberation Mono` for code/ID
  labels — treat them as the same “mono/code” role.
- Loaded from Google Fonts in `index.html`.
- Type scale observed in Figma (implemented via inline styles/classes):

| Role | Size / line-height | Weight | Notes |
| --- | --- | --- | --- |
| Hero display | 48 / 56 | 800 | letter-spacing −1.44px |
| Page title | 32 / 40 | 700 | −0.8px |
| Section title | 24 / 32 | 700 | −0.36px |
| Card / panel title | 20 / 28 | 700 or 600 | −0.2px |
| Sub-heading | 18 / 26 | 600 | −0.18px |
| Title / strong | 16 / 24 | 700 | |
| Body | 14 / 20 | 400 | |
| Body small | 13 / 18 | 400 | default dense table text |
| Meta / small | 12 / 16 | 600 | letter-spacing 0.24px |
| Label / overline | 11 / 14 | 700 | uppercase, letter-spacing ~0.44–0.55px |
| Mono / code | 11 / 14 | 700 | IDs, booking/transaction codes |

### 6.3 Color palette

Implemented tokens (`:root` in `index.css`) plus the raw Figma palette they map to:

Backgrounds and surfaces:

| Token | Value | Use |
| --- | --- | --- |
| `--bg-app` | `#FAF8FF` | app/page background |
| `--bg-card` | `#FFFFFF` | cards, tables, header/footer |
| `--bg-subtle` / `--bg-table-header` | `#F2F3FF` | table header, inset panels |
| `--bg-tag-uid` | `#EAEDFF` | neutral tag |
| `--bg-tag-owner` | `#D3E4FE` | info/owner tag |
| `--bg-tag-green` | `rgba(0,107,44,0.1)` | success/court tag |
| `--bg-tag-red` | `#FFDAD6` | danger tag |
| `--bg-tag-amber` | `rgba(85,129,0,0.15)` | warning tag |

Text and ink:

| Token | Value | Use |
| --- | --- | --- |
| `--text-primary` | `#131B2E` | headings, primary ink |
| `--text-secondary` | `#505F76` | body/secondary |
| `--text-muted` | `#54647A` | muted labels |
| `--text-subtle` | `#767676` | least emphasis |
| `--text-tag-uid` | `#3E4A3D` | mono tag text |

Brand and semantic:

| Token | Value | Use |
| --- | --- | --- |
| `--color-brand` | `#006B2C` | primary action/brand green |
| `--color-brand-hover` | `#005523` | brand hover |
| `--color-brand-light` | `#F7FFF2` | brand tint surface |
| `--color-brand-accent` | `#00873A` | secondary green |
| `--color-brand-blue` | `#2679F1` | links/info |
| `--color-danger` | `#BA1A1A` | destructive |
| `--color-danger-hover` | `#961515` | destructive hover |
| `--color-warning` | `#436600` | warning |
| `--color-owner-badge` | `#0B1C30` | owner dark badge |

Additional Figma accents (use via tokens when promoted; otherwise treat as
one-off): lime/positive `#B2F746`, `#98DA27`, `#7FFC97`, `#62DF7D`; dark greens
`#005320`, `#121F00`, `#002109`; blues `#DAE2FD`, `#D0E1FB`, `#EEF0FF`, `#0075FF`;
neutrals `#BDCABA`, `#283044`, `#6E7B6C`.

The auth and owner placeholder screens currently use a dark “glass” treatment
(hard-coded `#0f172a`/`#38bdf8` inline styles). This is a known divergence; see §10.

### 6.4 Radii, shadows, borders

- Radii: `--radius-sm 4px`, `--radius-md 8px`, `--radius-lg 12px`, `--radius-full 9999px`.
  Cards/panels use 12px; inputs/buttons 8px; pills/badges full.
- Shadows: `--shadow-sm` (resting), `--shadow-md` (raised), `--shadow-lg`,
  `--shadow-modal` (dialogs). Figma uses an equivalent elevation scale.
- Borders: `--border-subtle rgba(189,202,186,0.3)`, `--border-medium …0.5`,
  `--border-card …0.4`; header/footer separators `#E2E7FF`.

### 6.5 Shared UI patterns

- **App shell (player):** sticky header (72px) + main + footer; header has brand,
  primary nav tabs, notification bell, and a user dropdown; mobile drawer.
- **Admin shell:** fixed `AdminSidebar` + `AdminHeader` + content wrapper; each
  admin page composes the shell (there is no router-level admin layout yet).
- **Bento metric cards:** 4-card KPI grids (`metric-cards-grid`) used by Admin
  user/facility/dashboard screens.
- **Filter toolbar:** shared `FilterToolbar` with debounced search and chips.
- **Status badges:** color-coded pills (e.g. `ACTIVE` green, `SUSPENDED`,
  `PENDING_PAYMENT`, `CANCELLED`); never rely on color alone.
- **Modals:** centered dialog + overlay; use `useModalA11y`; confirm destructive
  actions; disable double-submit.
- **Toasts:** transient bottom-right feedback for admin actions.
- **States:** every async flow defines loading (skeleton), success, error, and
  empty states; never show empty while loading (`conventions.md`).

## 7. Feature Module Map

Detailed API contracts, state machines, and acceptance criteria live in each
feature’s Tech Design. This section maps the implemented/planned frontend surface.

### 7.1 `features/auth`

- Governing spec: `docs/features/platform/authentication-authorization/` (PRD +
  Tech Design, Ready), `docs/architecture/tech-stack.md` (session/CSRF/hashing).
- Pages: `sign-in-page`, `register-page`, `change-password-page`, `access-denied-page`.
- State: `auth-provider.tsx`, `auth-context.ts`, `use-auth.ts`.
- Transport: `auth-api.ts`.
- Behavior: sign-in redirects to forced password change or role home / `from`;
  error messages keyed by `ApiError.code`; support contact from
  `VITE_SUPPORT_CONTACT`. Figma: P01, P02, P43, P76.
- Not in scope (Figma-only content, do not implement): OTP/email verification
  (P03), OAuth/Google sign-in (P01), “remember me” (P01), forgot-password (P01,
  P43), MFA/2FA (P42, P43), device/session management UI (P42), account/
  notification/privacy settings and KYC/CCCD (P42). See §9.4.

### 7.2 `features/player`

- Governing spec: player shell is not separately specified; `PlayerLayout` is a
  frontend shell. Profile behavior is governed by `docs/features/player/profile/`
  (Ready); notifications by `docs/architecture/tech-stack.md` (in-app polling).
- Shell: `PlayerLayout`, `PlayerHeader` (nav: Home / Courts / Matchmaking /
  Tournaments), `PlayerFooter`.
- Pages: `PlayerHomePage.tsx` (designed home, currently not wired to the index
  route), `PlayerPlaceholderPage.tsx` (reusable placeholder for unimplemented tabs).
- Target Figma: P04 (home/dashboard), P05/P45 (notifications), P42/P44 (account),
  P46 (activity), P39/P40/P41 (history), P77–P86 (generic/empty/error states).
- Not in scope (Figma-only content, do not implement): extra editable profile
  fields beyond `full_name` + avatar (P44: gender, DOB, city, club, bio, dominant
  hand, jersey size, playing style, racket), email/phone editing (P42), ELO and
  “uy tín/điểm cộng đồng” scores (P04, P44), SmashPay wallet and JWT wording
  (P86). See §9.4 and the Player Profile PRD §4.

### 7.3 `features/booking`

- Governing spec: `docs/features/booking/player-booking/` (PRD + Tech Design,
  Ready) and `docs/business-rules-config-matrix.md` §2 (booking, cancellation,
  payment timeout, refund).
- Pages: `CourtSearchPage`, `CourtDetailPage`, `MyBookingsPage`, `BookingDetailPage`.
- Components: `CourtSearchFilters`, `CourtCard`, `AvailabilityGrid`,
  `BookingListCard`, `BookingStatusBadge` (incl. `RefundStatusBadge`),
  `CancelBookingModal`, `StateBlocks`.
- Hook: `useCourtAvailability` — fetches availability and **polls every 8000 ms**
  with request-id race protection, `loading/success/error`, and `refresh`.
- Service: `bookingService` (`searchCourts`, `getCourtAvailability`,
  `getMyBookings`, `getBookingDetail`, `cancelBooking`) via `httpClient`.
- Utils: `formatCurrency` (VND), time/date helpers, `isCancellable`.
- Figma: P06–P18, P39, P60–P63.
- Not in scope / must follow config, not Figma copy: cancellation windows are
  config-driven (`PLAYER_CANCELLATION_DEADLINE_MINUTES`, default `0`) — the
  “trước 12 giờ” (P07) and “trước 6 tiếng” (P08) texts are placeholders and are
  mutually inconsistent; refunds return to the original payment method (no
  points/wallet); map view, smart-gate lock, and “InstantPay/Instant Booking”
  branding are not in the booking spec. See §9.4 and §10.

### 7.4 `features/admin`

- Governing spec: `docs/features/admin/{user-management,court-management,dashboard,report-management}/`
  (Ready) and `PROJECT-BRIEF.md` §4 (admin scope).
- Pages: `UserManagementPage`, `CourtManagementPage`, `AdminPlaceholderPage`
  (dashboard/tournaments/reports placeholders).
- Shell components: `AdminSidebar`, `AdminHeader` (breadcrumbs + debounced global
  search), `TablePagination`, `Toast`.
- User management: `UserMetricCards`, `UserFiltersToolbar`, `UserTable`,
  `UserManagementActions`, `CreateUserModal`, `UserDetailsModal`,
  `UserStatusModal`, `ResetPasswordModal`, `DeleteUserModal`,
  `GlobalSearchResults`; `adminUserService`, `types/user.ts`, `utils/excelExport.ts`.
- Facility/court management (`components/facility/`): `FacilityMetricCards`,
  `FacilityFiltersToolbar`, `FacilityTable`, `FacilityStatusModal`,
  `CreateFacilityModal`, `FacilityComplianceBanner`; `adminFacilityService`,
  `types/facility.ts`, `utils/facilityExcelExport.ts`.
- Global search: `adminGlobalSearchService` (`GET /api/v1/admin/global-search`).
- Figma: A01–A09, A15–A18 (in-scope canvases). **A10–A14 and A19 are in the
  “Restricted / Not Build” canvas** and are out of the MVP UI surface.
- Not in scope (Figma-only content, do not implement): KYC/CCCD verification
  (A02, A03), numeric FairPlay/“uy tín” scores (A02), System Configuration (A19),
  and admin booking/matchmaking management (A10–A13). See §9.4.

### 7.5 Target features not yet implemented

The following features have Ready PRDs/Tech Designs and Figma screens but no
`frontend/src/features/` code yet. When implemented they must follow the folder,
shared-layer, and design-system rules in this document:

| Feature | Target folder | Figma | Docs |
| --- | --- | --- | --- |
| Court Owner workspace | `features/court-owner/` | O01–O17 | `docs/features/court-owner/` |
| Matchmaking | `features/matchmaking/` | P19–P25, P47, P48, P64–P67 | `docs/features/matchmaking/matchmaking/` |
| Ratings | `features/ratings/` | P25 | `docs/features/matchmaking/ratings/` |
| Tournament | `features/tournament/` | P26–P73 | `docs/features/tournament/` |
| Player profile | `features/player/profile/` | P04, P44, P85 | `docs/features/player/profile/` |
| Payments/refunds UI | within Booking/Tournament | P12, P17, P18, P61–P63 | `docs/features/platform/payments-refunds/` |

Notes:

- The Court Owner frontend folder is standardized on `features/court-owner/`
  (reconciled 2026-10-10; `conventions.md` requires `features/<capability>/`).
- Matchmaking, Ratings, and Tournament specs explicitly exclude ELO/MMR and any
  ranking algorithm; the ELO/SmartMatch/ELO-seeding content in Figma is not in
  scope. Ratings is skill + attitude on a 1–5 scale only (no court/facility
  rating). Tournament seeding uses the current skill level, not ELO. Payments
  excludes wallet/stored balance and has no “escrow” concept. See §9.4.

## 8. Cross-Cutting Frontend Behavior

- **Async states:** every user-visible async flow defines loading, success, error,
  and empty states; do not show empty while loading (`conventions.md`).
- **Polling:** booking availability polls every 8s (spec window 5–10s). Polling
  must be scoped to an open view, cleaned up on unmount, treat server responses as
  authoritative, and never advance state client-side. Matchmaking spec: 5–10s;
  notifications spec: 30s. No polling library may be added.
- **Authorization:** UI guards shape UX only; server enforces access. Do not infer
  permissions from hidden controls.
- **Error codes:** branch on stable `error.code`, never on the human-readable
  `message`. Map codes to Vietnamese copy at the feature boundary.
- **Security:** never store the session token in browser storage; render
  user-controlled text safely (XSS); send CSRF on state-changing requests.
- **Formatting:** currency in VND, dates `dd/mm/yyyy` `vi-VN`, times and durations
  via feature utils.
- **Responsive:** breakpoints at 1024 / 960 / 768 / 480 px; desktop/mobile nav
  patterns (drawer for player and admin).
- **Accessibility:** modals trap focus and close on Escape (`useModalA11y`); error
  and status must be conveyed as text, not color alone; passwords are masked and
  never echoed back.
- **No new global dependency** without a documented `tech-stack.md` decision.

## 9. Figma Screen Inventory

Figma file **“Badminton SmashPro”**, organized into canvases. Screen-code prefixes:
`P##` = Player, `O##` = Court Owner, `A##` = Admin. The legacy `ALLL` canvas
contains earlier duplicates and should be treated as superseded by the
categorized canvases.

### 9.1 Player (`P`)

- Authentication & account: P01 Login, P02 Register, P03 OTP, P42 Account
  Settings, P43 Change Password, P44 Edit Profile, P76 Unauthorized.
- Notifications: P05 List, P45 Detail, P81 Empty.
- Courts: P06 Discovery, P07 Facility Detail, P08 Court Detail, P09 Select Date,
  P10 Select Time Slots.
- Booking: P11 Summary, P12 Pending Payment, P13 Confirmed, P14 Detail, P15
  Completed, P16 Cancelled, P17 Expired, P18 Refund Status, P39 History, P60
  Cancellation Confirmation, P61 Payment Failure, P62 Refund Processing, P63
  Refund Completed.
- Matchmaking: P19 Create, P20 Request Detail, P21 Waiting For Court, P22 Waiting
  For Confirmation, P23 Match Detail, P24 Cancelled/Expired, P25 Post-Match
  Rating, P47 Leave Confirmation, P48 Confirmation Detail, P64 Matching Activity,
  P65 Confirmation Timeout, P66 No Court, P67 Player Left.
- Tournament: P26 Discovery/List, P27 Detail, P28 Register Singles, P29 Register
  Doubles, P30 Invitation Received, P31 Bracket, P32 Match Detail, P33 Create
  (DRAFT), P34 Edit, P35 Manage Participants, P36 Generate Bracket/Seeding, P37
  Manage Matches/Results, P41 History, P49 Team Detail, P50 Invitation Pending,
  P51 Accepted, P52 Declined, P53 Expired, P54 Participant View, P55 Withdrawal,
  P56 Match Result, P57 Walkover, P58 Unresolved, P59 Completion, P68 Registration
  Success, P69 Registration Closed, P70 Ready, P71 Cancelled, P72 In Progress,
  P73 Completed.
- Activity / report / generic: P38 Submit Report, P46 Activity, P74 Report
  Success, P75 Report Error, P77 Empty, P78 Loading, P79 Error, P80 Search/Filter,
  P82 Booking Empty, P83 Matchmaking Empty, P84 Tournament Empty, P85 Profile
  Empty, P86 Session Error.

### 9.2 Court Owner (`O`)

O01 Dashboard, O02 Manage Facility, O03 Court List, O04 Pricing, O05 Booking
Monitor, O06 Booking Detail, O07 Owner Cancel Booking, O08 Profile/Account, O09
Facility Create, O10 Facility Edit, O11 Court Create, O12 Court Edit, O13 Pricing
Create, O14 Pricing Edit, O15 Booking Calendar, O16 Cancellation Result, O17
Permission/Error.

### 9.3 Admin (`A`)

In-scope canvases: A01 Dashboard, A02 User List, A03 User Detail, A04
Facility/Court List, A05 Facility Detail, A06 Tournament List, A07 Tournament
Detail, A08 Report List, A09 Report Detail, A15 User Status Confirmation, A16
Facility Status Confirmation, A17 Empty/Filtered, A18 Error/Permission.

“Restricted / Not Build” canvas (out of the MVP UI surface): A10 Booking
Management, A11 Booking Detail, A12 Matchmaking Requests, A13 Matchmaking Match
Detail, A14 Tournament Participant Management, A19 System Configuration.

### 9.4 Figma content not aligned with the authoritative specifications

The following Figma content conflicts with, or is not defined by, the
authoritative documents. It must **not** be implemented unless the owning
document is changed first (`.agents/AGENTS.md` §4, §11). “Exclude” means keep it
out of the UI; “scope decision” means a human must approve a scope change.

| Figma content | Screen(s) | Authority that governs | Handling |
| --- | --- | --- | --- |
| OTP email verification step | P03 | Auth Tech Design (email verification is a non-goal) | Exclude |
| Google / OAuth social sign-in | P01 | Auth PRD (social sign-in excluded) | Exclude |
| “Remember me” checkbox | P01 | Auth PRD Decision #11 (not offered) | Exclude |
| Forgot / reset password | P01, P43 | Auth Tech Design (email-based reset excluded) | Exclude (scope decision if wanted) |
| MFA / 2FA + device/session management | P42, P43 | Auth PRD (MFA excluded) | Exclude |
| “Token JWT” wording | P86 | `tech-stack.md` (opaque session, no JWT) | Exclude wording |
| Mandatory password character mix + password history | P43 | Auth PRD Decision #8 (no mandatory mix) | Follow spec |
| Wallet “SmashPay”, refund as “điểm” | P08, P86 | Payments PRD (wallet/stored balance excluded) | Exclude |
| Escrow / “ký quỹ” | O01, O07, O16, A10 | Payments docs (no escrow concept) | Exclude wording; use payment-hold terms |
| KYC / CCCD / eKYC identity verification | P42, A02, A03 | No spec defines it | Exclude |
| ELO / MMR, SmartMatch ranking, ELO-based seeding | P04, P20, P21, P25, P36, P40, P42, P44, P64 | Matchmaking PRD (ELO excluded), Ratings PRD (no ELO/MMR), business-rules §1.2 (skill-level catalog) | Exclude; use skill-level catalog + simple range matching |
| Court / facility rating | P25 | Ratings PRD, PROJECT-BRIEF §5 (Court rating out of MVP) | Exclude |
| Extra editable profile fields (gender, DOB, city, club, bio, dominant hand, jersey, style, racket) + email/phone editing | P42, P44 | Player Profile PRD (editable = `full_name` + avatar only) | Exclude |
| Numeric “FairPlay / uy tín / điểm cộng đồng” scores | P04, P42, P44, O01, A02 | No spec defines a numeric score | Exclude |
| Fixed cancellation windows (“trước 12 giờ”, “trước 6 tiếng”) | P07, P08 | business-rules §2.4/§8 (config-driven, default `0`) | Follow config |
| Tournament dispute / arbitration committee workflow | P58 | Tournament Tech Design (`UNRESOLVED`/`WALKOVER` states only) | Exclude (scope decision if wanted) |
| System Configuration | A19 | PROJECT-BRIEF §4; documentation-guide §2.4 (out of MVP) | Restricted / Not Build |
| Admin booking / matchmaking management | A10–A13 | PROJECT-BRIEF §4 (admin does not manage bookings/matchmaking) | Restricted / Not Build |
| Facility ranking “Kim Cương BWF” | O01 | Court-owner PRD (no ranking) | Exclude |
| Smart-gate lock, “InstantPay/Instant Booking”, map view | P06, P07, P08 | Booking PRD (not specified) | Exclude (scope decision if wanted) |

Session-timeout wording (P86 “30 ngày không tương tác”) is inaccurate: the
confirmed Player idle timeout is 7 days and the absolute maximum is 30 days
(`business-rules-config-matrix.md` §8.7).

## 10. Known Gaps and Divergences

These are observations to resolve via the owning documents; this document does not
unilaterally decide them.

1. **Two transport styles.** Auth/booking/player use the shared `httpClient`;
   `adminUserService`, `adminFacilityService`, and `adminGlobalSearchService`
   use hand-rolled `fetch` with duplicated CSRF/error helpers (and global search
   omits `credentials`). The convention is transport separation, not two clients.
   Tracked by `docs/features/admin/frontend-consolidation/tasks.md` (AF-02).
2. **Two visual themes.** The token-driven light “SmashPro” theme vs. hard-coded
   dark “glass” styling in auth and the owner placeholder. The design system
   (§6) is the light theme; alignment is a design decision.
3. **Placeholder routes.** `/` (home), `/matchmaking`, `/tournaments`,
   `/owner`, and most admin sections render placeholders while designed Figma
   screens exist. `PlayerHomePage.tsx` exists but is not routed.
4. **Admin shell composition.** Admin pages each compose the sidebar/header rather
   than using a router-level admin layout; converting to a layout route would
   reduce duplication. Tracked by `docs/features/admin/frontend-consolidation/tasks.md` (AF-03).
5. **Path/naming drift in feature docs (resolved 2026-10-10).** Feature tasks
   that prescribed `frontend/src/services/`/`frontend/src/hooks/` or
   `frontend/src/App.tsx` for route registration have been corrected to the
   feature-folder convention and `frontend/src/app/router.tsx` (C2).
   The Court Owner folder is standardized on `features/court-owner/` (C3).
6. **Design-token gaps.** There is no spacing scale token set (spacing is inline
   values), and a few Figma colors are not yet promoted to CSS variables.
7. **API response-shape drift (docs fixed 2026-10-10).** The Admin User
   Management Tech Design is aligned to the global `meta: { page, limit, total,
   totalPages }` shape, and the Admin court/report Tech Designs are aligned to
   the `/api/v1/` prefix. The backend `AdminUserService` and the admin frontend
   services still use the old `pagination` key; code alignment is tracked by
   `docs/features/admin/frontend-consolidation/tasks.md` (AF-01, AF-02).

## 11. Traceability

- Frontend technology and global constraints: `docs/architecture/tech-stack.md`.
- Coding/naming/API/testing conventions: `docs/architecture/conventions.md`.
- Feature behavior and state machines: `docs/features/<domain>/<feature>/prd.md`,
  `tech-design.md`.
- Auth/session/CSRF details: `docs/features/platform/authentication-authorization/tech-design.md`.
- Business rules and configuration: `docs/business-rules-config-matrix.md`.
- Figma design source: **“Badminton SmashPro”**, `fileKey D9NrjgxLpE066BcE5Sk8HD`.

## 12. How AI Agents Must Use This Document

Before changing UI code, an AI agent MUST:

1. Read this document together with `docs/architecture/tech-stack.md`,
   `docs/architecture/conventions.md`, and the relevant feature PRD/Tech Design.
2. Treat §9.4 as forbidden scope. If a Figma screen shows content listed there
   (ELO, OTP, 2FA, wallet/escrow, KYC, court rating, extra profile fields, etc.),
   exclude it and surface the conflict — do not implement it.
3. Reuse the shared layer (`http-client`, `RequireAuth`, `useModalA11y`,
   `DataTable`, `FilterToolbar`, `Icons`) instead of duplicating it.
4. Consume design tokens from `frontend/src/index.css` instead of hard-coding
   colors/radii/shadows, and match the Figma screen for the target feature.
5. Follow the feature-folder layout and the loading/success/error/empty state
   rules; do not add unapproved dependencies.
6. Update this document in the same session when an approved change alters routes,
   the shared layer, the design system, or the screen inventory
   (`docs/documentation-guide.md` no-doc-debt rule).

## 13. Change Log

| Date | Change | Approved by | Reference |
| --- | --- | --- | --- |
| 2026-10-10 | Initial consolidated frontend architecture and design-system document created from the Figma “Badminton SmashPro” file and the implemented `frontend/src/` code. | Pending human review | Figma `D9NrjgxLpE066BcE5Sk8HD`; `frontend/src/` |
| 2026-10-10 | Re-grounded the document in the authoritative specs: added §1.4 (Figma is a design reference, specs win), governing-spec references in the route map and feature map, corrected the Admin canvas scoping (A10–A14 **and A19** are “Restricted / Not Build”), and added §9.4 cataloguing Figma content that conflicts with approved scope. Added API response-shape drift to §10. | Pending human review | `PROJECT-BRIEF.md`, feature PRDs/Tech Designs, `docs/business-rules-config-matrix.md` |
| 2026-10-10 | Applied the C1–C3 documentation fixes: aligned Admin User Management pagination to `meta` and removed stale Bearer/JWT wording (C1); corrected frontend paths in feature tasks to `frontend/src/app/router.tsx` and feature folders (C2); standardized the Court Owner folder on `features/court-owner/` (C3). Grouped C5–C6 (and the C1 code follow-up) into `docs/features/admin/frontend-consolidation/` (tech-design + tasks AF-01…AF-03) and linked them from §10. | Pending human review | `docs/features/admin/frontend-consolidation/`, feature tasks |
