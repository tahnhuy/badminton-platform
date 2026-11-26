# KHUNG BÁO CÁO ĐỒ ÁN MÔN HỌC CÔNG NGHỆ PHẦN MỀM

> Trạng thái: Khung soạn thảo, chưa phải báo cáo hoàn chỉnh.
>
> Nguồn xây dựng: [Báo cáo TLCN mẫu](<Báo Cáo TLCN final.md>) và [Rubric đồ án môn học CNPM v2](Rubric_Do_An_Mon_Hoc_CNPM_v2.docx.md).
>
> Khung kế thừa bố cục báo cáo TLCN, sửa thứ tự chương và bổ sung các phần minh chứng theo rubric. Các nội dung đặc thù VBook trong báo cáo mẫu không mặc định áp dụng cho đề tài mới. Thay `[Điền ...]` bằng thông tin thực tế; lặp bảng mẫu theo số lượng chức năng. Ngưỡng rubric là mốc tham chiếu, không phải kết quả đã đạt; bộ metric chính thức phải được thống nhất với giảng viên tại Bước 3. Không tự bổ sung số liệu hoặc xác nhận chưa có minh chứng.

## Cách sử dụng khung

- Điền thông tin đề tài, mục tiêu và phạm vi đã đăng ký trước khi viết nội dung chi tiết.
- Viết theo mạch: vấn đề → cơ sở lý thuyết → giải pháp → thực nghiệm → bàn luận → kết luận.
- Mỗi nhận định về kết quả cần dẫn tới bảng số liệu, báo cáo chạy hoặc minh chứng cụ thể.
- Khi dùng cho dự án trong repository này, đối chiếu phạm vi với `PROJECT-BRIEF.md` và tài liệu kiến trúc/PRD/Tech Design có thẩm quyền; báo cáo không thay thế các tài liệu đó.
- Khi xuất bản nộp, bỏ hướng dẫn soạn thảo và tạo lại mục lục, danh mục hình/bảng theo bản cuối cùng; dùng mẫu trình bày chính thức của Khoa/Trường.

# PHẦN ĐẦU BÁO CÁO

## Trang bìa và trang phụ bìa

- Trường: `[Điền tên trường]`
- Khoa/Bộ môn: `[Điền thông tin]`
- Loại báo cáo/Học phần: `[Điền thông tin]`
- Tên đề tài: **[Điền tên đề tài đã đăng ký]**
- Giảng viên hướng dẫn: `[Điền học vị, họ tên]`
- Sinh viên thực hiện, MSSV, lớp: `[Điền thông tin từng thành viên]`
- Khóa/Năm học: `[Điền thông tin]`
- Địa điểm, tháng/năm: `[Điền thông tin]`

## Phiếu nhận xét của giảng viên hướng dẫn

`[Chèn phiếu theo mẫu chính thức; phần nhận xét và xác nhận do giảng viên thực hiện.]`

## Phiếu nhận xét của giảng viên phản biện

`[Chèn phiếu theo mẫu chính thức.]`

## Lời cam đoan

`[Cam đoan về nguồn gốc nội dung, tính trung thực của số liệu, trích dẫn và khai báo sử dụng AI đúng thực tế.]`

## Lời cảm ơn

`[Điền lời cảm ơn phù hợp.]`

## Tóm tắt báo cáo

`[Tóm tắt bài toán, đối tượng sử dụng, mục tiêu, phương pháp, sản phẩm, kết quả đo lường chính và giới hạn. Chỉ điền kết quả sau khi có minh chứng.]`

## Mục lục

1. Phần mở đầu
2. Chương 1. Khảo sát hiện trạng và xác định yêu cầu
3. Chương 2. Cơ sở lý thuyết, công nghệ và lựa chọn giải pháp
4. Chương 3. Phân tích và thiết kế hệ thống
5. Chương 4. Cài đặt, hoàn thiện sản phẩm và quản lý chất lượng
6. Chương 5. Kiểm thử phần mềm
7. Chương 6. Triển khai CI/CD và vận hành
8. Chương 7. Thực nghiệm người dùng, đánh giá và cải tiến
9. Phần kết luận
10. Tài liệu tham khảo
11. Phụ lục và hồ sơ minh chứng

## Danh mục từ viết tắt

