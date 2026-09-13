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
    └── EXPIRED

CONFIRMED
    └── CANCELLED
```

Automatic transitions:

``` text
start_time → CONFIRMED becomes IN_PROGRESS
end_time   → IN_PROGRESS becomes COMPLETED
payment timeout → PENDING_PAYMENT becomes EXPIRED
```

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

The following remain TBD:

-   Payment provider.
-   Provider-specific refund execution.
-   `REFUND_PROCESSING_TIMEOUT_MINUTES`.

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

## 3.3 Matching Compatibility

Requests can be matched when they satisfy:

1.  Same `match_type`.
2.  Compatible skill ranges.
3.  Intersecting preferred time windows.
4.  Distance within the configured maximum.

The common playing time is the intersection of the matched requests.

The common window must be long enough for the configured Match duration.

## 3.4 Matching Priority

MVP does not use a scoring/ranking algorithm.

Compatible requests are prioritized by:

``` text
created_at ASC
```

Older compatible requests are considered first.

## 3.5 Automatic Court Finding

The approved MVP flow is:

``` text
Match players
    ↓
Find suitable Court
    ↓
Create Booking automatically
```

Court selection priority:

1.  Nearest to the group centroid.
2.  Lower price.
3.  Stable tie-breaker.

## 3.6 Court Search

If no suitable Court is found:

``` text
Match → WAITING_FOR_COURT
```

The system continues searching until the configured Court-search
timeout.

If the timeout is reached:

``` text
Match → CANCELLED
```

The original Request remains closed.

Players must create a new Matchmaking Request to try again.

## 3.7 Booking Creation Failure

If player matching succeeds but Booking creation fails:

-   Match remains or returns to `WAITING_FOR_COURT`.
-   The system continues searching until the Court-search timeout.
-   No new replacement Match is created automatically.

## 3.8 Match Confirmation

Confirmation is required by default.

Flow:

``` text
Match + Court
    ↓
Temporary Booking hold
    ↓
WAITING_FOR_CONFIRMATION
    ↓
All players confirm
    ↓
CONFIRMED
```

If not all players confirm before timeout:

``` text
Match → CANCELLED
```

No automatic replacement Match is created in MVP.

## 3.9 Player Leaving a Match

Before Match starts:

-   A Player may leave.
-   If enough players remain, the Match can continue according to the
    Match flow.
-   If leaving causes insufficient players, the old Match is cancelled.
-   Remaining players must create/use a new Matchmaking Request and form
    a new Match.

After Match starts:

-   A Player cannot leave through the normal leave flow.

------------------------------------------------------------------------

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

Players may cancel/withdraw before registration closes.

After registration closes, registrations are locked.

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

1.  Use skill ranking where sufficient information exists.
2.  Randomize when there is insufficient information.
3.  High seeds should avoid each other in early rounds.
4.  BYE placement prioritizes high seeds.

After bracket generation:

-   Bracket is locked.
-   Seed is locked.

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

Database uniqueness:

``` text
(rater_id, rated_player_id, match_id)
```

The exact rating scale is not frozen in this document and must be
defined before implementing range validation.

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
  -------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 8.3 Matchmaking Configuration

  -----------------------------------------------------------------------------------------------
  Key                                                               Default Meaning
  -------------------------------------------- ---------------------------- ---------------------
  `MATCHMAKING_ENABLED`                                              `true` Enable/disable
                                                                            matchmaking

  `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`                             `30` Request expiration

  `MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES`                           `15` Maximum Court-search
                                                                            period

  `MATCHMAKING_CONFIRMATION_REQUIRED`                                `true` Require all matched
                                                                            Players to confirm

  `MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES`                           `10` Confirmation timeout

  `MATCHMAKING_MATCH_DURATION_MINUTES`                                 `90` Default Match
                                                                            duration

  `MATCHMAKING_MAX_DISTANCE_KM`                                         `5` Maximum matching
                                                                            distance
  -----------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## 8.4 Tournament Configuration

  ----------------------------------------------------------------------------------------------
  Key                                                              Default Meaning
  ------------------------------------------- ---------------------------- ---------------------
  `TOURNAMENT_ENABLED`                                              `true` Enable/disable
                                                                           tournaments

  `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT`                              `16` Default competitive
                                                                           registration limit

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

# 9. Configuration Values Intentionally Not Frozen

The following is intentionally TBD:

``` text
REFUND_PROCESSING_TIMEOUT_MINUTES
```

The reason is that refund execution depends on the final payment
provider and refund mechanism.

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
