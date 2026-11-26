# Khảo sát nhu cầu sử dụng nền tảng cầu lông

Bản rút gọn gồm **22 câu hỏi trong 6 phần**, tập trung vào ba bài toán: tìm người chơi phù hợp, đặt sân và thanh toán rõ ràng, quản lý giải đấu ít sai sót. Nội dung bám theo [phạm vi dự án](../../PROJECT-BRIEF.md).

Mỗi người chỉ trả lời nhánh phù hợp: **15 câu** nếu chưa dự giải, **17 câu** nếu đã dự hoặc tổ chức giải, **10 câu** nếu chỉ quản lý sân, **20–22 câu** nếu vừa chơi vừa quản lý sân, **5 câu** nếu chưa chơi hoặc không thuộc nhóm khảo sát. Các số này tính cả câu góp ý tùy chọn; bảng gồm nhiều dòng đánh giá. Thời gian mục tiêu khoảng 4–6 phút cho nhánh thông thường, cần thử thực tế trước khi phát rộng; người kiêm hai vai trò có thể mất lâu hơn.

## Thiết lập Google Forms

- Giới thiệu rồi vào câu hỏi ngay, không có câu xác nhận tham gia.
- Mỗi “Trang” là một Section. Câu điều hướng đặt cuối trang, dùng Multiple choice và bật chuyển phần theo đáp án.
- Không thu email, không giới hạn một lần trả lời theo tài khoản; bật thanh tiến trình, không trộn câu hỏi.
- “Khác” dùng ô nhập tự do. Câu chọn tối đa 3 có xác thực số lựa chọn. Đáp án phủ định ghi rõ chọn riêng; rà soát tổ hợp mâu thuẫn khi phân tích.
- Với bảng, chọn một đáp án mỗi dòng, không giới hạn một lượt chọn trên mỗi cột.
- Script đồng bộ nội dung tại [tao-khao-sat.gs](../../scripts/google-forms/tao-khao-sat.gs); cách chạy tại [README](../../scripts/google-forms/README.md).

### Điều hướng

| Điểm | Đáp án | Đích đến |
| --- | --- | --- |
| C01 | Người chơi hoặc vừa chơi vừa quản lý sân | Trang 2 |
| C01 | Chỉ quản lý sân | Trang 5 |
| C01 | Chưa chơi có dự định hoặc nhóm khác | Trang 6 |
| C10 | Chưa dự giải hoặc mới dự định | Trang 4 |
| C10 | Đã dự giải hoặc tổ chức giải | Trang 3 |
| C13 | Có quản lý sân | Trang 5 |
| C13 | Không quản lý sân | Trang 6 |
| Cuối Trang 3 | Tất cả | Trang 4 |
| Cuối Trang 5 | Tất cả | Trang 6 |
| Cuối Trang 6 | Tất cả | Gửi biểu mẫu |

Trang 2 kết thúc bằng C10; Trang 4 chỉ có C13 để định tuyến người kiêm hai vai trò. Người tổ chức giải là góc nhìn khảo sát, không phải vai trò hệ thống riêng.

## Trang 1 Giới thiệu và nhóm người trả lời

Chào bạn! Nhóm thực hiện đề tài “Số hóa hệ sinh thái cầu lông” muốn tìm hiểu khó khăn thực tế khi tìm bạn chơi, đặt sân và tham gia hoặc tổ chức giải đấu. Khảo sát dự kiến mất 4–6 phút tùy nhánh.

Không yêu cầu họ tên, email hoặc số điện thoại. Vui lòng không nhập thông tin định danh vào câu trả lời mở. Dữ liệu được tổng hợp phục vụ đề tài. Chúng tôi mong nhận được cả nhu cầu sử dụng lẫn lý do bạn hài lòng với cách hiện tại.

### C01 Lựa chọn nào mô tả đúng nhất tình trạng hiện tại của bạn

**Kiểu:** Một đáp án, điều hướng. **Bắt buộc:** Có.