| Viết tắt | Tên đầy đủ | Giải thích trong đề tài |
| --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` |

## Danh mục bảng và danh mục hình

`[Tạo từ các bảng/hình thực tế. Đánh số nhất quán theo chương, có chú thích và dẫn chiếu trong nội dung, ví dụ: Bảng 1.1, Hình 3.1.]`

# PHẦN MỞ ĐẦU

## 1. Lý do chọn đề tài

`[Trình bày bối cảnh, vấn đề thực tế, người gặp vấn đề và căn cứ cho thấy cần giải quyết.]`

## 2. Tính cấp thiết và ý nghĩa thực tiễn

`[Mô tả tác động hiện tại, hạn chế của cách làm đang sử dụng và giá trị dự kiến của sản phẩm; dẫn nguồn hoặc dữ liệu khảo sát.]`

## 3. Mục tiêu đề tài

### 3.1. Mục tiêu tổng quát

`[Điền mục tiêu gắn với vấn đề thực tế.]`

### 3.2. Mục tiêu cụ thể và sản phẩm đầu ra

| Mã mục tiêu | Mục tiêu | Sản phẩm đầu ra | KPI đánh giá | Minh chứng dự kiến |
| --- | --- | --- | --- | --- |
| MT-01 | `[Điền]` | `[Điền]` | KPI-01 | `[Điền]` |

## 4. Đối tượng và phạm vi nghiên cứu

### 4.1. Đối tượng nghiên cứu và nhóm người dùng

`[Điền nghiệp vụ, đối tượng nghiên cứu và nhóm người dùng mục tiêu.]`

### 4.2. Phạm vi thực hiện

`[Liệt kê chức năng, nền tảng, dữ liệu và môi trường nằm trong phạm vi đã thống nhất.]`

### 4.3. Nội dung ngoài phạm vi

`[Nêu rõ phần không thực hiện; phân biệt với hướng phát triển tương lai.]`

## 5. Phương pháp thực hiện

`[Mô tả cách khảo sát, phân tích yêu cầu, lựa chọn giải pháp, xây dựng, kiểm thử và đánh giá với người dùng.]`

## 6. Kế hoạch, phân công và mốc thống nhất sản phẩm

| Giai đoạn/Tuần | Công việc | Người phụ trách | Đầu ra | Minh chứng tiến độ |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Ghi thời gian bắt đầu/kết thúc, mốc 50% thời gian, ngày chốt sản phẩm và metric; dẫn bản có chữ ký sinh viên và giảng viên cùng kết luận rà soát của bộ môn. Báo cáo tiến độ tối thiểu 1 lần/tuần theo rubric.]`

## 7. Bố cục báo cáo

`[Giới thiệu ngắn nội dung và mối liên hệ giữa các chương.]`

# CHƯƠNG 1. KHẢO SÁT HIỆN TRẠNG VÀ XÁC ĐỊNH YÊU CẦU

> Tiêu chí chính: TC1 (10 điểm), TC2.1 (10 điểm).

## 1.1. Bối cảnh và quy trình nghiệp vụ hiện tại

`[Mô tả quy trình hiện tại, tác nhân, dữ liệu, điểm bất tiện và hậu quả. Chèn mô hình quy trình có dẫn chiếu.]`

## 1.2. Khảo sát/phỏng vấn bên liên quan

### 1.2.1. Mục tiêu, đối tượng và phương pháp khảo sát

`[Nêu thời gian, cách chọn mẫu, số người tiếp cận, số phản hồi hợp lệ, tiêu chí loại phản hồi và giới hạn mẫu. Mốc Mức 5: ≥ 3 bên liên quan thực hoặc ≥ 30 phiếu khảo sát, có dữ liệu và biên bản.]`

### 1.2.2. Công cụ và kết quả khảo sát

| Câu hỏi/Vấn đề | Số phản hồi hợp lệ | Kết quả | Nhận định | Minh chứng |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền số lượng và tỷ lệ]` | `[Điền]` | `[Điền]` |

### 1.2.3. Chân dung người dùng và nhu cầu ưu tiên

| Nhóm người dùng | Mục tiêu | Khó khăn hiện tại | Nhu cầu | Căn cứ khảo sát |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 1.3. Khảo sát và so sánh giải pháp hiện có

`[Mốc Mức 5: so sánh ≥ 3 giải pháp. Chọn tiêu chí liên quan trực tiếp tới bài toán, ghi nguồn và thời điểm khảo sát.]`

| Tiêu chí | Giải pháp 1 | Giải pháp 2 | Giải pháp 3 | Định hướng của đề tài |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền kèm nguồn]` | `[Điền kèm nguồn]` | `[Điền kèm nguồn]` | `[Điền]` |

## 1.4. Khoảng trống và phát biểu bài toán

`[Tổng hợp điều chưa được giải quyết phù hợp với nhóm người dùng; giải thích vì sao phạm vi đề tài có thể xử lý khoảng trống đó.]`

## 1.5. Yêu cầu chức năng

| Mã yêu cầu | Nhóm chức năng | Tác nhân | Mô tả | Ưu tiên | Tiêu chí chấp nhận |
| --- | --- | --- | --- | --- | --- |
| FR-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | AC-01 |

`[Liệt kê đầy đủ yêu cầu trong phạm vi; đặc tả chi tiết tại Chương 3. Mốc Mức 5: 100% user story/use case có acceptance criteria.]`

## 1.6. Yêu cầu phi chức năng

| Mã | Nhóm chất lượng | Yêu cầu định lượng | Điều kiện đo | Cách kiểm chứng |
| --- | --- | --- | --- | --- |
| NFR-01 | Hiệu năng | `[Điền ngưỡng]` | `[Điền tải, dữ liệu, môi trường]` | `[Điền]` |
| NFR-02 | Khả năng phục vụ đồng thời | `[Điền ngưỡng]` | `[Điền]` | `[Điền]` |
| NFR-03 | Bảo mật | `[Điền điều kiện đạt đo được]` | `[Điền]` | `[Điền]` |
| NFR-04 | Độ tin cậy/Khôi phục | `[Điền ngưỡng]` | `[Điền]` | `[Điền]` |
| NFR-05 | Khả dụng/Tương thích | `[Điền ngưỡng]` | `[Điền]` | `[Điền]` |

