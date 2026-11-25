# Product Requirements Document (PRD) — Tournament Management

## Status and Ownership

```text
Status: Draft (rewritten 2026-11-25; awaiting teammate review before Ready)
Owner: PM/Business Owner
Fulfills: PROJECT-BRIEF.md §3.4, §4, §6, §7 ("Phân loại Giải đấu & Trọng tâm Thuật toán")
Scope: Tournament Management — Professional tournaments (this release); Casual tournaments and rank promotion deferred
```

This document replaces the legacy PRD (2026-09 → 2026-11-15, see git history). The legacy text mixed an all-account participant model, gateway payment (`PENDING_PAYMENT`), real Court bookings and post-match Ratings; all four are superseded by the decisions in §14.

### Tóm tắt quyết định (2026-11-25)

| # | Quyết định |
| --- | --- |
| 1 | Đợt này chỉ làm **giải chuyên nghiệp**; giải phong trào để sau (giữ sẵn cột `competition_type`). |
| 2 | **Không liên kết sân thật / booking.** Địa điểm giải là text tự do; mỗi trận có nhãn sân tự do ("Sân 3") và giờ dự kiến. |
| 3 | **Xếp lịch tự động trên sân ảo**: Organizer khai báo số sân, thời lượng trận, thời gian nghỉ tối thiểu, khung giờ mỗi ngày; hệ thống xếp trận tránh trùng sân và trùng vận động viên; Organizer sửa tay được. |
| 4 | **Điều kiện trình độ**: Organizer đặt trình độ tối thiểu–tối đa; giải đôi xét cả hai thành viên. |
| 5 | **Lệ phí trừ Ví sàn ngay** khi đăng ký → `CONFIRMED`; không có `PENDING_PAYMENT`/hết hạn thanh toán. Rút/bị loại/giải huỷ → hoàn 100% về ví. |
| 6 | **Tiền lệ phí** giữ ở sàn tới khi giải `COMPLETED`, sau đó cộng vào ví Organizer. |
| 7 | **Organizer loại được** một đăng ký (kèm lý do) trước khi bốc thăm; hoàn 100%. |
| 8 | **Không có Post-match Rating** cho trận giải (Brief §5: Out of MVP). |
| 9 | Công thức **nâng trình** vẫn TBD (TRN-14) — không làm trong đợt này, nhưng dữ liệu kết quả phải đủ để tính sau. |
| 10 | Mỗi trận **3 set thắng 2, mỗi set 21 điểm** theo luật cầu lông (cách 2 điểm, trần 30); Organizer nhập tỉ số từng set, hệ thống kiểm tra đúng luật. |
| 11 | Nhánh đấu, lịch và tỉ số **cập nhật realtime qua WebSocket** cho người đã đăng nhập; khách tự làm mới 30 giây. |
| 12 | Sau khi đóng đăng ký, người chơi **không tự rút** được; không đến thi đấu → Organizer ghi walkover, **không hoàn lệ phí**. |
| 13 | Thêm: **lịch sử giải trên Profile** (vị trí đạt được), **chia sẻ kết quả lên Social** sau khi giải kết thúc, **nhóm chat của giải** tạo khi đóng đăng ký. |

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §3.4, §4, §5, §7
- Business rules and configuration: `docs/business-rules-config-matrix.md` §4, §5
- Release decision gate: `docs/plans/01_g0-cong-quyet-dinh.md` (D1a/D1b/D1c)
- Wallet: `docs/features/platform/payments-refunds/` (wallet-first, SePay top-up)

## Related Documents

- Tech Design: [tech-design.md](./tech-design.md)
- Tasks: [tasks.md](./tasks.md)
- Track plan: `docs/plans/07_giai-dau.md`

## 1. Problem

Players organise badminton tournaments with spreadsheets, chat groups and paper brackets: registrations, fees, the draw, the match order and results are scattered, and participants cannot see where and when they play next. The platform needs one place where an Organizer runs a tournament end to end and participants follow it live. Professional tournaments are also the only future basis for rank promotion (`PROJECT-BRIEF.md` §7), so their results must be recorded reliably against Player accounts.

