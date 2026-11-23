# D22 — Bong bóng và khung chat nhanh

- Phạm vi GlobalChatDock: bubble/unread, cửa sổ inbox/room, list/filter/search/start dialogs và animation. Reuse UI D20/D21, không chép renderer/form.
- Giữ hook kéo/thả, ngưỡng drag, clamp/header/bottom-nav/storage key và consumeWasDragged; auth/route gate; unread/list/event/reconnect/search requests; filter/order, compact room keys/callbacks/navigation; timer đóng 165 ms và hình học cửa sổ hiện có (mobile bottom 8).
- UI: token/lucide/Motion, vùng bấm 44px, transition ngắn và reduced-motion theo provider. Runtime offset/height qua style variables, không thêm CSS đè legacy.
- Xóa CSS Dock/modal/list chỉ khi hết consumer; Blocks còn D23. Không đổi API/provider/cache/logic hoặc thêm dependency.
- Build/lint/check:ui PASS (173 file, 3 stylesheet legacy). 24 ca Messaging tổng: 18 Room/Workspace/cũ đạt, rerun toàn bộ 6 Dock đạt sau sửa test chờ Motion ổn định và pause clock trước assertion 165 ms. Không sửa timer/clamp để hợp thức hóa test.
- Backend/DB test và WebSocket thật: incoming cập nhật unread/list, gửi trả lời từ compact room giữ URL /feed và bên kia nhận ngay; responsive 390/1280; back/collapse/drag lưu offset không mở nhầm; expand đúng /messages/:id và dock ẩn. Không page error; logout 204.
- Đối chiếu AST 8 callback/filter giữ nguyên; hook kéo và service/socket không đổi. Motion chỉ điều khiển hình thức; state đóng vẫn 165 ms, runtime offset/height qua biến style. Shared list/start dialogs/room thay phần UI lặp, không có renderer riêng thứ hai.
- Xóa 37 rule CSS Dock/list/modal hết consumer và 7 keyframe không còn animation tham chiếu. messaging.css chỉ còn cho BlockList tới D23. Không thêm artifact/dependency/backend change. Tiếp theo D23.
