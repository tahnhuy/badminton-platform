# BÁO CÁO NGHIÊN CỨU & MÔ HÌNH HÓA: ĐIỀU CHỈNH TRÌNH ĐỘ QUA GIẢI ĐẤU CHUYÊN NGHIỆP

**Đề tài:** Nền tảng số hóa hệ sinh thái cầu lông (*Badminton Ecosystem Digital Platform*)
**Phiên bản:** 1.0 — 2026-11-25
**Trạng thái:** Chủ dự án đã chọn Hướng B (2026-11-25); chờ GVHD xác nhận. Đã đưa vào Tournament PRD (Decision #26), Tech Design §7.10, tasks TRN-14, `business-rules-config-matrix.md` §6 và `PROJECT-BRIEF.md` §3.4/§7.
**Tài liệu liên quan:** [Báo cáo đánh giá trình độ ban đầu](./bao-cao-cong-thuc-danh-gia-trinh-do.md) (khảo sát, thang 0–100, 7 bậc); `PROJECT-BRIEF.md` §3.4, §7; Tournament PRD (Draft 2026-11-25); mã mô phỏng trong [`nang-trinh-mo-phong/`](./nang-trinh-mo-phong/).

**Mục đích tài liệu:**
1. Trình bày cơ sở lý luận, mô hình toán học, mô phỏng kiểm chứng cho **thuật toán trọng tâm thứ hai** của đề tài: *tính điểm và điều chỉnh trình độ dựa trên kết quả giải đấu chuyên nghiệp* (`PROJECT-BRIEF.md` §7).
2. Đặc tả đủ chi tiết để làm đầu vào cho tài liệu nghiệp vụ, kỹ thuật và mã nguồn.

---

## 1. ĐẶT VẤN ĐỀ

### 1.1. Bối cảnh
- Khi đăng ký, người chơi được xếp vào 1 trong 7 bậc bằng **bài khảo sát tự đánh giá** (thang điểm $S \in [0, 100]$, luật chặn G1/G2). Bậc này được đánh dấu **tạm thời** (`is_skill_tentative = true`) vì chưa có bằng chứng thi đấu.
- `PROJECT-BRIEF.md` quy định: *Post-match Rating* (người chơi chấm nhau) bị loại khỏi MVP vì cảm tính, dễ "cày điểm ảo"; **trình độ chỉ được điều chỉnh qua kết quả thực tế tại Giải đấu chuyên nghiệp**.
- Quyết định của chủ dự án (2026-11-25): trình độ **đi theo phong độ thi đấu** — chơi tốt thì lên, chơi kém liên tục thì **xuống**, áp dụng cho mọi người chơi (không chỉ người đang ở trình tạm thời).

### 1.2. Vấn đề của khảo sát nếu dùng lại để "xác định lại"
Khảo sát đo **niềm tin của người chơi về bản thân**, không đo kết quả. Cho làm lại khảo sát để lên bậc thì người chơi chỉ cần khai cao hơn; không có cách kiểm chứng. Ngược lại, kết quả trận đấu là **dữ liệu khách quan** do Organizer ghi nhận. Vì vậy khảo sát chỉ nên là **điểm xuất phát (prior)**; điều chỉnh phải dựa trên kết quả thi đấu.

### 1.3. Yêu cầu đối với mô hình
| # | Yêu cầu | Nguồn |
|---|---|---|
| Y1 | Dựa trên kết quả thi đấu thật tại giải chuyên nghiệp | Brief §3.4, §7 |
| Y2 | Lên và xuống bậc theo phong độ | Chủ dự án 2026-11-25 |
| Y3 | Thắng người mạnh được nhiều hơn thắng người yếu; thua người yếu bị trừ nhiều hơn thua người mạnh | Thực tế phong trào ("ăn hiếp trình dưới" không chứng minh gì) |
| Y4 | Không lên xuống liên tục vì một giải xui / chấn thương | Ổn định cho ghép kèo, seed, điều kiện giải |
| Y5 | Sửa nhanh sai số của khảo sát (khai cao / "trình ẩn") | Trình tạm thời |
| Y6 | Tính lại được khi kết quả bị sửa/hủy (revert tự động) | G0 D1c 2026-11-15 |
| Y7 | Giải thích được cho người dùng, tham số là cấu hình | Khả năng vận hành, bảo vệ đồ án |

---

## 2. CƠ SỞ THAM KHẢO

### 2.1. Hệ thống xếp hạng BWF (điểm theo vòng đạt được)
BWF World Ranking cộng điểm theo **cấp giải** và **vòng đạt được** (vô địch > á quân > bán kết > tứ kết …); giải cấp cao cho nhiều điểm hơn; chỉ tính một số kết quả tốt nhất trong cửa sổ thời gian. Đây là **thứ hạng thành tích**, phản ánh cả độ chăm thi đấu, không phải bậc trình độ. [BWF — How Ranking Works; Wikipedia — BWF World Ranking; Olympics.com]

### 2.2. Grading của các liên đoàn Anh (Wales, Scotland, England)
- Tách bạch **ranking** (điểm thành tích) và **grading** (bậc trình độ A, B, C …): *"grading focuses on an individual's playing standard whilst rankings are based on results and commitment"* (Badminton Wales).
- Wales 2024/25 dùng bảng: bậc cao nhất có mặt trong giải × vòng đạt được × số lần đạt → có lên 1 bậc hay không; kết quả xấu **không** làm tụt bậc. Scotland tính **6 kết quả tốt nhất**; khuyến nghị người thường xuyên có huy chương ở giải Silver thì thi đấu Gold.
- Ý dùng được: mỗi lần chỉ thay đổi **1 bậc**; xét theo **trình đối thủ có mặt**; tách "thành tích" với "trình độ".

### 2.3. Elo, Glicko, DUPR (điểm theo kết quả kỳ vọng)
- **Elo:** trước trận tính xác suất thắng kỳ vọng $E$ từ chênh lệch điểm; sau trận điểm thay đổi $K \cdot (S - E)$, $S \in \{0, 1\}$. Tổng điểm hai bên **bảo toàn** (zero-sum).
- **Glicko/Glicko-2:** thêm *độ lệch xếp hạng* (RD) — người mới có RD lớn nên điểm thay đổi mạnh; chơi nhiều thì RD giảm. Cần khoảng 5–20 trận để ước lượng tốt.
- **DUPR (pickleball):** biến thể Elo; đánh đôi lấy **trung bình** điểm hai người; điểm đổi theo mức "bất ngờ" so với dự đoán; độ tin cậy cao thì dao động ít.
- Ý dùng được: trọng số theo đối thủ (Y3), **bảo toàn tổng điểm** (chống lạm phát), hệ số $K$ lớn cho người mới (Y5).

### 2.4. Thực tế giải phong trào ở Việt Nam
Không có thang chuẩn chung; mỗi giải tự quy định "trình". Điều lệ các giải (ví dụ pickleball Generali 2026, SeABank 2026) chống "vượt trình / trình ẩn" bằng: cấm VĐV đã đạt giải ở trình tương đương tham dự lại; giới hạn tổng trình cặp đôi; phát hiện vượt trình thì xử thua, không hoàn lệ phí. → Hệ thống cần **tự động nâng bậc người thắng nhiều** để họ không ở lại trình thấp.

---

## 3. HAI HƯỚNG TIẾP CẬN VÀ KẾT QUẢ MÔ PHỎNG

### 3.1. Hướng A — Điểm tích lũy rời rạc theo bậc (bản nháp đầu tiên)
Mỗi giải cộng điểm trận (theo chênh lệch bậc) + điểm thành tích (vòng đạt được); đủ ngưỡng thì lên bậc, đủ ngưỡng âm thì xuống bậc, **đặt lại điểm về 0 sau mỗi lần đổi bậc**.

### 3.2. Hướng B — Điểm phong độ liên tục (đề xuất)
Mỗi người chơi có **điểm phong độ $R$** trên **cùng thang 0–100 của khảo sát**; khởi đầu bằng điểm khảo sát; cập nhật kiểu Elo sau mỗi trận giải chuyên nghiệp; **bậc = dải điểm của $R$** (7 dải đã có), có **vùng đệm** chống dao động.

### 3.3. Thiết lập mô phỏng
Mã: [`nang-trinh-mo-phong/`](./nang-trinh-mo-phong/). 200 người chơi có **trình thật** liên tục (phân bố lệch về TB); khảo sát đúng bậc 55%, lệch ±1 bậc 40%, lệch ±2 bậc 5% (khai cao nhiều hơn khai thấp). Mỗi giải 8–16 người có bậc trong khoảng ±1 quanh một mức (điều kiện trình min–max), đánh loại trực tiếp; xác suất thắng theo hàm logistic của chênh lệch trình thật. Lặp 12–20 lần với hạt giống ngẫu nhiên khác nhau. Chỉ số: **độ chính xác** (bậc hệ thống = trình thật làm tròn), **flips** (số lần đổi chiều lên↔xuống / người — đo dao động), **bias** (bậc − trình thật trung bình).

### 3.4. Kết quả

**Hướng A** (sau ~45 trận/người; khảo sát ban đầu đúng 55%):

| Cấu hình | Độ chính xác | Flips/người | Bias |
|---|---|---|---|
| Điểm thắng/thua bất đối xứng (thắng +10, thua −5) | **1–4%** | 0,10–0,14 | lạm phát mạnh |
| Elo zero-sum, điều kiện hạ bậc chặt hơn lên bậc | 23–29% | 0,08–0,13 | +0,73…+0,82 |
| Elo zero-sum, điều kiện đối xứng | 30–49% | 0,44–1,19 | +0,14…+0,34 |

→ Hướng A **kém hơn cả khảo sát ban đầu**. Nguyên nhân: (1) điểm thắng > điểm thua hoặc thưởng thành tích luôn dương gây **lạm phát** — sau nhiều giải gần như ai cũng lên bậc; (2) bậc rời rạc làm **mất thông tin**: người mạnh nhất trong một bậc thắng nhiều hơn kỳ vọng → lên bậc → thua ở bậc mới → xuống → dao động; (3) **xóa điểm khi đổi bậc** vứt bỏ lịch sử.

**Hướng B** — theo số trận đã đánh ($K = 3$, $K_{tạm} = 6$ cho 6 trận đầu, $D = 15$, vùng đệm $h = 3$):

| Trận/người | Độ chính xác | Flips/người |
|---|---|---|
| 0 (khảo sát) | 55% | — |
| 3 | 58% | 0,00 |
| 6 | 61% | 0,00 |
| 12 | 66% | 0,01 |
| 22 | 71% | 0,02 |
| 45 | 73–76% | 0,07–0,08 |

So sánh tham số (45 trận/người):

| Biến thể | Độ chính xác | Flips/người |
|---|---|---|
| $K=3$, vùng đệm $h=3$ (đề xuất) | 73% | 0,08 |
| $K=3$, **không vùng đệm** ($h=0$) | 61% | **2,08** |
| $K=6$ (cập nhật quá mạnh) | 49% | 0,86 |
| $K=2$, $h=2$ | 76% | 0,07 |

→ Hướng B **luôn tốt hơn khảo sát** và **tăng dần theo số trận** (đúng tinh thần "trình đi theo phong độ"); vùng đệm là bắt buộc (không có thì dao động gấp ~26 lần); $K$ nhỏ (2–3) ổn định nhất.

**Kết luận:** chọn **Hướng B**. Phần "điểm tích lũy theo vòng đạt được" của Brief được giữ dưới dạng **điểm thành tích (ranking)** tách riêng — dùng để vinh danh/bảng xếp hạng, **không** quyết định bậc (đúng cách các liên đoàn Anh tách grading và ranking, §2.2).

---

## 4. MÔ HÌNH ĐỀ XUẤT

### 4.1. Điểm phong độ khởi đầu
$$R_0 = \operatorname{clamp}\big(S_{\text{khảo sát}},\ \text{cận dưới dải}(L_0),\ \text{cận trên dải}(L_0) - \varepsilon\big)$$
- $L_0$ là bậc sau luật chặn G1/G2; **kẹp** vì luật chặn có thể xếp bậc thấp hơn dải của $S$ (ví dụ $S = 76$ nhưng bị chặn về TB) — nếu không kẹp, hệ thống sẽ tự nâng bậc ngay ở lần tính đầu.
- Người chơi không có khảo sát (dữ liệu cũ): $R_0$ = điểm giữa dải của bậc hiện tại.

Dải bậc (dùng lại từ khảo sát): Mới chơi [0,15) · Yếu [15,30) · TB yếu [30,45) · TB [45,60) · TB khá [60,70) · Khá [70,80) · Giỏi [80,100].

### 4.2. Cập nhật sau mỗi trận
Với người chơi điểm $R$ gặp đối thủ điểm $R_o$ (đánh đôi: trung bình điểm hai người của mỗi đội):
$$E = \frac{1}{1 + 10^{(R_o - R)/D}}, \qquad \Delta R = K \cdot (S - E), \quad S = \begin{cases}1 & \text{thắng}\\ 0 & \text{thua}\end{cases}$$
- $D = 15$: chênh **một dải TB (15 điểm)** ⇒ người cao hơn có xác suất thắng kỳ vọng ≈ 91%.
- $K = 6$ trong **6 trận đầu** (trình tạm thời — giống RD lớn của Glicko), sau đó $K = 3$.
- **Đánh đôi:** hai người cùng đội nhận cùng $\Delta R$ tính từ điểm trung bình đội, nhân $\lambda_D = 0{,}8$ (đóng góp cá nhân không tách được).
- **Walkover, trận hủy:** không cập nhật (không phản ánh khả năng thi đấu). **Bỏ cuộc giữa trận** (`RETIRED`) được tính như một trận thua bình thường của người bỏ cuộc.
- $K$ được chọn **theo từng trận**, dựa trên số trận hợp lệ người chơi đã có *trước* trận đó (6 trận đầu dùng $K_{tạm}$). Cờ `is_skill_tentative` chỉ cập nhật ở lần xét bậc khi giải kết thúc (§4.4) — hai việc độc lập.
- Sau mỗi cập nhật, $R$ được **kẹp vào [0, 100]**.
- Chỉ trận thuộc **giải chuyên nghiệp `COMPLETED`**; giải phong trào và kèo giao lưu không tính.
- Tổng điểm hai bên trong một trận đơn **bảo toàn** (cùng $K$) ⇒ không lạm phát.

Bảng tham khảo ($K = 3$; người chơi điểm $R$, đối thủ $R_o$):

| $R_o - R$ | $E$ | Thắng | Thua |
|---|---|---|---|
| −30 (yếu hơn 2 dải) | 0,99 | +0,03 | −2,97 |
| −15 | 0,91 | +0,27 | −2,73 |
| 0 | 0,50 | +1,50 | −1,50 |
| +15 | 0,09 | +2,73 | −0,27 |
| +30 (mạnh hơn 2 dải) | 0,01 | +2,97 | −0,03 |

### 4.2b. Đạt giải (vô địch, á quân…) tác động thế nào
Không có khoản thưởng riêng theo thứ hạng: thứ hạng tác động **qua các trận thắng**. Vô địch giải 16 người = thắng 4 trận liên tiếp; gặp toàn đối thủ ngang điểm thì $\Delta R ≈ +6$ (đã xác nhận) hoặc $+12$ (tạm thời); mỗi trận thắng đối thủ mạnh hơn một dải được $+2{,}7$ (tạm thời $+5{,}5$); vô địch một giải toàn đối thủ yếu hơn hẳn gần như không đổi điểm. Mô phỏng: 16–34% nhà vô địch lên bậc ngay sau giải đó.

Đã thử thêm thưởng riêng (vô địch $+3$/$+5$, á quân một nửa, nhân độ mạnh của giải) và thưởng theo "số vòng vượt kỳ vọng": mọi biến thể đều làm lệch bậc theo thời gian — thưởng cố định $+3$ làm độ chính xác sau ~45 trận giảm từ 73% xuống 53% (lạm phát, bias $+0{,}45$); thưởng theo kỳ vọng gây dao động mạnh (flips 0,5–1,9). Vì vậy **không dùng thưởng thứ hạng cho điểm phong độ**; thứ hạng được ghi nhận ở lịch sử giải trên Profile, bài vinh danh trên Social và (nếu duyệt) điểm thành tích §4.5. Mã: `nang-trinh-mo-phong/mo_phong_thuong_thu_hang.py`.

### 4.3. Xác định bậc — vùng đệm (hysteresis)
Bậc **chỉ được xét khi giải `COMPLETED`** (không đổi giữa giải, để điều kiện tham gia và seed ổn định):
- **Lên** 1 bậc khi $R \ge$ cận dưới của bậc kế trên $+ h$.
- **Xuống** 1 bậc khi $R <$ cận dưới của bậc hiện tại $- h$.
- $h = 3$. Lặp tới khi ổn định (trường hợp hiếm $R$ vượt 2 dải sau một giải dài; trong thực tế mỗi giải tối đa ~7 trận × 6 điểm).
- Bậc 1 không xuống, bậc 7 không lên.

### 4.4. Trình tạm thời và xác nhận
| Trạng thái | Ý nghĩa | Hệ số |
|---|---|---|
| **Tạm thời** | Bậc từ khảo sát, chưa có ≥ 6 trận giải chuyên nghiệp hợp lệ | $K = 6$: sửa nhanh khai cao / trình ẩn |
| **Đã xác nhận** | Có ≥ 6 trận hợp lệ | $K = 3$: thay đổi chậm, ổn định |

`is_skill_tentative` chuyển `false` ở lần xét bậc đầu tiên sau khi đủ 6 trận. Cả hai trạng thái đều **lên và xuống** theo cùng quy tắc vùng đệm — khác nhau ở tốc độ.

### 4.5. Điểm thành tích (ranking) — tách khỏi bậc
Dùng cho **vinh danh, bảng xếp hạng, gợi ý seed khi cùng bậc**, không ảnh hưởng bậc:

| Vị trí | Điểm cơ sở |
|---|---|
| Vô địch | 100 |
| Á quân | 70 |
| Đồng hạng 3 (bán kết) | 50 |
| Tứ kết | 30 |
| Vòng trước đó | 10 |

$\text{Điểm} = \text{cơ sở} \times \frac{\text{trình trung bình của giải}}{4} \times \min\!\big(1, \frac{N}{8}\big)$; tổng **4 kết quả tốt nhất trong 12 tháng** (giống cách Scotland tính 6 kết quả tốt nhất).

### 4.6. Tính lại khi sửa kết quả (revert tự động)
- **Nguồn sự thật = lịch sử trận**, không phải điểm đã lưu. $R$ và bậc được **tính lại bằng cách phát lại** (replay) mọi trận hợp lệ theo thứ tự thời gian kết thúc giải, bắt đầu từ $R_0$.
- Điểm phong độ chỉ được tính khi giải `COMPLETED`; giải bị hủy trước đó không đóng góp gì nên không cần revert. Kích hoạt phát lại: Organizer **sửa kết quả trong 48 giờ sau khi giải kết thúc** (Tournament PRD Decision #24) hoặc Admin chủ động "tính lại toàn bộ" khi đổi tham số. Phát lại cho **những người chơi bị ảnh hưởng** và những ai đã gặp họ sau thời điểm đó (quy mô đồ án đủ nhỏ để phát lại toàn bộ trong một job).
- Mỗi lần đổi bậc lưu một **sự kiện** `skill_level_changes` (người chơi, bậc cũ → mới, $R$, giải gây ra, thời điểm, lý do `TOURNAMENT_RESULT` | `RECALCULATION`). Kết quả phát lại khác thì ghi sự kiện mới, không sửa sự kiện cũ (audit).
- Tính chất: **tất định** — cùng lịch sử cho cùng kết quả (kiểm thử được, trình bày được trong luận văn).

### 4.7. Tham số cấu hình (System Config)
| Khóa | Mặc định | Ý nghĩa |
|---|---|---|
| `SKILL_RATING_ENABLED` | `true` | Bật/tắt điều chỉnh trình qua giải |
| `SKILL_RATING_K` | 3 | Hệ số cập nhật sau xác nhận |
| `SKILL_RATING_K_TENTATIVE` | 6 | Hệ số khi trình tạm thời |
| `SKILL_RATING_TENTATIVE_MATCHES` | 6 | Số trận để xác nhận |
| `SKILL_RATING_SCALE_D` | 15 | Thang chênh lệch của $E$ |
| `SKILL_RATING_HYSTERESIS` | 3 | Vùng đệm lên/xuống bậc |
| `SKILL_RATING_DOUBLES_FACTOR` | 0,8 | Hệ số đánh đôi |
| `TOURNAMENT_RANKING_BEST_N` | 4 | Số kết quả tốt nhất tính ranking |
| `TOURNAMENT_RANKING_WINDOW_MONTHS` | 12 | Cửa sổ ranking |

Thay đổi tham số chỉ áp dụng cho lần tính tiếp theo; một lần "tính lại toàn bộ" do Admin chủ động mới áp dụng hồi tố.

---

## 5. VÍ DỤ MINH HỌA (tính bằng mô hình §4)

**Ví dụ 1 — Dũng khai thấp (trình ẩn).** Khảo sát 40 → TB yếu, tạm thời ($K = 6$).

| Trận | Đối thủ $R_o$ | KQ | $E$ | $\Delta R$ | $R$ | Bậc |
|---|---|---|---|---|---|---|
| 1 | 38 | Thắng | 0,58 | +2,54 | 42,54 | TB yếu |
| 2 | 47 | Thắng | 0,34 | +3,99 | 46,53 | TB yếu |
| 3 | 52 | Thắng | 0,30 | +4,19 | 50,72 | **TB** (≥ 45 + 3) |
| 4 | 55 | Thắng | 0,34 | +3,95 | 54,67 | TB |
| 5 | 50 | Thắng | 0,67 | +1,97 | 56,64 | TB |
| 6 | 58 | Thua | 0,45 | −2,69 | 53,95 | TB |
| 7 | 45 | Thắng | 0,80 | +0,61 ($K=3$) | 54,56 | TB — đã xác nhận |

*(Bậc thực tế chỉ đổi khi giải kết thúc; bảng hiển thị theo trận để dễ theo dõi.)* Thắng người mạnh hơn được nhiều điểm; sau 1–2 giải Dũng đã lên TB và tiếp tục tiến dần.

**Ví dụ 2 — Bình khai cao.** Khảo sát 72 → Khá, tạm thời: thua 55 (−5,59 → 66,41 → **TB khá**, vì < 70 − 3), thua 62, thắng 50 (+0,77), thua 66, 58, 52 → $R = 53{,}06$ → **TB**. Sai số khảo sát được sửa trong 1–2 giải.

**Ví dụ 3 — An ổn định.** Đã xác nhận TB, $R = 50$: thắng 48, thua 53, thắng 50, thắng 47, thua 55 → $R = 51{,}26$, giữ TB. Thắng thua lẫn lộn trước người cùng trình không làm đổi bậc.

**Ví dụ 4 — Em sa sút.** Đã xác nhận TB khá, $R = 63$: thua 55, thua 52, thua 60 → $R = 57{,}00 < 60 - 3$ → **xuống TB**; tiếp tục thua người thấp hơn → $R = 52{,}40$. Người cao trình thi đấu kém liên tục bị hạ bậc (yêu cầu Y2); một trận thua lẻ thì không (vùng đệm).

---

## 6. ĐÁNH GIÁ THEO YÊU CẦU

| Yêu cầu | Đáp ứng |
|---|---|
| Y1 kết quả thật | Chỉ trận giải chuyên nghiệp `COMPLETED`, không tính walkover |
| Y2 lên & xuống | Cùng quy tắc vùng đệm cho cả hai chiều, mọi người chơi |
| Y3 trọng số đối thủ | $E$ theo chênh lệch điểm (bảng §4.2) |
| Y4 ổn định | Vùng đệm $h$, $K$ nhỏ, chỉ xét bậc khi giải kết thúc — flips ≈ 0,02/người sau 22 trận |
| Y5 sửa khảo sát | $K$ gấp đôi trong 6 trận đầu; ví dụ 1, 2 |
| Y6 revert | Phát lại tất định từ lịch sử trận + sự kiện đổi bậc |
| Y7 giải thích | "Điểm phong độ 57/100 — còn 6 điểm để lên TB khá"; tham số là cấu hình |

## 7. HẠN CHẾ VÀ HƯỚNG PHÁT TRIỂN
1. Mô phỏng dùng mô hình xác suất giả định; tham số cần **hiệu chỉnh lại khi có dữ liệu thật** (đo tỉ lệ dự đoán đúng của $E$).
2. Đánh đôi dùng trung bình đội — chưa tách đóng góp cá nhân (cùng hạn chế với DUPR).
3. Chưa dùng tỉ số set/điểm (thắng 21–5 và 22–20 như nhau). Có thể mở rộng $S$ theo tỉ lệ điểm ghi được.
4. Chưa có suy giảm khi lâu không thi đấu (Glicko tăng RD). Có thể tăng $K$ tạm thời cho người quay lại sau > 6 tháng.
5. Người chơi chỉ đánh kèo giao lưu không bao giờ đổi bậc — đúng chủ trương Brief, cần giải thích rõ trên giao diện.

## 8. TÁC ĐỘNG LÊN THIẾT KẾ (tóm tắt cho TRN-14)
- **Dữ liệu:** `player_profiles.skill_rating` (numeric, $R$ hiện tại — cache), `player_profiles.rated_match_count`; bảng mới `skill_level_changes` (sự kiện); bảng `skill_rating_events` (mỗi trận × người chơi: $R$ trước/sau, $E$, $K$ — cache để hiển thị lịch sử, có thể xóa và phát lại). Bảng cũ `player_skill_adjustments` (của cơ chế Rating, cột bắt buộc là trung bình điểm rating) không dùng lại, giữ nguyên làm lịch sử.
- **Thời điểm chạy:** khi giải `COMPLETED` (trong transaction kết thúc giải hoặc job ngay sau); khi sửa kết quả / hủy giải: job phát lại.
- **Giao diện:** Profile hiển thị bậc, điểm phong độ, thanh tiến độ tới bậc kế, lịch sử đổi bậc; trang kết quả khảo sát giữ nhãn "Trình độ tạm thời" tới khi xác nhận.
- **Tương tác với giải:** điều kiện trình min–max dùng **bậc tại thời điểm hành động** (đã chốt; đổi bậc sau đó không loại người đã đăng ký); gợi ý seed sắp theo bậc (đánh đôi: tổng bậc), hòa thì theo điểm phong độ (đánh đôi: trung bình $R$), rồi ngẫu nhiên (Tech Design §7.1).

## 9. VẤN ĐỀ CẦN TEAM / GVHD CHỐT
1. ~~Duyệt Hướng B~~ — chủ dự án đã chọn (2026-11-25); còn chờ GVHD xác nhận. `PROJECT-BRIEF.md` và matrix đã cập nhật theo hướng này.
2. Có làm **điểm thành tích (ranking)** §4.5 trong đợt này không (dùng cho vinh danh/bảng xếp hạng), hay chỉ làm điều chỉnh bậc.
3. Hiển thị **điểm phong độ $R$** công khai trên hồ sơ, hay chỉ hiển thị cho chính người chơi (công khai minh bạch hơn nhưng dễ gây so bì).

---

## TÀI LIỆU THAM KHẢO
- BWF — How Ranking Works: https://bwfbadminton.com/how-ranking-works/
- Wikipedia — BWF World Ranking: https://en.wikipedia.org/wiki/BWF_World_Ranking
- Olympics.com — Badminton World Rankings: How do they work?: https://olympics.com/en/news/badminton-rankings-bwf-world-tour-team-olympics-men-women
- Badminton Wales — Series Event Regulations 2024–25: https://badminton.wales/wp-content/uploads/2024/08/Badminton-Wales-Series-Event-Regulations-2024-25.pdf
- Badminton Wales — Graded Series Regulations 25: https://badminton.wales/wp-content/uploads/2025/09/Graded-Series-Regulations-25.pdf
- Badminton Scotland — Rankings, gradings, results: https://badmintonscotland.org.uk/compete/rankings-gradings-results/
- Badminton Scotland — Gradings and Values 2026: https://badmintonscotland.org.uk/wp-content/uploads/2025/12/Gradings-and-Values-SCOTLAND-2026.pdf
- Redhill & Reigate BC — Grading (Badminton England): https://sites.google.com/view/redhill-reigate-bc/features/grading
- DUPR — How your DUPR rating is calculated: https://www.dupr.com/post/how-your-dupr-rating-is-calculated
- DUPR — Algo Update: Win or Lose, Your Rating Can Go Up: https://www.dupr.com/post/dupr-algo-update-win-or-lose-your-rating-can-go-up
- Reverse-engineering DUPR (DEV Community): https://dev.to/therubberduckiee/reverse-engineering-duprs-pickleball-rating-algorithm-40cc
- Glickman, M. — Glicko rating system (Wikipedia): https://en.wikipedia.org/wiki/Glicko_rating_system
- Elo, A. E. (1978). *The Rating of Chessplayers, Past and Present*. Arco.
- Điều lệ giải Generali Pickleball Championship 2026: https://generali.vn/page/thu-vien-thong-tin/tai-lieu-bieu-mau/dieu-le-giai-genforza-generali-pickleball-championship-2026
- Điều lệ giải SeABank Pickleball Open 2026: https://cloud-cdn.seabank.com.vn/seabank-web/%C4%90I%E1%BB%80U%20L%E1%BB%86%20GI%E1%BA%A2I%20SEABANK%20PICKLEBALL%20OPEN%202026_FINAL.pdf
- Lao Động — Lần đầu giải cầu lông phong trào tính điểm theo chuẩn châu Á: https://news.laodong.vn/ldt/the-thao/lan-dau-giai-cau-long-phong-trao-tinh-diem-theo-chuan-chau-a-1398070.ldo