## 2. Goals

- An Organizer (a Player) creates a professional tournament, opens registration, and runs it to completion from one console.
- Players find tournaments, check eligibility, register (Singles or Doubles) and pay the entry fee from their wallet in one step.
- Results live on: tournament history on the Player profile, result posts on the Social feed, and a group chat per tournament.
- The system builds a fair single-elimination bracket (seeding, BYEs, draw) and an automatic match schedule over the Organizer's courts without player or court clashes.
- The Organizer updates each match (start, set scores, result) and the system advances winners automatically.
- Participants and visitors follow the bracket, schedule and results.

## 3. Non-Goals (this release)

- Casual ("phong trào") tournaments with participants without accounts, manual entry or Excel import (TRN-13, deferred).
- Rank promotion formula and points (TRN-14, TBD — `docs/plans/01_g0-cong-quyet-dinh.md` D1c). Placements are shown on Profile and can be shared to Social, but no promotion is computed.
- Linking a tournament or its matches to platform Facilities, Courts or Bookings; no slot reservation, opening hours or maintenance checks.
- Post-match Ratings for tournament matches.
- Formats other than `SINGLE_ELIMINATION` (no round-robin, double elimination, third-place match).
- Team substitutes; Split Bill for entry fees; automatic Organizer replacement.
- Gateway payment per registration (the fee is always paid from the wallet; top-up uses the existing wallet top-up flow).

## 4. Scope

### In Scope

- Tournament lifecycle `DRAFT → OPEN_FOR_REGISTRATION → REGISTRATION_CLOSED → READY → IN_PROGRESS → COMPLETED`, plus `CANCELLED`.
- Classification field `competition_type` (`PROFESSIONAL` only in this release).
- Skill-level eligibility range set by the Organizer.
- Singles registration; Doubles teams with captain, invitation and team registration.
- Entry fee paid from the wallet at registration; 100% refunds on withdrawal, removal and cancellation; fee transfer to the Organizer's wallet on completion.
- Organizer participant management: view, remove (before the draw) with a reason.
- Seed order (system suggestion by skill level, Organizer adjusts), draw, bracket generation with BYEs.
- Automatic match scheduling over virtual courts; manual edits with conflict warnings; re-run for matches not yet started.
- Match operations: start, set scores, winner/walkover, result correction while the next match has not started, automatic advancement, tournament completion.
- Notifications for invitations, registration changes, bracket publication, schedule changes, cancellation.
- Admin: view all tournaments, cancel any tournament (with refunds).
- Realtime updates of bracket, schedule and scores (WebSocket; polling fallback for visitors).
- Tournament history (placements) on the Player profile; sharing a result post to the Social feed; a group chat per tournament.

### Out of Scope

See §3.

## 5. Target Users and Roles

- **Visitor (no session):** browse and view non-draft tournaments, bracket, schedule and results (Auth PRD §7.8).
- **Player:** register, manage own Doubles team and invitations, withdraw, follow own matches.
- **Tournament Organizer:** contextual permission of the Player who created the tournament (`PROJECT-BRIEF.md` §2); manages only that tournament.
- **Admin:** views all tournaments and may cancel any of them; does not play or organise (`PROJECT-BRIEF.md` §4).
- **Court Owner:** no role in this feature.

## 6. User Journeys

