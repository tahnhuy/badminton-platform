# Product Requirements Document (PRD) - Matchmaking (Ghép trận)

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.1
Scope: Player-driven invitation-only matchmaking — match request creation, browsing and direct player invitations, invitation timeout handling, group formation, owner-driven court booking, group membership, and pre-match leaving
```

This PRD is Ready. All original Open Questions were resolved by the human owner on 2026-09-26 (see §14 Decision Log), the original `Fulfills` reference to a non-existent `PROJECT-BRIEF.md §3.5` was corrected to `§3.1` (Decision 2026-09-26), and on 2026-10-10 the human owner reduced the MVP scope to invitation-only (see §14). It defines product behavior and business rules only. It does not define API contracts, database schema, or implementation structure.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md` §3.1 (Matchmaking), §5 (Out of MVP), §6 (MVP Focus), §7 (Confirmed Business Decisions)
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.2 (MVP domains), §5.2 (PRD ownership), §6.3 (status lifecycle)
- Applicable business rules and configuration: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §3 (Matchmaking Rules), §8.1 (Configuration Semantics), §8.3 (Matchmaking Configuration)
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §2.3 (Matchmaking business decisions), §8 (Lifecycle Summary — Matchmaking Request and Match)
- Related capabilities referenced (not redefined): `docs/features/platform/payments-refunds/prd.md`, `docs/features/booking/player-booking/prd.md`, `docs/features/platform/authentication-authorization/prd.md`
- Global technology constraints referenced as product constraints: `docs/architecture/tech-stack.md` (in-app notification, in-process scheduled processing, HTTP polling)

## Related Documents

- Parent or related PRD: `N/A — no parent PRD`
- Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved)
- Task or issue: [tasks.md](tasks.md)
- Related feature PRDs:
  - [Player Booking PRD](../../booking/player-booking/prd.md) — the request owner creates the match booking through the Booking lifecycle and real-time confirmation rules
  - [Payments & Refunds PRD](../../platform/payments-refunds/prd.md) — financial handling for the match booking
  - [Authentication & Authorization PRD](../../platform/authentication-authorization/prd.md) — Player identity and skill level
  - [Tournament PRD](../../tournament/prd.md) — shares the Match concept; tournament matchmaking is out of this PRD

## 1. Problem

- **Who is affected:** Players who want to play badminton but do not have enough people (a partner for Singles, or three other players for Doubles) at a suitable skill level, location, and time.
- **What is difficult or unavailable today:** There is no simple way to find other Players at a suitable skill level and time and to organize a court. Players must coordinate manually over chat and phone, which produces mismatched skill levels, no-shows, and wasted court searches.
- **Why it matters within MVP:** Matchmaking is one of the three core MVP business areas (`PROJECT-BRIEF.md` §3.1, §6). It is the entry point for casual play and is the primary way Players form a match outside Tournaments.

## 2. Goals

- A Player can state a play demand (match type, time window, skill preference, and area) and create a Matchmaking Request.
- A Player can browse suitable Players and send a direct invitation to a specific Player; MVP is invitation-only and does not match Players automatically (`PROJECT-BRIEF.md` §3.1).
- An invited Player accepts or declines within the invitation deadline; acceptance commits the Player to the group.
- When the group reaches the full required player count, a Match is formed for the group.
- The request owner chooses a court and creates the booking through the Court Booking flow; Matchmaking does not select a court or create a booking automatically.
- A Match requires its full player count; if a Player leaves before the start, the Match is cancelled and Players can try again with a new request.
- Success Metrics: Directional MVP metrics are defined in §10 (no numeric targets in MVP).

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- Automatic compatible-player matching (the system finding and grouping compatible Players). MVP is invitation-only (`PROJECT-BRIEF.md` §3.1; `docs/business-rules-config-matrix.md` §3.3).
- ELO or dynamic MMR / skill-rating algorithms. MVP uses the approved skill-level catalog (`docs/business-rules-config-matrix.md` §1.2).
- Automatic court finding, distance/centroid-based court selection, and automatic booking creation for a Match.
- Automatic substitution / automatically filling a vacated slot in a match that is already formed or in progress (Out of MVP; `docs/architecture/database-schema.md` §10).
- Group chat inside Matchmaking.
- Tournament matchmaking (tournament participation and bracket matching belong to the Tournament module).
- Match rescheduling after a Match is confirmed (`PROJECT-BRIEF.md` §5).
- Split Bill for the match booking (`PROJECT-BRIEF.md` §5).
- An independent refund-management module (`PROJECT-BRIEF.md` §5).
- Court rating (`PROJECT-BRIEF.md` §5).