- Tôi chơi cầu lông và không quản lý hoặc kinh doanh sân. → Trang 2.
- Tôi vừa chơi cầu lông vừa quản lý hoặc kinh doanh sân. → Trang 2.
- Tôi quản lý hoặc kinh doanh sân nhưng không chơi cầu lông. → Trang 5.
- Tôi chưa chơi nhưng có dự định bắt đầu. → Trang 6.
- Tôi không thuộc các nhóm trên. → Trang 6.

## Trang 2 Tìm người chơi và đặt sân

Trả lời theo trải nghiệm trong 3 tháng gần đây. “Kèo” là buổi hẹn chơi hoặc giao lưu có người đứng ra tổ chức và tuyển thêm người.

### C02 Bạn thường chơi cầu lông tại tỉnh hoặc thành phố nào

**Kiểu:** Văn bản ngắn. **Bắt buộc:** Có.

Chỉ ghi tỉnh/thành phố, không cần địa chỉ cụ thể. Có thể ghi “Chưa có địa điểm cố định”.

### C03 Trong 3 tháng gần đây bạn chơi cầu lông với tần suất nào

**Kiểu:** Danh sách thả xuống. **Bắt buộc:** Có.

- Chưa có buổi nào.
- Ít hơn 1 buổi/tháng.
- Từ 1 đến 3 buổi/tháng.
- Từ 1 đến 2 buổi/tuần.
- Từ 3 buổi/tuần trở lên.

### C04 Bạn đang dùng những cách nào để tìm người chơi cùng hoặc buổi giao lưu

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

- Chơi với nhóm quen cố định.
- Nhờ bạn bè giới thiệu.
- Nhóm hoặc bài đăng Facebook.
- Nhóm hoặc tin nhắn Zalo.
- Nhờ chủ sân hoặc người quản lý sân giới thiệu.
- Ứng dụng hoặc website chuyên về thể thao.
- Chưa từng tìm người chơi cùng. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C05 Bạn gặp các tình huống sau thường xuyên đến mức nào

**Kiểu:** Bảng một đáp án mỗi dòng. **Bắt buộc:** Có.

**Cột:** Chưa bao giờ / Hiếm khi / Thỉnh thoảng / Thường xuyên / Rất thường xuyên / Chưa có trải nghiệm.

**Dòng:**

- Khó tìm người phù hợp khu vực và lịch rảnh.
- Khó biết trình độ thực tế của người chơi mới.
- Bài tìm người bị trôi hoặc không rõ còn chỗ.
- Có người hủy sát giờ hoặc không đến.

### C06 Khi cân nhắc tham gia một kèo bạn ưu tiên thông tin nào nhất

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

Chọn tối đa 3 đáp án.

- Thời gian chơi.
- Khu vực hoặc sân cụ thể.
- Trình độ phù hợp.
- Số chỗ còn trống.
- Chi phí dự kiến mỗi người.
- Thông tin người tổ chức và người tham gia.
- Hình thức chơi đơn, đôi hoặc giao lưu nhóm.
- Tôi chưa có nhu cầu tham gia kèo. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C07 Hiện tại bạn thường đặt sân bằng cách nào

**Kiểu:** Một đáp án. **Bắt buộc:** Có.

- Gọi điện cho sân.
- Nhắn Zalo, Facebook hoặc ứng dụng nhắn tin khác.
- Đến sân đặt trực tiếp.
- Đặt qua ứng dụng hoặc website.
- Chơi theo lịch cố định đã thỏa thuận với sân.
- Người khác đặt giúp, tôi không trực tiếp đặt.
- Chưa từng đặt hoặc nhờ đặt sân.
- Khác: ______.

### C08 Bạn từng gặp những vấn đề nào liên quan đến đặt sân trong 3 tháng gần đây

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