**Organizer**
1. Creates a tournament (`DRAFT`): name, description, Singles/Doubles, participant limit, entry fee, eligibility range, registration window, tournament dates, free-text venue, schedule settings (number of courts, match duration, minimum rest, daily start/end time).
2. Opens registration. Players register and pay.
3. Reviews participants; removes an ineligible or problematic registration with a reason (refunded).
4. Closes registration (manually, or automatically at `registration_end`). With fewer than 2 registrations the tournament is cancelled and refunded.
5. Reviews the suggested seed order, adjusts it, and runs the draw → bracket generated and schedule built automatically → `READY`.
6. Adjusts the schedule if needed (moves a match to another court/time; the system warns about clashes) or re-runs automatic scheduling.
7. On the day: starts matches, enters the score of each set (best of 3, 21 points), or records a walkover for a no-show; winners advance. The first started match makes the tournament `IN_PROGRESS`. Uses the tournament group chat (created at close) for announcements.
8. After the final, concludes the tournament → `COMPLETED`; collected fees move to the Organizer's wallet; may share the result to the Social feed.

**Player**
1. Browses tournaments, opens one, sees format, fee, eligibility, slots left, venue and dates.
2. Registers (Singles) or creates a team, invites a partner, and the captain registers the team once the partner accepts (Doubles). The fee is debited from the wallet; if the balance is short, the Player is sent to top up.
3. May withdraw before registration closes (100% refund).
4. After the draw: sees the bracket, own next match (court label and time) and results, updated live; joins the tournament group chat.
5. After completion: the placement appears in the profile's tournament history; a placed Player may share it to the Social feed.

## 7. Functional Requirements

### 7.1 Tournament management
- FR-01 A Player can create a `DRAFT` tournament and becomes its Organizer.
- FR-02 The Organizer can edit a tournament under the editing rules in `business-rules-config-matrix.md` §4.4.
- FR-03 The Organizer sets an optional minimum and maximum skill level (from the 7-level catalog); min ≤ max.
- FR-04 The Organizer sets schedule settings: number of courts (1–20), match duration in minutes, minimum rest between a participant's matches, daily start and end time.
- FR-05 The Organizer opens registration (`DRAFT → OPEN_FOR_REGISTRATION`) and closes it (`→ REGISTRATION_CLOSED`); the system closes it automatically at `registration_end`.
- FR-06 The Organizer can cancel the tournament before `IN_PROGRESS`; an Admin can cancel it in any non-terminal state. Cancellation refunds every confirmed registration 100%.
- FR-07 The Organizer concludes the tournament after the final is resolved (`IN_PROGRESS → COMPLETED`).

### 7.2 Registration and fees
- FR-10 A Player can register for a Singles tournament while it is `OPEN_FOR_REGISTRATION`, within the registration window, with slots left and the Player's skill level inside the eligibility range.
- FR-11 For a paid tournament, registering debits the full fee from the Player's wallet in the same transaction and the registration is `CONFIRMED` immediately. Insufficient balance rejects the registration and tells the Player how much to top up. Free tournaments confirm directly.
- FR-12 A Player can withdraw a `CONFIRMED` registration before registration closes; a paid one is refunded 100% to the wallet. After registration closes there is no self-withdrawal and no refund; a no-show loses by walkover.
- FR-13 The Organizer can remove a `CONFIRMED` registration with a reason while the tournament is `OPEN_FOR_REGISTRATION` or `REGISTRATION_CLOSED` (before the draw); a paid one is refunded 100% and the participant is notified.
- FR-14 On completion, the sum of fees of registrations still `CONFIRMED` is credited to the Organizer's wallet exactly once.

### 7.3 Doubles teams
- FR-20 A Player can create a team in a Doubles tournament and becomes captain; the captain must meet the eligibility range.
- FR-21 The captain invites exactly one eligible Player; the invitee accepts or declines; the captain can cancel a pending invitation. Invitations expire after `TEAM_INVITATION_TIMEOUT_MINUTES`.
- FR-22 Once the team has two members, the captain registers it and pays the team's fee from the captain's wallet; membership locks.
- FR-23 Only the captain can withdraw the team's registration.