## 4. Scope

### In Scope

- Creating a Matchmaking Request for `SINGLES` or `DOUBLES`.
- Cancelling a Matchmaking Request while it is `OPEN`.
- Automatic expiration of an unmatched Request after its configured deadline.
- A Player with an `OPEN` request browsing suitable Players and sending a direct invitation to a specific Player.
- An invited Player accepting or declining within the invitation deadline (`MATCHMAKING_INVITATION_TIMEOUT_MINUTES`).
- Closing pending invitations when the request leaves OPEN; releasing accepted invitees on cancellation/expiry, or converting their membership to the formed Match.
- Forming a Match when the group (request owner plus accepted invitees) reaches the full required player count.
- The request owner choosing a court and creating the booking through the Court Booking flow; the Match is linked to that booking.
- Notifications to affected Players for invitation, group formation, cancellation, and expiration events.
- Viewing the details of a formed Match.
- A Player leaving a Match before it starts, including the cancellation consequence.
- A Player viewing their requests and their status.
- Viewing the members of the Player's group/Match and leaving it according to the pre-match leaving rule (`PROJECT-BRIEF.md` §3.1).
- Admin control through the `MATCHMAKING_*` configuration values.

### Out of Scope

- All items in §3 Non-Goals.
- Post-match rating (skill and attitude) — referenced by `PROJECT-BRIEF.md` §3.1 but owned by a separate Rating feature, not this PRD (Decision 2026-09-26, §14).
- Match result / score recording for casual matchmaking Matches. A casual Match moves to `IN_PROGRESS` at its scheduled start and to `COMPLETED` at its scheduled end; no result is recorded in MVP (Decision 2026-09-26, §14).
- Payment mechanics — the booking's financial lifecycle is owned by the Booking and Payments/Refunds capabilities; this PRD only assigns payment responsibility to the request owner (Decision 2026-09-26, §14).
- Match confirmation by Players as a separate step; accepting an invitation is the commitment (Decision 2026-10-10, §14).
- Any Admin-facing management of individual matchmaking requests or matches.
- Any direct Court Owner participation in matchmaking; the request owner selects the court through the Booking flow.

## 5. Target Users and Roles

