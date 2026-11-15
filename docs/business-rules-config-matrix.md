# Business Rules & Configuration Matrix

## Chốt kèo, thanh toán và thành viên chat — 2026-11-08

Quyết định người dùng xác nhận ngày 2026-11-08:

- **Chủ kèo bấm chốt**, không tự chốt khi đủ người. Singles/Doubles cần đủ 2/4 tài khoản; GROUP cần đạt tối thiểu và có ít nhất một thành viên đã được nhận ngoài chủ kèo. Apply/Invite được chấp nhận chỉ giữ chỗ; khi chốt mới tạo Match hoặc giữ Match của GROUP đã mở lại, chuyển MATCHED và đóng các yêu cầu đang chờ. Chốt là thao tác host, không phải thanh toán.
- Mọi kèo còn OPEN khi đến giờ bắt đầu đều EXPIRED; nếu GROUP đã có Match do mở tuyển lại thì Match bị hủy do chưa chốt lại. Không tự bắt đầu dù đã đủ tối thiểu và có sân. Quy tắc này thay thế các dòng tự tạo/bắt đầu Match cũ.
- Chủ kèo được loại thành viên khác; không được loại chính mình. Thành viên chỉ được tự rút, hoặc bị chủ kèo loại, **trước khi booking gắn với kèo được thanh toán thành công** và trước giờ bắt đầu. Sau mốc thanh toán, cả hai thao tác bị từ chối, kể cả booking được thanh toán trước khi chốt. Booking từng thanh toán thành công rồi được hoàn tiền không mặc định mở lại quyền rút/loại. Với sân ngoài hệ thống không có mốc thanh toán do hệ thống xác nhận: giữ giới hạn trước giờ bắt đầu; không tự suy đoán thanh toán bên ngoài.
- Trước mốc khóa trên: rời kèo OPEN giải phóng chỗ; rời kèo GROUP đã chốt mở lại tuyển và giữ Match; rời Singles/Doubles đã chốt hủy Match theo chính sách booking hiện hành. Không thay đổi quyền chủ kèo hủy cả kèo bằng quy tắc rút của thành viên.
- Chủ kèo có thể tạo nhóm chat từ kèo đã chốt và Match còn hoạt động. Một kèo tối đa một nhóm liên kết; tạo lại trả nhóm hiện có nếu còn khả dụng. Nhóm không tự khóa sau khi trận kết thúc.
- Khi thành viên tự rút hoặc bị loại thành công, **gỡ quyền thành viên khỏi nhóm chat liên kết**, không xóa tài khoản hay xóa hàng loạt tin nhắn cũ. Người đó không được tiếp tục đọc/gửi/nhận realtime bằng quyền thành viên cũ. Chỉ áp dụng nhóm liên kết kèo, không tác động nhóm độc lập khác. Xóa khỏi chat không đồng nghĩa xóa khỏi kèo theo chiều ngược lại. Quy tắc tự thêm lại khi quay lại kèo: TBD.

**Hiện trạng sau sửa lỗi theo yêu cầu người dùng:** working tree đã bổ sung khóa tự rút/loại theo lịch sử thanh toán booking và gỡ thành viên nhóm chat liên kết trong cùng transaction với rời kèo. Kiểm tra thanh toán dùng chung khóa booking với callback; áp dụng cả các endpoint tương thích. Nhóm độc lập và tin nhắn cũ được giữ nguyên. Tự thêm lại vào chat khi quay lại kèo vẫn TBD; thay đổi này không duyệt thiết kế ví hay đổi trạng thái Ready của các tài liệu.

Mục này thay thế các mô tả cũ mâu thuẫn về tự chốt khi đủ người, GROUP tự bắt đầu, quyền rút trước giờ chơi không xét thanh toán và việc Messaging hoàn toàn không đồng bộ với kèo. Quyết định nghiệp vụ đã được người dùng xác nhận; thiết kế kỹ thuật bổ sung còn cần hoàn thiện, không tự đổi trạng thái tài liệu thành Ready.

---

## Quy tắc thay thế hiện hành — 2026-11-08

Quyết định nghiệp vụ mới: **Admin quản lý thanh toán và ví ảo chung toàn sàn; mỗi người dùng có một ví**. Người dùng thanh toán bằng số dư ví; nếu thiếu tiền thì nạp thêm rồi thanh toán. Court Owner quản lý sân và vận hành booking, không quản lý hệ thống ví/thanh toán toàn sàn. Không đưa Split Bill vào phạm vi này.

Quyết định này thay thế yêu cầu cũ loại ví khỏi MVP và luồng bắt buộc trả trực tiếp qua VNPAY cho từng booking/lệ phí. VNPAY/mock hiện có là hiện trạng triển khai, không chứng minh luồng ví đã hoàn thành. Phương thức nạp, rút tiền, chuyển/đối soát tiền cho chủ sân, phí, hạn mức và chính sách hoàn về ví hay nguồn nạp: **TBD**. Giữ các điều kiện hủy/hoàn của nghiệp vụ trừ khi có quyết định thay thế; không tự chuyển tiền thực trong lần cập nhật tài liệu này.

Quyết định nghiệp vụ mới: **không dùng rating để nâng trình; chỉ việc tham gia giải chuyên nghiệp mới là cơ sở nâng trình**. Trận giao lưu, kèo đơn/đôi thông thường và giải phong trào không nâng trình. Khảo sát ban đầu vẫn là tự đánh giá ban đầu, không phải nâng trình hay chứng nhận.

Các quy tắc tự hiệu chỉnh từ điểm rating, cửa sổ trận, ngưỡng điểm và cooldown trong tài liệu cũ được thay thế. Điều kiện tham gia hợp lệ, xác nhận kết quả/thành tích, công thức/ngưỡng nâng trình và xử lý sửa/hủy kết quả: **TBD**; không mặc định cứ đăng ký/tham gia một giải là tăng một bậc. Giữ đánh giá kỹ năng và thái độ sau trận để tham khảo/hiển thị; cả hai loại điểm đều không được dùng để nâng trình.

Giải đấu có hai loại nghiệp vụ:

| Loại | Người tham gia | Tính trình độ và thành tích |
| --- | --- | --- |
| Phong trào | Không bắt buộc có tài khoản; công cụ mô hình giải/bracket và kết quả cho danh sách người tham gia | Không tính rank, không nâng trình |
| Chuyên nghiệp | Cần gắn người tham gia với tài khoản để ghi nhận trình độ/thành tích | Là cơ sở duy nhất để nâng trình; lưu thành tích trên Social và trang cá nhân |

Phân loại này khác với thể thức đơn/đôi hoặc loại bracket. Các quy tắc cũ bắt buộc mọi người tham gia đều là Player có tài khoản chỉ còn áp dụng cho giải chuyên nghiệp; không áp lên người tham gia phong trào. Không suy ra người tổ chức được miễn đăng nhập/quyền Organizer từ việc người tham gia không cần tài khoản. Cách nhập người tham gia không tài khoản, đăng ký/phí của giải phong trào, tiêu chí công nhận giải chuyên nghiệp, quyền xác nhận thành tích, cách hiển thị trên Social và quyền riêng tư: **TBD**. Không tự tạo tài khoản giả hoặc gắn người không tài khoản vào lịch sử Player.

Mục này thay thế các phần mâu thuẫn trong §1.2, §2.6–2.8, §4–6 và §8.8 về việc dùng rating để nâng trình (không áp dụng cho mô hình khảo sát đăng ký và danh mục 7 bậc chốt ngày 2026-11-15 ở §1.2). Các key PLAYER_SKILL_ADJUSTMENT_* từ rating là cấu hình legacy, không dùng để thiết kế cơ chế nâng trình mới.

---

**Status:** FROZEN\
**Purpose:** Central reference for all business rules and system
configuration values that were explicitly agreed for the MVP.\
**Scope:** Matchmaking, Court Booking, Tournament, Team Invitation,
Rating, Reports. Social Matchmaking and Messaging directions confirmed on
2026-10-31 are recorded in §3.12–§3.14 and §8.9; they are not yet implemented.

> This document records decisions already agreed during
> database/business-rule review. It is not a replacement for feature
> PRDs or Tech Designs.

------------------------------------------------------------------------

# 1. Global Rules

## 1.1 System Roles

The system has exactly three system roles:

-   `PLAYER`
-   `COURT_OWNER`
-   `ADMIN`

### Tournament Organizer

Tournament Organizer is **not** a separate system role.

Any Player can create a Tournament and becomes its Organizer for that
Tournament.