- Không biết khung giờ nào còn trống.
- Phải chờ sân trả lời hoặc xác nhận lâu.
- Giá theo khung giờ hoặc phụ phí chưa rõ.
- Sân đã được đặt nhưng lịch chưa cập nhật, dẫn đến trùng lịch.
- Sân hủy hoặc thay đổi lịch sát giờ.
- Không rõ điều kiện hủy và số tiền được hoàn.
- Khó theo dõi tiền đã trả hoặc tiền hoàn.
- Không gặp vấn đề nào. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Chưa có trải nghiệm. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C09 Bạn ưu tiên cách thanh toán nào khi đặt sân trực tuyến

**Kiểu:** Một đáp án. **Bắt buộc:** Có.

- Thanh toán trực tiếp từng lần qua ngân hàng hoặc ví điện tử.
- Nạp vào số dư nội bộ của nền tảng rồi dùng số dư để thanh toán.
- Đặt cọc trước một phần, thanh toán phần còn lại tại sân.
- Thanh toán toàn bộ tại sân.
- Không có ưu tiên.
- Chưa có ý kiến.

### C10 Trải nghiệm của bạn với giải đấu cầu lông trong 12 tháng gần đây là gì

**Kiểu:** Một đáp án, điều hướng. **Bắt buộc:** Có.

- Chưa từng tham gia hoặc tổ chức. → Trang 4.
- Có dự định nhưng chưa tham gia hoặc tổ chức. → Trang 4.
- Đã tham gia với tư cách vận động viên, chưa tổ chức. → Trang 3.
- Đã tổ chức hoặc tham gia ban tổ chức, có thể đồng thời là vận động viên. → Trang 3.

## Trang 3 Tham gia và tổ chức giải đấu

Trả lời theo trải nghiệm trong 12 tháng gần đây. Nếu chưa trực tiếp tổ chức, chọn những vấn đề bạn gặp với tư cách người dự giải.

### C11 Bạn gặp khó khăn nào khi tham gia hoặc tổ chức giải cầu lông

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

- Khó tìm thông tin giải hoặc nội dung phù hợp trình độ.
- Khó theo dõi đăng ký và lệ phí.
- Khó kiểm tra điều kiện hoặc trình độ người tham dự.
- Tốn công bốc thăm, xếp hạt giống hoặc xử lý suất miễn vòng đầu.
- Lịch bị trùng sân hoặc vận động viên.
- Khó cập nhật lịch, sơ đồ đấu và kết quả.
- Không gặp khó khăn đáng kể. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C12 Bạn muốn được hỗ trợ những công việc nào nhất liên quan đến giải đấu

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

Chọn tối đa 3 đáp án.

- Tìm giải và đăng ký nội dung đơn hoặc đôi trực tuyến.
- Quản lý danh sách đăng ký và lệ phí.
- Tạo sơ đồ đấu có xét hạt giống và suất miễn vòng đầu.
- Xếp lịch tránh trùng sân và vận động viên.
- Theo dõi lịch, kết quả và nhận thông báo thay đổi.
- Lưu thành tích có xác nhận vào hồ sơ người chơi.
- Chưa cần các hỗ trợ này. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

## Trang 4 Chuyển đến phần phù hợp

### C13 Hiện bạn có trực tiếp quản lý hoặc kinh doanh sân cầu lông không

**Kiểu:** Một đáp án, điều hướng. **Bắt buộc:** Có.

- Có. → Trang 5.
- Không. → Trang 6.

## Trang 5 Quản lý và vận hành sân

Dành cho người trực tiếp quản lý hoặc kinh doanh sân. Nếu phụ trách nhiều cơ sở, hãy chọn một cơ sở bạn nắm rõ nhất. Các câu về khó khăn xét trong 3 tháng gần đây.

### C14 Cơ sở bạn đang phụ trách có bao nhiêu sân cầu lông

**Kiểu:** Danh sách thả xuống. **Bắt buộc:** Có.

- 1–2 sân.
- 3–5 sân.
- 6–10 sân.
- Trên 10 sân.