- **Player:** creates, cancels, and views Matchmaking Requests; browses suitable Players and sends, accepts, or declines direct invitations within the invitation deadline; views group/Match members; receives invitation and group notifications; views formed Match details; leaves a Match before it starts. The request owner additionally chooses a court and creates the booking through the Booking flow.
- **Court Owner:** `N/A` directly. Courts are selected by the request owner through the Booking flow. Court Owner supervision, slot blocking, and court-side cancellation of the resulting booking are governed by the Booking module.
- **Admin:** `N/A` directly. Admin influences Matchmaking only by managing the `MATCHMAKING_*` configuration values in the configuration matrix. Admin does not participate in playing business (`PROJECT-BRIEF.md` §4).
- **Contextual permission:** `N/A — Matchmaking requires only the Player role; no contextual permission is involved.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

### 6.1 Normal journey — create a request and invite Players

1. A signed-in Player opens the Matchmaking area and creates a Matchmaking Request.
2. The Player selects the match type (`SINGLES` or `DOUBLES`), a preferred date and time window, a skill preference, and an area.
3. The system creates the request as `OPEN` with an expiration deadline derived from `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`.
4. The Player browses suitable Players and sends direct invitations to specific Players.
5. Each invited Player accepts or declines within `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`; an unanswered invitation becomes `EXPIRED` and the sender is notified and may invite someone else.
6. When the request owner plus the accepted invitees reach the full required player count (2 for `SINGLES`, 4 for `DOUBLES`), the group forms a Match and the request becomes `MATCHED`. For `DOUBLES`, the Players are split into two teams at random, with no partner preference.
7. The request owner chooses a court and slot and creates the booking through the Court Booking flow. On success, the Match is linked to the booking and becomes `CONFIRMED`.
8. The Players meet and play at the booked time. The Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP (Decision 2026-09-26, §14).

### 6.2 Alternative journey — invitation declined or times out

1. The owner sends one or more invitations while the request is `OPEN`.
2. An invitee declines, or an invitation reaches its deadline without a response.
3. The invitation becomes `DECLINED`/`EXPIRED`; the sender is notified and may invite another Player. The request remains `OPEN`.

### 6.3 Alternative journey — Player cancels an open request

1. A Player is waiting with an `OPEN` request.
2. The Player cancels the request.
3. The request becomes `CANCELLED`, its pending invitations are closed, and any accepted invitees are released with a notification.

### 6.4 Alternative journey — Player leaves before the Match starts

1. A Player is part of a Match that has not started.
2. The Player chooses to leave.
3. A Match requires exactly its full player count (2 for `SINGLES`, 4 for `DOUBLES`); MVP has no substitutes or automatic backfill.
4. If leaving drops the Match below its full required count, the old Match is `CANCELLED`. Remaining Players must create/use a new Matchmaking Request and form a new Match; no automatic replacement is performed (Out of MVP).
5. After the Match has started, a Player cannot leave through the normal leave flow.

### 6.5 Alternative journey — request expires with a partial group

1. A Player's request stays `OPEN` without reaching the full player count.
2. Its expiration deadline is reached.
3. The request becomes `EXPIRED`; pending invitations are closed and Players who already accepted are released with a notification. The Player may create a new request.

## 7. Functional Requirements

- The Player can create a Matchmaking Request for `SINGLES` or `DOUBLES`.
- The Player can specify a preferred date and time window, a skill preference (minimum and maximum skill level), and an area.
- The system rejects a request whose preferred start is fewer than `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) in the future.
- The system creates the request as `OPEN` with an expiration deadline.
- A Player can hold at most one `OPEN` request per match type at a time.
- The Player can cancel a Matchmaking Request while it is `OPEN`; the request becomes `CANCELLED`, its pending invitations are closed, and accepted invitees are released with a notification.
- The system expires an `OPEN` request when its deadline is reached; the request becomes `EXPIRED` and its pending invitations are closed.
- A Player with an `OPEN` request can browse suitable Players and send a direct invitation to a specific Player.
- The candidate list defaults to Players within the request's skill range, but the owner may invite Players outside it; an out-of-range invitee is shown with a skill-mismatch warning (skill is not hard-enforced).
- An invited Player can accept or decline the invitation; the sender is notified of the response.
- A Player cannot hold overlapping owner/accepted-group reservations or active Matches; check request creation, acceptance, formation and booking linkage.
- Each invitation has its own deadline of `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`; an unanswered invitation becomes `EXPIRED`.
- An invitation is only valid while the sender's request is `OPEN`; when the request is matched, cancelled, or expired, its pending invitations become `CANCELLED` or `EXPIRED` accordingly.
- Acceptance binds the invited Player to the sender's group; acceptance is the Player's commitment and no separate confirmation step is required.
- When the group reaches the full required player count (2 for `SINGLES`, 4 for `DOUBLES`), the group forms a Match and the involved request becomes `MATCHED`; a request never returns to `OPEN`.
- For `DOUBLES`, the system assigns the matched Players into two teams at random; no partner preference is supported in MVP.
- The system forms a Match only when the full required number of Players is available; the Match is created without a court.
- The request owner can create a booking for the Match through the Court Booking flow; on success, the Match is linked to that booking and becomes `CONFIRMED`.
- Matchmaking does not select a court, does not use distance/centroid, and does not create a booking automatically.
- The Player can view the details of a formed Match.
- The Player can leave a Match before it starts; a Match requires exactly its full player count, so if leaving drops the Match below that count it is `CANCELLED` and the remaining Players must rematch with a new request. MVP has no substitutes or automatic backfill.
- The Player cannot leave a started Match through the normal leave flow.
- A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP.
- The system applies no penalty, cooldown, or active-request limit for cancelling a request or leaving a Match in MVP.
- The system sends in-app notifications for invitation received, invitation response, group formation (Match ready), Match cancellation, and request expiration.
- The system applies `MATCHMAKING_ENABLED` as the feature gate.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §3 (Matchmaking Rules) and §8.3 (Matchmaking Configuration); `docs/architecture/database-schema.md` §2.3 (Matchmaking business decisions).
- Match types: `SINGLES` requires 2 Players; `DOUBLES` requires 4 Players.
- Request lifecycle: `OPEN → MATCHED | CANCELLED | EXPIRED`. A request does not return to `OPEN`.
- One request can produce at most one successful Match.
- A Player can hold at most one `OPEN` request per match type at a time.
- MVP is invitation-only: there is no automatic compatibility matching.
- Skill is a default candidate filter with a mismatch warning, not a hard invitation rule.
- A request's preferred start must be at least `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) in the future.
- Before booking, the commitment covers the preferred window; after booking, the commitment covers the booking start/end. Duration is snapshotted on request creation.
- Direct invitation lifecycle: `PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`; accepted invitees may withdraw before formation (`WITHDRAWN`).
- Each invitation has its own deadline of `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` (default 15), capped by the request's snapshotted `expires_at` (`docs/business-rules-config-matrix.md` §3.5, §8.1).
- A direct invitation is scoped to the sender's `OPEN` request; when the request is matched, cancelled, or expired, its pending invitations are closed.
- Acceptance of a direct invitation binds the invited Player to the sender's group and is the Player's commitment; there is no separate confirmation step.
- When the group reaches the full required player count, a Match is formed and the request becomes `MATCHED`.
- The Match is created without a court; the request owner chooses a court and creates the booking through the Court Booking flow.
- Court selection uses no distance/centroid logic, and Matchmaking creates no booking automatically.
- The request owner is the booking owner and is responsible for the booking payment; the other Players do not pay separately (Split Bill is out of MVP). The booking's financial lifecycle follows the Booking and Payments/Refunds rules.
- If the request expires before the group is full, the request becomes `EXPIRED`, pending invitations are closed, and accepted invitees are released with a notification; no automatic replacement group is created.
- For `DOUBLES`, the matched Players are assigned into two teams at random; MVP supports no partner preference.
- Before the Match starts, a Player may leave. A Match requires exactly its full required count (2 for `SINGLES`, 4 for `DOUBLES`); with no substitutes or automatic backfill in MVP, leaving below that count cancels the old Match and remaining Players must form a new Match with a new request.
- After the Match starts, a Player cannot leave through the normal leave flow.
- A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP.
- MVP applies no penalty, cooldown, or active-request limit for cancelling a request or leaving a Match; no no-show enforcement is applied automatically.
- Request expiration is governed by `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` (default 30 minutes); invitation expiration is governed by `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` (default 15 minutes).
- Configuration changes apply to new entities only; an already-created request or invitation keeps its established/snapshotted deadline (`docs/business-rules-config-matrix.md` §8.1).
- Matchmaking availability is gated by `MATCHMAKING_ENABLED`.

