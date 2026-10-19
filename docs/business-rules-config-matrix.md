# Business Rules & Configuration Matrix

**Status:** FROZEN\
**Purpose:** Central reference for all business rules and system
configuration values that were explicitly agreed for the MVP.\
**Scope:** Matchmaking, Court Booking, Tournament, Team Invitation,
Rating, Reports.

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

  rank   code              Name              Self-assessment description
  ------ ----------------- ----------------- ---------------------------------------------------------
  1      `BEGINNER`        Mới chơi          Mới tập, chưa giữ được cầu qua lại ổn định
  2      `WEAK`            Yếu               Đánh qua lại được, kỹ thuật cơ bản chưa vững
  3      `AVERAGE_MINUS`   Trung bình yếu    Có phông cầu, đập và bỏ nhỏ chưa ổn định
  4      `AVERAGE`         Trung bình        Chơi đôi ổn, có chiến thuật cơ bản
  5      `AVERAGE_PLUS`    Trung bình khá    Kỹ thuật đều, di chuyển tốt, hay đánh giải phong trào
  6      `GOOD`            Khá / Giỏi        Có thành tích giải phong trào, kỹ thuật toàn diện

`rank` is ascending order of skill (1 = lowest) and is unique, matching
`SKILL_LEVELS.rank` (`docs/architecture/database-schema.md` §3.2). `code`
is unique and matches `SKILL_LEVELS.code`. The self-assessment description
is the authoritative wording shown to a Player choosing their initial
skill level at registration; the description matters more than the code
or name for matching quality.

Decision recorded 2026-09-16 (Business Owner), following the change
policy in §11.

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
  `PLAYER_SKILL_ADJUSTMENT_ENABLED`              `true` Enable automatic skill adjustment
                                                         from ratings

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
- Confirmed configuration bounds: `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS` integer 1–100; `PLAYER_SKILL_ADJUSTMENT_THRESHOLD` integer 1–6; `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS` integer 0–365. Boolean gates use true/false. Defaults in §8.8 remain unchanged.
- Another Player's aggregate is accessible only when the target is ACTIVE and not soft-deleted. Below three ratings, expose count and not-enough-data state but no averages/distributions. Self and Admin retain full aggregate access. Individual received records are Admin-only. Profile retains its own three-rating display threshold, including on the owning Player's profile.
- Player given-history and Admin read-only rating/adjustment history are required MVP surfaces. No manual skill-editing capability is introduced by this review.

Reference: Ratings PRD §15 and Tech Design §23. This approval confirms the Ratings-related bounds only; unrelated pending System Config ranges remain pending.