`[Các nhóm trên là gợi ý để điền theo đề tài. Mốc Mức 5: ≥ 5 NFR có ràng buộc định lượng.]`

## 1.7. Quy tắc nghiệp vụ và từ điển dữ liệu nghiệp vụ

| Mã quy tắc | Nội dung | Điều kiện áp dụng | Ngoại lệ | Nguồn xác nhận |
| --- | --- | --- | --- | --- |
| BR-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Giải thích thuật ngữ và trạng thái nghiệp vụ. Nếu tài liệu nguồn đã tồn tại, tóm tắt và dẫn chiếu đúng phiên bản.]`

## 1.8. Bộ KPI nghiệp vụ đã thống nhất

| Mã KPI | Mục tiêu liên quan | Chỉ số và công thức | Giá trị ban đầu | Ngưỡng cam kết | Phương pháp đo | Minh chứng xác nhận |
| --- | --- | --- | --- | --- | --- | --- |
| KPI-01 | `[Điền]` | `[Điền]` | `[Điền/chưa đo]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Mốc Mức 5: ≥ 5 KPI nghiệp vụ định lượng được chốt ở Bước 3 và duy trì nhất quán tới bảo vệ. Phân biệt KPI nghiệp vụ với metric kỹ thuật như coverage hoặc số lần deploy.]`

## 1.9. Tổng kết chương

`[Kết luận về nhu cầu, phạm vi và các yêu cầu làm căn cứ thiết kế.]`

# CHƯƠNG 2. CƠ SỞ LÝ THUYẾT, CÔNG NGHỆ VÀ LỰA CHỌN GIẢI PHÁP

> Tiêu chí chính: TC2.1, TC4 (10 điểm).

## 2.1. Cơ sở lý thuyết liên quan trực tiếp tới bài toán

`[Trình bày khái niệm, mô hình, thuật toán hoặc nguyên lý thực sự được áp dụng; giải thích áp dụng ở đâu và dẫn tài liệu.]`

## 2.2. Các phương án giải quyết

| Vấn đề cần quyết định | Phương án | Ưu điểm | Hạn chế/Chi phí | Mức phù hợp |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 2.3. Lựa chọn kiến trúc và công nghệ

| Thành phần | Công nghệ/Phiên bản | Vai trò | Lý do chọn | Đánh đổi | Tài liệu tham khảo |
| --- | --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Không sao chép danh sách công nghệ của VBook. Chỉ ghi lựa chọn đã được xác nhận của đề tài; quyết định chưa chốt ghi rõ chưa xác định.]`

## 2.4. Vận dụng tài liệu và tổng kết chương

`[Nêu cách cơ sở lý thuyết dẫn tới lựa chọn giải pháp. Mốc Mức 5 của TC4: vận dụng ≥ 5 tài liệu ngoại ngữ chất lượng; dẫn tài liệu tại đúng luận điểm sử dụng.]`

# CHƯƠNG 3. PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG

> Tiêu chí chính: TC2.1. Mốc Mức 5: ≥ 4 loại sơ đồ, khớp 100% với mã nguồn khi đối chiếu.

## 3.1. Tác nhân và sơ đồ Use Case tổng quát

`[Mô tả trách nhiệm, quyền hạn và ranh giới của từng tác nhân; chèn sơ đồ.]`

## 3.2. Đặc tả Use Case/User Story

### 3.2.1. UC-01 — [Tên chức năng]

| Thuộc tính | Nội dung |
| --- | --- |
| Yêu cầu liên quan | `[FR-..., BR-...]` |
| Mục tiêu, tác nhân | `[Điền]` |
| Tiền điều kiện, kích hoạt | `[Điền]` |
| Luồng chính | `[Điền từng bước]` |
| Luồng thay thế | `[Điền]` |
| Luồng lỗi, ngoại lệ | `[Điền]` |
| Hậu điều kiện | `[Điền]` |
| Tiêu chí chấp nhận | `[AC-...: điều kiện đầu vào, hành động, kết quả mong đợi đo/kiểm tra được]` |

`[Lặp mục này cho toàn bộ chức năng trong phạm vi.]`

## 3.3. Mô hình quy trình và trạng thái nghiệp vụ

`[Chèn activity/BPMN và state diagram nếu phù hợp; giải thích chuyển trạng thái, điều kiện và ngoại lệ.]`

## 3.4. Thiết kế kiến trúc tổng thể

### 3.4.1. Sơ đồ ngữ cảnh (Context)

`[Ranh giới hệ thống, tác nhân và hệ thống bên ngoài.]`

### 3.4.2. Sơ đồ thành phần (Component)

`[Trách nhiệm từng thành phần và quan hệ phụ thuộc.]`

## 3.5. Thiết kế dữ liệu

### 3.5.1. ERD và/hoặc sơ đồ lớp

`[Thực thể, quan hệ, bội số và ràng buộc; đối chiếu schema/migration thực tế.]`

### 3.5.2. Từ điển dữ liệu

