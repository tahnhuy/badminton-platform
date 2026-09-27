# Product Requirements Document (PRD) - Matchmaking (Ghép trận)

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.1
Scope: Player-driven automated matchmaking — match request creation, compatibility matching, automatic court finding and booking hold, match confirmation, and pre-match leaving
```

This PRD is Ready. All Open Questions were resolved by the human owner on 2026-09-26 (see §14 Decision Log), and the original `Fulfills` reference to a non-existent `PROJECT-BRIEF.md §3.5` was corrected to `§3.1` (Decision 2026-09-26). It defines product behavior and business rules only. It does not define API contracts, database schema, or implementation structure.

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
  - [Player Booking PRD](../../booking/player-booking/prd.md) — the Matchmaking-created booking follows the Booking lifecycle and real-time confirmation rules
  - [Payments & Refunds PRD](../../platform/payments-refunds/prd.md) — financial handling for the match booking
  - [Authentication & Authorization PRD](../../platform/authentication-authorization/prd.md) — Player identity and skill level
  - [Tournament PRD](../../tournament/prd.md) — shares the Match concept; tournament matchmaking is out of this PRD

## 1. Problem

- **Who is affected:** Players who want to play badminton but do not have enough people (a partner for Singles, or three other players for Doubles) at a suitable skill level, location, and time.
- **What is difficult or unavailable today:** There is no automated way to find compatible Players, agree on a common time window, locate a suitable court near the group, and reserve it. Players must coordinate manually over chat and phone, which produces mismatched skill levels, no-shows, and wasted court searches.
- **Why it matters within MVP:** Matchmaking is one of the three core MVP business areas (`PROJECT-BRIEF.md` §3.1, §6). It is the entry point for casual play and is the primary way Players form a match outside Tournaments.

## 2. Goals

- A Player can state a play demand (match type, time window, skill range, location, maximum distance) and have the system find compatible Players automatically.
- The system matches Players using the approved simple rules (compatibility + oldest request first), without a complex scoring/ranking algorithm.
- When enough compatible Players are found, the system automatically selects a suitable court near the group, creates a booking hold, and asks every matched Player to confirm.
- A Match is completed only with the full required number of confirmed Players; otherwise it is cancelled cleanly and Players can try again with a new request.
- Success Metrics: Directional MVP metrics are defined in §10 (no numeric targets in MVP).

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- ELO or dynamic MMR / skill-rating algorithms. MVP uses the approved skill-level catalog and simple range compatibility only (`docs/business-rules-config-matrix.md` §1.2, §3.3).
- Automatic substitution / automatically filling a vacated slot in a match that is already formed or in progress (Out of MVP; `docs/architecture/database-schema.md` §10).
- Group chat inside Matchmaking.
- Tournament matchmaking (tournament participation and bracket matching belong to the Tournament module).
- Complex ranking/prioritization beyond oldest-request-first (`created_at ASC`).
- Match rescheduling after a Match is confirmed (`PROJECT-BRIEF.md` §5).
- Split Bill for the match booking (`PROJECT-BRIEF.md` §5).
- An independent refund-management module (`PROJECT-BRIEF.md` §5).
- Court rating (`PROJECT-BRIEF.md` §5).

## 4. Scope

### In Scope

- Creating a Matchmaking Request for `SINGLES` or `DOUBLES`.
- Cancelling a Matchmaking Request while it is `OPEN`.
- Automatic expiration of an unmatched Request after its configured deadline.
- Compatibility matching across Requests: same match type, compatible skill ranges, intersecting time windows long enough for the configured match duration, and distance within the configured maximum.
- Matching priority by oldest request first (`created_at ASC`); no scoring algorithm.
- Automatic court finding near the matched group, following the approved selection priority.
- Automatic creation of a booking hold for the selected court.
- Court-search timeout handling (`WAITING_FOR_COURT` until timeout, then cancellation).
- Match confirmation by all matched Players (enabled by default), with a confirmation timeout.
- Notifications to affected Players for match, confirmation, cancellation, and expiration events.
- Viewing the details of a matched Match.
- A Player leaving a Match before it starts, including the cancellation/rematch consequence.
- A Player viewing their requests and their status.
- Admin control through the `MATCHMAKING_*` configuration values.

### Out of Scope

- All items in §3 Non-Goals.
- Post-match rating (skill and attitude) — referenced by `PROJECT-BRIEF.md` §3.1 but owned by a separate Rating feature, not this PRD (Decision 2026-09-26, §14).
- Match result / score recording for casual matchmaking Matches. A casual Match moves to `IN_PROGRESS` at its scheduled start and to `COMPLETED` at its scheduled end; no result is recorded in MVP (Decision 2026-09-26, §14).
- Payment mechanics beyond the booking hold — the booking's financial lifecycle is owned by the Booking and Payments/Refunds capabilities; this PRD only assigns payment responsibility (Decision 2026-09-26, §14).
- Any Admin-facing management of individual matchmaking requests or matches.
- Any direct Court Owner participation in matchmaking; courts are selected automatically from available slots.

## 5. Target Users and Roles

- **Player:** creates, cancels, and views Matchmaking Requests; receives match and confirmation notifications; confirms participation; views matched Match details; leaves a Match before it starts.
- **Court Owner:** `N/A` directly. Courts are selected automatically from available slots. Court Owner supervision, slot blocking, and court-side cancellation of the resulting booking are governed by the Booking module.
- **Admin:** `N/A` directly. Admin influences Matchmaking only by managing the `MATCHMAKING_*` configuration values in the configuration matrix. Admin does not participate in playing business (`PROJECT-BRIEF.md` §4).
- **Contextual permission:** `N/A — Matchmaking requires only the Player role; no contextual permission is involved.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

