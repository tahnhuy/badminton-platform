# Frontend SmashPro

Frontend dùng React, TypeScript và Vite. Hướng dẫn này giúp người mới tìm đúng nơi phát triển chức năng và hiểu phần giao diện mới đang cùng tồn tại với CSS cũ.

Tài liệu chi tiết và quy ước chính thức nằm trong [kiến trúc frontend](../docs/architecture/frontend.md), [coding conventions](../docs/architecture/conventions.md) và [tech stack](../docs/architecture/tech-stack.md). [Kế hoạch chuyển đổi](../docs/architecture/plans/refactor_FE_add_lib/frontend-modernization-review-plan.md) ghi các màn đã chuyển và phần còn lại.

## Tìm code ở đâu

| Vị trí | Nội dung |
| --- | --- |
| `src/app/` | Router, providers toàn ứng dụng và đường dẫn trang chủ theo vai trò |
| `src/features/<capability>/` | Trang, component, hook, service và kiểu dữ liệu riêng của từng chức năng |
| `src/components/ui/` | Primitive shadcn/Radix như Button, Input, Dialog, DropdownMenu |
| `src/components/common/` | UI ghép dùng chung: PageContainer/PageHeader, ContentPanel, DataTable, FilterToolbar, ConfirmDialog |
| `src/shared/` | HTTP client, auth guard, hook và utility dùng chung; `shared/utils/cn.ts` ghép class |
| `src/index.css` | Entry CSS, token thiết kế, base và CSS legacy còn consumer |
| `public/` | Asset tĩnh được phục vụ trực tiếp |
| `e2e/` | Test Playwright và fixture được bảo trì |
| `dist/` | Kết quả sinh bởi `npm run build`; sửa giao diện trong `src/` |

## CSS và giao diện hiện tại

`main.tsx` import `index.css` một lần. File này nạp Tailwind CSS v4 và `tw-animate-css`, khai báo token màu/font/bo góc/đổ bóng, ánh xạ token semantic của component và giữ CSS legacy trong `@layer legacy`.

Thứ tự layer hiện có:

```text
theme → base → legacy → components → utilities
```

Layer quyết định ưu tiên CSS; nó không giới hạn selector vào một trang. Legacy vẫn có các rule toàn cục như `body`, `button`, `input`, bên cạnh các class `auth-*`.

Giao diện đã chuyển dùng class Tailwind ngay trong component, với token như `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`. Primitive dùng Radix/shadcn; icon phổ thông dùng lucide, chuyển động dùng Motion và thông báo nổi dùng Sonner. Ví dụ cách ghép trang có sẵn ở `components/common/page-layout.tsx`; các biến thể nút ở `components/ui/button-variants.ts`.

Token chung trong `index.css` tác động nhiều màn. Bố cục hoặc style riêng của một trang nằm trong class của component tương ứng; thêm biến thể dùng chung ở component khi có nhu cầu tái sử dụng. Giá trị động như vị trí chat nổi, độ rộng cột hoặc zoom ảnh vẫn có thể đi qua style/CSS variable/Motion theo quy ước hiện có.

## Nhận biết phần giao diện cũ

Các phần sau vẫn đang chạy và chưa chuyển hết:

- `/register`: `features/auth/register-page.tsx`, `AuthLayout`/`AuthAlert` và CSS `auth-*` trong `index.css`.
- `/courts/:courtId/date`: `features/booking/pages/SelectDatePage.tsx`, phần trình bày chính còn style inline.
- `/facilities/:facilityId`: `features/booking/pages/FacilityDetailPage.tsx`, phần trình bày chính còn style inline.
- Placeholder Giải đấu Player và các placeholder Admin: nội dung còn style inline, dù khung điều hướng đã chuyển.

Đây là phần tương thích còn dùng, không phải mẫu để phát triển UI mới. Quy ước hiện có là giữ CSS cho consumer chưa chuyển, rồi xóa selector/import/component hết dùng sau khi thay consumer cuối; không thêm rule mới vào `@layer legacy`. Chỉ giữ file CSS không đồng nghĩa mọi trang vẫn dùng cách cũ, và hoàn thành các đợt trong kế hoạch không đồng nghĩa toàn bộ màn đã chuyển.

## Khi làm một trang hoặc chức năng mới

1. Đọc PRD/Tech Design của chức năng và phần thiết kế trong `frontend.md`; đặt code riêng ở `features/<capability>/` và ghép route tại `app/router.tsx`.
2. Dùng lại primitive ở `components/ui/` và UI chung ở `components/common/`. UI chỉ phục vụ một chức năng ở trong feature; hook/utility thật sự dùng chung ở `shared/`.
3. Viết giao diện bằng Tailwind và token hiện có. Khi sửa một màn cũ, kiểm tra các consumer trước khi xóa CSS hoặc component cũ.
4. Giữ phần trình bày tách khỏi service/API, quyền và xử lý nghiệp vụ. Chọn thư viện theo nhu cầu chức năng; việc thư viện đã cài không có nghĩa mọi form/data hook hiện tại phải viết lại.
5. Theo quy ước DS01, thêm file UI đã dựng lại vào `ui-check.config.json` và kiểm tra responsive, bàn phím/focus, loading/error/empty của phần thay đổi.

## Chạy và kiểm tra

Thiết lập môi trường/backend theo [README gốc](../README.md). Từ thư mục gốc, `npm run dev` khởi động cả backend và frontend. Các lệnh dưới đây chạy trong thư mục `frontend/`:

```bash
npm run dev       # Chỉ chạy Vite frontend
npm run build     # TypeScript và build production
npm run lint      # Oxlint và check:ui
npm run check:ui  # Kiểm tra quy ước giao diện DS01
```

`check:ui` hiện kiểm tra các file trong danh sách `migrated` và phát hiện stylesheet CSS mới ngoài danh sách cho phép; nó không tự bao phủ mọi file UI mới. Hướng dẫn này mô tả cấu trúc và cách làm hiện tại; nguồn quy ước chi tiết vẫn là các tài liệu liên kết ở đầu file.
