# Kế hoạch chi tiết tái cấu trúc Backend (Layer-First Architecture)

## 1. Mục tiêu & Nguyên tắc

- **Mục tiêu**: Đồng bộ hóa 100% backend theo mô hình **Layer-first** đã được quy định trong tài liệu chuẩn [docs/architecture/conventions.md:91-98](file:///d:/STUDY/NAM4/TLCN/badminton-platform/docs/architecture/conventions.md#L91-L98), dọn sạch toàn bộ các file cầu nối (shim), thống nhất tầng xử lý lỗi, middleware, validation và thư mục test.
- **Nguyên tắc bất biến (Invariants)**:
  1. **Zero-Breaking-Change**: Giữ nguyên 100% API contract, HTTP status code, format dữ liệu request/response, cookie và logic bảo mật.
  2. **Non-Destructive**: Không xóa/sửa bất kỳ logic nghiệp vụ hay business rule nào.
  3. **Verifiable**: Mỗi giai đoạn đều có thể kiểm chứng bằng TypeScript compiler (`npm run build --prefix backend`) và Vitest suite (`npm test --prefix backend`).

---

## 2. Bản đồ chuyển đổi cấu trúc (Before vs After)

```
HIỆN TRẠNG (HỖN HỢP)                          MỤC TIÊU (LAYER-FIRST CHUẨN)
====================                          ============================
backend/src/                                  backend/src/
├── app.ts                                    ├── app.ts
├── index.ts                                  ├── index.ts
│                                             │
├── modules/ (XÓA BỎ HOÀN TOÀN)               │
│   ├── auth/                                 │
│   │   ├── auth.controller.ts -------------> ├── controllers/auth/AuthController.ts
│   │   ├── auth.service.ts ----------------> ├── services/auth/AuthService.ts
│   │   ├── auth.repository.ts -------------> ├── repositories/auth/AuthRepository.ts
│   │   ├── auth.routes.ts -----------------> ├── routes/auth/authRoutes.ts
│   │   ├── auth.validation.ts -------------> ├── validation/auth.ts
│   │   └── password-hasher.ts -------------> ├── services/auth/password-hasher.ts
│   └── skill-levels/                         │
│       ├── skill-levels.controller.ts -----> ├── controllers/skill-levels/SkillLevelController.ts
│       ├── skill-levels.repository.ts -----> ├── repositories/skill-levels/SkillLevelRepository.ts
│       └── skill-levels.routes.ts ---------> ├── routes/skill-levels/skillLevelRoutes.ts
│                                             │
├── controllers/                              ├── controllers/
│   ├── admin/ (còn chứa validation) -------> │   ├── admin/ (chỉ chứa controller sạch)
│   ├── booking/                              │   ├── booking/
│   │                                         │   ├── auth/ (mới)
│   │                                         │   └── skill-levels/ (mới)
│                                             │
├── services/                                 ├── services/
│   ├── admin/                                │   ├── admin/
│   ├── booking/                              │   ├── booking/
│   └── tournaments/                          │   ├── tournaments/
│                                             │   └── auth/ (mới)
│                                             │
├── repositories/ (files nằm ở root) --------> ├── repositories/ (có subfolder)
│   ├── UserRepository.ts ------------------> │   ├── user/UserRepository.ts
│   ├── FacilityRepository.ts --------------> │   ├── facility/FacilityRepository.ts
│   ├── BookingRepository.ts ---------------> │   ├── booking/BookingRepository.ts
│   ├── CourtRepository.ts -----------------> │   ├── booking/CourtRepository.ts
│   │                                         │   ├── auth/AuthRepository.ts (mới)
│   │                                         │   └── skill-levels/SkillLevelRepository.ts (mới)
│                                             │
├── routes/                                   ├── routes/
│   ├── admin/                                │   ├── admin/
│   ├── booking/                              │   ├── booking/
│   │                                         │   ├── auth/authRoutes.ts (mới)
│   │                                         │   └── skill-levels/skillLevelRoutes.ts (mới)
│                                             │
├── validation/ (thiếu admin & auth) -------> ├── validation/
│   ├── booking.ts                            │   ├── booking.ts
│   │                                         │   ├── auth.ts (từ auth.validation.ts)
│   │                                         │   └── admin.ts (tách từ Admin controllers)
│                                             │
├── middleware/                               ├── middleware/
│   ├── auth.middleware.ts                    │   ├── auth.middleware.ts (gộp authenticate + authorize)
│   └── validate.middleware.ts                │   ├── csrf.middleware.ts (chuyển từ shared/auth)
│                                             │   └── validate.middleware.ts
│                                             │
├── shared/                                   ├── shared/
│   ├── auth/ (XÓA BỎ - đã đưa về middleware) │   ├── config/ (env, system-config)
│   ├── http/ (app-error.ts duplicate) -----> │   ├── http/ (error-handler, rate-limit)
│   └── logging/                              │   └── logging/ (logger)
│                                             │
├── errors/                                   ├── errors/
│   └── AppError.ts (shim re-export) -------> │   └── AppError.ts (file gốc duy nhất cho AppError & subclasses)
│                                             │
├── utils/                                    ├── utils/
│   └── password.ts (shim) -----------------> │   └── password.ts (gọi trực tiếp passwordHasher chuẩn)
│                                             │
├── db/                                       ├── db/
│   ├── client.ts (shim 1 dòng) ------------> │   (XÓA BỎ client.ts, chỉ dùng db/index.ts)
│   └── index.ts                              │   └── index.ts
│                                             │
├── __tests__/ (tách đôi 2 nơi) ------------> (GỘP HẾT VỀ src/test/)
└── test/                                     └── test/ (thư mục test duy nhất)
```

---

## 3. Chi tiết 5 giai đoạn thực hiện (Kèm lý do tại sao)

### Giai đoạn 1: Chuẩn hóa Auth & Skill-Levels sang Layer-First
*Mục đích: Xóa bỏ hoàn toàn thư mục `src/modules/`, đưa mọi thành phần về đúng vị trí layer theo `conventions.md`.*

| File nguồn | File đích | Lý do thay đổi (Tại sao) |
|---|---|---|
| `modules/auth/auth.controller.ts` | `controllers/auth/AuthController.ts` | Đúng quy ước: Controller chuyên xử lý HTTP request/response và cookie. |
| `modules/auth/auth.service.ts` | `services/auth/AuthService.ts` | Đúng quy ước: Service điều phối nghiệp vụ xác thực, session, lockout. |
| `modules/auth/auth.repository.ts` | `repositories/auth/AuthRepository.ts` | Đúng quy ước: Repository sở hữu thao tác truy vấn bảng `auth_sessions`, `auth_login_lockouts`. |
| `modules/auth/auth.routes.ts` | `routes/auth/authRoutes.ts` | Đúng quy ước: Khai báo route HTTP `/api/v1/auth/*`. |
| `modules/auth/auth.validation.ts` | `validation/auth.ts` | Đúng quy ước: Toàn bộ Zod schemas nằm tập trung ở `validation/`. |
| `modules/auth/password-hasher.ts` | `services/auth/password-hasher.ts` | Là service tiện ích nội bộ phục vụ băm mật khẩu HMAC+Bcrypt cho Auth. |
| `modules/skill-levels/*` | `controllers/skill-levels/`, `repositories/skill-levels/`, `routes/skill-levels/` | Tách nhỏ skill-levels theo 3 tầng tương ứng, xóa bỏ thư mục `modules/`. |

---

### Giai đoạn 2: Tinh gọn Repositories và chuẩn hóa Validation
*Mục đích: Không để file repository nằm tự do ở thư mục gốc; không viết inline validation schemas trong Controller.*

| Thao tác | Vị trí tác động | Lý do thay đổi (Tại sao) |
|---|---|---|
| Tạo thư mục subfolder trong `repositories/` | `repositories/user/UserRepository.ts`<br>`repositories/facility/FacilityRepository.ts`<br>`repositories/booking/BookingRepository.ts`<br>`repositories/booking/CourtRepository.ts` | [conventions.md:92](file:///d:/STUDY/NAM4/TLCN/badminton-platform/docs/architecture/conventions.md#L92) quy định phân cấp theo capability: `repositories/<capability>/`. |
| Tách validation của Admin ra file riêng | Tạo `validation/admin.ts` | Hiện tại các schema (`listUsersQuerySchema`, `createUserBodySchema`, `updateStatusBodySchema`...) đang bị viết lẫn vào trong [AdminUserController.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/controllers/admin/AdminUserController.ts) và [AdminFacilityController.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/controllers/admin/AdminFacilityController.ts), vi phạm nguyên tắc tách biệt mối quan tâm (Separation of Concerns). |

---

### Giai đoạn 3: Hợp nhất Errors, Middleware và Xóa sạch các File Shim
*Mục đích: Chấm dứt tình trạng import vòng vèo, xóa bỏ các file bắc cầu sinh ra khi merge.*

| Thành phần | Hành động cụ thể | Lý do thay đổi (Tại sao) |
|---|---|---|
| **Errors** | - Hợp nhất [shared/http/app-error.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/shared/http/app-error.ts) vào [errors/AppError.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/errors/AppError.ts).<br>- Xóa file `shared/http/app-error.ts`. | Tránh duplicate định nghĩa `AppError`. Cung cấp 1 điểm import lỗi duy nhất (`ValidationError`, `UnauthorizedError`, `NotFoundError`...) cho toàn dự án. |
| **Database Client Shim** | - Thay thế các import từ `../db/client` thành `../db` (hoặc `../db/index`).<br>- **Xóa bỏ `backend/src/db/client.ts`**. | File này chỉ có 1 dòng re-export, hoàn toàn dư thừa sau khi đã chuẩn hóa import. |
| **Password Utils Shim** | - Chuẩn hóa [utils/password.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/utils/password.ts) trỏ thẳng vào `services/auth/password-hasher.ts`. | Giữ `utils/password.ts` làm helper dùng chung gọn gàng cho admin/seeders. |
| **Middleware & CSRF** | - Chuyển `shared/auth/csrf.middleware.ts` sang `middleware/csrf.middleware.ts`.<br>- Hợp nhất session authenticate và role authorization vào `middleware/auth.middleware.ts`.<br>- Di dời `session-cookie.ts` sang `shared/auth/session-cookie.ts` hoặc `utils/session-cookie.ts`.<br>- Xóa bỏ thư mục `shared/auth/`. | Gom tất cả Express middlewares về đúng thư mục `middleware/`, xóa bỏ sự chồng chéo giữa `middleware/` và `shared/auth/`. |

---

### Giai đoạn 4: Hợp nhất Thư mục Test & Cập nhật Imports
*Mục đích: Thống nhất một nơi duy nhất quản lý toàn bộ bài kiểm thử, tránh phân mảnh.*

| Thao tác | Chi tiết | Lý do thay đổi (Tại sao) |
|---|---|---|
| Di chuyển test từ `src/__tests__/` sang `src/test/` | - `admin-facilities.test.ts` $\rightarrow$ `src/test/admin-facilities.test.ts`<br>- `admin-users.test.ts` $\rightarrow$ `src/test/admin-users.test.ts`<br>- `booking-*.test.ts` $\rightarrow$ `src/test/booking-*.test.ts`<br>- Xóa thư mục `src/__tests__/`. | Vitest đang dùng cấu hình `globalSetup` và `setupFiles` trong `src/test/`. Việc gom về 1 nơi giúp dễ quản lý, dễ chạy từng bộ test và tránh nhầm lẫn. |
| Cập nhật đường dẫn import trong toàn bộ test files | Điều chỉnh các import từ `modules/auth`, `repositories/` sang đường dẫn mới. | Đảm bảo 100% test files biên dịch và chạy chính xác. |

---

### Giai đoạn 5: Cập nhật App Mounting & Nghiệm thu
*Mục đích: Đảm bảo toàn bộ server và route mounting chạy trơn tru.*

1. **Cập nhật [backend/src/app.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/app.ts)**:
   - Đổi import `authRouter` từ `modules/auth/auth.routes` $\rightarrow$ `routes/auth/authRoutes`.
   - Đổi import `skillLevelsRouter` từ `modules/skill-levels/...` $\rightarrow$ `routes/skill-levels/skillLevelRoutes`.
   - Đổi import `csrfProtection` từ `shared/auth/csrf.middleware` $\rightarrow$ `middleware/csrf.middleware`.
2. **Kiểm tra TypeScript Typecheck**:
   - Chạy `npm run build --prefix backend` (`tsc`) để đảm bảo không còn bất kỳ lỗi import hay type mismatch nào.
3. **Chạy Vitest**:
   - Chạy `npx vitest run` kiểm tra toàn bộ unit test độc lập (password hasher, session cookie, bracket generator, validation...).

---

## 4. Bảng tổng hợp rủi ro & Biện pháp phòng ngừa

| Rủi ro | Mức độ | Biện pháp phòng ngừa |
|---|:---:|---|
| Sai lệch đường dẫn import gây lỗi compile | Thấp | Chạy `npx tsc --noEmit` sau từng giai đoạn để phát hiện ngay file nào bị lệch import. |
| Gãy logic bảo mật của Auth/Session | Trung bình | Tuyệt đối không sửa logic bên trong các hàm xử lý (`hash`, `verify`, `timingSafeEqual`, `touchSession`), chỉ di chuyển file và đổi đường dẫn import. |
| Ảnh hưởng tới Frontend | Không có | Mọi API endpoint (`/api/v1/auth/*`, `/api/v1/admin/*`, `/api/v1/bookings/*`) và response contract giữ nguyên 100%, Frontend không bị ảnh hưởng. |

---

## 5. Tiêu chí hoàn thành (Acceptance Criteria)

- [ ] Thư mục `backend/src/modules/` không còn tồn tại.
- [ ] Các file shim ([db/client.ts](file:///d:/STUDY/NAM4/TLCN/badminton-platform/backend/src/db/client.ts), duplicate `shared/http/app-error.ts`) đã bị xóa bỏ.
- [ ] Thư mục `backend/src/__tests__/` đã được gộp hoàn toàn vào `backend/src/test/`.
- [ ] Lệnh `npm run build --prefix backend` thực thi thành công với 0 lỗi TypeScript.
- [ ] Toàn bộ unit tests và router mounting hoạt động chính xác.
