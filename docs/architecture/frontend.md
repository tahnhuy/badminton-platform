# Frontend Architecture & Design System

## Thư viện giao diện và cách tiếp cận thiết kế — Confirmed 2026-11-17

Người dùng đã xác nhận quyết định của nhóm và cho phép thực hiện D00 ngày 17/11/2026. Mục này và các quy tắc được cập nhật bên dưới thay thế hạn chế cũ về thư viện UI/CSS thuần. Nguồn quyết định công nghệ: `tech-stack.md`. Chỉ quyết định thư viện và phạm vi D00 được xác nhận; trạng thái Draft của các nội dung lịch sử chưa duyệt trong tài liệu không tự thay đổi. Shared docs vẫn cần review PR trước merge.

**1. Thư viện được phép**

| Nhu cầu | Thư viện | Quy tắc dùng |
| --- | --- | --- |
| Style | Tailwind CSS v4 (`@tailwindcss/vite`) | Viết style bằng class Tailwind. Không hard-code màu/khoảng cách; dùng token trong `@theme`. CSS thuần chỉ cho trường hợp Tailwind không làm được (ghi chú lý do). |
| Component | shadcn/ui trên Radix UI; `class-variance-authority`, `clsx`, `tailwind-merge` | Component sinh bởi shadcn đặt ở `src/components/ui/`, được sửa trực tiếp cho hợp thiết kế. Biến thể (variant) khai báo bằng `cva`; ghép class bằng hàm `cn()` ở `src/shared/utils/cn.ts`. Không tự viết lại dialog/menu/radio/tabs khi đã có bản Radix. |
| Icon | `lucide-react` | Chỉ dùng một bộ icon. Icon cầu lông đặc thù (cầu, sân) giữ trong `components/common/Icons.tsx`. |
| Chuyển động | `motion` | Chuyển bước/hiện ẩn khi có nhu cầu. Thời lượng 150–300 ms; CSS animation dùng cho hiệu ứng nhỏ, không cùng điều khiển thuộc tính với Motion. Luôn tôn trọng `prefers-reduced-motion` (`useReducedMotion` hoặc `MotionConfig reducedMotion="user"`). |
| Thông báo nổi | `sonner` | Một `<Toaster />` duy nhất ở `app/`; dùng cho phản hồi tạm thời, không thay cho thông báo lỗi ngay tại trường nhập. |
| Form | `react-hook-form` + `zod` | Mỗi form có một schema `zod` trong thư mục tính năng; wizard kiểm tra theo từng bước. Thông báo lỗi chọn theo `error.code` của API như hiện nay. |
| Dữ liệu từ server | TanStack Query | Một `QueryClient` duy nhất ở `app/`. Hàm gọi API vẫn đi qua `shared/api/http-client.ts` (CSRF, xử lý 401/403 giữ nguyên). Khóa truy vấn (query key) khai báo theo tính năng. Polling dùng `refetchInterval` theo khoảng thời gian trong `tech-stack.md`. Phiên đăng nhập vẫn do `AuthProvider` (React Context) quản lý. |
| Ngày giờ | `date-fns` | Dùng khi cần xử lý ngày; locale `vi` không thay quy tắc timezone `Asia/Ho_Chi_Minh`; giữ `Intl` nếu đã đủ. |
| Hiệu ứng | `canvas-confetti` | Tùy chọn cho màn kết quả đã có nghiệp vụ; dùng `disableForReducedMotion: true`, tải khi cần. |
| Biểu đồ | Recharts | Dashboard có API thật; lazy-load tại trang dùng; `react-is` khớp React đã cài. |

Vẫn **không** dùng: MUI, Ant Design, Chakra; CSS-in-JS; CSS Modules; Redux/Zustand hoặc thư viện state toàn cục khác.

**2. Vai trò của Figma**

Figma "Badminton SmashPro" là **tham khảo phong cách** (màu thương hiệu xanh, font Inter, bo góc, cảm giác chung), **không** bắt buộc khớp từng chi tiết bố cục. Nội dung ngoài phạm vi MVP trong Figma (§9.4) vẫn không được làm.

**3. Hệ thống thiết kế**

- Token (màu, font, bo góc, đổ bóng) khai báo một lần trong `src/index.css` bằng `@theme` của Tailwind, giữ giá trị hiện tại ở §6 làm điểm xuất phát (ví dụ `--color-brand: #006B2C`). Biến shadcn (`--primary`, `--background`, `--radius`…) ánh xạ sang các token này.
- Các trang được chuyển dùng token chung theo từng đợt. D00 kiểm tra layout Auth legacy hiện có; không làm lại các màn Auth đồng loạt.
- Mọi component mới phải đạt: điều khiển được bằng bàn phím, focus nhìn thấy được, vùng bấm tối thiểu 44 px, không dùng màu làm tín hiệu duy nhất.

**4. Cấu trúc thư mục bổ sung**

```text
frontend/src/
├── components/
│   ├── ui/            # component shadcn/ui (sinh bằng CLI, project sở hữu và sửa)
│   └── common/        # component dùng chung khác (DataTable, FilterToolbar, Icons…)
├── shared/utils/
│   └── cn.ts          # cn() = clsx + tailwind-merge
└── app/
    └── providers.tsx  # QueryClientProvider, MotionConfig, Toaster (cùng AuthProvider)
```

**5. Kế hoạch chuyển đổi**

**Ràng buộc người dùng nhắc lại 19/11/2026: chỉ thay giao diện, không đổi logic hoạt động.** Giữ luồng, validation/giá trị mặc định, điều hướng, quyền/phiên, điều kiện thao tác, dữ liệu và API/request behavior. Tách component/hook trình bày được phép khi hành vi không đổi; không dùng đợt UI để thay data layer hoặc sửa lỗi nghiệp vụ. Các thay đổi vượt UI đã có ở D02/D03/SH01 được phân biệt trong kế hoạch §2.1 và lịch sử; không tự hoàn tác hoặc coi đó là quyền mở rộng các đợt sau.

Các trang hiện có đã chứa nhiều luồng nghiệp vụ. Chuyển theo `plans/refactor_FE_add_lib/frontend-modernization-review-plan.md`: **D00 cập nhật tài liệu, kiểm kê/cài bổ sung và kiểm chứng nền; D01 chỉ trang đăng nhập sau khi D00 hoàn tất và người dùng xác nhận.** Người dùng cho phép triển khai tuần tự các đợt đã có ngày 19/11/2026: phân tích → triển khai UI → cleanup → kiểm chứng → cập nhật trạng thái → commit từng đợt → làm đợt kế tiếp; review tổng hợp cuối cùng. Nền/component bổ sung theo trang; không làm UI kit/shell hoặc Query migration toàn ứng dụng trước. Giữ legacy CSS cho consumer chưa chuyển; xóa selector sau khi consumer cuối đã chuyển. Không bắt khảo sát AUTH-31 hoặc backend chưa sẵn sàng chặn các trang đã có contract.

Từ D02, mỗi đợt bắt đầu bằng bước rà soát hiện trạng (plan §2.2, xác nhận 18/11/2026): rà soát UI/hành vi ngắn từ góc độ người dùng và thiết kế, ghi phạm vi/tiêu chí trước khi triển khai. Từ 19/11/2026 dùng báo cáo gọn, kiểm tra responsive 390/1280 px nhưng chỉ chụp ảnh khi cần và lưu kết quả chạy ngoài Git; quy tắc hiện tại ở kế hoạch §2. Theo ủy quyền mới ngày 19/11/2026, không cần dừng xin duyệt thường lệ; chỉ hỏi khi gặp blocker/quyết định chưa rõ hoặc cần đổi hướng/phạm vi. Không tự push.

**Quy tắc nền và dữ liệu:**