### C15 Bạn hiện dùng cách nào để ghi nhận và quản lý lịch sân

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

- Sổ hoặc bảng ghi chép.
- Excel hoặc Google Sheets.
- Lịch trên điện thoại hoặc Google Calendar.
- Lịch sử tin nhắn Zalo hoặc Facebook.
- Phần mềm quản lý sân.
- Chưa có công cụ theo dõi cố định. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C16 Trong 3 tháng gần đây cơ sở gặp các tình huống sau thường xuyên đến mức nào

**Kiểu:** Bảng một đáp án mỗi dòng. **Bắt buộc:** Có.

**Cột:** Chưa bao giờ / Hiếm khi / Thỉnh thoảng / Thường xuyên / Rất thường xuyên / Không nắm thông tin.

**Dòng:**

- Lịch nhận qua nhiều kênh khó tổng hợp hoặc bị trùng.
- Khách hủy sát giờ hoặc không đến.
- Mất thời gian trả lời giờ trống và giá sân.
- Khó đối soát tiền thu hoặc xử lý hoàn tiền khi có sự cố.

### C17 Bạn cần các chức năng quản lý sân sau ở mức độ nào

**Kiểu:** Bảng một đáp án mỗi dòng. **Bắt buộc:** Có.

**Cột:** 1 Không cần thiết / 2 Ít cần thiết / 3 Bình thường / 4 Cần thiết / 5 Rất cần thiết / Chưa rõ hoặc không áp dụng.

**Dòng:**

- Lịch trống và lượt đặt cập nhật theo thời gian thực.
- Cấu hình giá theo ngày và khung giờ.
- Khóa giờ bảo trì, thông báo và hoàn tiền khi sân hủy.
- Theo dõi doanh thu, giao dịch và rút tiền để đối soát.

### C18 Bạn sẵn sàng áp dụng xác nhận đặt sân tự động sau khi khách thanh toán ở mức độ nào

**Kiểu:** Một đáp án. **Bắt buộc:** Có.

Khách chọn khung giờ còn trống trên hệ thống; sau khi thanh toán thành công, lịch được xác nhận và cập nhật mà không cần chủ sân duyệt từng lượt.

- Hoàn toàn chưa sẵn sàng.
- Ít sẵn sàng.
- Cần tìm hiểu thêm.
- Sẵn sàng.
- Rất sẵn sàng.

## Trang 6 Ưu tiên và góp ý

Đánh giá theo nhu cầu hiện tại. Nếu chưa chơi cầu lông, trả lời theo điều bạn mong đợi khi bắt đầu.

### C19 Nếu có một nền tảng cầu lông mới bạn muốn ưu tiên những nhóm chức năng nào

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

Chọn tối đa 3 đáp án.

- Tìm kèo và tuyển người chơi phù hợp.
- Tìm sân trống và đặt sân trực tuyến.
- Quản lý thanh toán, chia tiền và tra cứu hoàn tiền.
- Tìm và đăng ký giải đấu.
- Quản lý tổ chức giải, sơ đồ đấu và lịch thi đấu.
- Hồ sơ trình độ và thành tích.
- Nhắn tin riêng hoặc theo nhóm kèo.
- Bảng tin chia sẻ cộng đồng.
- Tôi chưa cần nền tảng mới. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C20 Những điều gì có thể khiến bạn không sử dụng một nền tảng cầu lông mới

**Kiểu:** Nhiều đáp án. **Bắt buộc:** Có.

- Đã hài lòng với Facebook, Zalo hoặc cách hiện tại.
- Ít người chơi hoặc ít sân ở khu vực của tôi.
- Thông tin lịch sân hoặc kèo không đáng tin cậy.
- Quy trình đăng ký và sử dụng mất thời gian.
- Lo ngại dữ liệu cá nhân.
- Không muốn nạp tiền vào số dư nội bộ.
- Phí sử dụng hoặc phí giao dịch.
- Không muốn chuyển sang một ứng dụng khác.
- Chưa thấy trở ngại đáng kể. Chỉ chọn đáp án này nếu không chọn đáp án khác.
- Khác: ______.

