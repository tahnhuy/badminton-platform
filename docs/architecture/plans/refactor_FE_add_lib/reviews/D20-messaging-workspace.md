# D20 — Workspace và danh sách tin nhắn

- Phạm vi: MessagingWorkspacePage, danh sách/bộ lọc, modal tìm Player/mở 1-1/tạo nhóm. Room/Dock còn D21/D22; không sửa service/socket/hook.
- Người dùng: hàng hội thoại và trạng thái chưa đọc chưa rõ; sidebar chật trên mobile, modal thiếu focus/nhãn. Thiết kế: card/token/lucide, avatar và trạng thái theo dữ liệu thật, vùng cuộn riêng; không trang trí cản nội dung.
- Giữ thứ tự API, list 1/50, lọc cục bộ ALL/UNREAD/GROUP + tên trim/lowercase, preview/giờ/unread/presence, tìm Player 20 mỗi thay đổi, defaults/validation/payload/reset/navigation, event/reconnect/unread callbacks và key room.
- Modal/list/filter/identity tách thành UI dùng chung trong feature để Dock D22 tái sử dụng; primitive ToggleGroup ở components/ui. Xóa CSS riêng workspace hết consumer, giữ CSS Room/Dock/Blocks tới đợt tương ứng. Không thêm dependency hay data layer.
- Build/lint/check:ui PASS (167 file, 3 stylesheet legacy); 9 test Messaging/Workspace PASS; kiểm tra lại case nhóm sau đối chiếu callback giữ checked từ render PASS. Các test cũ được đưa vào config UI mô phỏng, giữ assertion gửi thất bại/retry cùng clientMessageId/read marker/dock/blocks, bổ sung mock shell đầy đủ để không gọi backend ngoài ý muốn.
- Backend thật trên DB test: tạo 2 Player có profile bằng API Admin; list/modal tìm kiếm 390/1280 không tràn; mở DIRECT và tạo GROUP qua UI, API xác nhận counterpart/members/title, không page error, logout 204. Không reset dev.
- Xóa CSS workspace/sidebar riêng hết consumer; giữ CSS Room/Dock/Blocks tới D21–D23. List item/filter/dialog/identity ở feature; ToggleGroup primitive ở components/ui. Không đổi service/socket/requests/realtime.
- Phát hiện cũ: tìm Player bất đồng bộ chưa chống response cũ; giữ nguyên, không tiện sửa trong đợt UI. Bàn giao kỹ thuật theo ủy quyền, tiếp theo D21. Artifact ngoài Git.