### 7.4 Seeding, draw and bracket
- FR-30 The Organizer sees the confirmed registrations with a suggested seed order (higher skill level first; Doubles uses the sum of the two members' ranks; ties broken randomly).
- FR-31 The Organizer sets or clears seed numbers (1..N, unique) before the draw.
- FR-32 The Organizer runs the draw: bracket size = smallest power of 2 ≥ registrations; seeded registrations are placed by standard seed positions (top seeds apart until late rounds), BYEs go to the highest seeds, unseeded registrations are placed randomly. Bracket and seeds lock afterwards.
- FR-33 The draw and the initial automatic schedule happen in one step; the tournament becomes `READY`.

### 7.5 Scheduling (virtual courts)
- FR-40 The system assigns each playable match a court label ("Sân 1" … "Sân k") and a start time so that no court hosts two overlapping matches, no participant plays two overlapping matches, each participant rests at least the minimum rest time between matches, a match never starts before both of its feeder matches can be finished, and matches stay inside the daily window (overflow moves to the next day).
- FR-41 The Organizer can edit the court label (free text) and start time of a match that has not started. The system shows warnings for court or participant clashes and for a match placed before its feeder matches, but saves the edit.
- FR-42 The Organizer can re-run automatic scheduling; matches already started or finished keep their court and time.
- FR-43 Participants and visitors see the schedule by time and by court.

### 7.6 Match operations and results
- FR-50 The Organizer starts a match whose two participants are known; the first start moves the tournament to `IN_PROGRESS`.
- FR-51 The Organizer records the score of each set and confirms the result. A match is best of 3 sets; a set is won at 21 points with a 2-point lead, otherwise play continues until a 2-point lead, capped at 30 (30–29). The system rejects invalid scores and derives the winner (2 sets). Alternatively the Organizer records a walkover with the winning side (no-show, retirement).
- FR-52 The winner advances to the next match automatically; a BYE winner advances at draw time without a match.
- FR-53 The Organizer can correct a resolved match while the next match has not started; the advancement is corrected too.
- FR-54 A match can be cancelled with resolution `NONE` (no advancement); the Organizer must later resolve it before the tournament can complete.

### 7.7 Viewing, realtime and notifications
- FR-60 Anyone can list and view tournaments that are not `DRAFT`; a `DRAFT` is visible only to its Organizer and Admins.
- FR-61 A Player sees "my tournaments": organised, registered, team invitations.
- FR-62 Notifications: team invitation received/answered/expired; registration confirmed, removed by the Organizer, refunded; registration closed; bracket and schedule published; own match time or court changed; tournament cancelled; tournament completed.
- FR-63 Bracket, schedule, match status and scores update live for signed-in viewers (WebSocket push); visitors' pages refresh every 30 seconds while the tournament is `READY`/`IN_PROGRESS`.

### 7.8 Profile, Social and chat
- FR-70 The Player profile (own and public) shows a "Giải đấu" section: completed professional tournaments the Player took part in, with placement (Vô địch, Á quân, Đồng hạng 3 = lost in the semi-final, Tứ kết, Vòng N) and the tournament link. Cancelled tournaments are not listed.
- FR-71 After `COMPLETED`, the Organizer and each Player placed in the top 4 can publish one result post per tournament to the Social feed: optional text plus an automatic card (tournament name, date, champion, runner-up, own placement, link). The post follows normal Social rules (edit, delete, report, hide).
- FR-72 When registration closes (with ≥ 2 registrations) the system creates a tournament group chat with the Organizer and all confirmed participants; members removed later are removed from the chat; the chat is locked (read-only) when the tournament is `CANCELLED` or 30 days after `COMPLETED`.

## 8. Business Rules

- Format `SINGLE_ELIMINATION`; match type `SINGLES` or `DOUBLES`; `competition_type = PROFESSIONAL` only.
- Participant limit counts registrations (Singles: players; Doubles: teams).
- Eligibility: a Player is eligible when the tournament has no bound, or the Player's current skill rank is within [min rank, max rank]. Checked at registration, team creation and invitation acceptance; not re-checked later (a level change after registering does not remove the participant).
- The Organizer may not register in, or join a team of, their own tournament (proposed, see §15 Q1).
- The entry fee is a non-negative amount; `0` = free; locked once any registration is `CONFIRMED`.
- Refunds are always 100% of the paid fee and go to the payer's wallet (Doubles: the captain's).
- Fees are held by the platform until `COMPLETED`; a cancelled tournament pays nothing to the Organizer.
- Minimum 2 registrations at close; otherwise the tournament is `CANCELLED` automatically.
- Bracket and seeds lock after the draw; no re-draw.
- Schedule edits never block: conflicts are warnings.
- A started match cannot be unstarted; its court label and time may still be corrected for display.
- Results are corrected only while the next match has not started.
- Score rule per set: winner w, loser l valid iff (w = 21 and l ≤ 19) or (22 ≤ w ≤ 30 and l = w − 2) or (w = 30 and l = 29). A match is 2 sets (2–0) or 3 sets (1–1 then a deciding set).
- Withdrawal after registration closes is not possible; no-shows lose by walkover; no refund.
- Placement is derived from the bracket: final winner = champion, final loser = runner-up, semi-final losers = joint third, others = the round they lost in.
- No Ratings, no Booking, no Court Owner involvement.
- No third-place match; only the Organizer enters results; times use Asia/Ho_Chi_Minh.