### 6.1 Normal journey — create a request and get matched

1. A signed-in Player opens the Matchmaking area and chooses to create a Matchmaking Request.
2. The Player selects the match type (`SINGLES` or `DOUBLES`), a preferred date and time window, a skill range, their location, and a maximum distance.
3. The system creates the request as `OPEN` with an expiration deadline derived from `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`.
4. The system looks for compatible `OPEN` requests and prioritizes the oldest compatible requests first.
5. Once enough compatible Players exist (2 for `SINGLES`, 4 for `DOUBLES`), the system forms a Match, closes the involved requests as `MATCHED`, and sets the common playing time to the intersection of the matched requests' windows. For `DOUBLES`, the four Players are split into two teams at random, with no partner preference.
6. The system searches for a suitable court near the group centroid, applying the approved priority: nearest to the group centroid, then lower price, then a stable tie-breaker.
7. The system creates a temporary booking hold for the selected court. The earliest matched request's Player is designated as the booking owner and is responsible for the booking payment; the other Players do not pay separately (Split Bill is out of MVP).
8. If confirmation is required (`MATCHMAKING_CONFIRMATION_REQUIRED = true`), the Match moves to `WAITING_FOR_CONFIRMATION` and every matched Player is notified and asked to confirm participation within `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`. If confirmation is not required, the Match becomes `CONFIRMED` directly.
9. When all Players confirm, the Match becomes `CONFIRMED` and the Players can view the confirmed Match details, including the court and playing time.
10. The Players meet and play at the confirmed time. The Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP.

### 6.2 Alternative journey — no court found

1. Steps 1–5 of §6.1 succeed, but the system cannot find a suitable court.
2. The Match moves to `WAITING_FOR_COURT` and the system keeps searching until `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES` is reached.
3. If a court is found before the timeout, the journey continues at §6.1 step 7.
4. If the timeout is reached, the Match becomes `CANCELLED`. The original requests remain closed (`MATCHED`) and do not return to `OPEN`.
5. Affected Players are notified and must create a new Matchmaking Request to try again.

### 6.3 Alternative journey — confirmation not completed in time

1. The Match reaches `WAITING_FOR_CONFIRMATION` after a court and booking hold are obtained.
2. One or more Players either explicitly decline or do not confirm before `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES` elapses.
3. The Match becomes `CANCELLED`. No automatic replacement Match or replacement Player is created (Out of MVP).
4. The original requests remain closed (`MATCHED`); remaining Players must create a new Matchmaking Request to try again.