| Thực thể/Trường | Ý nghĩa | Kiểu dữ liệu | Ràng buộc | Nguồn thiết kế |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 3.6. Thiết kế xử lý — sơ đồ tuần tự

`[Chèn sequence diagram cho luồng cốt lõi và luồng lỗi quan trọng; giải thích giao dịch, kiểm tra quyền và xử lý đồng thời khi có.]`

## 3.7. Thiết kế giao diện

`[Tổ chức màn hình theo tác nhân/luồng; mỗi hình có mục đích, thao tác và yêu cầu liên quan. Mô tả trạng thái tải, rỗng, lỗi, dữ liệu không hợp lệ và responsive.]`

## 3.8. Thiết kế API, bảo mật và xử lý ngoại lệ

`[Tóm tắt hợp đồng API, xác thực, phân quyền, validation, log và lỗi theo thiết kế thực tế; dẫn tài liệu chi tiết.]`

## 3.9. Sơ đồ triển khai (Deployment)

`[Mô tả các nút chạy, kết nối và môi trường thực tế. Phân biệt thiết kế dự kiến với cấu hình đã triển khai.]`

## 3.10. Truy vết và đối chiếu thiết kế với mã nguồn

| Yêu cầu | Use Case/AC | Sơ đồ/Thành phần | Vị trí mã nguồn | Test case | Kết quả đối chiếu |
| --- | --- | --- | --- | --- | --- |
| FR-01 | UC-01/AC-01 | `[Điền]` | `[Điền đường dẫn và phiên bản]` | TEST-01 | `[Chưa kiểm tra/khớp/lệch]` |

`[Ghi thay đổi thiết kế, lý do, ngày và báo cáo tiến độ liên quan; đối chiếu tối thiểu 5 điểm ngẫu nhiên theo cách đo rubric.]`

## 3.11. Tổng kết chương

`[Tóm tắt cách thiết kế đáp ứng yêu cầu và những đánh đổi chính.]`

# CHƯƠNG 4. CÀI ĐẶT, HOÀN THIỆN SẢN PHẨM VÀ QUẢN LÝ CHẤT LƯỢNG

> Tiêu chí chính: TC2.2 (10 điểm), TC2.3 (5 điểm), TC2.4 (10 điểm).

## 4.1. Môi trường và hướng dẫn cài đặt

`[Yêu cầu hệ thống, phiên bản công cụ, lấy mã nguồn, cấu hình mẫu không chứa secret, khởi tạo dữ liệu, build, chạy và kiểm tra. Dẫn README có thể tái lập.]`

## 4.2. Tổ chức mã nguồn và quy ước lập trình

`[Mô tả phân lớp/mô-đun, trách nhiệm, quy ước đặt tên, xử lý lỗi và quản lý cấu hình; dẫn coding convention.]`

## 4.3. Kết quả cài đặt theo nhóm chức năng

| Chức năng cam kết | Kết quả cài đặt | Minh chứng chạy thực tế | Ngoại lệ/Ca biên đã xử lý | Hạn chế còn lại |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Bổ sung ảnh màn hình thực tế có chú thích; phân biệt ảnh thiết kế với ảnh sản phẩm đã chạy.]`

## 4.4. Mức độ hoàn thành so với cam kết

| Hạng mục ở Bước 3 | Khối lượng/Trọng số đã thống nhất | Người phụ trách | Kết quả nghiệm thu | Minh chứng | Phần chưa hoàn thành |
| --- | --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Công bố cách tính tỷ lệ chức năng hoạt động và tỷ lệ khối lượng hoàn thành. Mốc Mức 5: 100% chức năng chính hoạt động, ≥ 100% khối lượng cam kết, demo không lỗi, môi trường production hoặc staging công khai có người dùng thực theo mô tả TC2.2. Nêu rõ loại môi trường; bảng metric Mục 5 của rubric dùng mốc production có người dùng thật.]`

## 4.5. Quản lý Git, review và tiến độ

`[Dẫn repository, lịch sử commit, Pull Request có review và nhật ký tuần. Nêu khoảng thời gian, mẫu số và cách đếm.]`

## 4.6. Chất lượng mã nguồn và bảo mật mã nguồn

| Metric | Mốc tham chiếu Mức 5 | Kết quả thực đo | Công cụ/Phạm vi/Ngày đo | Minh chứng |
| --- | --- | --- | --- | --- |
| Lỗi lint còn tồn | 0 | `[Điền]` | `[Điền]` | `[Điền]` |
| Issue Blocker/Critical phân tích tĩnh | 0 | `[Điền]` | `[Điền]` | `[Điền]` |
| Tỷ lệ mã trùng lặp | ≤ 3% | `[Điền]` | `[Điền]` | `[Điền]` |
| Tuần có commit | ≥ 90% | `[Điền]` | `[Điền]` | `[Điền]` |
| Thay đổi qua PR có review | ≥ 90% | `[Điền]` | `[Điền]` | `[Điền]` |
| Secret/Khóa API lộ trong repository | 0 | `[Điền]` | `[Điền]` | `[Điền]` |

## 4.7. Sử dụng và kiểm soát LLM/Agentic AI

### 4.7.1. Phạm vi sử dụng AI