A Player can manage multiple tournaments.

Admin can manage all tournaments.

## 1.2 Skill Level Catalog

Skill level is a shared reference used by Player profile self-assessment
(`docs/features/platform/authentication-authorization/prd.md` §7.1),
Matchmaking invitation candidates and skill preference (§3.3), and Tournament
seeding (§5.2).

The catalog has **seven levels** (decision 2026-11-15; previously six levels
with `GOOD` named "Khá / Giỏi"):

  rank   code              Name              Description
  ------ ----------------- ----------------- ---------------------------------------------------------
  1      `BEGINNER`        Mới chơi          Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định
  2      `WEAK`            Yếu               Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả, hay đứng sai vị trí
  3      `AVERAGE_MINUS`   Trung bình yếu    Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi; dễ tự đánh hỏng khi đối phương tăng tốc
  4      `AVERAGE`         Trung bình        Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí; độ ổn định chưa đồng đều giữa các kỹ thuật
  5      `AVERAGE_PLUS`    Trung bình khá    Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật có chủ đích
  6      `GOOD`            Khá               Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ; người chơi phong trào năng lực cao
  7      `EXCELLENT`       Giỏi              Kỹ thuật chuyên sâu, chính xác ngay cả dưới áp lực; chủ động công thủ tốc độ cao; thường đã có thành tích thi đấu (bao gồm cả bán chuyên và chuyên nghiệp)

`rank` is ascending order of skill (1 = lowest) and is unique, matching
`SKILL_LEVELS.rank` (`docs/architecture/database-schema.md` §3.2). `code`
is unique and matches `SKILL_LEVELS.code`. Seven levels (not the nine-level
community scale) were chosen so that the levels match the names used by the
Vietnamese recreational community and stay within the precision of a
self-reported survey; rationale in
`docs/research/bao-cao-cong-thuc-danh-gia-trinh-do.md` §3.6.

Direction confirmed 2026-10-31 (`PROJECT-BRIEF.md` §3.1): the initial level
is produced by a one-time skill survey inside registration instead of a
direct level choice; automatic adjustment from ratings is superseded by the
2026-11-08 decision; only professional tournaments provide a basis for
progression (formula TBD).

### Registration skill survey (model finalized 2026-11-15)

The model below replaces the earlier "Method 2B" survey (six 0–3 criteria,
bands 20/38/55/72/86, inactivity −8). Rationale, sources, worked examples and
sensitivity analysis: `docs/research/bao-cao-cong-thuc-danh-gia-trinh-do.md`
(v2.4). This section is the authoritative statement of the rules.