### 6.4 Alternative journey — Player cancels an open request

1. A Player is waiting with an `OPEN` request.
2. The Player cancels the request.
3. The request becomes `CANCELLED` and is removed from further matching.

### 6.5 Alternative journey — Player leaves before the Match starts

1. A Player is part of a Match that has not started.
2. The Player chooses to leave.
3. A Match requires exactly its full player count (2 for `SINGLES`, 4 for `DOUBLES`); "sufficient" means that full count, not a lower minimum. MVP has no substitutes or automatic backfill, so there are no spare Players.
4. If leaving drops the Match below its full required count, the old Match is `CANCELLED`. Remaining Players must create/use a new Matchmaking Request and form a new Match; no automatic replacement is performed (Out of MVP).
5. After the Match has started, a Player cannot leave through the normal leave flow.

### 6.6 Alternative journey — request expires

1. A Player's request stays `OPEN` without a successful match.
2. Its expiration deadline is reached.
3. The request becomes `EXPIRED` and is removed from further matching. The Player may create a new request.

## 7. Functional Requirements

- The Player can create a Matchmaking Request for `SINGLES` or `DOUBLES`.
- The Player can specify a preferred date and time window, a skill range (minimum and maximum), a location, and a maximum search distance.
- The system creates the request as `OPEN` with an expiration deadline and makes it available for matching.
- A Player can hold at most one `OPEN` request per match type at a time.
- The Player can cancel a Matchmaking Request while it is `OPEN`; the request becomes `CANCELLED`.
- The system expires an `OPEN` request when its deadline is reached; the request becomes `EXPIRED`.
- The system matches requests only when they share the same match type, have overlapping skill ranges, have intersecting time windows that are at least as long as the configured match duration, and have every pair of Players within the configured maximum distance.
- Two requests' skill ranges are compatible when the ranges intersect (the intersection is non-empty).
- The system prioritizes compatible requests by same match type and oldest `created_at` first, without a scoring algorithm.
- The system forms a Match only when the full required number of Players is available (2 for `SINGLES`, 4 for `DOUBLES`), and sets the common playing time to the intersection of the matched requests.
- For `DOUBLES`, the system assigns the four matched Players into two teams at random; no partner preference is supported in MVP.
- The system marks the involved requests as `MATCHED` when a successful Match is produced; a request never returns to `OPEN`.
- The system searches for a suitable court near the matched group and applies the approved court selection priority.
- The system automatically creates a temporary booking hold for the selected court and designates the earliest matched request's Player as the booking owner responsible for payment; the other Players do not pay separately.
- If no suitable court is found, the system keeps the Match in `WAITING_FOR_COURT` and continues searching until `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES` is reached, after which the Match becomes `CANCELLED`.
- If player matching succeeds but booking creation fails, the Match remains or returns to `WAITING_FOR_COURT` and the system continues searching until the court-search timeout; no replacement Match is created automatically.
- When `MATCHMAKING_CONFIRMATION_REQUIRED` is `true`, the system moves the Match to `WAITING_FOR_CONFIRMATION` and waits for all matched Players to confirm within `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`.
- When `MATCHMAKING_CONFIRMATION_REQUIRED` is `false`, the system skips the confirmation wait and moves the Match directly to `CONFIRMED`.
- The system moves the Match to `CONFIRMED` only when all matched Players have confirmed.
- A matched Player can explicitly decline during confirmation; an explicit decline or a confirmation timeout cancels the Match.
- If not all Players confirm before the timeout, the system moves the Match to `CANCELLED`; no automatic replacement is created.
- The Player can view the details of a matched Match.
- The Player can leave a Match before it starts; a Match requires exactly its full player count (2 for `SINGLES`, 4 for `DOUBLES`), so if leaving drops the Match below that count it is `CANCELLED` and the remaining Players must rematch with a new request. MVP has no substitutes or automatic backfill.
- The Player cannot leave a started Match through the normal leave flow.
- A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP.
- The system applies no penalty, cooldown, or active-request limit for cancelling a request, leaving a Match, or failing to confirm in MVP.
- The system sends in-app notifications for match found, confirmation required, confirmation result, Match cancellation (with reason), and request expiration.
- The system applies `MATCHMAKING_ENABLED` as the feature gate.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §3 (Matchmaking Rules) and §8.3 (Matchmaking Configuration); `docs/architecture/database-schema.md` §2.3 (Matchmaking business decisions).
- Match types: `SINGLES` requires 2 Players; `DOUBLES` requires 4 Players.
- Request lifecycle: `OPEN → MATCHED | CANCELLED | EXPIRED`. A request does not return to `OPEN`.
- One request can produce at most one successful Match.
- A Player can hold at most one `OPEN` request per match type at a time.
- Compatibility requires all of: same match type, overlapping skill ranges, intersecting preferred time windows, and distance within the configured maximum.
- Two requests' skill ranges are compatible when the ranges intersect; the effective compatible range is their intersection.
- Distance compatibility is evaluated pairwise between the matched Players, and a Match is valid only when every pair is within both Players' maximum distance. The court search then uses the group centroid.
- The common playing time is the intersection of the matched requests and must be long enough for the configured match duration (`MATCHMAKING_MATCH_DURATION_MINUTES`).
- Matching priority is oldest request first (`created_at ASC`); MVP uses no scoring/ranking algorithm.
- Court selection priority: nearest to the group centroid, then lower price, then a stable tie-breaker.
- For `DOUBLES`, the four matched Players are assigned into two teams at random; MVP supports no partner preference.
- If no suitable court is found, the Match remains `WAITING_FOR_COURT` until `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`, then becomes `CANCELLED`; the original requests remain closed and Players must create a new request.
- If player matching succeeds but booking creation fails, the Match remains or returns to `WAITING_FOR_COURT` and the system continues searching until the same court-search timeout; no automatic replacement Match is created.
- The earliest matched request's Player is the booking owner and is responsible for the booking payment; the other Players do not pay separately (Split Bill is out of MVP). The booking's financial lifecycle follows the Booking and Payments/Refunds rules.
- Confirmation is required by default (`MATCHMAKING_CONFIRMATION_REQUIRED = true`).
- Match flow when confirmation is required: Match + Court → temporary booking hold → `WAITING_FOR_CONFIRMATION` → all Players confirm → `CONFIRMED`.
- When `MATCHMAKING_CONFIRMATION_REQUIRED` is `false`, the Match becomes `CONFIRMED` directly after the court and booking hold are obtained, without a confirmation wait.
- A Player may explicitly decline during confirmation; an explicit decline or a confirmation timeout both cancel the Match.
- If not all Players confirm before `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`, the Match becomes `CANCELLED`; no automatic replacement Match is created in MVP.
- Before the Match starts, a Player may leave. "Enough Players" means the Match still has exactly its full required count (2 for `SINGLES`, 4 for `DOUBLES`); with no substitutes or automatic backfill in MVP, leaving below that count cancels the old Match and remaining Players must form a new Match with a new request.
- After the Match starts, a Player cannot leave through the normal leave flow.
- A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP.
- MVP applies no penalty, cooldown, or active-request limit for cancelling a request, leaving a Match, or failing to confirm; no no-show enforcement is applied automatically.
- The maximum matching distance is governed by the per-request maximum distance and `MATCHMAKING_MAX_DISTANCE_KM` (default 5 km).
- Request expiration is governed by `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` (default 30 minutes).
- Configuration changes apply to new entities only; an already-created request or Match keeps its established/snapshotted deadline (`docs/business-rules-config-matrix.md` §8.1).
- Matchmaking availability is gated by `MATCHMAKING_ENABLED`.