- Alias `@/*` → `src/*` ở TypeScript và Vite; shadcn utils alias trỏ `@/shared/utils/cn`.
- Layer thứ tự `theme, base, legacy, components, utilities`; CSS cũ trong `legacy`, không thêm rule mới vào đó. Preflight có thể ảnh hưởng heading/list/image; phải kiểm tra trang cũ và focus, không coi layer là bảo đảm giao diện giữ nguyên.
- Một QueryClient; feature queries tiếp tục gọi `http-client`. Trước khi cache dữ liệu riêng, triển khai account-scoped keys, cleanup khi logout/đổi phiên, cancellation và invalidation. D00 chỉ kiểm tra providers hiện có, chưa chuyển feature.
- Retry chỉ lỗi mạng/5xx có thể phục hồi, không retry 401/403/abort/lỗi lập trình; mutation không tự retry. CSRF refresh một lần thuộc HTTP client. Chọn freshness/polling theo feature; Social không thêm fixed polling và Messaging giữ WebSocket/catch-up.
- Một Toaster cho thao tác tạm thời; field errors ở form. AuthProvider tiếp tục quản lý auth state; không đồng nhất auth context với server session storage.
- Màn mới dùng giao diện sáng và project tokens; chưa triển khai dark mode. Các màn cũ giữ cách trình bày hiện có đến đợt của chúng. Reduced-motion áp dụng cả CSS và hiệu ứng ngoài Motion.
- Chỉ tạo primitive có consumer. Chưa có `components/ui/` không chặn nghiệm thu D00; primitive trang đăng nhập thuộc D01.

---

## Ảnh hưởng UI ngày 2026-11-08 — 2026-11-08

UI working tree dùng Chốt kèo cho Singles/Doubles/GROUP, nút host loại thành viên và tạo/mở nhóm chat; Kèo của bạn gồm cả host và thành viên. Các nút tự rút/loại phải bị vô hiệu hóa sau thanh toán booking thành công, đồng thời backend bắt buộc kiểm tra; phần này chưa triển khai. Giữ đánh giá kỹ năng/thái độ để tham khảo, bỏ thông điệp nâng trình từ rating; bổ sung thành tích giải chuyên nghiệp trên Social/profile. Thiết kế UI ví và hai loại giải còn TBD. Palette bổ sung theo index.css: info #1D4ED8, success #006B2C, caution #8A5A00 cùng các nền/hover tương ứng; không coi là thay đổi Figma đã được xác nhận.

---

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
- Figma is a style reference for brand, typography and visual language; pixel-for-pixel layout matching is not required. Feature behavior and scope remain governed by the specifications.

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
| Real-time | HTTP polling 5–10s (booking/monitoring); in-app notification polling; Messaging: WebSocket `/api/v1/ws/messaging` + REST `afterSeq` catch-up (2026-11-01) | `tech-stack.md`, Messaging Tech Design §7.7 |
| E2E tests | Playwright under `frontend/e2e/` | `tech-stack.md`, `conventions.md` |
| Lint | `oxlint` | `frontend/.oxlintrc.json`, `frontend/package.json` |