Detailed rules: `docs/business-rules-config-matrix.md` §4–§5 (updated 2026-11-25).

## 9. UI/UX Behavior

- Entry point: "Giải đấu" in the Player navigation; public tournament pages for visitors.
- Tournament list: filters by status, match type, fee (free/paid), eligibility ("phù hợp trình độ của tôi"), date.
- Tournament detail: header (name, status, dates, venue, fee, eligibility, slots left), tabs "Thông tin", "Người tham gia", "Nhánh đấu", "Lịch thi đấu".
- Registration: one confirmation dialog showing the fee and the wallet balance; a short balance links to wallet top-up.
- Organizer console: setup form, participant table (remove with reason), seed editor with suggestion and "Bốc thăm", schedule board (rows = time, columns = courts) with drag/edit and warning badges, match panel (start, score entry, walkover, correct), "Kết thúc giải".
- Bracket view: rounds left to right, BYE shown, winners highlighted, current matches marked live; updates without reload.
- Score entry: three set rows (third enabled only at 1–1), instant validation message per set, winner preview before confirming.
- Profile: "Giải đấu" section with placement badges. Social: result card in the feed. Tournament detail links to its group chat for members.

## 10. Success Metrics

- Tournament completion rate: share of tournaments that start and reach `COMPLETED` (PM/Business Owner, 2026-09-13).

## 11. Constraints

- No new system role; Organizer is contextual (`PROJECT-BRIEF.md` §2).
- Wallet operations reuse the platform wallet and ledger (idempotent, auditable).
- The bracket and scheduling algorithms are the thesis focus (`PROJECT-BRIEF.md` §7) and must be deterministic for a given random seed and testable as pure functions.

## 12. Risks

- **Schedule realism:** real venues deviate from plan. Mitigation: free edits, warnings instead of blocks, re-run for remaining matches.
- **Organizer misuse of collected fees:** fees reach the Organizer only on `COMPLETED`; Admin can cancel and refund before that.
- **Late eligibility changes:** levels may change after registering; rule: eligibility checked at registration only.
- **Rank promotion still TBD:** results are stored per match and per participant so TRN-14 can compute promotion later without migration of history.

## 13. Dependencies

- Auth and skill level (survey) — done.
- Wallet (debit, credit, refund ledger) — done.
- Notifications module — done (producer and resource type `TOURNAMENT` to add).
- Shared Match core (`MATCHES`, `MATCH_GAMES`) — exists.

## 14. Decision Log