## 9. UI/UX Behavior

- Entry points: the Matchmaking area of the Player experience, with a request-creation entry point, a list of the Player's requests with their current status, and a view of the Player's matched Matches.
- Important states:
  - Loading (submitting a request, searching for a match, searching for a court, loading match details).
  - Empty (no compatible Players found yet; no active request; no matched Matches).
  - Waiting (`OPEN` request waiting for a match; `WAITING_FOR_COURT`; `WAITING_FOR_CONFIRMATION`).
  - Success (request created; Match confirmed; Match details available).
  - Error (request creation fails; a requested change conflicts with the current state, such as cancelling a request that is no longer `OPEN`).
  - Cancelled (request cancelled by the Player; Match cancelled after court-search timeout or confirmation timeout; Match cancelled after a Player leaves).
  - Expired (request expired before a match was found).
- User feedback:
  - Clear status display for each request and Match.
  - Clear indication of the required player count and how many are still needed.
  - A visible deadline or countdown for confirmation while the Match is `WAITING_FOR_CONFIRMATION`.
  - In-app notifications for match found, confirmation required, confirmation success, Match cancellation (with reason: court not found, confirmation timeout, or Player leaving), and request expiration.
  - A clear message that a cancelled/expired request cannot be reopened and that a new request is required.
- Content requirements: show match type, required player count, common playing time and date, skill range, location and maximum distance, selected court/venue, and the confirmation deadline where applicable.
- Accessibility or content requirements: N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP; Decision 2026-09-26, §14):
  - Request-to-match rate.
  - Court-found rate.
  - Confirmation-completion rate.
  - Average time from request creation to confirmed Match.
  - Cancelled-match rate by reason (court not found, confirmation timeout, Player leaving).