`[Khai báo đúng công cụ, mục đích, phần AI hỗ trợ và trách nhiệm của từng thành viên. Đưa nhật ký đầy đủ vào phụ lục.]`

| Ngày/Người dùng | Công cụ | Nhiệm vụ/Prompt chính | Đầu ra AI/Vị trí mã | Phần sinh viên sửa | Cách kiểm chứng | Commit/PR |
| --- | --- | --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

### 4.7.2. Lỗi/ảo giác của AI đã phát hiện và sửa

| Mã | Đề xuất sai của AI | Nguyên nhân | Cách phát hiện | Cách sửa và kiểm tra lại | Commit minh chứng |
| --- | --- | --- | --- | --- | --- |
| AI-ERR-01 | `[Điền trường hợp có thật]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Mốc Mức 5: ≥ 5 trường hợp có phân tích nguyên nhân và commit sửa; giải thích đúng 100% khi được hỏi ngẫu nhiên ≥ 5 vị trí mã do AI sinh.]`

### 4.7.3. Quy trình kiểm soát đầu ra AI

`[Mô tả review, đối chiếu tài liệu chính thức, kiểm thử, kiểm tra giấy phép và bảo vệ dữ liệu nhạy cảm trong prompt. Nếu thực sự không dùng AI, thay phần nhật ký bằng cam kết không sử dụng kèm Git và tiến độ nhất quán; không dùng cam kết này khi đã có AI hỗ trợ.]`

## 4.8. Nợ kỹ thuật và tài liệu bàn giao

| Hạn chế/Nợ kỹ thuật | Ảnh hưởng | Ưu tiên | Hướng xử lý | Tài liệu bàn giao liên quan |
| --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

# CHƯƠNG 5. KIỂM THỬ PHẦN MỀM

> Tiêu chí chính: TC2.5 (5 điểm).

## 5.1. Kế hoạch kiểm thử

`[Mục tiêu, phạm vi, mô-đun cốt lõi, môi trường/dữ liệu, người thực hiện, công cụ, tiêu chí bắt đầu/kết thúc và cách lưu kết quả.]`

## 5.2. Chiến lược và các tầng kiểm thử

`[Mô tả các tầng đã thực hiện: unit, integration, API, E2E/UI, phi chức năng. Mốc Mức 5: ≥ 4 tầng; bao phủ luồng chính, ca âm, ca biên, quyền truy cập và tình huống lỗi phù hợp.]`

## 5.3. Bộ test case và truy vết yêu cầu

| Mã test | FR/UC/AC/NFR | Tầng | Tiền điều kiện/Dữ liệu | Các bước | Kết quả mong đợi | Thực tế/Trạng thái | Minh chứng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TEST-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Chưa chạy]` | `[Điền]` |

## 5.4. Kết quả kiểm thử và độ phủ

| Metric | Mốc tham chiếu Mức 5 | Kết quả thực đo | Cách tính/Phạm vi | Báo cáo/CI run |
| --- | --- | --- | --- | --- |
| Coverage dòng lệnh mô-đun cốt lõi | ≥ 70% | `[Điền]` | `[Điền]` | `[Điền]` |
| Test case tự động hóa | ≥ 70% | `[Điền]` | `[Điền]` | `[Điền]` |
| Test pass lần CI cuối | 100% | `[Điền]` | `[Điền]` | `[Điền]` |
| Defect Critical/Blocker còn tồn | 0 | `[Điền]` | `[Điền]` | `[Điền]` |

## 5.5. Quản lý lỗi và kiểm thử hồi quy

| Defect | Mức độ | Test/Yêu cầu liên quan | Nguyên nhân | Commit sửa | Regression test | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 5.6. Đánh giá đáp ứng NFR và giới hạn kiểm thử

`[So sánh từng NFR với số đo và điều kiện chạy; ghi rõ phần chưa kiểm thử, rủi ro và phạm vi có thể kết luận.]`

# CHƯƠNG 6. TRIỂN KHAI CI/CD VÀ VẬN HÀNH

> Tiêu chí chính: TC2.6 (5 điểm).

## 6.1. Môi trường triển khai và cách truy cập

`[URL, loại môi trường, phiên bản/commit đang chạy, thành phần hạ tầng và cách hội đồng truy cập. Cấp tài khoản demo qua kênh phù hợp, không ghi mật khẩu/secret vào báo cáo công khai.]`

## 6.2. Pipeline CI/CD

`[Chèn sơ đồ pipeline, giải thích trigger, từng chặng, điều kiện chặn triển khai và dẫn tệp cấu hình thực tế. Mốc Mức 5: ≥ 6 chặng gồm build, lint/phân tích tĩnh, test, quét bảo mật/phụ thuộc, đóng gói Docker và triển khai tự động. Đây là mốc rubric, không tự xác nhận lựa chọn hạ tầng cho dự án.]`

## 6.3. Kết quả chạy pipeline và triển khai

| Metric | Mốc tham chiếu Mức 5 | Kết quả | Khoảng thời gian/Cách tính | Minh chứng |
| --- | --- | --- | --- | --- |
| Tỷ lệ build xanh | ≥ 90% | `[Điền]` | `[Điền]` | `[Điền]` |
| Số lần triển khai tự động trong kỳ | ≥ 10 | `[Điền]` | `[Điền]` | `[Điền]` |
| Thời gian commit → staging | ≤ 15 phút | `[Điền]` | `[Điền]` | `[Điền]` |

## 6.4. Quản lý cấu hình, secret, phiên bản và rollback

`[Mô tả cách đang áp dụng, lịch sử phiên bản và quy trình rollback; bổ sung minh chứng thử khôi phục nếu có.]`

## 6.5. Giám sát và xử lý sự cố

`[Mô tả health check, log tập trung, monitoring, cảnh báo và hướng dẫn xử lý sự cố. Nêu rõ phần đã chạy và phần chưa triển khai.]`

# CHƯƠNG 7. THỰC NGHIỆM NGƯỜI DÙNG, ĐÁNH GIÁ VÀ CẢI TIẾN

> Tiêu chí chính: TC2.7 (5 điểm), TC1, TC4.

## 7.1. Mục tiêu, người tham gia và thiết kế thực nghiệm

`[Nêu câu hỏi đánh giá, tiêu chí chọn người dùng đúng đối tượng, cách thu thập, thời điểm và chỉ số xác định trước. Mốc Mức 5: ≥ 10 người dùng thực, không chỉ bạn cùng lớp; có danh sách ẩn danh và biên bản. Phân biệt khảo sát nhu cầu ở Chương 1 với thực nghiệm sử dụng sản phẩm ở chương này.]`

## 7.2. Kịch bản tác vụ

| Mã tác vụ | Nhóm người dùng | Nhiệm vụ | Điều kiện ban đầu | Tiêu chí thành công | Chỉ số thu thập |
| --- | --- | --- | --- | --- | --- |
| TASK-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 7.3. Dữ liệu và kết quả thực nghiệm

| Mã người dùng ẩn danh | Tác vụ | Thành công/Thất bại | Thời gian | Lỗi/Khó khăn | Phản hồi |
| --- | --- | --- | --- | --- | --- |
| P-01 | TASK-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Tổng hợp task success rate theo số lượt tác vụ thành công/tổng lượt hợp lệ; ghi cách xử lý lượt bỏ dở. Nếu dùng SUS, đính kèm bộ câu hỏi và cách tính. Mốc Mức 5: tỷ lệ hoàn thành ≥ 90%, SUS ≥ 80 hoặc CSAT/NPS tương đương với thang đo và căn cứ quy đổi được giải thích rõ.]`