### C21 Nếu nền tảng đáp ứng nhu cầu của bạn khả năng bạn dùng thử là bao nhiêu

**Kiểu:** Thang điểm 1–5. **Bắt buộc:** Có.

**Nhãn:** 1 Chắc chắn không dùng thử; 5 Chắc chắn sẽ dùng thử.

### C22 Theo bạn vấn đề quan trọng nhất mà một nền tảng cầu lông cần giải quyết là gì

**Kiểu:** Văn bản dài. **Bắt buộc:** Không.

Bạn có thể nêu nhu cầu chưa được hỏi, góp ý về một chức năng hoặc lý do bạn không cần nền tảng này.

**Thông báo sau khi gửi:** Cảm ơn bạn đã chia sẻ! Ý kiến của bạn sẽ giúp nhóm xác định những vấn đề thực tế và ưu tiên chức năng phù hợp cho đề tài.

## Cách dùng kết quả để làm rõ bài toán dự án

Phần này dành cho nhóm nghiên cứu, không đưa vào form.

| Bài toán cần kiểm chứng | Bằng chứng hiện trạng | Nhu cầu hoặc phương án giải quyết |
| --- | --- | --- |
| Tìm người chơi phân tán, khó khớp lịch và trình độ, thiếu thông tin chỗ trống | C04–C05 | C06 và ưu tiên tìm kèo tại C19 |
| Đặt sân qua nhiều kênh, thiếu lịch trống, thông tin giá và hoàn tiền | C07–C08 | C09 và ưu tiên đặt sân, thanh toán tại C19 |
| Đăng ký, bốc thăm, xếp lịch và cập nhật giải còn bất tiện | C10–C11 | C12, gồm thuật toán phân nhánh và tránh trùng lịch |
| Quản lý sân khó tổng hợp lịch và đối soát | C14–C16 | C17–C18 |
| Các nghiệp vụ và trao đổi bị tách rời | C04, C07, C15 | C19 có nhắn tin, hồ sơ và bảng tin để so sánh với ba nghiệp vụ chính |
| Rào cản chuyển sang nền tảng mới | C20 | C21–C22 |

- Báo cáo cả tỷ lệ gặp khó khăn lẫn tỷ lệ chưa gặp/không cần; không coi danh sách chức năng là bằng chứng nhu cầu nếu không đối chiếu hiện trạng.
- Tách người chơi, chủ sân và người chưa chơi dựa trên C01. Nhóm kiêm hai vai trò xuất hiện trong hai phân tích nhưng chỉ tính một người khi báo cáo tổng mẫu.
- Câu bị bỏ qua do phân nhánh không phải câu trả lời phủ định. C11–C12 chỉ phân tích người từng dự hoặc tổ chức giải, tách hai góc nhìn theo C10.
- Với câu nhiều đáp án, mẫu số là số người trả lời câu đó; tổng tỷ lệ có thể vượt 100%. Đánh dấu các tổ hợp vừa chọn đáp án phủ định vừa chọn vấn đề để rà soát.
- Với bảng, tách “Chưa có trải nghiệm”, “Không nắm thông tin”, “Chưa rõ hoặc không áp dụng” khỏi mẫu số đánh giá. C05/C16 thể hiện tần suất; C17 thể hiện nhu cầu, không gộp hai loại thang đo.
- C09 kiểm tra mức chấp nhận hình thức thanh toán, không mặc định người trả lời muốn dùng ví nội bộ. C18 kiểm tra mức sẵn sàng xác nhận sân tự động. Kết quả không tự thay đổi quy tắc dự án.
- C21 đo ý định dùng thử, không phải cam kết sử dụng thực tế. Thử các nhánh và đo thời gian trên điện thoại trước khi phát rộng.