- Numeric targets are TBD — product metric target needs decision; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve the three system roles; no new role is introduced (`PROJECT-BRIEF.md` §2).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including Match rescheduling and automatic Match replacement after confirmation failure.
- Must use the approved simple matching rules (`docs/business-rules-config-matrix.md` §3) and must not introduce ELO/MMR or a complex ranking algorithm.
- Must preserve the request and Match lifecycles defined by `docs/business-rules-config-matrix.md` §3 and `docs/architecture/database-schema.md` §8.
- Must preserve configuration defaults and snapshot semantics owned by `docs/business-rules-config-matrix.md` §8.1 and §8.3; these are not redefined here.
- The Match booking is created through the existing Booking module and follows real-time booking rules; the normal `Player → Pending → Owner approval/rejection` flow must not be introduced (`PROJECT-BRIEF.md` §7).
- Notifications are in-app only (`docs/architecture/tech-stack.md`).
- Time-based behavior uses in-process scheduled processing for MVP (`docs/architecture/tech-stack.md`); this is a product constraint on deadline handling, not an implementation choice in this PRD.
- No Split Bill for the match booking (`PROJECT-BRIEF.md` §5).
- Must not define API contracts, database fields, or implementation component structure in this PRD.

## 12. Risks

- Risk: Too few Players create requests, so matches rarely complete.
  Mitigation: simple, fast match creation and clear status feedback; candidate success metric measures request-to-match rate.
- Risk: A Player confirms but does not show up, wasting the court and the other Players' time.
  Mitigation: confirmation requirement with a deadline. MVP does not enforce no-show automatically; trust is handled later through reporting/rating.
- Risk: Confirmation timeout cancels otherwise viable Matches, and there is no automatic replacement in MVP.
  Mitigation: clear deadline display and notifications; Players can immediately create a new request.
- Risk: The automatically created booking hold expires or cannot be paid, leaving the Match without a court.
  Mitigation: the earliest matched request's Player is the designated booking owner; booking creation failure returns the Match to `WAITING_FOR_COURT` until the court-search timeout.
- Risk: Concurrent matching of overlapping requests produces an inconsistent assignment.
  Mitigation: matching of a Match must be evaluated atomically; a request can produce at most one successful Match (business rule, enforced outside this PRD).
- Risk: Players misunderstand distance/skill compatibility and create requests that never match.
  Mitigation: show the effective maximum distance and skill range clearly during request creation.
- Risk: The booking owner cannot both confirm and complete payment before the booking hold expires, cancelling otherwise viable Matches with reason `BOOKING_FAILED`.
  Mitigation: the booking payment timeout should not be shorter than the confirmation timeout so the payment window does not close before the confirmation deadline; the result is a clean cancellation with notification and a new request.
- Risk: A request's preferred date, or the booking owner's active-booking limit, makes court booking deterministically impossible, so the Match only fails after the full court-search timeout.
  Mitigation: the failure reason is logged distinctly and the Match cancels at the court-search deadline; Players can create a new request. Aligning the request date with the booking advance window is a future product consideration, not introduced here.