**Questions.** 16 items in 4 steps; every visible item is required (wording
in the Authentication & Authorization PRD, subsection "Registration skill
survey — content updated 2026-11-15"):

| Step | Items | Feeds |
| --- | --- | --- |
| 1. Background | Playing time (6 options), sessions per week (4), coaching (5), returning after a break of more than 6 months (yes/no) | $X_{\text{years}}$, $X_{\text{freq}}$, $T$, penalty |
| 2. Technique | 9 skills, each rated 0–3: service, clear, smash, net play, defense, drive, backhand, footwork, doubles play | $K$ |
| 3. Play & stamina | Rally consistency before own error (6 options), stamina (5 options) | $R$, $P$ |
| 4. Achievement | Highest result achieved — 1st, 2nd or 3rd place only (5 options) | $A$ |

**Option scores.** Option $i$ (counted from 0) of an item with $n$ ordered
options scores $C = \frac{i}{n-1} \times 100$, kept at full precision (for
example $100/3$, never a pre-rounded $33.33$). Technique:
$K = \frac{\sum k_j}{3n} \times 100$ for $n$ skills ($n = 9$ in version 1).
Experience: $X = 0.7\,X_{\text{years}} + 0.3\,X_{\text{freq}}$.

**Weighted score.**
$S_{\text{raw}} = 0.40K + 0.20R + 0.15X + 0.10P + 0.10A + 0.05T$.
If the Player is returning after a continuous break of more than 6 months
(and has played again for less than 3 months), $S = \max(0, S_{\text{raw}} - 15)$;
otherwise $S = S_{\text{raw}}$. The returning question is not shown and is
`false` when playing time is "less than 6 months".

**Rounding.** All calculations and all comparisons with band boundaries use
unrounded values; scores are rounded to 2 decimals only for storage and
display.

**Score bands** on $S \in [0, 100]$:

| $S$ | Level |
| --- | --- |
| $0 \le S < 15$ | `BEGINNER` |
| $15 \le S < 30$ | `WEAK` |
| $30 \le S < 45$ | `AVERAGE_MINUS` |
| $45 \le S < 60$ | `AVERAGE` |
| $60 \le S < 70$ | `AVERAGE_PLUS` |
| $70 \le S < 80$ | `GOOD` |
| $80 \le S \le 100$ | `EXCELLENT` |

**Guardrails.** Final rank $= \min(\text{Band}(S), \text{cap}_{G1}, \text{cap}_{G2})$.
A guardrail is recorded as applied when its cap is below $\text{Band}(S)$.

-   **G1 — Bottleneck:** $\text{cap}_{G1} = \min(\text{Band}(K), \text{Ref}(R), \text{Ref}(P)) + 1$,
    where $\text{Band}(K)$ uses the score bands above and $\text{Ref}$ is the
    reference rank of the chosen option, matched to the PRD options by position:

    | Rally consistency ($R$) | Ref | Stamina ($P$) | Ref |
    | --- | --- | --- | --- |
    | Fewer than 5 shots | 1 | Out of breath within 20 minutes | 2 |
    | 5–9 shots | 2 | Lasts 20–40 minutes | 3 |
    | 10–14 shots | 3 | About 1 hour, fades in game 3 | 4 |
    | 15–19 shots | 4 | Keeps form through 3 games | 5 |
    | 20 or more shots | 5 | Several matches in a session | 6 |
    | 20 or more shots and usually finishes the rally by attacking | 6 | | |

-   **G2 — Experience cap:** playing time "less than 6 months" caps the level
    at `AVERAGE_MINUS`; "6 months to less than 1 year" caps it at `AVERAGE`;
    1 year or more has no cap.
-   No guardrail requires tournament achievement. Achievement only adds to
    $S$ through $A$; the high `GOOD` (70) and `EXCELLENT` (80) boundaries keep
    the top levels hard to reach without excelling in most criteria.

**Versioning.** All parameters above (questions, option scores, skill list,
weights, experience mix, penalty, bands, G1 reference ranks, G2 caps) form
survey **version 1** and are stored as data per version
(`SKILL_SURVEY_VERSIONS`, `docs/architecture/database-schema.md` §13.8). The
calculation steps (weighted sum, penalty, rounding, G1/G2 application) are
code. Changing any parameter requires a new version; a published version is
never edited, and Players keep the level and result produced by the version
they took. An Admin UI for versions is out of MVP.

**Other rules.**

-   The result is an initial self-assessment (tentative), not a certification
    of ability. One survey per Player; no retake.
-   Accounts created before the survey are sample data and are recreated, not
    migrated (decision 2026-11-15). This supersedes the 2026-10-31 rule
    "existing accounts keep their current level".
-   History of descriptions: before 2026-10-31 `AVERAGE_PLUS` read "Kỹ thuật
    đều, di chuyển tốt, hay đánh giải phong trào" and `GOOD` read "Có thành
    tích giải phong trào, kỹ thuật toàn diện"; they were revised on 2026-10-31
    and replaced by the seven-level descriptions on 2026-11-15.

Decision recorded 2026-09-16 (Business Owner), following the change
policy in §11; catalog and survey model updated 2026-11-15 (human owner).

## 1.3 Facility and Court Status

Facility and court `status` values are:

-   `ACTIVE` — bookable.
-   `SUSPENDED` — not bookable; set by Admin for operational reasons.
-   `PENDING_APPROVAL` — an owner-submitted facility/court awaiting Admin
    review; not bookable.
-   `REJECTED` — an owner submission rejected by Admin; not bookable.

Rules:

-   A Court Owner submission is created as `PENDING_APPROVAL`.
-   Admin approval moves a submission to `ACTIVE`; Admin rejection moves
    it to `REJECTED`.
-   `ACTIVE ↔ SUSPENDED` is the operational transition; the onboarding
    states are not used for operational suspension.
-   Deactivation (`deleted_at`) is separate from `status` and is
    irreversible in the MVP flow.
-   Only `ACTIVE` facilities/courts are bookable and appear to Players.

Decision recorded 2026-10-04 (Business Owner), following the change policy
in §11.

------------------------------------------------------------------------

# 2. Court Booking Rules

## 2.1 Booking Model

-   Booking is real-time.
-   There is no Player → Pending → Owner approval/rejection workflow.
-   A selected Court time slot is held through `PENDING_PAYMENT` while
    payment is pending.
-   A Booking may span multiple contiguous pricing intervals.
-   Booking price is snapshotted.
-   Changes to Court Pricing do not change existing Booking prices.

## 2.2 Court Availability

For the same Court:

-   Booking intervals must not overlap.
-   Boundary-touching intervals are allowed.

Example:

``` text
18:00 ───── 19:00
19:00 ───── 20:00
```

These two bookings are valid.

## 2.3 Booking Price

The final Booking amount is calculated from the applicable pricing
intervals.

The pricing information used for the Booking must be snapshotted so that
later changes to Court Pricing do not affect the existing Booking.

## 2.4 Booking Cancellation

Player cancellation:

-   Allowed before `start_time`, subject to configured rules.
-   If a paid Booking is cancelled under allowed conditions, the Player
    receives a full refund.
-   A `PENDING_PAYMENT` (unpaid) Booking may be cancelled by the Player before
    `start_time`; it becomes `CANCELLED` and the slot is released with no refund.

Owner cancellation:

-   Allowed before `start_time`, subject to configured rules.
-   If the cancellation is caused by a Court issue/maintenance, the
    Player must be notified.
-   If a paid Booking is cancelled by the Owner, the refund flow is
    triggered.

Booking cancellation and payment/refund lifecycle are separate concerns.

### 2.4.1 Court Owner revision (approved 2026-10-23)

- Owner cannot directly cancel a tournament system reservation; Organizer handles the linked match through Tournament. No payment/refund is inferred for this reservation.
- Owner incident cancellation remains pre-start only; after-start incidents show existing support guidance, with no partial refund or new override in MVP.
- New bookings require both facility and court ACTIVE/not deactivated, full pricing coverage and opening-hour eligibility. Facility/court suspension leaves existing bookings unchanged and visible/actionable subject to their normal rules.
- Reject Owner opening-hour changes excluding effective future/in-progress bookings. Serialize these edits with all booking-creation paths.
- Approved location changes require an Admin proposal/review while keeping the live approved location; rejected onboarding can be edited/resubmitted in place with retained review history and mandatory rejection reason. Pending onboarding attempts are immutable.
- Maintenance locks use their own `MAINTENANCE_ADVANCE_WINDOW_DAYS` (default 90), from today through today + configured days inclusive in Asia/Ho_Chi_Minh. This does not extend the Player booking window. One range per creation and one whole block per release by ID; no recurring, partial or bulk operations. Effective active bookings (including IN_PROGRESS and Tournament) prevent overlapping locks; expired holds do not.
- Pricing upsert identifies updates by pricing ID and may end validity; never mutate existing booking snapshots. Missing pricing is unavailable, never free or zero-priced by inference.

## 2.5 Booking Lifecycle

``` text
PENDING_PAYMENT
    ├── CONFIRMED
    │     └── IN_PROGRESS
    │            └── COMPLETED
    │
    ├── EXPIRED
    └── CANCELLED   (Player cancels an unpaid hold before start_time)

CONFIRMED
    └── CANCELLED       (Player cancels before start_time)
```

Automatic transitions:

``` text
start_time → CONFIRMED becomes IN_PROGRESS
end_time   → IN_PROGRESS becomes COMPLETED
payment timeout → PENDING_PAYMENT becomes EXPIRED
```

Manual transition:

``` text
Player cancels an unpaid PENDING_PAYMENT hold → CANCELLED
(slot released immediately; no refund)
```

Decision recorded 2026-09-26 (Business Owner): a Player may cancel an unpaid
`PENDING_PAYMENT` hold before `start_time`; the Booking becomes `CANCELLED`,
the slot is released, and no refund applies.

## 2.6 Payment Timeout

Default payment timeout:

``` text
10 minutes
```

When payment expires:

-   Booking becomes `EXPIRED`.
-   Payment becomes `EXPIRED`.
-   Court slot is released.

The timeout is snapshotted for the pending transaction. Changing the
configuration does not modify the expiry of an existing pending Booking.

## 2.7 Late Payment

If a payment arrives after the Booking has already expired:

-   The Booking must never be reopened.
-   If the payment provider has already charged the Player, the amount
    must go through the refund flow.

Payment success and Booking confirmation must be idempotent.

## 2.8 Refund

Refund handling is part of MVP when required by a paid Booking
cancellation.

There is no separate refund-management module in MVP.

The following are confirmed:

-   Payment provider: VNPAY (`docs/architecture/tech-stack.md`).
-   Provider-specific refund execution: integrated into the payment
    lifecycle (`docs/features/platform/payments-refunds/tech-design.md`).
-   `REFUND_PROCESSING_TIMEOUT_MINUTES`: `1440` minutes (§8.2).

------------------------------------------------------------------------

# 3. Matchmaking Rules

## 3.1 Match Types

Supported:

-   `SINGLES`
-   `DOUBLES`

Player count:

``` text
SINGLES = 2 players
DOUBLES = 4 players
```

## 3.2 Request Lifecycle

``` text
OPEN
  ├── MATCHED
  ├── CANCELLED
  └── EXPIRED
```

A Request does not return to `OPEN`.

One Request can produce **at most one successful Match**.

## 3.3 Invitation Candidates

Browse existing non-deleted Players with valid profiles by name and skill. No
online/ACTIVE status, OPEN request, availability, match-type preference or
profile-area requirement applies. Skill defaults to the preferred range and
can be overridden with a warning; authenticated response rules remain intact.

## 3.4 Invitation Lifecycle

`PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`.
Before formation only: `ACCEPTED → WITHDRAWN` on invitee withdrawal.
A closed invitation is never reopened. Multiple pending invitations may exceed
remaining seats; first valid acceptances fill the group. Duplicate pending or
already-accepted group invitations are rejected.

## 3.5 Invitation Timeout

Snapshot `expires_at = min(created_at + MATCHMAKING_INVITATION_TIMEOUT_MINUTES,
request.expires_at)`. Request expiry is capped at preferred start. Request cancellation/expiry/formation closes pending
invitations atomically. Accepted members are released on request closure.

## 3.6 Group Formation and Reservations

Owner plus accepted invitees forms exactly 2/4 Players for Singles/Doubles.
The owner and accepted invitees reserve the preferred window until closure or
booking. Final acceptance and creation of one PENDING_COURT Match are atomic.

## 3.7 Partial Group Withdrawal and Expiry

Accepted invitees can withdraw before formation without cancelling the request.
Request expiry/cancel releases all reservations and notifies affected members.
No automatic replacement is created.

## 3.8 Court Booking

Owner books/pays through Booking. Booking must be on the preferred date, within
the accepted window and match the duration snapshot. Area is a suggestion only;
booking outside it is allowed. Link a paid, future booking to confirm the Match.

## 3.9 Leaving and Cancellation

Any participant may leave PENDING_COURT before its booking deadline or CONFIRMED
before booked start; the Match is cancelled. Automatically request linked-booking
cancellation under Booking policy, with retry and Payment-owned refund. Booking
cancellation cancels the Match; no return to PENDING_COURT. No backfill or penalty.

## 3.10 Overlapping Commitments

Check OPEN-owner and accepted partial-group reservations, PENDING_COURT preferred
windows and CONFIRMED/IN_PROGRESS booking intervals. Release on withdrawal,
request closure or Match cancellation. Serialize Player scheduling writes in DB.

## 3.11 Scheduling Feasibility

Preferred start must be at least MATCHMAKING_MIN_LEAD_TIME_MINUTES (60) in the
future. Snapshot duration on request creation. PENDING_COURT is cancelled at
preferred start if no booking is linked; use COURT_NOT_BOOKED, not started state.

### Approved implementation decisions — 2026-10-10

Status: Ready. Approved by: Human owner, explicitly approving the review choices
and readiness in this session. These decisions refine the invitation-only scope.

- Discovery uses existing, non-deleted Player accounts with a valid profile; no
  online-presence or `USERS.status = ACTIVE` requirement applies to browsing or
  sending an invitation. Invitees need no OPEN request or stored availability.
  Responding still requires the existing authenticated, authorized Player flow;
  this approval does not bypass authentication/account-access restrictions.
- Browse by name and skill, defaulting to the request's skill range; allow viewing
  out-of-range Players with a mismatch warning. Time and area are invitation
  context, not candidate filters inferred from profiles.
- Select city/district from the shared facility-address values. Area is a
  preference only: the owner may book outside it without another confirmation.
- Sending more invitations than remaining seats is allowed. The first valid
  acceptances fill the seats; formation atomically closes other pending invites.
  Declined, expired, cancelled or withdrawn invitees can receive a new invitation
  while the request remains OPEN; historical invitations are never reopened.
- An OPEN request reserves its owner's preferred playing window; ACCEPTED
  invitations to that request reserve the same window for invitees. These
  reservations and PENDING_COURT/CONFIRMED/IN_PROGRESS Matches may not overlap.
  Reserve the whole preferred window before booking because the owner may book
  any duration-sized interval inside it. A Player cannot create an overlapping
  owner request or accept an overlapping invitation. Exclude the same group's
  own reservation when it is converted to a Match or linked to a booking.
- Before formation, an accepted invitee may withdraw; the invitation becomes
  WITHDRAWN, the owner is notified and the invitee's reservation is released.
  This does not cancel the request. No withdrawal or replacement after formation;
  participants then use Match leave.
- Pending invitees see invitation context. Accepted invitees additionally see
  the owner, accepted members, remaining seats, request deadline and resulting
  Match link. Membership access ends on withdrawal/request closure, except their
  own invitation history and participant access to a formed Match.
- The final acceptance and full group formation commit together; any failure
  rolls back the final acceptance. Never persist a full group without a Match.
- Snapshot match duration when the request is created. A linked booking must
  belong to the owner, be paid/CONFIRMED, start in the future, be on the preferred
  date, fit wholly inside the preferred window, have exactly the snapshotted
  duration, and not be linked elsewhere. Recheck every participant's schedule.
  Before booking, reserve the preferred window; after booking use its actual
  start/end as the official interval. Config changes do not change old intervals.
- PENDING_COURT expires at the original preferred start if no booking is linked:
  cancel with COURT_NOT_BOOKED, release reservations and notify the group. Any
  member (including the owner) may leave before that deadline; after it, return
  the effective cancelled state rather than claiming the Match has started.
- Leaving a CONFIRMED Match before its booked start cancels the Match. Request
  cancellation of its linked booking through Booking policy automatically;
  Payment owns refunds. Persist retryable cancellation work with the Match
  transition. A policy refusal is visible to the owner; the Match remains
  CANCELLED and the booking is not silently reported as cancelled/refunded.
- Cancellation of a linked booking cancels the Match with BOOKING_CANCELLED;
  do not return it to PENDING_COURT. Reconciliation precedes time advancement.
- Linking the same booking to the same Match again returns current state (200);
  a different booking after linkage is a conflict. Match/booking state must be
  revalidated atomically with the linkage.
- Player scheduling is serialized by database Player-row locks in ascending id
  order, followed by request, invitation, Match and Booking locks. All scheduling
  writers recheck reservations inside the transaction; no in-memory lock is used.
- Matchmaking reads/commands/jobs are scoped by MATCHMAKING_MATCHES. Tournament
  lifecycle remains explicit and is never advanced by Matchmaking jobs.
- When MATCHMAKING_ENABLED is false, reject new requests and invitations only.
  Existing invitation responses, formation, booking linkage, reads, withdrawal,
  leave, cancellation and cleanup continue.

Decision recorded 2026-10-10 (Human owner), following the change policy in §11:
MVP Matchmaking is invitation-only, courts are booked manually by the request
owner, each invitation has its own timeout, skill is a default filter with a
mismatch warning (not hard-enforced), a Player cannot be in two overlapping
Matches, and a minimum lead time applies to a request's preferred start.

## 3.12 Social Matchmaking — business direction confirmed 2026-10-31

Status: direction confirmed by the human owner on 2026-10-31
(`PROJECT-BRIEF.md` §3.1, §7). These are business rules only. They do not
confirm statuses, schema, API or technology; numeric limits are configuration
in §8.9. §3.1–§3.11 remain the rules for the implemented invitation-only flow
until the affected PRD sections are approved as Ready and the Tech Design is
updated. Implementation of the new flow must not start from this section alone.

Confirmed directions:

-   **Discovery and joining.** Match-finding posts appear on a feed for
    signed-in Players. A Player may Apply and the host approves or rejects; the
    host may also Invite. Apply and Invite share one membership, slot and
    schedule-conflict model. Reactions/comments never create membership or
    take a slot.
-   **Preparation before publishing.** A host may prepare a match-finding post
    before publishing it and invite Players during that stage. A pending
    invitation never holds a slot; a slot is deducted only after the invitee
    accepts. An unpublished post accepts no Apply and may still become full
    through invitations alone.
-   **Post types.** `SINGLES` and `DOUBLES` keep their player counts (2 and 4)
    and produce one Match as today. A casual group ("giao lưu") post produces
    one multi-player Match without team assignment; every participant of that
    Match may rate every other participant under §6.
-   **Full condition.** Singles/Doubles are full only when every slot is filled.
    A casual group post is full when every slot is filled, or when the host
    closes recruitment early after reaching the post's minimum player count (with at least 1 accepted registered Player member, so a Match never forms with the host alone).
-   **Companions without an account.** Only a casual group host may declare a number of
    companions without an account; Singles and Doubles require 2/4 registered Players. Companions are deducted from slots, but they are
    not Match participants on the platform and cannot
    rate or be rated.
-   **Court.** A post may use a host-declared external court (shown as not
    verified by the platform) or a CONFIRMED booking owned by the host, linked
    before or after gathering players. A post that still has no court at its
    start is cancelled (the existing `COURT_NOT_BOOKED` outcome). Cancellation of
    a linked booking cancels the Match (the existing `BOOKING_CANCELLED`
    outcome); it does not return to a no-court state.
-   **Withdrawal before full.** Withdrawal releases the slot without cancelling
    the post (unchanged from §3.7).
-   **Leaving after full — Singles/Doubles.** A participant leaving cancels the
    Match, unchanged from §3.9.
-   **Leaving after full — casual group.** A non-host participant leaving reopens
    the slot so the host can recruit a replacement through the feed until the
    start time. The Match takes place only when it has at least the minimum
    player count; it is not played with an arbitrary shortfall. Replacement is
    manual (Apply/Invite), not automatic, so §10 "Automatic Match replacement"
    remains out of MVP.
-   **Host leaving.** The host leaving cancels the post/Match; host ownership is
    never transferred.

Superseded by the approved Phase 1 business rules (2026-10-31): §3.1 (only two Match types),
§3.2 (a request never returns to recruiting) for casual group posts, §3.3
(invitation-only discovery), §3.6 (exactly 2/4 Players) for casual group posts,
§3.8 (booking only after formation; no external court), §3.9 for casual group
posts, and the 2026-10-10 statement "MVP Matchmaking is invitation-only".

Detailed rules confirmed by the human owner on 2026-10-31 (numeric values
are configuration keys in §8.9; storage technique is not decided):

-   **Deadlines.** A post recruits until its start time or until recruitment
    closes. A pending Apply or Invite expires after a configurable timeout
    (default 24 hours), never later than the start time or the moment
    recruitment closes. When a casual group reopens recruitment, closed
    Applies/Invites are not restored.
-   **Capacity.** Casual group posts have 3–12 slots; the host sets a minimum
    from 2 to the total. Companions without an account count toward both
    capacity and the minimum, but forming or starting a casual group Match always requires at least 1 accepted registered Player member (at least 2 platform accounts including the host). At publishing at least one slot must remain open.
    Singles and Doubles posts cannot declare companions.
-   **Open posts per Player.** At most 3 open match-finding posts per Player
    (configurable). Free posts are not limited by this rule.
-   **Schedule conflicts.** A pending Apply does not reserve the window. Conflict
    is checked when the Apply is sent and when it is approved. When a Player's
    participation is confirmed, that Player's other pending Applies/Invites with
    an overlapping window close automatically and the affected Players are
    notified.
-   **Skill on Apply.** Out-of-range skill shows a mismatch warning; the host
    decides. Not hard-enforced (same as Invite).
-   **Visibility.** Feed, posts and comments: signed-in Players only (not
    Visitors or Court Owners). Accepted members (name, avatar): any Player. The
    applicant list and management data: host only. An unpublished post: the
    host, and invitees only for the information needed to respond (no
    applicant list or management data).
-   **Withdrawal deadline.** A participant may withdraw any time before the start
    time; no penalty in MVP. For a casual group, withdrawal re-checks the
    minimum; Singles/Doubles follow the "leaving after full" rule above.
-   **Booking when the host cancels.** When the host actively cancels or leaves,
    the host chooses to keep the linked booking or to request its cancellation
    under the Booking policy (§2.4).
-   **Casual group below minimum at start.** If the group is below `min_players` or has zero accepted registered Player members at start, the post/Match is cancelled, the
    linked booking is kept, and the host is told clearly that the booking is
    still valid.
-   **Editing a match-finding post.** The author may edit or delete their post.
    Once any member is accepted, start time, post type and capacity are locked;
    adding an external court or linking a booking remains allowed while the post
    has no court. Author deletion of an active match-finding post goes through the
    cancellation flow first and hides the post afterwards; linked bookings follow
    the host-choice cancellation policy above. Admin hiding only hides content:
    it does not cancel the post/Match or booking, and existing members retain
    authorized access to manage their participation.
-   **Court already set (approved 2026-10-31).** The only allowed change is from
    a host-declared external court to the host's CONFIRMED booking at the same
    location that covers the whole post time; members are notified. A booking
    at a different location is a court change and is not allowed. Replacing a
    linked booking is not allowed. The linking action never cancels any booking.
-   **Duration.** `MATCHMAKING_MATCH_DURATION_MINUTES` (90) remains the default
    for posts without a linked booking; it never overrides the duration of a
    linked booking. A casual group host enters a duration of 60–180 minutes
    (default 90) when creating the post (approved 2026-10-31). When a booking is
    linked, the post time must lie entirely within the booking. The time of a
    post that already has members is never changed automatically.

## 3.14 Social feed — rules confirmed 2026-10-31

-   Players may publish free posts and match-finding posts. Free posts never
    create membership, a Match or a booking.
-   Reactions on posts use exactly six types: 👍 ❤️ 😂 😮 😢 😡. One reaction per
    Player per post; it may be changed or removed.
-   Comments are flat (no nested replies). The comment author and the post author
    may delete a comment; editing is not supported. Deletion of posts and
    comments is a soft hide so reports can still be handled.
-   Images on posts: JPEG/PNG/WebP, at most 5 MB each and 4 per post. Document
    files are not allowed on posts.
-   Uploads are validated for type, size and upload permission and are never
    executed. MVP has no malware scanning.
-   **Rate limits (approved 2026-10-31, §8.9).** At most 10 free posts per
    Player per day and 10 comments per Player per minute across the platform.
    Deleting a post or comment does not restore quota. Match-finding posts
    follow the open-post limit instead.
-   **Hidden content and evidence (approved 2026-10-31).** In MVP, hidden posts
    and comments, reported messages and attachments are never permanently
    deleted automatically. Recalled messages (`deleted_at`) and dissolved group conversations (`status = 'DISSOLVED'`) are soft-hidden from Player views while preserving the underlying message rows and media files in the database as report evidence (updated 2026-11-01). Content linked to a report is kept for at least 180 days
    after the report becomes `RESOLVED`; this is a minimum, not a deletion
    commitment. Hidden content is not reachable through normal posts or
    conversations; evidence access is limited to report handling.
-   Admin may hide posts and comments. Hiding a match-finding post never cancels
    the post or its booking. No automatic moderation.

## 3.13 Messaging — business direction confirmed 2026-10-31

Status: direction confirmed by the human owner on 2026-10-31
(`PROJECT-BRIEF.md` §3.4, §7). Technology is owned by
`docs/architecture/tech-stack.md` (WebSocket real-time delivery for messages, reactions, online presence and typing indicators, paired with REST API,
approved on 2026-11-01) and the Messaging Tech Design
(`docs/features/messaging/tech-design.md`, Ready); this section does not decide it.

-   MVP supports standalone one-to-one (`DIRECT`) and group (`GROUP`) conversations with real-time text, images,
    file attachments, per-message reactions, online and typing indicators,
    history and unread counts. Voice/video calls are out of MVP.
-   Messaging is completely decoupled from Matchmaking: any Player can create a group conversation (`title` + initial `memberIds[]`), add members (`ACTIVE`), or leave a group (`LEFT`). Social/Matchmaking UI may invoke the group-creation API (`POST /api/v1/conversations/group`) as a convenience action, without coupling group lifecycle to post/Match states.
    Read/send permission follows active conversation membership (`state = 'ACTIVE'`).

-   Leaving a conversation never withdraws the Player from the post or Match.

Detailed rules confirmed on 2026-10-31:

-   **Group conversation lifecycle & Group Owner permissions (updated 2026-11-01).** Created explicitly via the Messaging API (`POST /api/v1/conversations/group`) with a group title and initial Player members (at least 2 members including the creator, up to `MESSAGING_GROUP_MAX_MEMBERS`). The creator is the **Group Owner (`created_by`)**, who is always an `ACTIVE` member and cannot leave without dissolving the group. Only the Group Owner may rename the group, lock/unlock group message sending (`is_locked` — when locked, only the Group Owner can send new messages), add or reactivate (`LEFT → ACTIVE`) non-blocked Players, remove a member (`ACTIVE → LEFT`), recall any message in the group, or dissolve the group (`status = 'DISSOLVED'`). Regular `ACTIVE` members may send messages (when not locked), reply (`parent_id`), edit/recall their own messages, hide messages for themselves (`message_hides`), react, and voluntarily leave (`ACTIVE → LEFT`). Leaving or being removed (`LEFT`) immediately stops new messages/unread counts and revokes history/attachment access until the Group Owner re-adds the Player. Dissolving a group closes it permanently for all members in real time while retaining database rows and media files for report evidence.
-   **Message actions (Reply, Edit, Recall, Hide for me — approved 2026-11-01).** Any sender may quote-reply (`parent_id`) to a non-recalled message in the same conversation, edit the text of their own non-recalled message (`edited_at`), or recall their own message (`deleted_at`; Group Owner may also recall any message in their group). Recalled messages hide text and attachments from all members and block attachment downloads (`GET /media/:id`) while preserving DB/media records as evidence. Any active member may hide a message for themselves (`message_hides`) without affecting other members.






-   **One-to-one conversations.** Any Player may start one with another Player
    unless either has blocked the other, subject to anti-spam rate limits
    (§8.9): limits apply per sender across all conversations; a "new one-to-one
    conversation" counts only the first conversation with a Player not
    messaged before (reopening an existing conversation does not count). Court
    Owner and Admin do not take part in chat in MVP.
-   **Blocking.** Two-way: blocks new one-to-one messages and new Apply/Invite
    between the two Players, and closes pending requests between them. It does
    not remove either Player from an existing post or group conversation. The
    blocked Player is not notified. One-to-one history remains readable but no
    new message can be sent.
-   **Attachments.** Images: JPEG/PNG/WebP, at most 5 MB each and 4 per message.
    Files (messages only): PDF/DOCX/XLSX/TXT, at most 10 MB and 1 per message.
    Type, size and permission are validated; uploads are never executed; no
    malware scanning in MVP.
-   **Presence.** Online status is shown only to Players who share a
    conversation; typing is shown only inside that conversation. A Player who
    left the group or is blocked no longer receives presence through that
    relationship. No "hide online" option in MVP.
-   **Message reactions.** The same six types as posts; one reaction per Player
    per message.
-   **Moderation.** Admin may view only a reported message and its reported
    attachment, never the whole conversation.
-   **Notifications.** New messages are reflected in unread counts only, not as
    individual notification entries.

Reported messages and attachments follow the evidence-retention rule in §3.14.

---

# 4. Tournament Rules

## 4.1 Supported Format

MVP supports:

``` text
Format: SINGLE_ELIMINATION
Match Type: SINGLES | DOUBLES
```

## 4.2 Tournament Lifecycle

``` text
DRAFT
  ↓
OPEN_FOR_REGISTRATION
  ↓
REGISTRATION_CLOSED
  ↓
READY
  ↓
IN_PROGRESS
  ↓
COMPLETED
```

`CANCELLED` is a terminal state reachable according to the approved
cancellation rules.

## 4.3 Organizer Cancellation

Organizer can cancel:

-   `DRAFT`
-   `OPEN_FOR_REGISTRATION`
-   `REGISTRATION_CLOSED`
-   `READY`

Organizer cannot self-cancel an `IN_PROGRESS` Tournament.

Admin can cancel any Tournament.

If an Organizer account is deactivated:

-   Tournament is not automatically cancelled.
-   Admin may intervene and manage the Tournament.

There is no automatic Organizer replacement in MVP.

## 4.4 Tournament Editing

### DRAFT

Full editing is allowed.

### OPEN_FOR_REGISTRATION

Limited editing:

-   Cannot change `match_type`.
-   Cannot change `format`.
-   Cannot reduce `participant_limit` below current registrations.
-   Cannot change the registration period once it has started.
-   Cannot change `entry_fee` once any registration is `CONFIRMED`.

### REGISTRATION_CLOSED / READY / IN_PROGRESS

Structural information is locked.

### COMPLETED / CANCELLED

Read-only.

## 4.5 Registration

### Singles

``` text
registration_type = SINGLES
player_id != NULL
team_id = NULL
```

One registration represents one player.

### Doubles

``` text
registration_type = DOUBLES
player_id = NULL
team_id != NULL
```

One registration represents one team.

Participant limit therefore means:

``` text
Singles: 1 registration = 1 player
Doubles: 1 registration = 1 team = 2 players
```

Example:

``` text
participant_limit = 8

Singles → 8 players
Doubles → 8 teams = 16 players
```

## 4.6 Registration Period

Registration is allowed only during the configured registration period
and while the Tournament is in the appropriate lifecycle state.

Registration lifecycle:

```text
PENDING_PAYMENT
  ├── CONFIRMED   (successful payment, or free tournament)
  ├── CANCELLED   (Player withdraws before registration closes)
  └── EXPIRED     (payment timeout)
```

A free tournament (`entry_fee = 0`) creates the registration directly as
`CONFIRMED`.

`PENDING_PAYMENT` registrations expire at a snapshotted `expires_at`
derived from `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`.

Players may cancel/withdraw before registration closes.

After registration closes, registrations are locked.

A Player who withdraws a paid `CONFIRMED` registration before
registration closes receives a full refund.

A Doubles registration may only be withdrawn by its Team captain.

## 4.7 Doubles Team

A Doubles Team:

-   Has exactly 2 players.
-   Has no substitute in MVP.
-   Is created by a Player.
-   Creator becomes captain.
-   Captain invites the second player.
-   Invitee must accept the invitation.
-   Team must contain exactly 2 members before registration.
-   Membership is locked after the Team is registered.

Team and invitation window:

-   Creating a Team, inviting, accepting, declining, and cancelling an
    invitation are allowed only while the Tournament is
    `OPEN_FOR_REGISTRATION`.
-   When the Tournament becomes `REGISTRATION_CLOSED` or is `CANCELLED`,
    remaining `PENDING` invitations become `CANCELLED` automatically.

A Player may belong to only one Doubles Team within the same Tournament.

A Player may simultaneously:

-   register as a Singles participant, and
-   belong to one Doubles Team.

## 4.8 Team Invitation

Lifecycle:

``` text
PENDING
  ├── ACCEPTED
  ├── DECLINED
  ├── CANCELLED
  └── EXPIRED
```

Default timeout:

``` text
1440 minutes = 24 hours
```

`expires_at` is calculated when the invitation is created.

Changing the configuration does not modify existing pending invitations.

Pending invitations are automatically `CANCELLED` when the Tournament
stops accepting registrations (`REGISTRATION_CLOSED` or `CANCELLED`).

Decision recorded 2026-09-25 (Human owner), following the change policy
in §11.

------------------------------------------------------------------------

## 4.9 Entry Fee, Payment, and Refund

-   The Organizer configures `entry_fee`; `0` means the Tournament is
    free.
-   `entry_fee` is editable in `DRAFT` and locked once any registration
    is `CONFIRMED`.
-   The Player must pay the full fee before the registration becomes
    `CONFIRMED`. Split Bill is not supported.
-   When a paid Tournament is cancelled by the Organizer or an Admin,
    each paid registration receives a 100% refund.
-   When a Player withdraws a paid `CONFIRMED` registration before
    registration closes, the registration receives a 100% refund.
-   Payment and refund handling is idempotent.

## 4.10 Venue and Match Scheduling

-   A Tournament may reference a platform Facility and/or hold a
    free-text venue note.
-   Tournament matches are scheduled by the Organizer.
-   A match's Court may be unassigned until scheduled, but must be
    assigned before the match starts.
-   Changing a match's Court or time after it has started is match
    rescheduling, which is outside MVP.

------------------------------------------------------------------------

# 5. Tournament Bracket Rules

## 5.1 Bracket Size

Bracket size is:

``` text
smallest power of 2 >= number of registrations
```

BYEs are automatically created when necessary.

## 5.2 Seeding

Seeding rules:

1.  The Organizer sets the seed order before the draw; the system provides a
    skill-ranking suggestion as the starting point
    (`PROJECT-BRIEF.md` §3.3).
2.  If the Organizer does not seed, the system uses skill ranking where
    sufficient information exists and randomizes otherwise.
3.  The draw randomizes all unseeded registrations.
4.  High seeds should avoid each other in early rounds.
5.  BYE placement prioritizes high seeds.

After bracket generation:

-   Bracket is locked.
-   Seed is locked; the seed order cannot change after the draw.

Decision recorded 2026-10-04 (Human owner), following the change policy in
§11, to align with `PROJECT-BRIEF.md` §3.3.

## 5.3 Minimum Participants

Singles:

``` text
>= 2 players
```

Doubles:

``` text
>= 2 teams
```

If the minimum is not reached when registration closes:

``` text
Tournament → CANCELLED
```

No bracket is generated.

If the minimum is reached:

``` text
Tournament → READY
```

The Tournament becomes `IN_PROGRESS` when the first Match starts.

## 5.4 Tournament Match Result

A valid Tournament Match result must come from the underlying Match
result.

Winner is recorded through:

``` text
winner_registration_id
```

The winner advances using:

``` text
next_match_id
next_registration_slot
```

The loser is eliminated.

## 5.5 Tournament Match Cancellation

If a Tournament Match is cancelled:

-   No automatic advancement occurs.
-   Organizer/Admin must resolve the situation.
-   The cancelled Match record remains for audit/history.

Resolution values:

``` text
NONE
WALKOVER
WINNER_DECLARED
UNRESOLVED
```

## 5.6 No-Show

Grace period:

``` text
15 minutes after scheduled Match start
```

Singles:

-   No-show may result in opponent `WALKOVER`.

Doubles:

-   If one member is absent, the Team is not eligible.
-   Opponent receives `WALKOVER`.

------------------------------------------------------------------------

# 6. Rating Rules

A Player may rate another participant of the same Match.

Rules:

-   Self-rating is forbidden.
-   A rater may rate multiple other players in the same Match.
-   In Doubles, a Player may rate teammates and opponents.
-   Direction confirmed 2026-10-31 (§3.12): in a casual group Match without
    teams, a participant may rate every other participant; companions without
    an account are never rated.
-   Skill adjustment by Match entry — approved 2026-10-31, applied equally to
    Singles, Doubles and casual groups. Until migrated (Tech Design), the
    rules below remain those of the implemented feature.
    -   Every individual rating is kept for display and aggregates.
    -   A Match entry is the unrounded average of the skill ratings a Player
        received in that Match; it exists once the Match has at least one such
        rating.
    -   The window is the most recent `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES`
        (default 5) Match entries, ordered by Match completion time, then Match
        ID, descending. The window average weights each Match entry equally,
        regardless of how many Players rated.
    -   A late rating updates the entry of its own Match. A Match outside the
        current window does not change the current window result.
    -   No further adjustment occurs merely because the cooldown elapsed: a new
        adjustment requires at least one new Match entry since the previous
        adjustment.
    -   Threshold (1 level), one-step movement, cooldown (14 days) and the
        target bands below are unchanged.
    -   How the used data point is recorded and how the old configuration is
        converted belong to the Ratings Tech Design; not yet decided.
-   The same rater → rated player pair may be rated again in another
    Match.
-   The same rater may rate the same player at most once per Match.
-   Both rater and rated player must belong to the same Match.
-   Rating is only valid for a Match that has reached a completed state.
-   A submitted rating is immutable; it is not edited or deleted after
    submission.

Database uniqueness:

``` text
(rater_id, rated_player_id, match_id)
```

Rating dimensions and scale:

-   Each rating records two dimensions: skill and attitude.
-   Rating scale: `1–5` integer, applied to both dimensions.

Rating scope:

-   Rating applies to completed Matches, covering both matchmaking
    (casual) Matches and Tournament Matches.
-   Tournament-related rating is gated by `TOURNAMENT_RATING_ENABLED`
    (§8.4).

Skill adjustment (automatic):

-   The recorded skill ratings automatically adjust the rated Player's
    skill level under a simple, bounded rule
    (`PROJECT-BRIEF.md` §3.1). Only the skill dimension drives
    adjustment; the attitude dimension does not.
-   Input is the most recent `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`
    received skill ratings (sliding window).
-   Target-level mapping from the recent skill average:
    -   `< 1.50` → `BEGINNER` (rank 1)
    -   `1.50 ≤ average < 2.50` → `WEAK` (rank 2)
    -   `2.50 ≤ average < 3.50` → `AVERAGE_MINUS` (rank 3)
    -   `3.50 ≤ average < 4.50` → `AVERAGE` (rank 4)
    -   `4.50 ≤ average < 5.00` → `AVERAGE_PLUS` (rank 5)
    -   `5.00` → `GOOD` (rank 6)
    -   *Legacy (2026-11-15): this mapping targets the former six-level
        catalog and never reaches `EXCELLENT` (rank 7). Automatic adjustment is
        disabled (`PLAYER_SKILL_ADJUSTMENT_ENABLED = false`, §8.8) and must not
        be re-enabled without a new mapping decision.*
-   When the target differs from the current level by at least
    `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` levels, the Player moves exactly
    one level toward the target.
-   At most one automatic adjustment per Player per
    `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`.
-   Every automatic adjustment is recorded as history (previous level,
    new level, average, ratings considered, timestamp).
-   `PLAYER_SKILL_ADJUSTMENT_ENABLED` gates automatic adjustment; ratings
    are still recorded when it is `false`.
-   No ELO/MMR or complex rank calculation is used. Tournament seeding is
    not changed directly by adjustment; it continues to use the Player's
    current skill level.

Decision recorded 2026-09-27 (Business Owner), following the change policy
in §11: the exact rating scale is fixed at a `1–5` integer scale for both
skill and attitude; rating scope is confirmed for completed Tournament
Matches (gated by `TOURNAMENT_RATING_ENABLED`) in addition to completed
matchmaking Matches.

Decision recorded 2026-10-04 (Business Owner), following the change policy
in §11: rating data automatically adjusts the Player's skill level using
the simple bounded rule above, aligning with `PROJECT-BRIEF.md` §3.1.

------------------------------------------------------------------------

# 7. Report Rules

Each Report targets exactly one object:

``` text
Player
OR
Facility
OR
Tournament
```

Rules:

-   A Report cannot target multiple objects.
-   A Report cannot have zero targets.
-   Multiple targets require separate Reports.
-   A Player cannot report themselves.

Direction confirmed 2026-10-31 (§3.13–§3.14): reportable targets will also
include a post, a comment and a message; a message report may point to the
specific image/file attachment. The "exactly one target" rule is kept. Schema
and Report Management changes are pending.

Reason codes for post, comment and message reports (approved 2026-10-31; a fixed
set, not configuration; existing reason codes for other targets are unchanged):

  Code                      Label
  ------------------------- ---------------------------------------------
  `SPAM`                    Spam/quảng cáo không phù hợp
  `HARASSMENT`              Quấy rối, xúc phạm
  `INAPPROPRIATE_CONTENT`   Nội dung không phù hợp
  `SCAM`                    Lừa đảo
  `PRIVACY_VIOLATION`       Tiết lộ thông tin riêng tư
  `OTHER`                   Khác — a non-empty description (after trimming) is required

------------------------------------------------------------------------

# 8. Configuration Matrix

## 8.1 Configuration Semantics

Configuration changes apply to **new transactions/entities**.

Existing pending entities keep their already-established/snapshotted
deadlines.

Example:

``` text
TEAM_INVITATION_TIMEOUT_MINUTES = 1440
```

Changing it to another value affects newly created invitations only.
Existing pending invitations keep their original `expires_at`.

The same principle applies to Booking payment timeout and
Matchmaking/Tournament timeout values where an entity has already
received an `expires_at` or equivalent deadline.

------------------------------------------------------------------------

## 8.2 Booking Configuration

  -------------------------------------------------------------------------------------------
  Key                                                           Default Meaning
  ---------------------------------------- ---------------------------- ---------------------
  `BOOKING_ENABLED`                                              `true` Enable/disable
                                                                        booking

  `BOOKING_MIN_DURATION_MINUTES`                                   `60` Minimum booking
                                                                        duration

  `BOOKING_MAX_DURATION_MINUTES`                                  `180` Maximum booking
                                                                        duration

  `BOOKING_ADVANCE_WINDOW_DAYS`                                     `7` Maximum advance
                                                                        booking window

  `MAINTENANCE_ADVANCE_WINDOW_DAYS`                                `90` Independent advance
                                                                        maintenance window

  `BOOKING_ACTIVE_LIMIT_MODE`                                 `LIMITED` Active-booking limit
                                                                        strategy

  `BOOKING_MAX_ACTIVE_PER_PLAYER`                                   `5` Maximum active
                                                                        bookings per Player

  `PLAYER_CAN_CANCEL_BOOKING`                                    `true` Whether Player
                                                                        cancellation is
                                                                        enabled

  `PLAYER_CANCELLATION_DEADLINE_MINUTES`                            `0` Player cancellation
                                                                        deadline relative to
                                                                        start

  `OWNER_CAN_CANCEL_BOOKING`                                     `true` Whether Owner
                                                                        cancellation is
                                                                        enabled

  `OWNER_CANCELLATION_DEADLINE_MINUTES`                             `0` Owner cancellation
                                                                        deadline relative to
                                                                        start

  `BOOKING_PAYMENT_TIMEOUT_MINUTES`                                `10` Payment hold timeout

   `REFUND_ENABLED`                                               `true` Enable refund flow

   `REFUND_PROCESSING_TIMEOUT_MINUTES`                            `1440` Refund processing timeout
  -------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 8.3 Matchmaking Configuration

  -----------------------------------------------------------------------------------------------
  Key                                                               Default Meaning
  -------------------------------------------- ---------------------------- ---------------------
  `MATCHMAKING_ENABLED`                                              `true` Enable/disable
                                                                            matchmaking

  `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`                             `30` Request expiration

  `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`                             `15` Direct invitation
                                                                            expiration

  `MATCHMAKING_MIN_LEAD_TIME_MINUTES`                                   `60` Minimum lead time for a
                                                                            request's preferred start

  `MATCHMAKING_MATCH_DURATION_MINUTES`                                 `90` Default Match
                                                                            duration
  -----------------------------------------------------------------------------------------------

Invitation expiration follows §8.1: an invitation keeps the deadline snapshotted
at creation. `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`,
`MATCHMAKING_CONFIRMATION_REQUIRED`, `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`,
and `MATCHMAKING_MAX_DISTANCE_KM` are removed: MVP Matchmaking is
invitation-only, does not search for a court, and does not require player
confirmation.

Decision recorded 2026-10-10 (Human owner), following the change policy in §11.

Social Matchmaking/Messaging keys approved on 2026-10-31 are listed in §8.9.
Until their migration is implemented, the keys above keep their current
meaning and defaults.

------------------------------------------------------------------------

## 8.4 Tournament Configuration

  ----------------------------------------------------------------------------------------------
  Key                                                              Default Meaning
  ------------------------------------------- ---------------------------- ---------------------
  `TOURNAMENT_ENABLED`                                              `true` Enable/disable
                                                                           tournaments

  `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT`                              `16` Default competitive
                                                                           registration limit

  `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`                   `10` Registration payment
                                                                           hold timeout

  `TOURNAMENT_RATING_ENABLED`                                       `true` Enable
                                                                           tournament-related
                                                                           rating

  `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES`                           `15` No-show grace period
  ----------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 8.5 Team Configuration

  --------------------------------------------------------------------------------------
  Key                                                      Default Meaning
  ----------------------------------- ---------------------------- ---------------------
  `TEAM_INVITATION_TIMEOUT_MINUTES`                         `1440` Team invitation
                                                                   timeout; 24 hours

  --------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 8.6 Report Configuration

  Key                  Default Meaning
  ------------------ --------- --------------------------
  `REPORT_ENABLED`      `true` Enable/disable reporting

------------------------------------------------------------------------

## 8.7 Authentication Configuration

  --------------------------------------------------------------------------------------------------------
  Key                                                  Default Meaning
  ---------------------------------------------- ---------- ---------------------------------------------
  `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD`                  `5` Consecutive failed sign-in attempts before an
                                                              account is temporarily locked

  `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES`                   `15` Lockout duration; account auto-unlocks after
                                                              this period

  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER`         `10080` Player session idle timeout (7 days)

  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER`     `43200` Player session absolute maximum duration
                                                              (30 days)

  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER`    `10080` Court Owner session idle timeout (7 days)

  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER` `43200` Court Owner session absolute maximum
                                                              duration (30 days)

  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN`             `60` Admin session idle timeout (1 hour)

  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN`        `480` Admin session absolute maximum duration
                                                              (8 hours)
  --------------------------------------------------------------------------------------------------------

A configuration change applies to new sessions/lockout windows only;
an already-established session or an in-progress lockout keeps its
originally snapshotted expiry, consistent with §8.1.

Decision recorded 2026-09-16 (Business Owner), following the change
policy in §11.

------------------------------------------------------------------------

## 8.8 Player Skill Adjustment Configuration

  --------------------------------------------------------------------------------------------
  Key                                            Default Meaning
  ---------------------------------------------- ---------- ----------------------------------
  `PLAYER_SKILL_ADJUSTMENT_ENABLED`              `false` Enable automatic skill adjustment
                                                         from ratings (default `true` until
                                                         2026-11-15; set to `false` by the
                                                         survey migration; legacy, keep false)

  `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`          `5` Minimum recent skill ratings before
                                                         an adjustment can occur

  `PLAYER_SKILL_ADJUSTMENT_THRESHOLD`            `1` Minimum gap (in skill levels)
                                                         between the current and target level
                                                         that triggers an adjustment

  `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`        `14` Minimum days between two automatic
                                                         adjustments for the same Player
  --------------------------------------------------------------------------------------------

Adjustment uses the mapping and magnitude rules in §6. Configuration
changes apply to new evaluations only, consistent with §8.1.

Decision recorded 2026-10-04 (Business Owner), following the change
policy in §11.

Approved 2026-10-31 (§6): `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` (integer 1–100,
default `5`) will replace `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` as the window
size counted in Match entries. The replacement requires a migration plan in
the Ratings Tech Design; `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` stays in effect
until then.

------------------------------------------------------------------------

## 8.9 Social Matchmaking and Messaging Configuration (approved 2026-10-31; not yet implemented)

  Key                                            Default   Range        Meaning
  ---------------------------------------------- --------- ------------ ------------------------------------------------
  `SOCIAL_FEED_ENABLED`                          `true`    true/false   Enable/disable feed posts, reactions, comments
  `MESSAGING_ENABLED`                            `true`    true/false   Enable/disable messaging
  `MATCHMAKING_APPLICATION_TIMEOUT_MINUTES`      `1440`    15–10080     Pending Apply timeout (capped per §3.12)
  `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`       `1440`    15–10080     Existing key; default changes from `15`
  `MATCHMAKING_GROUP_MIN_SLOTS`                  `3`       3–20         Minimum capacity of a casual group post
  `MATCHMAKING_GROUP_MAX_SLOTS`                  `12`      3–20         Maximum capacity; MIN ≤ MAX
  `MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER`        `3`       1–20         Open match-finding posts per Player
  `MESSAGING_GROUP_MAX_MEMBERS`                  `50`      3–100        Maximum members in a group conversation
  `MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY`   `20`      1–500        New one-to-one conversations per sender per day
  `MESSAGING_MESSAGES_PER_MINUTE`                `30`      1–300        Messages per sender per minute
  `SOCIAL_FREE_POSTS_PER_DAY`                    `10`      1–100        Free posts per Player per day
  `SOCIAL_COMMENTS_PER_MINUTE`                   `10`      1–60         Comments per Player per minute

Semantics:

-   "Day" is the calendar day in `Asia/Ho_Chi_Minh`. Per-minute limits use a
    sliding 60-second window.
-   Messaging limits count per sender across all conversations. A new one-to-one
    conversation counts only the first conversation with a Player not messaged
    before.
-   Deleting a post or comment does not restore quota.
-   Media limits (§3.13–§3.14) are fixed rules, not configuration.
-   `MATCHMAKING_MATCH_DURATION_MINUTES` keeps default `90` and never overrides a
    linked booking's duration.
-   `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` is to be retired because posts
    recruit until start or close. Retiring/renaming keys and changing the
    `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` default require a migration plan;
    keys used by current code are not removed directly.
-   Storage technique for these keys is not decided by this section.

------------------------------------------------------------------------

# 9. Configuration Values Intentionally Not Frozen

No refund-processing configuration value remains intentionally unfrozen.

Other implementation details that are not business configuration values
remain in their respective architecture/feature documents.

------------------------------------------------------------------------

# 10. MVP Scope Boundaries

The following are explicitly outside MVP:

-   Split Bill.
-   Super Admin role.
-   Match rescheduling.
-   Court rating.
-   Independent refund-management module.
-   System-wide content management.
-   Automatic Tournament Organizer replacement.
-   Automatic bracket modification after a cancelled Tournament Match.
-   Automatic Match replacement after confirmation failure.
-   Automatic Matchmaking (automatic compatible-player matching).
-   Automatic court selection and automatic booking for Matchmaking.

Refund handling for a paid Booking cancellation **is still part of
MVP**. Only a standalone refund-management module is excluded.

------------------------------------------------------------------------

# 11. Rule Change Policy

These rules are considered frozen.

If a business rule changes:

1.  Identify the affected rule.
2.  Identify affected tables/configuration.
3.  Update this document.
4.  Re-check `database-schema.md`.
5.  Re-check affected PRD and Tech Design.
6.  Update database migrations if required.
7.  Record the change before implementation proceeds.

No developer or AI coding agent should silently introduce a different
business rule.

## Rating implementation clarification — approved 2026-10-15

The human owner approved these refinements to §6 and §8.8:

- Duplicate submissions acknowledge immutable stored ratings successfully; no second row or changed scores/comments are created.
- Tournament rating requires a completed, actually played Match with `WINNER_DECLARED`; walkover, unresolved and no-result Matches are excluded even if participants are populated.
- The adjustment window is the latest N received ratings by submission timestamp with rating ID as a descending tie-breaker. Late submissions count by submission time. Use unrounded averages and the continuous bands in §6; `GOOD` requires exactly 5.
- Only newly recorded ratings trigger evaluation, once per affected Player per submission. An all-duplicate replay never evaluates adjustment. A sliding window may overlap a previously used window; no requirement for N new ratings or distinct raters is added.
- Rating creation and any resulting skill/history changes are atomic. Concurrent evaluations serialize per rated Player and check the locked current level/cooldown. Cooldown is elapsed days × 24 hours; equality permits evaluation. Zero cooldown permits distinct new submissions to adjust successively. No timer or configuration write triggers evaluation.
- Confirmed configuration bounds: `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` integer 1–100; `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` integer 1–6 (legacy six-level bound; adjustment disabled since 2026-11-15); `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` integer 0–365. Boolean gates use true/false. Defaults in §8.8 remain unchanged.
- Another Player's aggregate is accessible only when the target is ACTIVE and not soft-deleted. Below three ratings, expose count and not-enough-data state but no averages/distributions. Self and Admin retain full aggregate access. Individual received records are Admin-only. Profile retains its own three-rating display threshold, including on the owning Player's profile.
- Player given-history and Admin read-only rating/adjustment history are required MVP surfaces. No manual skill-editing capability is introduced by this review.

Reference: Ratings PRD §15 and Tech Design §23. This approval confirms the Ratings-related bounds only; unrelated pending System Config ranges remain pending.

Court Owner review, 2026-10-23: human owner approved recommendations 1–14; §2.4.1 and §8.2 updated. Shared-document/schema edits await teammate PR review before merge.

Social Matchmaking/Messaging direction, 2026-10-31: human owner confirmed the
business directions and detailed rules in §1.2 (registration survey), §3.12,
§3.13, §3.14, §6 and §7. Configuration keys, defaults, ranges and semantics in §8.9 and the replacement
key in §8.8 are approved as business configuration. No implementation, status,
schema, API or technology change is approved by this entry. Shared
document edits await teammate PR review before merge.

## Phase 1 readiness review — 2026-10-31

Status: Ready for the Phase 1 business changes in §1.2, §3.12–§3.14, §6, §7 and §8.8–§8.9. The human owner explicitly approved readiness after review and confirmed the final three resolutions: companions only in casual groups; author deletion cancels the active post through its cancellation flow while Admin hiding preserves the post/Match, booking and member management access; the group-chat grace period starts at Match completion or post cancellation/expiry, never recruitment closure. These extensions take precedence over conflicting earlier business requirements. The earlier rules describe the implemented baseline only. This approval does not approve technical design, schema, API, new statuses or technology, and shared documents still require teammate PR review before merge.