## 7.4. Cải tiến theo phản hồi và đo lại

| Vấn đề | Minh chứng trước cải tiến | Thay đổi đã triển khai | Commit/Phiên bản | Kết quả đo lại | Chênh lệch |
| --- | --- | --- | --- | --- | --- |
| `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Mốc Mức 5: ≥ 1 vòng cải tiến có so sánh định lượng trước–sau. Nêu khác biệt mẫu, tác vụ hoặc môi trường có thể ảnh hưởng tới phép so sánh.]`

## 7.5. Đối chiếu mục tiêu và KPI đã cam kết

| Mục tiêu/KPI | Giá trị ban đầu | Ngưỡng cam kết Bước 3 | Kết quả cuối | Đạt/Chưa đạt | Minh chứng/Giải thích |
| --- | --- | --- | --- | --- | --- |
| KPI-01 | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

## 7.6. Bàn luận và giới hạn của kết quả

`[Phân tích nguyên nhân đạt/chưa đạt, giá trị thực tiễn, đánh đổi, sai lệch chọn mẫu, độ tin cậy và khả năng khái quát. Kết luận trong phạm vi số liệu đã thu thập.]`

# PHẦN KẾT LUẬN

## 1. Kết quả đạt được

### 1.1. Về kiến thức và phương pháp

`[Nêu kiến thức thực sự vận dụng và cách vận dụng.]`

### 1.2. Về kỹ năng và quá trình thực hiện

`[Nêu kỹ năng phân tích, thiết kế, lập trình, kiểm thử, vận hành và phối hợp; gắn với minh chứng.]`

### 1.3. Về sản phẩm và mức hoàn thành mục tiêu

`[Tổng hợp kết quả từ bảng KPI và nghiệm thu; không bổ sung kết quả chưa có ở phần nội dung.]`

## 2. Ưu điểm, hạn chế và nguyên nhân

`[Đánh giá dựa trên kiểm thử và thực nghiệm; phân biệt hạn chế sản phẩm, giới hạn nghiên cứu và phần ngoài phạm vi.]`

## 3. Hướng phát triển

`[Đề xuất theo mức ưu tiên và tính khả thi, xuất phát từ hạn chế đã phân tích.]`

## 4. Kết quả nổi bật — TC6 (tối đa 5 điểm)

| Kết quả có thật | Đóng góp của sinh viên | Minh chứng hợp lệ | Liên hệ với đề tài |
| --- | --- | --- | --- |
| `[Điền hoặc ghi chưa có]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Có thể gồm công bố, giải thưởng, xác nhận của đơn vị sử dụng, sở hữu trí tuệ, đóng góp mã nguồn mở, kết quả vượt xa KPI hoặc giải pháp có tính mới được ghi nhận. Không tự quy đổi thành điểm khi chưa được hội đồng đánh giá.]`