### 8.1 Readiness review decisions (Human owner, 2026-10-10)

Status: Ready; all 21 review choices approved, with 12B and no invitee activity
requirement. The authoritative detailed rules are business-rules §3.

- Discover non-deleted Players with profiles by name/skill, including those not
  currently active; no OPEN request or availability is required. Account access
  controls still apply when responding. Show an optional skill-mismatch warning.
- Area is selected city/district context, not a constraint on the eventual court.
- Owners may invite more people than seats; valid acceptances fill seats first.
  Reinvitation creates new history. Accepted invitees may withdraw before the
  group is full, releasing their time without cancelling the request.
- Owner requests and accepted partial groups reserve the preferred window.
  Members can view the partial group's progress and resulting Match.
- Booking stays on the same day, fits within the accepted window and uses the
  duration established on request creation. It may be outside the requested area.
- A group without a booked court is cancelled at preferred start; no member is
  trapped in a PENDING_COURT group after the deadline.
- Leaving cancels the Match and automatically requests linked-booking
  cancellation under Booking policy; Payment owns refund. Cancellation of the
  booking also cancels the Match. Failures/policy refusal are visible to owner.
- Disabling Matchmaking stops new requests/invitations while existing journeys
  and cleanup continue. Tournament Matches retain their own lifecycle.

