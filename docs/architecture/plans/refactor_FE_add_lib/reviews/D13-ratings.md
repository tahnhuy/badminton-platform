# D13 — Đánh giá hiện có

19/11/2026 · DONE · thực hiện tuần tự theo ủy quyền; không push.

## Đã đổi và giữ nguyên

- Chuyển `/ratings/given`, RatingModal, StarRating và UserRatingsPanels sang token, PageContainer/PageHeader, Dialog/Progress/Textarea/Button, RadioGroup Radix và icon lucide. Nút sao 44 px, footer gọn, bảng cuộn trong vùng có thể focus trên mobile; giữ hai điểm 1–5 và điểm đã gửi chỉ đọc.
- Giữ nguyên các khối load/updateDraft/submit (đối chiếu nguyên văn), request version, chống gửi trùng, giữ nháp, validation/payload, thứ tự/phân trang 20 lịch sử và 5/panel Admin, quyền/URL. Radix giữ focus vào dialog lúc mở, Tab/Shift+Tab/Escape và trả focus như trước; điểm không tự chọn khi mở.
- Nhãn GROUP hiển thị Giao lưu; bỏ lời hứa nâng trình từ rating để thống nhất quyết định tài liệu 08/11, dùng lời nhắc đánh giá công bằng. Không thay backend điều chỉnh trình độ cũ hoặc triển khai khảo sát/tournament.

## Dùng chung và cleanup

- Thêm primitive `ui/table.tsx`, `ui/radio-group.tsx`; `common/data-table.tsx` là facade modern trên **cùng** bộ render/selection DataTable. Facade cũ giữ mặc định legacy cho Owner/Admin chưa chuyển; không nhân bản logic bảng hoặc thay giao diện các consumer cũ. Dọn nhánh/facade legacy khi consumer cuối được chuyển.
- Xóa `ratings.css` sau kiểm tra hết consumer. Đổi tên `ratings.spec.ts` → `ratings-ui.spec.ts`, giữ 13 case và bổ sung 2 case responsive/bảng cuộn; mock đầy đủ API shell bằng helper chung, không để request 401 thật gây logout trong test mô phỏng. Không thêm ảnh/JSON/log vào Git.
- Self-review: giữ RadioGroup bị khóa khi submit như fieldset cũ; sửa icon đóng bị co; thêm `DialogContent.overlayClassName` tùy chọn, mặc định không đổi. Rating và LeaveMatch giữ lớp 1000 như legacy để bong bóng chat không đè CTA; có test nút gửi không bị che. Shared primitive không đổi lớp mặc định của các dialog khác.

## Kiểm chứng và giới hạn

- Build/lint PASS (30 warning legacy, warning bundle); check:ui **118 file, 4 stylesheet legacy**. Baseline sau cô lập API **13/13 PASS** trước đổi source; sau đổi **40 test mục tiêu PASS**: 15 Ratings, 19 Match detail và 6 Post detail. Giữ coverage, thêm assertion payload chính xác và kích thước icon/nút gửi.
- Dev chỉ đọc lịch sử 390/1280. Backend 3010 + `badminton_test`: fixture Ratings hiện có, gửi điểm 5/4 và comment qua phiên thật → xem/tải lại lịch sử → đối chiếu API lưu đúng; Admin xem được bản ghi. Lần đầu harness đoán nhầm trang đích Admin, đã kiểm tra lại riêng tại `/admin/users` PASS, không sửa app vì lỗi harness. Các phiên đều logout 204; không reset/ghi dev.
- Xem modal 390/1280, không tràn ngang, icon đóng đủ kích thước, CTA không bị chat che. Không gửi thêm rating khi kiểm tra hình thức lần cuối. Fixture chỉ ở DB test. Chưa kiểm tra Safari/Firefox hoặc thay cơ chế nghiệp vụ Ratings theo quyết định tương lai.