# TÀI LIỆU THAM KHẢO

`[Chọn một chuẩn trích dẫn thống nhất theo yêu cầu Khoa/Trường. Mỗi tài liệu có tác giả/tổ chức, tên, năm/phiên bản, nơi công bố hoặc URL, ngày truy cập khi phù hợp. Đánh dấu tài liệu ngoại ngữ và dẫn chiếu trong nội dung.]`

| Mã | Thông tin thư mục | Ngôn ngữ | Vị trí vận dụng | Nội dung đã vận dụng |
| --- | --- | --- | --- | --- |
| [1] | `[Điền]` | `[Điền]` | `[Chương/Mục]` | `[Điền]` |

`[Mốc Mức 5 của TC4: ≥ 5 tài liệu ngoại ngữ chất lượng có vận dụng, trùng lặp ≤ 20% ngoài trích dẫn hợp lệ, 0 lỗi chính tả/định dạng và 100% hình/bảng được đánh số, chú thích, dẫn chiếu.]`

# PHỤ LỤC VÀ HỒ SƠ MINH CHỨNG

## Phụ lục A. Đăng ký, phân công, tiến độ và cam kết

- Phiếu đăng ký đề tài của giảng viên và sinh viên, bảng phân công từng thành viên.
- Nhật ký tuần có xác nhận: công việc đã làm, vướng mắc, kế hoạch tuần tiếp theo.
- Cam kết sản phẩm và metric có chữ ký, chốt trước mốc 50% thời gian; kết luận rà soát của bộ môn.

## Phụ lục B. Dữ liệu khảo sát nhu cầu

`[Bộ câu hỏi, biên bản phỏng vấn, dữ liệu phản hồi đã ẩn danh, cách làm sạch dữ liệu và bảng tổng hợp.]`

## Phụ lục C. Đặc tả yêu cầu và thiết kế (SRS/SDD)

`[Tài liệu đầy đủ, sơ đồ đọc được và bảng truy vết. Nếu đã có tài liệu được quản lý riêng, dẫn đường dẫn và phiên bản nộp.]`

## Phụ lục D. Repository và quản lý chất lượng

`[Link repository đã cấp quyền hội đồng, commit/tag bàn giao, lịch sử commit/PR, coding convention, báo cáo phân tích tĩnh, quét secret, README và nợ kỹ thuật.]`

## Phụ lục E. Nhật ký AI hoặc cam kết không sử dụng

`[Nhật ký đầy đủ theo mục 4.7, liên kết commit sửa lỗi và checklist kiểm soát; chỉ dùng cam kết không sử dụng nếu đúng thực tế.]`

## Phụ lục F. Hồ sơ kiểm thử

`[Test plan, test case, mã nguồn test tự động, kết quả chạy, coverage, defect và trạng thái.]`

## Phụ lục G. CI/CD và vận hành

`[Tệp pipeline, lịch sử run/deploy, URL môi trường, phiên bản, minh chứng monitoring/alert và hướng dẫn rollback.]`

## Phụ lục H. Thực nghiệm người dùng

`[Danh sách ẩn danh, biên bản, kịch bản tác vụ, dữ liệu thô, bảng điểm SUS/CSAT/NPS, phản hồi và số đo trước–sau cải tiến.]`

## Phụ lục I. Kiểm tra trùng lặp và nguồn gốc nội dung

`[Báo cáo kiểm tra trùng lặp, tài liệu ngoại ngữ đã vận dụng, nguồn và giấy phép mã nguồn/tài nguyên bên ngoài.]`

## Phụ lục J. Kết quả nổi bật

`[Chỉ đính kèm minh chứng có thật: xác nhận sử dụng, chứng nhận, bài báo, PR được chấp nhận hoặc số liệu liên quan.]`

## Phụ lục K. Chuẩn bị thuyết trình và vấn đáp

> TC3 (10 điểm) và TC5 (15 điểm) được đánh giá tại buổi bảo vệ; tài liệu chuẩn bị không thay thế kết quả trình bày/vấn đáp thực tế.

### K.1. Kịch bản trình bày và demo

| Phần | Nội dung | Thời lượng dự kiến | Người trình bày | Minh chứng/Thao tác demo |
| --- | --- | --- | --- | --- |
| Bài toán | Nhu cầu và mục tiêu | `[Điền]` | `[Điền]` | `[Điền]` |
| Giải pháp | Thiết kế và đánh đổi | `[Điền]` | `[Điền]` | `[Điền]` |
| Demo | Luồng nghiệp vụ chính trên môi trường thật | `[Điền]` | `[Điền]` | `[Điền]` |
| Đánh giá | KPI, kiểm thử, người dùng, hạn chế | `[Điền]` | `[Điền]` | `[Điền]` |

`[Điền tổng thời gian theo quy định thực tế; mốc Mức 5: sai lệch ≤ 5%, demo trực tiếp trên môi trường thật không lỗi.]`

### K.2. Bảng tự kiểm tra khả năng giải thích

| Nội dung được chọn | Làm gì? | Vì sao cần? | Nguồn dữ liệu/Tham số/Thư viện? | Bỏ đi ảnh hưởng gì? | Minh chứng |
| --- | --- | --- | --- | --- | --- |
| `[Đoạn báo cáo/mã/thiết kế]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` | `[Điền]` |