## 9. UI/UX Behavior

- Entry points: the Matchmaking area of the Player experience, with a request-creation entry point, a list of the Player's requests with their current status, a suitable-Players browse and direct-invitation entry point, an inbox of received invitations with accept/decline actions, and a view of the Player's formed Matches and group members.
- Important states:
  - Loading (submitting a request, loading candidates, loading Match details).
  - Empty (no candidate Players; no active request; no invitations; no Matches).
  - Waiting (`OPEN` request waiting for invitees; group not yet full).
  - Success (request created; invitation accepted; Match formed; booking confirmed; Match details available).
  - Error (request creation fails; a requested change conflicts with the current state, such as cancelling a request that is no longer `OPEN`).
  - Cancelled (request cancelled by the Player; Match cancelled after a Player leaves).
  - Expired (request expired before a Match formed; invitation expired before a response).
  - Invitation (pending sent/received invitations; accepted, declined, cancelled, or expired invitations; and the "waiting for more players" group state).
- User feedback:
  - Clear status display for each request, invitation, and Match.
  - Clear indication of the required player count and how many are still needed.
  - A visible countdown for each pending invitation's deadline.
  - In-app notifications for invitation received, invitation response, group formation, Match cancellation, and request expiration.
  - A clear message that a cancelled/expired request cannot be reopened and that a new request is required.
- Content requirements: show match type, required player count, preferred playing time and date, skill preference, area, the selected court/venue and price once booked, and the request owner/payer.
- Accessibility or content requirements: N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP; Decision 2026-09-26, §14):
  - Request-to-match rate.
  - Invitation-acceptance rate.
  - Average time from request creation to a formed Match.
  - Average time from Match formation to a booked court.
  - Cancelled/expired-match rate by reason (request expired, Player leaving).
- Numeric targets are TBD — product metric target needs decision; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve the three system roles; no new role is introduced (`PROJECT-BRIEF.md` §2).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including Match rescheduling and automatic Match replacement.
- Must use the approved invitation-only rules (`docs/business-rules-config-matrix.md` §3) and must not introduce automatic matching, ELO/MMR, or a complex ranking algorithm.
- Must preserve the request and Match lifecycles defined by `docs/business-rules-config-matrix.md` §3 and `docs/architecture/database-schema.md` §8.
- Must preserve configuration defaults and snapshot semantics owned by `docs/business-rules-config-matrix.md` §8.1 and §8.3; these are not redefined here.
- The match booking is created by the request owner through the existing Booking module and follows real-time booking rules; the normal `Player → Pending → Owner approval/rejection` flow must not be introduced (`PROJECT-BRIEF.md` §7).
- Notifications are in-app only (`docs/architecture/tech-stack.md`).
- Time-based behavior uses in-process scheduled processing for MVP (`docs/architecture/tech-stack.md`); this is a product constraint on deadline handling, not an implementation choice in this PRD.
- No Split Bill for the match booking (`PROJECT-BRIEF.md` §5).
- Must not define API contracts, database fields, or implementation component structure in this PRD.

## 12. Risks

- Risk: Too few Players accept invitations, so groups rarely reach full count.
  Mitigation: fast invitation flow, clear candidate browsing, and short per-invitation deadlines; the request-to-match metric measures this.
- Risk: An invitation goes unanswered and blocks a slot.
  Mitigation: each invitation has its own deadline (`MATCHMAKING_INVITATION_TIMEOUT_MINUTES`) so the owner can invite someone else quickly.
- Risk: A Player joins a group but does not show up, wasting the court and the other Players' time.
  Mitigation: acceptance is an explicit commitment. MVP does not enforce no-show automatically; trust is handled later through reporting/rating.