The frontend libraries confirmed in `tech-stack.md` are allowed. Do not add CSS Modules, CSS-in-JS, MUI/Ant Design/Chakra, or an application-wide Redux/Zustand store. Auth state stays in React Context; Query owns only server resources explicitly migrated to it. Installing a dependency is not completion of its consumers or a reason to rewrite working hooks.

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
│   │   ├── ui/               # shadcn/Radix primitives, added when used
│   │   └── common/           # shared composed UI and legacy adapters
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
│   └── main.tsx              # entry: StrictMode → AppProviders → RouterProvider
├── index.html                # lang="vi", title "SmashPro - Badminton Platform"
├── vite.config.ts
├── playwright.config.ts
└── .env.example              # VITE_SUPPORT_CONTACT
```

Rules:

- Feature code lives under `frontend/src/features/<capability>/` (UI, hooks, API
  clients, feature state).
- Route composition and application-wide providers live in `frontend/src/app/`.
- New shadcn/Radix primitives live in `frontend/src/components/ui/`; shared composed UI and compatibility wrappers live in `components/common/`. Keep DataTable/FilterToolbar feature-agnostic.
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

`main.tsx` composes `StrictMode` → `AppProviders` → `RouterProvider`. `AppProviders` owns QueryClientProvider, MotionConfig, AuthProvider and one Sonner Toaster; auth remains in AuthProvider.
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
| `/` (index) | `PLAYER` + `PlayerLayout` | Redirect to `/feed` (SH01) | P04 reference only | Approved SH01 landing; dedicated home/dashboard remains deferred |
| `/profile` | `PLAYER` + `PlayerLayout` | `PlayerProfilePage` + shared live `ProfileProvider` | P44, P04/P85 adaptations | Player Profile PRD §9.1/§9.3, Tech Design §9.0; real name/avatar, unavailable aggregates |
| `/courts` | `PLAYER` | `CourtSearchPage` | P06 (facility P07) | `docs/features/booking/player-booking/` |
| `/courts/:courtId` | `PLAYER` | `CourtDetailPage` | P08 / P09 / P10 | same |
| `/bookings` | `PLAYER` | `MyBookingsPage` | P39 | same |
| `/bookings/:bookingId` | `PLAYER` | `BookingDetailPage` | P14 | same |
| `/matchmaking` | `PLAYER` | `MatchmakingPage` (my requests + create) | P19, P20, P24 | `docs/features/matchmaking/matchmaking/` |
| `/matchmaking/requests/:requestId` | `PLAYER` | `MatchmakingRequestDetailPage` (candidates + invitations) | P20, P64 | same |
| `/matchmaking/invitations` | `PLAYER` | `MatchmakingInvitationsPage` (received/sent) | — | same |
| `/matchmaking/matches` | `PLAYER` | `MyMatchesPage` (paginated list) | P23 | same |
| `/matchmaking/matches/:matchId` | `PLAYER` | `MatchDetailPage` (leave; owner booking link) | P23, P47, P67 | same |
| `/tournaments` | `PLAYER` | `PlayerPlaceholderPage` | P26/P27… | `docs/features/tournament/` |
| `/owner` | `COURT_OWNER` + `OwnerLayout` | `OwnerDashboard` | O01 | `docs/features/court-owner/` |
| `/owner/facilities` | `COURT_OWNER` | `OwnerFacilityPage` (submission/edit/resubmit/reviews) | O02/O03/O09–O12 | same |
| `/owner/pricing` | `COURT_OWNER` | `OwnerPricingPage` (one court, explicit pricing ID) | O04/O13/O14 | same |
| `/owner/schedule` | `COURT_OWNER` | `OwnerSchedulePage` (day calendar, maintenance, history/detail) | O05/O06/O15 | same; cancellation CO-05/CO-08 remains blocked |
| `/owner/account` | `COURT_OWNER` | `OwnerAccountPage` (existing Auth identity/actions) | O08 | same |
| `/profile/contact` | `PLAYER` + `PlayerLayout` | `PlayerContactPage` (optional private phone) | PP-07 | `docs/features/player/profile/` |
| `/admin` | `ADMIN` | `<Outlet/>` → redirect to `/admin/users` | — | — |
| `/admin/users` | `ADMIN` | `UserManagementPage` | A02 (A03, A15) | `docs/features/admin/user-management/` |
| `/admin/courts` | `ADMIN` | `CourtManagementPage` | A04 (A05, A16) | `docs/features/admin/court-management/` |
| `/admin/courts/:facilityId/reviews` | `ADMIN` | `FacilityReviewPage` (onboarding/address decisions and history) | CM-05 | `docs/features/admin/court-management/` |
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

`getRoleHomePath(role)`: `ADMIN → /admin`, `COURT_OWNER → /owner`, `PLAYER → /feed` (SH01, human-approved 2026-11-18). The Player index `/` redirects to `/feed`. Used after sign-in/registration and by return-home links. Successful password change follows the separate D02 sign-out/sign-in flow.

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
  body scroll, trap focus, and focus the dialog. Keep it for legacy dialogs. New Radix dialogs use Radix focus handling; do not attach two focus traps.
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

Figma “Badminton SmashPro” provides style references. Runtime tokens live in `frontend/src/index.css`: `@theme static` emits brand/font/radius/shadow values, base `:root` retains surfaces/legacy names, and `@theme inline` maps shadcn semantic colors. New UI uses the shared tokens/scale rather than hard-coded design values; the palette below is the starting point.

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

D00 browser smoke (2026-11-17) renders the existing Sign-in/Register/Change-password in the light token palette. Earlier dark-glass observations are historical. These pages still use legacy `.auth-*` components; D01 will migrate Sign-in only.

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
- **Modals:** new dialogs use shadcn/Radix; legacy dialogs keep `useModalA11y` until migrated. Preserve focus return/busy behavior; confirm destructive
  actions; disable double-submit.
- **Toasts:** new transient feedback uses the single Sonner Toaster; migrate existing admin Toast consumers only in their batch.
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
  (Ready); notifications by `docs/features/platform/notifications/` (Ready; in-app polling).
- Shell: `PlayerLayout`, `PlayerHeader`, `PlayerBottomNav`, `PlayerFooter`; five working areas: Courts / Matchmaking / Community / Messages / Ratings. Desktop navigation starts at 1024 px; smaller screens use the five-tab bottom navigation. `nav-tabs.ts` is the single source for labels, icons and active-area mapping. `PlayerSidebar` was removed.
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

The following target features have Ready PRDs/Tech Designs and Figma screens.
Except for the implemented Matchmaking hosts noted below, their feature code is pending. When implemented they must follow the folder,
shared-layer, and design-system rules in this document:

| Feature | Target folder | Figma | Docs |
| --- | --- | --- | --- |
| Court Owner workspace | `features/court-owner/` | O01–O17 | `docs/features/court-owner/` |
| Matchmaking (implemented hosts; Ratings integration pending) | `features/matchmaking/` | P19, P20, P23, P24, P25, P47, P64, P67 | `docs/features/matchmaking/matchmaking/` |
| Ratings (implemented; Tournament host integration pending) | `features/ratings/` | P25 | `docs/features/matchmaking/ratings/` |
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
- Matchmaking is invitation-only (2026-10-10): the UI has no automatic-matching,
  “waiting for court” (P21/P66), or separate player-confirmation
  (P22/P48/P65) screens. Candidate browsing, the invitation inbox, and the
  request-owner booking-link flow are the primary screens. Match detail shows
  the booked court, price, and payer once the owner links a booking.
  This describes the implemented scope and is superseded at the business level by the approved Social
  Matchmaking extension (see below).
- Social Matchmaking and Messaging — business scope and technical targets were
  approved in Phase 1/2 (2026-10-31). The subsequent Figma audit verified
  `PLAYER — Social` (99:2) and `PLAYER — Messaging` (99:3), including desktop,
  mobile, state galleries, components and report evidence references. See the
  end-of-document "Social and Messaging — Figma alignment review" for exact
  node-to-task mapping and exclusions; these new screens have names/node IDs,
  not assigned P## codes. The route table in the Phase 2 plan remains proposed.
  Online/typing use WebSocket + REST per `tech-stack.md` (updated 2026-11-01; the earlier polling decision is superseded); Profile PRD §15
  supersedes the older exclusion of area/play style/bio. The new report-evidence
  panel is a narrow reference to compose into A08/A09, not a complete new Admin
  screen. The registration survey is outside this Social/Messaging canvas audit.

## 8. Cross-Cutting Frontend Behavior

- **Async states:** every user-visible async flow defines loading, success, error,
  and empty states; do not show empty while loading (`conventions.md`).
- **Polling:** booking availability polls every 8s (spec window 5–10s). Polling
  must be scoped to an open view, cleaned up on unmount, treat server responses as
  authoritative, and never advance state client-side. Matchmaking spec: 5–10s;
  notifications spec: 30s. Migrated consumers may use Query `refetchInterval`; remove the old timer for that consumer. Do not change intervals merely to match a library default.
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
- **Accessibility:** modals manage focus/Escape through Radix for new UI or `useModalA11y` for legacy UI; error
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

The additional `PLAYER — Social` / `PLAYER — Messaging` pages reviewed on
2026-10-31 use named frames rather than P## identifiers. Their exact frame,
component and task mapping is in "Social and Messaging — Figma alignment review"
at the end of this document; do not reuse legacy P19/P20 automation as the new
Social behavior.

### 9.2 Court Owner (`O`)

O01 Dashboard, O02 Manage Facility, O03 Court List, O04 Pricing, O05 Booking
Monitor, O06 Booking Detail, O07 Owner Cancel Booking, O08 Profile/Account, O09
Facility Create, O10 Facility Edit, O11 Court Create, O12 Court Edit, O13 Pricing
Create, O14 Pricing Edit, O15 Booking Calendar, O16 Cancellation Result, O17
Permission/Error.

Court Owner composition approved 2026-10-23: O05/O15 implement one calendar workspace with history access; O06 is its booking-detail panel; O07/O16 are cancellation and result modal/panel states. Screen codes remain references to original Figma frames, not separate required routes. Include UNAVAILABLE causes, tournament reservation context, owned booking history/current refund status, resubmission/rejection history and approved/proposed address review states per Owner PRD §8.1. One whole-block unlock by ID, independent 90-day maintenance horizon. Actual Figma alignment is reviewed separately; this mapping does not claim the canvas has been updated.

Court Owner Figma alignment F01–F24 approved as **A** by the human owner on 2026-10-23. Governing scope: `docs/features/court-owner/prd.md` §8.2/§14.2; technical UI/data boundaries: its Tech Design §9.8; source-node evidence: [Court Owner Figma review](../features/court-owner/frontend-figma-review.md). The canvas remains unmodified by this documentation decision.

- O01 minimal owned-resource workspace; no analytics/AI/financial projections. O08 read-only current account using existing Auth identity/actions, no separate profile editor.
- O02/O03/O09–O14 use approved facility/court/pricing fields and explicit submit/save. Include pending/rejected/review/resubmit and address-proposal states; no persisted draft, media upload, interactive map, structured equipment/legal forms or Owner moderation controls.
- O04/O13/O14 price one court by time/date intervals; no inherited/versioned shared price lists, bulk apply or weekend/holiday/tier engine. Snapshot at booking creation, including unpaid holds.
- O05/O15 one day view with history; O06/O07/O16 detail/cancel/result panels. Include availability causes, current refund state, tournament restrictions, maintenance form, full scoped contact, multi-facility selection, loading/empty/error/retry. No week/month/export/PDF, Owner booking creation, recurring/multi-court sessions, check-in/chat/IoT/live score.
- All Owner screens exclude escrow/wallet/payout, voucher/SMS/Zalo/push/email workflows, numerical reputation/BWF certification, automatic cancellation-rate suspension, eKYC/MFA/role switch and fabricated support details. Configured platform policy is not Owner-editable; use real backend eligibility instead of Figma sample limits.

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
| Extra editable profile fields (gender, DOB, city, club, bio, dominant hand, jersey, style, racket) + email/phone editing | P42, P44 | Player Profile PRD (editable = `full_name` + avatar only) | Exclude; area, play style and bio confirmed for the Ready Profile PRD §15 (2026-10-31) and are included in the approved business scope; UI implementation remains pending |
| Numeric “FairPlay / uy tín / điểm cộng đồng” scores | P04, P42, P44, O01, A02 | No spec defines a numeric score | Exclude |
| Fixed cancellation windows (“trước 12 giờ”, “trước 6 tiếng”) | P07, P08 | business-rules §2.4/§8 (config-driven, default `0`) | Follow config |
| Tournament dispute / arbitration committee workflow | P58 | Tournament Tech Design (`UNRESOLVED`/`WALKOVER` states only) | Exclude (scope decision if wanted) |
| System Configuration | A19 | PROJECT-BRIEF §4; documentation-guide §2.4 (out of MVP) | Restricted / Not Build |
| Admin booking / matchmaking management | A10–A13 | PROJECT-BRIEF §4 (admin does not manage bookings/matchmaking) | Restricted / Not Build |
| Facility ranking “Kim Cương BWF” | O01 | Court-owner PRD (no ranking) | Exclude |
| Smart-gate lock, “InstantPay/Instant Booking”, map view | P06, P07, P08 | Booking PRD (not specified) | Exclude (scope decision if wanted) |

Court Owner-specific additions to the exclusion inventory (approved 2026-10-23):

| Figma content | Screen(s) | Authority | Handling |
| --- | --- | --- | --- |
| Revenue/occupancy analytics, AI pricing and projections | O01/O03/O04/O13/O14 | Owner PRD §8.2, F19 | Exclude; minimal workspace only |
| Wallet, escrow, bank setup, payout and instant-refund receipt claims | O01/O06–O08/O16 | Owner PRD §8.2, F01–F02 | Actual payment/refund state only |
| Weekend/holiday multipliers, court tiers, inherited price-list versions, bulk pricing | O04/O13/O14 | Owner PRD §8.2, F10–F12 | Per-court intervals and booking-creation snapshots |
| Publish-now, operational toggles, coupled cancel-and-lock, Owner policy overrides | O03/O09–O12/O07 | Owner PRD §8.2, F04–F07 | Admin review, separate interval lock, effective platform policy |
| Draft/autosave, technical/legal catalogs, uploads and interactive maps/Google Business | O02/O09–O14 | Owner PRD §8.2, F08–F09/F13 | Approved fields/explicit saves only |
| Week/month/export, PDF, offline/recurring/multi-court booking, check-in/chat/IoT/live score | O01/O05/O06/O15 | Owner PRD §8.2, F14/F16–F18 | Single-day calendar/history/detail only |
| eKYC/MFA/role switch, facility rating/certification and automatic suspension thresholds | O08/O01/O07/O16/O17 | Owner PRD §8.2, F20–F21/F24 | Read-only Auth identity, actual Admin status |
| Voucher and external-channel promises; sample hotline/email/SLA/technician | O02/O07–O09/O16/O17 | Owner PRD §8.2, F03/F24 | In-app event and confirmed support details only |

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
2. **Legacy Auth components.** Register still uses AuthLayout/AuthAlert and their remaining legacy rules. Sign-in (D01), Change-password, Access-denied and session loading (D02) have been migrated; do not remove Register consumers or reopen accepted Auth batches while finishing SH01.
3. **Placeholder routes.** `/tournaments`,
   and some admin sections render placeholders while designed Figma
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
3. Reuse `http-client`, `RequireAuth`, DataTable and FilterToolbar. New primitives use `components/ui/`; retain legacy modal/icon adapters until consumers migrate. Prefer lucide for generic icons; keep badminton-specific SVGs. Do not combine Radix and legacy focus traps.
4. Consume design tokens from `frontend/src/index.css` instead of hard-coding
   colors/radii/shadows. Use Figma as a style reference within approved feature behavior; review the selected page design before extending it to another page.
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

## Matchmaking readiness alignment — approved 2026-10-10

Human owner approved invitation-only implementation refinements and Ready status.
Use city/district selection, name search, include-out-of-range skill warnings;
never require online/ACTIVE invitee presence. Invitation views show request
context; accepted members can view partial-group progress and withdraw before
formation. Request detail access includes current accepted members. Show booked
start/end, payer and pending-court deadline. Court outside preferred area is
allowed; enforce backend date/window/duration decisions through feedback. Show
booking cancellation/refund progress to owner and effective cancelled states.
Platform notification APIs are owned by platform/notifications; no new polling
library. Matchmaking views never include Tournament Matches.

## Ratings implementation alignment — approved 2026-10-15

The human owner approved the Ratings review (Ratings PRD §15 / Tech Design §23). Reusable UI/hooks/services live in `features/ratings/`; casual host pages remain in `features/matchmaking/`, Tournament host pages in `features/tournament/`. Matchmaking code now exists; the older §7.5 “not yet implemented” label for Matchmaking is historical. Ratings, Profile and Tournament target behavior must be checked against actual code before implementation.

- P25 uses the two required 1–5 dimensions and optional comment only. Show pending participants and caller-only read-only submitted ratings; subset submission is allowed. Duplicate acknowledgement is success; all-rated state retains viewing access.
- Casual Match Details/History and Tournament participant Match Detail (P32) each host the component. Tournament walkover/unresolved/no-result excludes submission. Missing Tournament host is an explicit dependency, not permission to use casual-only endpoints.
- Add `/ratings/given` under the existing Player layout/navigation for immutable ratings-given history (RT-07). App router owns route registration; domain-aware match links must not point Tournament IDs at casual pages.
- Admin User Detail includes read-only given/received ratings and automatic skill history (RT-08), using shared tables/pagination. No new moderation/manual skill editing UI.
- Other-Player aggregate threshold and inactive-target restrictions are enforced by Ratings backend; Profile preserves its display threshold on own views too. Never display masked values or reconstruct them from distributions.
- Follow existing Vietnamese copy, focus trap/Escape modal behavior, CSRF/auth and safe comment rendering. No new global dependencies.

This is an architecture/route mapping of approved feature behavior; PRD and Tech Design remain the behavior/API authorities. No code completion is implied.


Ratings audit, 2026-10-15: reusable modal/history and Admin oversight panels are implemented and verified by 12 browser tests, including a real signed-in API/database flow. Pending/all-rated actions in casual Detail/History follow server state; Admin tables reuse DataTable. Tournament host integration remains blocked (RT-05). See Ratings tasks.md for verification and the corrected E2E database-isolation runner.

| 2026-10-23 | Court Owner review recommendations 1–14 approved by human owner: calendar/detail/result composition and required review/history/availability states synchronized with Owner PRD §14.1. | Teammate PR review pending for shared-doc changes | `docs/features/court-owner/` |

Court Owner Figma decision record, 2026-10-23: human owner approved F01–F24 all A; §9.2/§9.4 synchronized with feature PRD/Tech Design/Tasks. Shared-document teammate PR review remains pending; canvas/code alignment is not complete.

2026-10-23 approved phone slice PP-07: Player `/profile/contact` is a session/PLAYER guarded contact-only page; registration optionally accepts phone. Phone is editable/clearable privately, never added to public Player cards. This supersedes the phone-edit exclusion only for the approved optional contact; other excluded profile fields remain excluded. Owner reads actual optional phone within owned-booking detail.

Court Owner uses shared `useApiResource` for abortable scoped reads and optional polling. A facility change remounts scoped content and clears prior details; polling within the same scope preserves form input. Facility selection is kept in the `facilityId` query parameter.

### Profile implementation delivery note — 2026-10-19

Player Profile lives under `frontend/src/features/player/profile/`. `/profile` now uses the real identity API; `PlayerProfileLayout` mounts ProfileProvider once for all Player routes, keyed by account id, so the header and page share saved name/avatar/skill. Header uses neutral fallbacks instead of email-derived names or fabricated ranks. Root `/` remains the original home placeholder. Missing Ratings/statistics capabilities are explicit nullable API sections and render unavailable states, not sample/zero data. Validated avatar upload is enabled and updates shared page/header state immediately; name-only PATCH results merge only the name so concurrent avatar updates are preserved. The backend serves read-only `/uploads` assets, and Vite proxies `/uploads` to the backend. The former preview provider was removed. Public profile modal entry points are wired into Matchmaking candidates, partial-group members, invitation counterparts and match rosters via PlayerProfileButton; focus returns on close. Tournament entry points remain pending. Original Figma P44 assets remain local. Shared HTTP client preserves FormData boundaries and existing JSON/cookie/CSRF behavior; live identity/avatar/Matchmaking tests use dedicated configs/ports and `badminton_test`. See `docs/features/player/profile/tasks.md` for full delivery status.

## Phase 1 business review — Ready, 2026-10-31

The human owner approved the Phase 1 business changes in this document after review. This approval covers the Social Matchmaking/Messaging changes only; it does not approve unrelated Draft content, new routes, schema, API, technology, or implementation. The affected technical documents and Tasks must be updated before implementation.

## Social Matchmaking and Messaging frontend plan — Draft (Phase 2, 2026-10-31)

Status: Draft. Governing documents: Social and Messaging PRD/Tech Design, Matchmaking Tech Design §24. Figma was not reviewed during Phase 2. A subsequent read-only audit on 2026-10-31 verified the new pages and mapping below; no new P## screen codes are assigned.

| Area | Feature folder | Routes and approval | Notes |
| --- | --- | --- | --- |
| Feed, composer, post detail, comments, reactions | `features/social/` | `/feed`, `/posts/:postId` — approved by human owner 2026-11-01 | Refresh on demand and on page visibility; no fixed polling; existing `/` retained |
| Match-finding creation/management, applicants, early close, court | `features/matchmaking/` (existing) | Existing `matchmaking/*` routes extended | Booking-link and "cancel booking" actions hidden while MM-19/MM-20 are BLOCKED |
| Conversations, Global Chat Dock, block list | `features/messaging/` | `/messages`, `/messages/:conversationId`, `/settings/blocks` + Global `MessagingProvider` & `GlobalChatDock` in `PlayerLayout` (Approved 2026-11-01) | Persistent Player-wide WebSocket (`/api/v1/ws/messaging`) with REST `afterSeq` + `unread-summary` catch-up on reconnect (`tech-stack.md`, Messaging Tech Design §7.7, updated 2026-11-01); draggable right-edge chat bubble (`useDraggableBubbleOffset`, persisted in `localStorage`) + floating `380×540px` compact chat window on every Player page with expand-to-`/messages` toggle; header unread badge |
| Registration survey | `features/auth/` | `/register` | Renders the backend survey definition; handles `AUTH_REGISTRATION_FORM_OUTDATED` |
| Profile fields | `features/player/profile/` | `/profile` | Area, play style, bio |
| Moderation | `features/admin/` | `/admin/reports` | Evidence view; hide actions |

Shared needs: an authorized media component (images inline, files as downloads) in `components/common/`; a polling hook in `shared/hooks/` only if the matchmaking hook is generalized for a polling consumer (no duplicate per feature; Messaging uses WebSocket, not polling). The two Social routes in the table are approved; other route approvals retain their own status.

Messaging is standalone (2026-11-01): Social/Matchmaking screens never create, sync or lock a group conversation as a side effect of recruitment. A "create group" shortcut that calls `POST /api/v1/conversations/group` is optional (`PROJECT-BRIEF.md` §3.4) and is deferred from SOC-08/MM-29 by human approval on 2026-11-01. Players create groups explicitly in Messaging.


## Social and Messaging — Figma alignment review, 2026-10-31

**Scope:** frontend documentation and Tasks only, requested by the human owner. No UI code or canvas changed. The existing Draft status of this global document and approval requirements for the proposed routes above are unchanged. Ready PRDs/Tech Designs remain the behavior authority.

**Evidence:** read the two pages, all top-level frames, nested text, component/variant IDs and prototype reactions; visually inspected desktop feed and direct conversation screenshots. Desktop screen frames are 1280px wide; the four mobile frames are 390px. There are 11 Social UI/reference frames plus a handoff frame, and 9 Messaging frames. No prototype reactions were found in these frames; the handoff explicitly says the eight journeys are static. Do not claim a runnable prototype or implemented frontend.

### Social screen-to-task mapping

| Figma reference | UI composition / owner | Implementation task |
| --- | --- | --- |
| [Bảng tin cộng đồng](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43349) | Three columns: filter rail, feed/composer entry, own-profile/hosted-kèo side rail. Collapse to one column on mobile. | SOC-08 |
| [Chi tiết bài chia sẻ](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43550) | Body/images, reaction picker, flat comments and author profile/message entry. | SOC-08; profile integration PP-09; reports RP-08 |
| [Tạo bài tìm kèo](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43701) | Social content composer combined with Matchmaking fields and card preview; not a second creation API. | SOC-08 + MM-29 |
| [Chi tiết kèo — Người chưa tham gia](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-43891) | Same post detail composed with viewer-specific recruitment projection/actions. | SOC-08 + MM-29 |
| [Chi tiết kèo — Chủ kèo chưa công khai](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44007) | Invitation before publication, acceptance and slot count variants and publish; automatic group-chat entry is superseded. | MM-29 |
| [Quản lý người tham gia](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44134) | Host-only applicants/invitations/members, warning/approval, early close and errors; public profile modal reused. | MM-29 + PP-09 |
| [Social — Trạng thái & hộp thoại](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44308) | Create/edit composer, failed upload, deletion, pending/invited/member/ended, withdrawal, gates and quota overlays; gallery is not a product page. | SOC-08 + MM-29 |
| [Social — Báo cáo & evidence](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44643) | Shared Player report dialog; Admin evidence is a separate role-protected composition. | RP-08 (Player) + RP-07 (Admin) |
| [Social — Components](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-44860) | Native component/variant reference, not an application route. | SOC-08 + MM-29 |
| [Mobile — Bảng tin](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45192) | 390px feed; controls and cards reflow without horizontal overflow. | SOC-08 / SOC-09 |
| [Mobile — Chi tiết kèo](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45274) | 390px post detail with role-aware recruitment actions. | SOC-08 + MM-29 / SOC-09 |

### Messaging screen-to-task mapping

| Figma reference | UI composition / owner | Implementation task |
| --- | --- | --- |
| [Tin nhắn — Chưa chọn hội thoại](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45354) | Conversation list plus empty selection panel. | MSG-09 |
| [Hội thoại cá nhân](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45426) | Two-column workspace, history, composer, presence and contextual menus. Menus shown below the frame are reference states. | MSG-09 |
| [Nhóm chat — Giao lưu](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45582) | Standalone group workspace (`title` + `ACTIVE` members), adding members, and leaving group (`LEFT`). Since 2026-11-01 the group is standalone: its roster is conversation membership, not synced from the kèo. | MSG-09; optional group shortcut deferred from SOC-08/MM-29 |
| [Người đã chặn](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45764) | Block list, confirmation and empty state. | MSG-09 |
| [Messaging — Trạng thái & hộp thoại](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-45821) | Attachment validation/preview, retry, leave group (`LEFT`), block, connection and feature-gate states. The grace/read-only and revoked variants are superseded (no 24-hour lock, no `REVOKED` state; 2026-11-01). | MSG-09; reporting RP-08 |
| [Nhóm chat — Chỉ đọc](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46232) | Reference for disabled-composer state (used when `MESSAGING_ENABLED = false`, group is locked by owner, or counterpart is locked/deleted; group chats do not auto-lock after 24 hours per 2026-11-01 decision). | MSG-09 |
| [Messaging — Components](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46361) | Native component/variant reference, not an application route. | MSG-09 |
| [Mobile — Danh sách hội thoại](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46712) | 390px list without an empty desktop conversation panel. | MSG-09 / MSG-10 |
| [Mobile — Hội thoại](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46751) | 390px conversation with back navigation preserving list/selection state. | MSG-09 / MSG-10 |

Handoff: [Bàn giao — Social & Messaging](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=99-46819). It documents eight journeys, account identities, slot/chat counts and timeline variants. It is documentation, not another user-facing screen.

### Reuse and integration boundaries

- Social native references: `FreePostCard` 99:47318, `MatchPostCard` 99:47333, `SkillBadge` 99:47334, `RecruitmentStatus` 99:47335, `SlotCounter` 99:47350, `CommentRow` 99:47351, `CommentComposer` 99:47352, `ImageGrid` 99:47353. Applicant/invitation/member rows belong to Matchmaking UI.
- Messaging native references: `ConversationRow` 99:47422, `MessageBubble` 99:47423, `MessageComposer` 99:47434, `AttachmentCard` 99:47435, `ReadOnlyBanner` 99:47452, `AccessUnavailable` 99:47438.
- Both canvases have reaction, image, button/input and report designs. Implement feature-agnostic authorized media/reaction/dialog primitives once in `components/common/`; compose feature-specific cards in their feature folders. Reuse existing primitives and `PlayerProfileButton`, rather than duplicating parallel Social/Messaging design systems. Figma variants do not dictate backend status names.
- Header has Cộng đồng and Tin nhắn with a separate unread badge. SOC-08/MSG-09 integrate with the existing Player shell, not a per-page header clone. Registration and profile editing stay outside this review; PP-09 owns profile entry points.
- RP-08 owns one Player-facing report dialog and its Social/Messaging entry wiring; RP-06 owns report creation, RP-07 owns Admin evidence/hide UI. Admin never opens an unrestricted conversation.
- The original review did not approve routes; `/feed` and `/posts/:postId` were subsequently approved on 2026-11-01. Other route strings retain their individual approval status. Creation, variants, menus and dialogs need no additional routes just because Figma has separate frames. Existing `/` is not replaced by a feed by this review.

### Canvas differences and required handling

| Observed design / gap | Required handling under the Ready specifications |
| --- | --- |
| No linked prototype; desktop boards mix successive states and display menus/variants next to the main view | Implement the approved journeys as real interactions. Treat boards as references; do not render all examples or handoff annotations together. Lack of prototype links is not permission to omit behavior. |
| `Xem file` includes an inline PDF preview | Keep document downloads authorized and `Content-Disposition: attachment` per Social/Messaging Tech Design. Filename/size card and download only; no inline document renderer or new PDF dependency. Image lightbox may use authorized image data. |
| Feed sample has an active date filter but also shows a different-day kèo | Apply actual server filter results. Do not hardcode sample cards or treat sample filter/data mismatch as a filter rule. |
| A visitor-variant kèo frame uses Nguyễn Văn Nam as both signed-in user and host | Resolve real viewer identity/permissions; hosts never get self-Apply/self-message controls. The frame name indicates the intended variant, not permission from its sample names. |
| Handoff text implies opening a chat clears unread; examples show totals 3 → 2 → 1 | Advance read only to actually loaded/rendered message seq. Opening alone does not clear unread. Recompute badge from server; do not copy sample totals. |
| Upload examples display 62% progress | Show a truthful pending/loading state with current HTTP transport; do not fabricate percentages or add a dependency/API for staged uploads. Retain draft and retry identity. |
| Slot labels show 3–12 and grace labels show 24 hours | Use effective slot limits returned by the approved APIs/config; these are defaults. Grace labels are superseded: no recruitment event starts a chat grace period or read-only lock (2026-11-01). |
| The variant name `Draft` appears on MatchPostCard | Map it to unpublished visibility, not a new recruitment DRAFT status. |
| `Quy tắc cộng đồng` is a sample link; no destination is specified | Do not add a dead/fabricated destination or a new content-management feature. Omit until a governed destination exists. |
| Booking source is shown as selectable; one cancel variant shows integration unavailable | Gate booking link/cancel by real readiness and server permission. Do not make unavailable controls perform local-only success or change the kèo time. |

### Verification required by the affected Tasks

Use the 1280px desktop and 390px mobile references for layout checks, with keyboard/focus behavior from existing conventions. Verify one-column mobile feed and list/detail navigation, no viewport overflow, composer reachable, and scroll position preserved when loading older chat history. Tests must use real roles/permissions and API outcomes rather than sample author names, unread numbers or slot labels. Feature-gate, hidden-content, retry and access-loss states must be implemented even without a dedicated clickable prototype. No backend contract, dependency or business decision changes are introduced by this alignment review.


## Social frontend delivery — approved alignment, 2026-11-01

The human owner accepted the findings and proposed handling in [Social Figma review](../features/social/frontend-figma-review.md) and requested implementation. The Ready feature contracts govern behavior; legacy automatic matching, chat creation/sync/revocation/read-only, bulk notification read, report uploads and sanctions are excluded.

Implemented routes `/feed` and `/posts/:postId` use the existing Player shell. Social refreshes on demand/visibility with `asOf` pagination and de-duplication; no feed polling. Shared dialog, authorized image and reaction primitives live in `components/common/`. Matchmaking uses the same post composer and its request route preserves authorized management access when Social content is unavailable. Backend CSRF and permission checks remain authoritative.

Apply endpoints and UI are now delivered by MM-24 (2026-11-01), including history in the existing `/matchmaking?tab=applications` route. Real Apply/approval remains fail-closed until the Messaging BlockPort is registered. Player report endpoints are still absent and report entry remains visibly unavailable. Booking-link/CANCEL and Messaging shortcuts remain excluded until their providers are ready. Notification UI/deep links remain NTF-04/05. See [implementation and verification](../features/social/frontend-implementation.md) for delivered behavior and remaining gates; no SOC/MM completion is implied by UI delivery. These shared-document edits require teammate PR review before merge, per AGENTS.md.

## Sign-in page migration — D01, 2026-11-17

The user authorized D01 after D00 review. The initial D01 delivery on 2026-11-17 used an opt-in `features/auth/sign-in-layout.tsx` and `sign-in-form.tsx`, with project-owned shadcn/Radix-style Button/Input/Label/Alert primitives in `components/ui/`. `button-variants.ts` keeps CVA helpers separate from component exports. Brand tokens and lucide icons are reused; no global CSS or legacy AuthLayout consumer is rewritten.

`use-sign-in-form.ts` owns React Hook Form/Zod validation and a submission-cycle guard; `sign-in-errors.ts` owns API-code messages. Requests still use AuthProvider/authApi/http-client, with the existing role/from/forced-password/CSRF behavior. No Query resource migration occurs. Form validation trims email and requires a password without enforcing registration password policy; password is never trimmed or persisted. Errors have visible text, associations and focus; the password toggle is keyboard reachable.

D01 is AWAITING_REVIEW, not completion of all Auth pages. Tests: `frontend/e2e/sign-in-ui.spec.ts` via `frontend/playwright.sign-in.config.ts`, no database; 22 browser contract cases plus 12 production smoke cases. See the history §14 for evidence, bundle impact, limitations and the D02 confirmation gate.

## Sign-in v2 integration and migration cleanup — 2026-11-18

The user approved the vector prototype and authorized integration into `/sign-in` only. `sign-in-layout.tsx` replaces the first D01 layout; `sign-in-hero.tsx` owns the feature-specific composition and imports the SVG from `src/assets/illustrations/badminton-court.svg`. Production does not import prototype HTML/CSS or depend on the docs preview server. Tailwind utilities use additive `@theme` brand tokens; semantic ink/border variables are scoped to this page, leaving legacy consumers unchanged.

`components/common/brand-logo.tsx` contains brand identity; `components/common/labeled-input.tsx` composes the existing Input/Label primitives and their field-error association without coupling to React Hook Form. The form keeps registration/validation/submission in the Auth feature. `shared/hooks/use-pointer-parallax.ts` uses Motion values/springs; `use-media-query.ts` subscribes to preference changes, including reduced motion while the page is open. The hero uses LazyMotion/domAnimation and `m.img`, not the full motion component feature bundle. Touch input does not activate parallax.

During every batch, remove superseded code, imports, styles and assets only after checking static/dynamic consumers. Never stack a new legacy override onto the old implementation. Primitives stay in `components/ui`, shared composed components in `components/common`, generic hooks/utilities in `shared`, feature presentation/behavior in its feature. Current removals: the first D01 CourtIllustration/layout, duplicated email/password field markup and unused `.auth-support`. Keep legacy `auth-*` rules and AuthLayout/AuthAlert for Register, Change-password and Access-denied; dynamic alert variants are still used.

Build and 31 mocked-API browser checks pass; lint retains the same 31 existing warnings. Real anonymous `/sign-in` rendering and backend health were also checked, without credential submission or database mutation. Delivery and cleanup evidence: [history §17](plans/refactor_FE_add_lib/frontend-modernization-history.md). D01 awaits implementation review; no survey wizard or D02 implementation is authorized by this delivery.

**Update 2026-11-18 — D01 DONE.** After review the user accepted D01: informational text on Sign-in is at least 12 px and decorative uppercase labels at least 11 px, duplicated slogans were removed, the lockout time is formatted in `Asia/Ho_Chi_Minh`, and the hero slogan is no longer a heading so the form `h1` comes first. 34 mocked-API browser checks pass. See history §18. D02 starts with the pre-implementation review (plan §2.2).

**Update 2026-11-18 — D02 awaiting review.** Change-password, Access-denied and the guard's session-loading screen now use the focused Auth layout (`features/auth/auth-focus-layout.tsx`) with shared `PasswordInput`, `FocusAlert`, `Alert` (`success`) and `Button` (`outline`). The Admin header has an account menu (`DropdownMenu` primitive) with change-password and sign-out. After a successful password change the client signs out the current session (Auth PRD Decision #27); after any deliberate sign-out the guard no longer saves a return destination. Legacy `auth-*` rules used only by these screens were removed; Register keeps `AuthLayout`. See history §19.

**Update 2026-11-18 — D03 awaiting review.** `/courts` is paged by facility (`GET /api/v1/facilities`, Booking Tech Design §9.1a), keeps filters and page in the URL (`city`, `district`, `date`, `from`, `to`, `page`, preserving `matchId`) and loads results through TanStack Query (`features/booking/hooks/useCourtSearch.ts`, public data, key `['facilities','search', params]`). This is the first Query consumer; it holds public data only, so the account-scoped cache safeguards are still required before private resources move to Query. New shared UI: `components/ui/{badge,skeleton,dialog}.tsx`, `components/common/{pagination,empty-state}.tsx`. See history §20.

## Hệ thống thiết kế — DS01, 2026-11-18

Nguồn duy nhất cho giao diện mới. Quyết định của người dùng ngày 18/11/2026 (history §21, [báo cáo DS01](plans/refactor_FE_add_lib/reviews/DS01-design-foundation.md)).

**Bảng màu A — xanh lá dịu** (mở rộng Sign-in v2 ra toàn app; token trong `src/index.css`):

| Vai trò | Class Tailwind | Giá trị |
| --- | --- | --- |
| Nền trang | `bg-background` | #F2F5EF |
| Thẻ, popover | `bg-card` | #FFFFFF |
| Nền ô nhập/chip | `bg-soft` | #F9FBF7 |
| Nền phụ, skeleton | `bg-muted` | #EEF2EC |
| Chữ chính | `text-foreground` | #172C24 |
| Chữ phụ | `text-muted-foreground` | #5B6862 (≥ 5,3:1 trên nền trang) |
| Viền, viền ô nhập | `border-border`, `border-input` | #DFE7DC |
| Thương hiệu / hành động | `bg-primary`, `text-primary`, `ring-ring` | #006B2C |
| Trạng thái | `success`, `caution`, `danger`/`destructive`, `info` (+ `-bg`) | như cũ |
| Trang trí hero Auth | `brand-forest`, `brand-moss`, `brand-mint`, `brand-lime`… | chỉ dùng cho minh họa |

Các biến cũ (`--bg-app`, `--text-primary`, `--text-secondary`, `--bg-subtle`, `--bg-table-header`, `--bg-tag-uid`…) được đổi giá trị theo bảng A để trang chưa chuyển cùng tông; code mới **không** dùng chúng. Token trùng nghĩa `brand-page/ink/muted/border/soft` đã bỏ.

**Thang chữ:** `text-xs` 12 px (tối thiểu cho chữ có thông tin) · `text-sm` 14 · `text-base` 16 · `text-lg` 18 · `text-2xl` 24 · `text-3xl` 30. `text-2xs` 11 px chỉ cho nhãn trang trí in hoa. Không dùng `text-[…]`.

**Bo góc:** `rounded-md` 8 (phần tử nhỏ) · `rounded-lg` 12 (nút, ô nhập, menu, chip) · `rounded-2xl` 16 (thẻ, khối) · `rounded-panel` 28 (panel lớn, bottom sheet) · `rounded-full`. Không dùng `rounded-sm/xl/3xl` hoặc giá trị tùy ý.

**Khoảng cách và khung trang:** bội số 4 px của Tailwind. Trang trong shell dùng `PageContainer` (tối đa 1440 px, lề 16/24 px, khoảng cách khối 24 px) và `PageHeader` (h1 24/30 px, mô tả 14 px, nút hành động bên phải) ở `components/common/page-layout.tsx`.

**Mẫu trang:**

| Loại | Thành phần | Ví dụ |
| --- | --- | --- |
| Danh sách có bộ lọc | `PageHeader` → form lọc (`role="search"`, mobile thu gọn vào sheet) → `h2` tóm tắt kết quả → lưới thẻ → `Pagination`; trạng thái bằng `Skeleton`/`EmptyState`; bộ lọc + trang trên URL | `/courts` |
| Chi tiết | `PageHeader` có nút quay lại → khối thông tin `rounded-2xl` → hành động chính | D04 |
| Form tập trung | Thẻ giữa trang `rounded-panel`, RHF + Zod, `LabeledInput`/`PasswordInput`, `FocusAlert` cho lỗi chung | `/change-password` |
| Bảng quản trị | `PageHeader` + hành động → bộ lọc → bảng (component mới thay `DataTable` cũ) → `Pagination` | D18 |

**Kiểm tra tự động:** `npm run lint` chạy oxlint và `scripts/check-ui.mjs`. File đã dựng lại phải nằm trong `ui-check.config.json` → `migrated`; script báo lỗi khi có mã hex, `style={{…}}`, biến CSS cũ, import `.css`, cỡ chữ `text-[…]`, bo góc ngoài thang hoặc component legacy (`common/Dialog`, `DataTable`, `FilterToolbar`), và khi có file `.css` mới. Ngoại lệ phải ghi `reason` trong cấu hình.

## Player shell — SH01 handoff, 2026-11-19

Current status: **DONE**, following the user’s confirmation to proceed on 2026-11-19. User decisions and handoff are in [SH01 review](plans/refactor_FE_add_lib/reviews/SH01-player-shell.md); the [compact plan](plans/refactor_FE_add_lib/frontend-modernization-review-plan.md) owns current statuses. Older numbered handoffs (§13–§22) now live in [history](plans/refactor_FE_add_lib/frontend-modernization-history.md); their past states/test counts are not current guidance.

`PlayerProfileLayout` keeps the existing account-keyed ProfileProvider. `PlayerLayout` composes skip link, header, main outlet, footer, bottom navigation and GlobalChatDock. Profile identity comes from the shared profile provider; unread counts come from the Messaging-owned `use-unread-messages.ts` hook, refreshed on the existing unread-change/visibility signals. Do not fork these into per-page shell copies. The shared Auth AccountMenu is also used by Admin; primitive DropdownMenu stays in `components/ui`.

Header contains the brand, five navigation links and account menu. Mobile uses only the brand symbol plus the account menu, with the five links in the bottom bar. Hide the nonfunctional notification bell and placeholder Home/Tournaments entries; the existing routes and permissions remain. Footer contains the brand/current year with no dead links. The chat dock remains and is clamped above the mobile bottom bar using `data-app-header`/`data-app-bottom-nav`; it is still hidden on `/messages/*` as before.

Cleanup: removed PlayerSidebar, 80 unused `.player-*` lines in `index.css` and two shortcut lines in `profile.css`; unchanged page bodies remain legacy until their batches. Shell/skip-link/account menu/unread files were added to the DS01 check list. Verification: build/lint/check:ui pass (30 pre-existing lint warnings, 54 checked files); 86 mocked-API UI tests pass; actual seeded-account login and eight shell renders (four routes × 390/1280) pass. Real data covers current empty feed/messages states; presence/realtime and business mutations were not exercised. No feature source was added during this handoff-only cleanup.


## Court detail presentation — D04, 2026-11-19

Status: **DONE**, sequential execution authorized by the user on 2026-11-19; [compact plan](plans/refactor_FE_add_lib/frontend-modernization-review-plan.md) owns status and [D04 handoff](plans/refactor_FE_add_lib/reviews/D04-court-detail.md) records approval/evidence. Scope is `/courts/:courtId` and `AvailabilityGrid`; SelectDate and FacilityDetail remain legacy.

`CourtDetailPage` keeps the existing state, effects, availability hook and navigation. Feature-specific Header/TimeFilters/AvailabilityPanel/SelectionSummary live in `features/booking/components`; shared PageContainer/PageHeader, EmptyState, Input/Label/Button/Badge/Skeleton and `useMediaQuery` are reused. Motion animates the selection summary for 200 ms, respecting reduced motion. Native duration select retains all five options and event semantics. The UI distinguishes the free interval from the selected start/duration and displays the server price without recalculating it. Polling, last-good data, services and API contracts are unchanged.

Cleanup replaces the old inline page/grid presentation directly and removes unused SyncIcon after checking consumers. StateBlocks and MatchBookingContext remain for other Booking pages; no global CSS or new stylesheet was added. Six rebuilt files are registered with check:ui (60 checked files total). Real backend checks cover selection/reset, links and navigation up to the summary at 390/1280; no hold/payment was created. The D04 handoff distinguishes mocked edge-state tests from real-data verification.


## Booking checkout presentation — D05, 2026-11-19

D05 uses shared ContentPanel/DetailRow for summary, pending and detail; BookingPageState keeps a page heading during loading/errors. Booking status/cancellation/Mock-payment presentation uses existing Button/Badge and Radix Dialog primitives. `DialogContent.showClose` is optional and defaults to the existing true behavior. Checkout passes false to retain its original footer/close conditions. StateBlocks/MatchBookingContext/status badges remain shared by Booking consumers. Removed the unused checkout CSS selectors; no service, request, calculation, consent, timer or redirect behavior changed. Verification/limits are in the [D05 handoff](plans/refactor_FE_add_lib/reviews/D05-booking-checkout.md).


D06 (2026-11-19) rebuilds MyBookingsPage/BookingListCard on the shared page/Button/status presentation; native filter buttons retain their five definitions and functional pagination handlers. The data controller, request behavior and navigation remain unchanged. No new stylesheet or service changes; see the [D06 handoff](plans/refactor_FE_add_lib/reviews/D06-booking-history.md).


## Lưu trữ kết quả kiểm tra — chốt 19/11/2026

Repository giữ mã nguồn, asset ứng dụng, cấu hình, test có thể chạy lại và tài liệu quyết định/bàn giao gọn. Không commit JSON kiểm chứng từng lần chạy, log/trace/report hoặc bộ ảnh trước/sau theo từng đợt. Kết quả PASS/FAIL, môi trường và giới hạn được ghi ngắn trong review của đợt; output chi tiết đặt ở `/tmp`, `.local-artifacts/` đã ignore hoặc CI artifacts. Kiểm tra responsive vẫn thực hiện, ảnh chỉ chụp khi cần xem trực quan. Bộ minh họa của lần chuyển đổi này chỉ giữ [hai ảnh đại diện](plans/refactor_FE_add_lib/examples/README.md); không tăng số lượng theo mỗi đợt. Quy định này không áp dụng cho JSON cấu hình hoặc fixture kiểm thử được bảo trì có chủ đích.


## Recruitment management presentation — D11, 2026-11-19

Request detail, application/candidate panels and invitation inbox now compose the shared page/UI primitives. `components/common/confirm-dialog.tsx` owns the repeated state-mounted confirmation UI used by Matchmaking and PostComments; callers retain commands, busy/error state and permission predicates. The optional `DialogContent.closeDisabled` defaults to false; migrated busy dialogs pass it explicitly to preserve their disabled close button. Added semantic Button variants without changing existing variants. `social.css` and unused legacy request form were removed after checking consumers. API/data hooks, request timing, validation and payloads are unchanged. Check results, test replacement and real-backend scope are in the [D11 handoff](plans/refactor_FE_add_lib/reviews/D11-recruitment-detail.md).

### D12 presentation — 2026-11-19

Matchmaking keeps ownership of MyMatches/MatchDetail and the leave command; ContentPanel/EmptyState and shadcn Dialog compose the views. The user explicitly approved correcting GROUP roster display (all API players in server order, nullable teamNo) and leave explanations by match type/host role; these are presentation corrections to the existing contract/rules, not backend changes. Singles/Doubles server teams, permissions, action availability, polling and API payloads remain unchanged. `match-detail.css` has no remaining consumer and was removed; Ratings modal/admin legacy CSS remains for D13.

### D13 presentation — 2026-11-19

Ratings views use shared Dialog, Progress, Textarea, Button, RadioGroup and table primitives. `components/common/data-table.tsx` enforces modern presentation on the same DataTable renderer; `DataTable.tsx` retains a legacy-default adapter for Owner/Admin consumers until their migration. Remove the legacy branch/facade after the last consumer, not by duplicating tables. Ratings CSS was removed after checking consumers. `DialogContent.overlayClassName` is optional and preserves the default; Rating/LeaveMatch use their prior z-index 1000 to stay above the chat bubble. API hooks/commands and backend rating/adjustment behavior were not changed.

### SH02 Owner shell — 2026-11-19

OwnerLayout retains facility loading/selection/query/context/remount and sign-out behavior. OwnerHeader/OwnerNavigation share one five-link definition, with a mobile bottom navigation and keyboard skip link. The facility selector uses shared NativeSelect. Unused Owner brand SVG and shell selectors were removed. OwnerUi temporarily imports the existing owner.css; owner-main remains only as the compatibility ancestor for D14–D17 content, to be removed with its final consumers. The inner Owner pages are not migrated by SH02.

### D14 Owner facilities — 2026-11-19

CreateFacilityPanel is a feature presentation component reused by Dashboard/FacilityPage; OwnerForm retains its uncontrolled FormData serialization, while controls use shared Input/Textarea/Label/Button. Facility/court tables use the modern DataTable facade; review/status/async/pager presentation is shared inside the Owner feature. No service/hooks/backend changed. OwnerLayout now provides the token-based container without owner-main: only the remaining legacy Owner pages carry owner-main with display:contents, isolating their styles from migrated pages. owner.css stays imported by legacy Dashboard; Admin FacilityReviewPage also consumes it, so keep the remaining rules/import until D19 and remove Owner wrappers as D15–D17 complete.

### D15 Owner pricing — 2026-11-19

Pricing composes shared PageHeader, ContentPanel, NativeSelect, modern DataTable and OwnerForm. Its legacy wrapper/imports were removed; every returned court remains selectable in server order. Existing selection/edit state, form keys/serialization, endpoints, snapshot explanation and read cadence are unchanged. Owner/Admin styles remain only for the remaining legacy consumers.

### D16 Owner schedule — 2026-11-19

Schedule/history/maintenance use the shared table/form/select controls while retaining the existing flat server slot order and command availability. BookingDetailPanel uses DialogContent variant side, preserving its original content focus, Escape/button closing, blocked backdrop dismissal and existing lack of focus return. shared/utils/dialog-focus.ts also serves RatingModal; default Dialog variants are unchanged. Old Owner drawer/form/grid selectors were removed after consumer checks. No Owner cancellation UI or business/data-layer behavior was added.

### D17 Owner dashboard/account — 2026-11-19

Dashboard and account now use PageHeader/ContentPanel/Button with existing facility data and Auth identity only. Facility ordering, links/query, creation panel and sign-out are retained. All scoped Owner pages/components have migrated; no owner-main legacy wrapper remains in Owner. owner.css is now imported only by Admin FacilityReviewPage, its remaining consumer until D19; unused owner-note/list rules were removed. No analytics or account workflow was added.

### SH03 Admin shell — 2026-11-19

AdminSidebar/Header/GlobalSearchResults use tokens, Button/Input, BrandLogo and lucide. AdminMain shares layout only: UserManagement, CourtManagement and placeholders keep their own collapse/mobile state, original main content and sibling overlays; routing/lifecycle persistence did not change. Sidebar and header retain 240/68 px desktop, 260 px mobile and 72 px header dimensions. Search effects/service/debounce/result paths remain unchanged; unbacked badges and static sidebar identity were removed in favor of Auth email. Old shell selectors and unused Dashboard/Menu SVG exports were removed; inner User/Court UI remains D18–D19.

### D18 Admin user presentation — 2026-11-20

User tables, filters, metrics, actions and five dialogs use the shared modern table/filter and Radix/token primitives. AdminDialog and AdminMetricCard are reused inside the Admin feature. Fake hard-coded growth/fair-play/court counts were removed; service-backed counts remain. The Toast adapter renders through the existing singleton Sonner Toaster while page state and its four-second timer stay unchanged. User commands, validation/defaults, bulk confirmation, debounce, export and API services remain unchanged. Shared filter/pager/toast were regression-tested on CourtManagementPage; legacy filter selectors are removed, while the DataTable adapter and remaining table/page CSS wait for D19.

### D19 Admin facilities and reviews — 2026-11-20

Facility lists/create/status dialogs and registration/address/court reviews now use shared modern table/filter, Admin presentation components and semantic tokens. Review request/polling/pagers/decisions and the existing facility command layer are unchanged. The last DataTable legacy consumer migrated: common/data-table.tsx is the sole implementation; uppercase adapters and owner.css were removed after checking all consumers. Unused Admin table/header/metric CSS and decorative chart SVG were removed. Status-dialog dismissal policy is explicitly retained; reason/note propagation remains existing backlog.

### D20 Messaging workspace — 2026-11-20

Workspace/list and direct/group start dialogs use shared token UI, Radix ToggleGroup/Dialog and feature presentation components (MessagingUi, StartConversationDialogs), ready for Dock reuse. Room lifecycle/key, filters/search/defaults/validation/commands, list refresh and WebSocket/unread/reconnect behavior stay unchanged. Only workspace-exclusive selectors were removed; Room/Dock/Blocks CSS remains until their batches. Existing Messaging tests now use the mocked-API UI config with complete shell mocks; no live/reset server is needed for those contract tests.

### D21 Messaging room — 2026-11-20

Room presentation is split into MessageBubble, MessagingImageViewer and feature display metadata, with Radix Popover/DropdownMenu/Dialog and token-based composer/history/header. Existing data effects, command handlers, retry UUIDs, read/typing/cursor logic and permissions remain; quoted-message scrolling respects reduced motion. Workspace mobile height reserves the shell bottom navigation, and compact/mobile composer tools get a separate row. Runtime width/zoom values stay dynamic; obsolete Room CSS rules were removed after all-consumer inspection. Real two-user WebSocket, private media and group gates were verified on the isolated test database.