## 13. Dependencies

- Player account, authentication, and skill-level data (`docs/features/platform/authentication-authorization/prd.md`).
- Skill-level catalog (`docs/business-rules-config-matrix.md` §1.2).
- Facility, court, pricing, and slot availability data maintained by Court Owner and Admin modules.
- Booking module, for automatic booking hold creation and the resulting booking lifecycle (`docs/features/booking/player-booking/prd.md`).
- Payments and refunds capability, for financial handling of the match booking (`docs/features/platform/payments-refunds/prd.md`).
- Notification capability, for in-app matchmaking notifications.
- System configuration values owned by `docs/business-rules-config-matrix.md` §8.3 and system configuration management.
- Geography data for distance calculation between Players/requests and courts.

## 14. Decision Log

All Open Questions were resolved by the human owner on 2026-09-26.

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| `Fulfills` referenced `PROJECT-BRIEF.md §3.5`, but the brief has no §3.5. Which section(s) should this PRD fulfill? | Human owner | Correct `Fulfills` to `PROJECT-BRIEF.md §3.1` (Matchmaking). | 2026-09-26 | RESOLVED |
| Exact skill-range compatibility rule. | Human owner | Two requests are compatible when their skill ranges intersect (non-empty intersection). | 2026-09-26 | RESOLVED |
| Number of concurrent `OPEN` requests a Player may hold. | Human owner | At most one `OPEN` request per match type at a time. | 2026-09-26 | RESOLVED |
| Financial responsibility for the auto-created match booking, since Split Bill is out of MVP. | Human owner | The earliest matched request's Player is the booking owner and pays the full booking amount; the other Players do not pay separately. The booking's financial lifecycle stays with the Booking and Payments/Refunds capabilities. | 2026-09-26 | RESOLVED |
| Behavior when `MATCHMAKING_CONFIRMATION_REQUIRED` is `false`. | Human owner | The Match becomes `CONFIRMED` directly after the court and booking hold are obtained; the `WAITING_FOR_CONFIRMATION` wait is skipped. | 2026-09-26 | RESOLVED |
| Whether a matched Player may explicitly decline during confirmation. | Human owner | Yes; an explicit decline cancels the Match the same way as a confirmation timeout. | 2026-09-26 | RESOLVED |
| Distance compatibility basis. | Human owner | Distance is evaluated pairwise between matched Players; the Match is valid only when every pair is within both Players' maximum distance. The court search uses the group centroid. | 2026-09-26 | RESOLVED |
| `MATCHMAKING_REQUEST_EXPIRATION_MINUTES` application. | Human owner | `expires_at` is snapshotted at request creation per §8.1; the request expires if it is still `OPEN` at its deadline. | 2026-09-26 | RESOLVED |
| Ownership of post-match rating (skill and attitude). | Human owner | Owned by a separate Rating feature, outside this PRD. | 2026-09-26 | RESOLVED |
| Team assignment for `DOUBLES`. | Human owner | The four Players are assigned into two teams at random; no partner preference in MVP. | 2026-09-26 | RESOLVED |
| How a casual Match reaches `IN_PROGRESS` / `COMPLETED` and whether results are recorded. | Human owner | A casual Match becomes `IN_PROGRESS` at its scheduled start and `COMPLETED` at its scheduled end; no result is recorded in MVP. | 2026-09-26 | RESOLVED |
| No-show handling for a casual Match. | Human owner | No automatic no-show enforcement in MVP; trust is handled later through reporting/rating. | 2026-09-26 | RESOLVED |
| Penalties, cooldowns, or active-request limits for cancelling, leaving, or failing to confirm. | Human owner | None in MVP; Players can create a new request immediately. | 2026-09-26 | RESOLVED |
| Matchmaking notification events. | Human owner | Events: match found, confirmation required, confirmation success, Match cancellation (with reason), and request expiration. No separate confirmation reminders in MVP. | 2026-09-26 | RESOLVED |
| Product success metrics and targets. | Human owner | Use the directional metrics in §10 with no numeric targets in MVP. | 2026-09-26 | RESOLVED |

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.
