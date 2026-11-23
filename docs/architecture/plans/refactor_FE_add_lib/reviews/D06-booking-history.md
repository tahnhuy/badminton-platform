# D06 — Booking history

> 19/11/2026: ảnh/kết quả chạy tạm đã được dọn theo yêu cầu giữ repository gọn. Các kết luận kiểm tra bên dưới được giữ; không cần lưu snapshot từng lần chạy trong Git.

19/11/2026 · DONE · sequential authorization.

Scope: MyBookingsPage and BookingListCard. Current UI has inline card/filter/pager styling and a fixed 260 px inner minimum. Direction: shared page template, semantic filter buttons and readable cards with date/location/status/price. Preserve all five filter definitions, page size 10, tab→page reset, request timing, stale meta/error behavior, functional prev/next setters and detail destinations. Cancellation presentation was migrated/tested with its existing D05 consumers; no new mutation here. Do not adopt Query or broaden filters.

## Handoff

- Replaced page/filter/pager/card inline styles with PageContainer/PageHeader, Button, lucide icons and the shared Booking badges. Removed the fixed inner 260 px minimum; mobile card contents wrap and remain readable. Filter selection has text and aria-pressed.
- Controller prefix is byte-for-byte unchanged; all filter definitions/page size/reset logic, GET parameters, functional prev/next updates and detail destinations preserved. Existing shared Pagination is not substituted because the page’s functional state updates must be retained. No API/hooks/CSS changes; 2 files registered in check:ui.
- Build/lint PASS; check:ui **73 files PASS** (30 existing warnings). **13 targeted UI tests PASS** (6 new history + 7 checkout): default/filter parameters, reset, paging boundaries, navigation, empty/retry and 390/1280 layout. Last full regression: 106 passed at D05.
- Real backend: dev demo account empty list; dedicated test backend/database existing cancelled booking, both 390/1280 with zero overflow. Completed filter shows the existing empty state. Read-only checks; both sessions logged out 204. No new booking or cancellation mutation in D06. [Representative mobile example](../examples/booking-history-mobile.png); other per-run artifacts were removed.
- Continue D07. No push. Floating chat can cover arbitrary user-chosen locations; general dock presentation remains D22, not a reason to alter Booking workflows.