- Risk: A Player joins a group but the request expires before the group is full.
  Mitigation: accepted invitees are released with a notification; Players can create a new request immediately.
- Risk: The request owner cannot find or book a suitable court after the group is full.
  Mitigation: the Match is created without a court and the owner books through the normal Booking flow, which shows real-time availability; failures surface as normal Booking errors.
- Risk: Concurrent acceptance and request cancellation/expiry produce an inconsistent group.
  Mitigation: accept and request-close must be evaluated atomically; acceptance is only valid while the request is `OPEN` (business rule, enforced outside this PRD).
- Risk: The booking owner cannot complete payment before the booking hold expires.
  Mitigation: the booking follows the normal Booking payment timeout and slot release rules; a released hold is a clean failure and the group can book again.
- Risk: No-show and mismatched skill remain quality problems.
  Mitigation: skill preference is shown during request creation and browsing; post-match ratings handle trust later (separate Rating feature).

## 13. Dependencies

- Player account, authentication, and skill-level data (`docs/features/platform/authentication-authorization/prd.md`).
- Skill-level catalog (`docs/business-rules-config-matrix.md` §1.2).
- Facility, court, pricing, and slot availability data maintained by Court Owner and Admin modules.
- Booking module, for the request owner's court booking and the resulting booking lifecycle (`docs/features/booking/player-booking/prd.md`).
- Payments and refunds capability, for financial handling of the match booking (`docs/features/platform/payments-refunds/prd.md`).
- Notification capability, for in-app matchmaking notifications.
- System configuration values owned by `docs/business-rules-config-matrix.md` §8.3 and system configuration management.

## 14. Decision Log