`[Tập giải thích cả phần có AI hỗ trợ và hạn chế của giải pháp. Quy trình rubric chọn ngẫu nhiên ≥ 5 nội dung, gồm ≥ 2 nội dung luận văn và ≥ 3 nội dung mã nguồn/minh chứng; tối đa 3 phút/nội dung. Mốc Mức 5 của TC5: trả lời đúng trọng tâm ≥ 90% câu hỏi và chính xác ≥ 95% câu hỏi kỹ thuật.]`

## Phụ lục L. Ma trận đối chiếu rubric và hồ sơ nộp

| Tiêu chí | Điểm tối đa | Phần báo cáo đáp ứng | Minh chứng cần liên kết | Trạng thái |
| --- | --- | --- | --- | --- |
| TC1 | 10 | Mở đầu, Chương 1, mục 7.5 | Khảo sát, so sánh giải pháp, KPI đã chốt | `[Điền]` |
| TC2.1 | 10 | Chương 1–3 | SRS/SDD, AC, NFR, sơ đồ, truy vết mã | `[Điền]` |
| TC2.2 | 10 | Mục 4.3–4.5, 6.1 | Cam kết, nghiệm thu, sản phẩm, Git | `[Điền]` |
| TC2.3 | 5 | Mục 4.7, Phụ lục E | AI Usage Log/cam kết đúng thực tế | `[Điền]` |
| TC2.4 | 10 | Mục 4.2, 4.5–4.6, 4.8 | Convention, Git/PR, phân tích tĩnh, quét secret | `[Điền]` |
| TC2.5 | 5 | Chương 5 | Test plan/case, mã test, coverage, defect | `[Điền]` |
| TC2.6 | 5 | Chương 6 | Pipeline, lịch sử run/deploy, URL | `[Điền]` |
| TC2.7 | 5 | Chương 7 | Người dùng thực, tác vụ, số đo, cải tiến | `[Điền]` |
| TC3 | 10 | Phụ lục K.1, buổi bảo vệ | Slide, kịch bản, demo trực tiếp | `[Điền]` |
| TC4 | 10 | Toàn báo cáo, tài liệu tham khảo | Trích dẫn, hình/bảng, báo cáo trùng lặp | `[Điền]` |
| TC5 | 15 | Phụ lục K.2, buổi bảo vệ | Khả năng giải thích và trả lời thực tế | `[Điền]` |
| TC6 | 5 | Kết luận mục 4, Phụ lục J | Kết quả nổi bật có minh chứng | `[Điền]` |
| **Tổng** | **100** | | | |

### L.1. Kiểm tra đủ 12 nhóm hồ sơ theo Mục 8 của rubric

- [ ] Phiếu đăng ký giảng viên/sinh viên và phân công công việc.
- [ ] Sổ theo dõi tiến độ tuần có xác nhận giảng viên.
- [ ] Cam kết sản phẩm và metric trước mốc 50% thời gian.
- [ ] Repository đầy đủ lịch sử commit và quyền truy cập hội đồng.
- [ ] Nhật ký AI hoặc cam kết không sử dụng đúng thực tế.
- [ ] SRS/SDD kèm sơ đồ.
- [ ] Phân tích tĩnh, quét secret và coding convention.
- [ ] Kế hoạch/test case/mã test/coverage/defect.
- [ ] Cấu hình pipeline, lịch sử chạy/triển khai và link môi trường.
- [ ] Báo cáo thực nghiệm người dùng đầy đủ.
- [ ] Kiểm tra trùng lặp và danh mục tài liệu có đánh dấu ngoại ngữ.
- [ ] Minh chứng kết quả nổi bật; ghi rõ chưa có nếu không phát sinh.

### L.2. Rà soát điều kiện bảo vệ và quy tắc chặn điểm

`[Đối chiếu trực tiếp Mục 6–7 của rubric trước khi nộp. Thiếu minh chứng thì tiêu chí tương ứng không được xếp từ Mức 4 trở lên theo rubric.]`

- [ ] G1: Có cam kết sản phẩm/metric đúng hạn và kết quả rà soát phù hợp của bộ môn.
- [ ] G2: Kiểm tra tần suất báo cáo; dưới 0,5 lần/tuần khiến TC2.2 và TC2.4 giảm mỗi tiêu chí 1 mức.
- [ ] G3–G4: Có hồ sơ AI phù hợp, kê khai khớp Git và phần giải thích.
- [ ] G5: Có kiểm thử tự động hoặc tài liệu kiểm thử thủ công; công bố đúng phần đã thực hiện.
- [ ] G6: Pipeline CI/CD chạy được tại thời điểm bảo vệ.
- [ ] G7: Có thực nghiệm với người dùng thực tế.
- [ ] G8: Hội đồng truy cập được repository và build được mã đã nộp.
- [ ] G9: Khối lượng phù hợp thời gian và số lượng sinh viên đăng ký.
- [ ] G10: Giải thích được nội dung, nguồn và đóng góp; không làm giả minh chứng/số liệu, đối chiếu các mức vi phạm V0–V4.