| # | Question | Decision | Decided by | Date | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Seeding with insufficient data | Use skill ranking; randomize ties/unranked; keep high seeds apart; BYEs to high seeds. | PM/Business Owner | 2026-09-13 | RESOLVED |
| 2 | Who controls seeding and the draw | Organizer adjusts the suggested order, then triggers the draw; seeds and bracket lock afterwards. | Human owner | 2026-10-04 | RESOLVED |
| 3 | Fee refunds on cancellation | 100% for every paid registration. | PM/Business Owner | 2026-09-13 | RESOLVED |
| 4 | Fee field and editability | `entry_fee ≥ 0`, `0` = free, locked once any registration is `CONFIRMED`. | Human owner | 2026-09-25 | RESOLVED |
| 5 | Team/invitation window | Only during `OPEN_FOR_REGISTRATION`; pending invitations cancelled at close. | Human owner | 2026-09-25 | RESOLVED |
| 6 | Professional vs casual tournaments | Two classes (`PROJECT-BRIEF.md` §3.4). Professional: account + registration window + slot. Casual: deferred (TRN-13). | User / G0 D1a, D1b | 2026-11-15 | RESOLVED |
| 7 | Rank promotion | Only professional tournaments may promote; formula and achievement confirmation TBD (TRN-14); corrected/cancelled results revert promotions. Ratings never promote. | User / G0 D1c | 2026-11-15 | PARTIAL |
| 8 | Court reservation for matches | **Superseded.** No link to platform Courts/Bookings; free-text venue and per-match court label. Replaces the 2026-10-04 "system booking" decision and the 2026-10-23 Court Owner integration. | Project owner | 2026-11-25 | RESOLVED |
| 9 | Match scheduling | Automatic scheduling over virtual courts (court count, duration, rest, daily window) avoiding court and participant clashes; Organizer edits with warnings. | Project owner | 2026-11-25 | RESOLVED |
| 10 | Skill eligibility | Organizer sets optional min/max skill level; Doubles checks both members. | Project owner | 2026-11-25 | RESOLVED |
| 11 | Fee payment | Wallet debit at registration → `CONFIRMED`; no `PENDING_PAYMENT`/`EXPIRED`. Replaces the 2026-09-25 gateway/timeout decisions. | Project owner | 2026-11-25 | RESOLVED |
| 12 | Fee destination | Held by the platform; credited to the Organizer's wallet when the tournament is `COMPLETED`. | Project owner | 2026-11-25 | RESOLVED |
| 13 | Organizer participant management | Organizer may remove a registration with a reason before the draw; 100% refund. | Project owner | 2026-11-25 | RESOLVED |
| 14 | Post-match Ratings for tournament matches | Removed (Brief §5 Out of MVP). Replaces "Ratings integration alignment" (2026-10-15). | Project owner | 2026-11-25 | RESOLVED |
| 15 | Casual tournaments in this release | Deferred; keep `competition_type` for later. | Project owner | 2026-11-25 | RESOLVED |
| 16 | Match format and score validation | Best of 3 sets, 21 points per set, 2-point lead, cap 30; Organizer enters each set; strict validation. | Project owner | 2026-11-25 | RESOLVED |
| 17 | Live updates | WebSocket push for signed-in viewers; 30 s polling for visitors. | Project owner | 2026-11-25 | RESOLVED |
| 18 | Withdrawal after close / no-show | No self-withdrawal after close; no-show → walkover; no refund. | Project owner | 2026-11-25 | RESOLVED |
| 19 | Profile, Social, chat | Tournament history with placements on Profile; result post to Social after completion; tournament group chat created at close. Rank promotion still TBD. | Project owner | 2026-11-25 | RESOLVED |

## 15. Open Questions (non-blocking, proposed defaults)

| # | Question | Proposed default |
| --- | --- | --- |
| Q1 | May the Organizer play in their own tournament? | No (conflict of interest when entering own results). |
| Q2 | Tournament chat size | Created through a dedicated path that is not limited by `MESSAGING_GROUP_MAX_MEMBERS` (a Doubles tournament can have up to 257 members) and skips members who blocked the Organizer. |
| Q3 | Who may view participant names before the draw? | Everyone who can view the tournament. |
| Q4 | Who may share a result post? | The Organizer and Players placed top 4; one post per user per tournament. |