All original Open Questions were resolved by the human owner on 2026-09-26. On 2026-10-04 the human owner approved adding a direct-invitation path. On 2026-10-10 the human owner reduced the MVP scope to invitation-only: no automatic matching, no automatic court selection, no separate confirmation step, manual court booking by the request owner, and a per-invitation timeout. Rows marked `SUPERSEDED` were replaced by the 2026-10-10 decisions.

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| `Fulfills` referenced `PROJECT-BRIEF.md §3.5`, but the brief has no §3.5. Which section(s) should this PRD fulfill? | Human owner | Correct `Fulfills` to `PROJECT-BRIEF.md §3.1` (Matchmaking). | 2026-09-26 | RESOLVED |
| Exact skill-range compatibility rule. | Human owner | Two requests are compatible when their skill ranges intersect (non-empty intersection). | 2026-09-26 | SUPERSEDED (2026-10-10: automatic matching removed; skill is a browsing preference) |
| Number of concurrent `OPEN` requests a Player may hold. | Human owner | At most one `OPEN` request per match type at a time. | 2026-09-26 | RESOLVED |
| Financial responsibility for the match booking, since Split Bill is out of MVP. | Human owner | The request owner is the booking owner and pays the full booking amount; the other Players do not pay separately. The booking's financial lifecycle stays with the Booking and Payments/Refunds capabilities. | 2026-09-26 | RESOLVED (owner refined 2026-10-10: the request owner creates the booking) |
| Behavior when `MATCHMAKING_CONFIRMATION_REQUIRED` is `false`. | Human owner | The Match becomes `CONFIRMED` directly after the court and booking hold are obtained; the `WAITING_FOR_CONFIRMATION` wait is skipped. | 2026-09-26 | SUPERSEDED (2026-10-10: confirmation step removed) |
| Whether a matched Player may explicitly decline during confirmation. | Human owner | Yes; an explicit decline cancels the Match the same way as a confirmation timeout. | 2026-09-26 | SUPERSEDED (2026-10-10: confirmation step removed) |
| Distance compatibility basis. | Human owner | Distance is evaluated pairwise between matched Players; the Match is valid only when every pair is within both Players' maximum distance. The court search uses the group centroid. | 2026-09-26 | SUPERSEDED (2026-10-10: no distance/centroid; owner books manually) |
| `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` application. | Human owner | `expires_at` is snapshotted at request creation per §8.1; the request expires if it is still `OPEN` at its deadline. | 2026-09-26 | RESOLVED |
| Ownership of post-match rating (skill and attitude). | Human owner | Owned by a separate Rating feature, outside this PRD. | 2026-09-26 | RESOLVED |
| Team assignment for `DOUBLES`. | Human owner | The four Players are assigned into two teams at random; no partner preference in MVP. | 2026-09-26 | RESOLVED |
| How a casual Match reaches `IN_PROGRESS` / `COMPLETED` and whether results are recorded. | Human owner | A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP. | 2026-09-26 | RESOLVED |
| No-show handling for a casual Match. | Human owner | No automatic no-show enforcement in MVP; trust is handled later through reporting/rating. | 2026-09-26 | RESOLVED |
| Penalties, cooldowns, or active-request limits for cancelling, leaving, or failing to confirm. | Human owner | None in MVP; Players can create a new request immediately. | 2026-09-26 | RESOLVED |
| Matchmaking notification events. | Human owner | Events: request/invitation events, group formation, Match cancellation (with reason), and request expiration. No separate confirmation reminders in MVP. | 2026-09-26 | RESOLVED (2026-10-10: confirmation events removed) |
| Product success metrics and targets. | Human owner | Use the directional metrics in §10 with no numeric targets in MVP. | 2026-09-26 | RESOLVED |
| Whether Matchmaking supports direct invitations per `PROJECT-BRIEF.md` §3.1, or automatic matching only. | Human owner | Add a direct-invitation path: a Player with an `OPEN` request can browse suitable Players and send invitations; the recipient accepts or declines; acceptance binds the invited Player to the sender's group, and a Match forms once the full player count is reached. | 2026-10-04 | RESOLVED (2026-10-10: invitation-only) |
| Invitation timeout source and lifecycle. | Human owner | Invitations are scoped to the sender's `OPEN` request; lifecycle `PENDING → ACCEPTED / DECLINED / CANCELLED / EXPIRED`. No invitation-specific configuration value is introduced. | 2026-10-04 | SUPERSEDED (2026-10-10: dedicated invitation timeout added) |
| MVP scope: automatic matching or invitation-only? | Human owner | Invitation-only; the automatic compatibility-matching engine is removed from MVP. | 2026-10-10 | RESOLVED |
| Court selection and booking. | Human owner | Matchmaking does not select a court or use distance/centroid. The request owner chooses a court and creates the booking through the Court Booking flow; the Match is linked to that booking and becomes `CONFIRMED`. | 2026-10-10 | RESOLVED |
| Separate player confirmation step. | Human owner | Removed. Accepting a direct invitation is the Player's commitment; `MATCH_CONFIRMATIONS` and the confirmation-timeout configuration are removed. | 2026-10-10 | RESOLVED |
| Invitation timeout. | Human owner | Each invitation has its own deadline `MATCHMAKING_INVITATION_TIMEOUT_MINUTES` (default 15), capped by the request's snapshotted `expires_at`. | 2026-10-10 | RESOLVED |
| Request expiry with a partial group. | Human owner | The request becomes `EXPIRED`; pending invitations are closed and accepted invitees are released with a notification. No automatic replacement group. | 2026-10-10 | RESOLVED |
| Skill when inviting. | Human owner | Skill is a default candidate filter with a skill-mismatch warning; it is not hard-enforced, so the owner may invite an out-of-range Player. | 2026-10-10 | RESOLVED |
| Overlapping Matches. | Human owner | A Player cannot be committed to two Matches whose playing intervals overlap; an overlapping acceptance or group formation is rejected (`MATCHMAKING_SCHEDULE_CONFLICT`). | 2026-10-10 | RESOLVED |
| Minimum lead time for a request. | Human owner | A request's preferred start must be at least `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) in the future; otherwise it is rejected (`MATCHMAKING_START_TOO_SOON`). | 2026-10-10 | RESOLVED |

### Review approval record — 2026-10-10

Human owner approved choices 1A–21A except 12B, with invitees not required to be
active. PRD readiness explicitly reaffirmed. Detailed resolved behavior is §8.1
and business-rules §3; no implementation is claimed by this approval.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.
