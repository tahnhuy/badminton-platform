# Database Schema

**Status:** FROZEN\
**Purpose:** Global database source of truth for the badminton ecosystem
platform.\
**Stack:** PostgreSQL\
**Scope:** MVP unless explicitly marked as future/TBD.

------------------------------------------------------------------------

## 1. Source-of-Truth Policy

This document is the source of truth for the global database schema.

-   `PROJECT-BRIEF.md` defines core business scope and system roles.
-   `docs/architecture/tech-stack.md` defines global technology
    decisions.
-   `docs/features/<feature>/<feature>-PRD.md` defines feature-specific
    business rules.
-   `docs/features/<feature>/<feature>-Tech-Design.md` defines
    feature-specific API and technical specifications.
-   `docs/architecture/conventions.md` defines coding and implementation
    conventions.
-   Feature documents must not silently redefine global database
    structure.
-   Any schema change after this document is frozen requires an explicit
    schema-change decision and an update to this document.

------------------------------------------------------------------------

# 2. Global Business Decisions Reflected in the Schema

## 2.1 Roles

System roles are:

-   `PLAYER`
-   `COURT_OWNER`
-   `ADMIN`

Tournament Organizer is a contextual permission of a Player, not a
separate system role.

Any Player can create and manage multiple tournaments. Admin can manage
all tournaments.

## 2.2 Booking

-   Booking is real-time; there is no Player → Pending → Owner approval
    workflow.
-   Bookings for the same Court cannot overlap.
-   Boundary-touching intervals are allowed, e.g. `18:00–19:00` and
    `19:00–20:00`.
-   A Booking may span multiple contiguous pricing intervals.
-   Booking pricing is snapshotted so later pricing changes do not
    affect existing bookings.
-   `PENDING_PAYMENT` temporarily holds the selected slot.
-   Payment timeout defaults to 10 minutes and is configurable.
-   Existing pending bookings retain their established `expires_at`;
    configuration changes apply to new bookings.
-   Player and Owner may cancel before the configured deadline.
-   A Player may cancel an unpaid `PENDING_PAYMENT` booking before
    `start_time`; it becomes `CANCELLED` and the slot is released.
-   Player cancellation of a paid booking, when permitted, results in a
    full refund.
-   Owner cancellation of a paid booking triggers the refund flow.
-   Booking cancellation and payment/refund lifecycles are separate.
-   `CONFIRMED → IN_PROGRESS` at `start_time`.
-   `IN_PROGRESS → COMPLETED` at `end_time`.
-   Payment timeout changes Booking to `EXPIRED` and releases the slot.
-   A late payment must never reopen an expired booking. If the provider
    has charged the player, a refund is required.
-   Payment handling must be idempotent.

## 2.3 Matchmaking

-   MVP Matchmaking is invitation-only: a Player with an `OPEN` request browses
    suitable Players and sends direct invitations to specific Players. There is
    no automatic compatible-player matching and no distance computation.
-   One Matchmaking Request can produce at most one successful Match.
-   Singles requires 2 players; Doubles requires 4 players.
-   Each invitation has its own snapshotted deadline
    (`MATCHMAKING_INVITATION_TIMEOUT_MINUTES`), capped by the request's
    snapshotted `expires_at`.
-   A request's preferred start must be at least
    `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) in the future.
-   Owner OPEN requests, accepted partial groups and PENDING_COURT reserve the
    preferred window; linked Matches reserve booked start/end. Overlap is rejected
    under shared Player-row locks (`MATCHMAKING_SCHEDULE_CONFLICT`).
-   Accepted partial-group members may withdraw before formation (WITHDRAWN),
    releasing their preferred-window reservation.
-   Request becomes `MATCHED` once the group (request owner plus accepted
    invitees) reaches the full player count and a Match is produced; it does not
    return to `OPEN`.
-   If the request expires before the group is full, pending invitations close
    and accepted invitees are released; no automatic replacement group is
    created.
-   The Match is created without a Court and awaits the request owner's manual
    booking through the Court Booking flow; the owner links the booking to the
    Match and the Match becomes `CONFIRMED`. Matchmaking does not select a Court
    and does not create a Booking or hold.
-   The request owner is the booking owner and pays the full booking amount;
    Split Bill is out of MVP.
-   There is no separate player confirmation step; accepting an invitation is the
    Player's commitment.
-   A Player may leave before Match start. After booked start, normal leave is not
    allowed. Unbooked Matches expire at booking_deadline_at.
-   If leaving causes insufficient players before start, the old Match is
    cancelled and remaining players must rematch using a new Matchmaking Request.

## 2.4 Tournament

MVP supports:

-   Single Elimination
-   Singles
-   Doubles

Doubles Team:

-   Exactly 2 players.
-   No substitute in MVP.
-   Team membership is locked after registration.

Registration:

-   Singles: one player per registration.
-   Doubles: one team per registration.
-   A player may register for Singles and also belong to one Doubles
    Team in the same tournament.
-   A player cannot belong to two different Doubles Teams in the same
    tournament.
-   Participant limit counts competitive registrations: one Singles
    registration = one player; one Doubles registration = one team.
-   Cancellation is allowed before registration closes; registrations
    are locked after registration closes.
-   A paid registration is `PENDING_PAYMENT` until payment succeeds, then
    `CONFIRMED`; a free registration is `CONFIRMED` immediately.
-   `PENDING_PAYMENT` registrations expire to `EXPIRED` at the snapshotted
    `expires_at`, derived from
    `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`.
-   A Player who withdraws a paid `CONFIRMED` registration before
    registration closes receives a full refund.

Bracket:

-   Smallest power of 2 greater than or equal to participant count.
-   BYE is automatic.
-   Seeding uses skill ranking; randomization is used if insufficient
    information exists.
-   High seeds should avoid each other in early rounds.
-   BYE placement prioritizes high seeds.
-   Bracket and seed are locked after generation.

Minimum participants:

-   Singles: at least 2 players.
-   Doubles: at least 2 teams.

If minimum participation is not reached at registration close,
Tournament becomes `CANCELLED` and no bracket is generated.

Tournament status:

`DRAFT → OPEN_FOR_REGISTRATION → REGISTRATION_CLOSED → READY → IN_PROGRESS → COMPLETED`

`CANCELLED` is available from allowed pre/in-progress states according
to business rules.

Organizer can cancel:

-   `DRAFT`
-   `OPEN_FOR_REGISTRATION`
-   `REGISTRATION_CLOSED`
-   `READY`

Organizer cannot self-cancel `IN_PROGRESS`.

Admin can cancel any Tournament.

Organizer deactivation does not automatically cancel a Tournament. Admin
may intervene.

Editing:

-   `DRAFT`: full edit.
-   `OPEN_FOR_REGISTRATION`: limited edit; match type and format cannot
    change, participant limit cannot be reduced below current
    registrations, and registration period cannot be changed once it has
    started.
-   `REGISTRATION_CLOSED`, `READY`, `IN_PROGRESS`: structural fields
    locked.
-   `COMPLETED`, `CANCELLED`: read-only.

Entry fee:

-   Organizer configures a non-negative `entry_fee`; `0` means free.
-   `entry_fee` is editable in `DRAFT`; it is locked once any registration
    is `CONFIRMED`.

Venue and scheduling:

-   A Tournament may reference a platform `FACILITIES` row through
    `facility_id` and/or carry a free-text `venue_note`.
-   Tournament matches are scheduled by the Organizer. A match's Court may
    be unassigned until the Organizer schedules it; it must be assigned
    before the match starts.

No-show:

-   Grace period is 15 minutes after scheduled match start.
-   Singles no-show may result in `WALKOVER`.
-   If one member of a Doubles Team is absent, the team is not eligible
    and the opponent receives `WALKOVER`.

Tournament Match cancellation does not automatically advance a
participant. Organizer/Admin must resolve it.

Tournament Match resolution:

`NONE | WALKOVER | WINNER_DECLARED | UNRESOLVED`

## 2.5 Team Invitation

Team invitations are required for Doubles Team creation.

Lifecycle:

`PENDING → ACCEPTED | DECLINED | CANCELLED | EXPIRED`

Default invitation timeout: 1440 minutes (24 hours).

`expires_at` is snapshotted when the invitation is created. Later
configuration changes do not alter an existing pending invitation.

## 2.6 Rating

-   A participant may rate another player in the same Match.
-   Self-rating is forbidden.
-   Doubles allows rating teammates and opponents.
-   One rater may rate multiple players in the same Match.
-   The same rater → rated player pair may be rated again in another
    Match.
-   A rater may rate a given player at most once per Match.
-   Both players must belong to the same Match.
-   Rating is only valid for a Match that has reached a completed state.
-   A submitted rating is immutable.
-   The rating scale is a `1–5` integer scale, applied to both the skill
    and attitude dimensions (`docs/business-rules-config-matrix.md` §6).
-   Rating applies to completed matchmaking and Tournament Matches;
    Tournament-related rating is gated by `TOURNAMENT_RATING_ENABLED`
    (`docs/business-rules-config-matrix.md` §8.4).
-   `PLAYER_RATINGS` stores the two dimensions as `skill_rating` and
    `attitude_rating` (§3.23).
-   Received **skill** ratings automatically adjust the rated Player's
    skill level under a simple, bounded, configurable rule
    (`docs/business-rules-config-matrix.md` §6, §8.8). Only the skill
    dimension drives adjustment. Every adjustment is recorded in
    `PLAYER_SKILL_ADJUSTMENTS` (§3.30).

## 2.7 Reports

Each Report targets exactly one object:

-   Player, or
-   Facility, or
-   Tournament

A Report cannot target multiple objects or no object.

A Player cannot report themselves.

------------------------------------------------------------------------

# 3. Schema Reference

## 3.1 USERS

  Column            Type        Constraints / Meaning
  ----------------- ----------- ----------------------------------
  `id`              bigint      PK
  `email`           varchar     UNIQUE, login identifier
  `password_hash`   varchar     Password hash
  `role`            varchar     `PLAYER \| COURT_OWNER \| ADMIN`
   `status`          varchar     `ACTIVE | SUSPENDED | DEACTIVATED`
   `must_change_password` boolean  Temporary password must be changed at next login; default `false`
   `deleted_at`      timestamp   Soft-delete marker; nullable
  `created_at`      timestamp   Creation timestamp
  `updated_at`      timestamp   Last update timestamp

## 3.2 SKILL_LEVELS

  Column          Type        Constraints / Meaning
  --------------- ----------- --------------------------
  `id`            bigint      PK
  `code`          varchar     UNIQUE
  `name`          varchar     Display name
  `rank`          int         UNIQUE; ordering/ranking
  `description`   text        Nullable description
  `created_at`    timestamp   Creation timestamp
  `updated_at`    timestamp   Last update timestamp

## 3.3 PLAYER_PROFILES

  Column             Type        Constraints / Meaning
  ------------------ ----------- ------------------------
  `user_id`          bigint      PK, FK → `USERS.id`
  `full_name`        varchar     Player name
  `skill_level_id`   bigint      FK → `SKILL_LEVELS.id`
  `avatar_url`       varchar     Nullable
  `created_at`       timestamp   Creation timestamp
  `updated_at`       timestamp   Last update timestamp

## 3.4 COURT_OWNER_PROFILES

  Column            Type        Constraints / Meaning
  ----------------- ----------- -----------------------------
  `user_id`         bigint      PK, FK → `USERS.id`
  `business_name`   varchar     Business/owner display name
  `phone`           varchar     Contact phone
  `created_at`      timestamp   Creation timestamp
  `updated_at`      timestamp   Last update timestamp

## 3.5 FACILITIES

  Column           Type        Constraints / Meaning
  ---------------- ----------- ------------------------------
  `id`             bigint      PK
  `owner_id`       bigint      FK → `USERS.id`
  `name`           varchar     Facility name
  `description`    text        Nullable
  `phone`          varchar     Contact phone
  `status`         varchar     `ACTIVE \| SUSPENDED \| PENDING_APPROVAL \| REJECTED`; CHECK `chk_facility_status`
  `address`        varchar     Street/address
  `ward`           varchar     Ward
  `district`       varchar     District
  `city`           varchar     City
  `latitude`       decimal     Geographic latitude
  `longitude`      decimal     Geographic longitude
  `opening_time`   time        Opening time
  `closing_time`   time        Closing time
  `deleted_at`     timestamp   Soft-delete marker; nullable
  `created_at`     timestamp   Creation timestamp
  `updated_at`     timestamp   Last update timestamp

## 3.6 COURTS

  Column          Type        Constraints / Meaning
  --------------- ----------- ------------------------------
  `id`            bigint      PK
  `facility_id`   bigint      FK → `FACILITIES.id`
  `name`          varchar     Court name/number
  `status`        varchar     `ACTIVE \| SUSPENDED \| PENDING_APPROVAL \| REJECTED`; CHECK `chk_court_status`
  `description`   text        Nullable
  `deleted_at`    timestamp   Soft-delete marker; nullable
  `created_at`    timestamp   Creation timestamp
  `updated_at`    timestamp   Last update timestamp

## 3.7 COURT_PRICINGS

  Column         Type        Constraints / Meaning
  -------------- ----------- ------------------------------------
  `id`           bigint      PK
  `court_id`     bigint      FK → `COURTS.id`
  `start_time`   time        Pricing interval start
  `end_time`     time        Pricing interval end
  `price`        decimal     Price for the defined pricing unit
  `valid_from`   date        Pricing validity start
  `valid_to`     date        Pricing validity end; nullable
  `created_at`   timestamp   Creation timestamp
  `updated_at`   timestamp   Last update timestamp

Pricing-unit semantics must be documented in conventions/feature
technical design before implementation. Cross-midnight pricing is not
defined as a supported rule here.

## 3.8 BOOKINGS

  Column           Type        Constraints / Meaning
  ---------------- ----------- -------------------------------------------
  `id`             bigint      PK
  `player_id`      bigint      FK → `USERS.id`
  `court_id`       bigint      FK → `COURTS.id`
  `booking_date`   date        Date of booking
  `start_time`     time        Start time
  `end_time`       time        End time
  `unit_price`     decimal     Snapshot/reference price where applicable
  `total_amount`   decimal     Final snapshotted total
  `status`         varchar     Booking lifecycle
  `booking_code`   varchar     Human-readable unique booking reference; set on creation
  `version`        int         Optimistic concurrency/versioning
  `expires_at`     timestamp   Payment deadline snapshot for `PENDING_PAYMENT`; nullable
  `created_at`     timestamp   Creation timestamp
  `updated_at`     timestamp   Last update timestamp

`expires_at` is snapshotted at creation for `PENDING_PAYMENT` bookings from
`BOOKING_PAYMENT_TIMEOUT_MINUTES`; later configuration changes do not alter an
existing deadline. Successful payment transitions `PENDING_PAYMENT → CONFIRMED`
idempotently.

`booking_code` is generated at creation and is unique; it is the stable,
Player-facing booking reference used for support and check-in.

A `PENDING_PAYMENT` booking with a `NULL` `expires_at` is treated as already
released/expired: the scheduler sweep, the stale-hold sweep, the active-interval
reads, and `confirmBooking` all agree that such a hold is not active and must
not be reopened by a late payment.

Booking overlap must be prevented transactionally/database-side.
PostgreSQL range/exclusion constraints are preferred for enforcing
non-overlap.

## 3.9 BOOKING_PRICING_DETAILS

  Column               Type        Constraints / Meaning
  -------------------- ----------- -------------------------------------
  `id`                 bigint      PK
  `booking_id`         bigint      FK → `BOOKINGS.id`
  `court_pricing_id`   bigint      FK → `COURT_PRICINGS.id`
  `start_time`         time        Snapshotted interval start
  `end_time`           time        Snapshotted interval end
  `price`              decimal     Snapshotted applicable price
  `amount`             decimal     Calculated amount for this interval
  `created_at`         timestamp   Creation timestamp

This table preserves the exact pricing inputs used to calculate a
Booking.

## 3.10 PAYMENTS

  -----------------------------------------------------------------------
  Column                  Type                    Constraints / Meaning
  ----------------------- ----------------------- -----------------------
  `id`                    bigint                  PK

  `booking_id`            bigint                  FK → `BOOKINGS.id`; nullable for tournament payments

  `registration_id`       bigint                  FK → `TOURNAMENT_REGISTRATIONS.id`; nullable for booking payments

  `amount`                decimal                 Payment amount

  `provider`              varchar                 Payment provider; VNPAY
                                                  is selected for MVP

  `payment_method`        varchar                 Payment method

  `transaction_id`        varchar                 UNIQUE when present

  `status`                varchar                 Payment lifecycle

  `paid_at`               timestamp               Successful payment
                                                  timestamp; nullable

  `created_at`            timestamp               Creation timestamp

  `updated_at`            timestamp               Last update timestamp
  -----------------------------------------------------------------------

Each payment must reference its applicable booking or tournament registration
through exactly one of `booking_id` and `registration_id`. The migration adding
`registration_id` must make `booking_id` nullable and enforce this exactly-one
rule with a database CHECK constraint while preserving existing booking payment
rows.

Refund handling is represented through the payment lifecycle rather than a
separate MVP refund-management module. Refund processing uses a
`REFUND_PROCESSING_TIMEOUT_MINUTES` value of 1440 minutes.

## 3.11 MATCHMAKING_REQUESTS

  Column                   Type        Constraints / Meaning
  ------------------------ ----------- -------------------------------------------
  `id`                     bigint      PK
  `player_id`              bigint      FK → `USERS.id`
  `match_type`             varchar     `SINGLES \| DOUBLES`
  `min_skill_level_id`     bigint      FK → `SKILL_LEVELS.id`
  `max_skill_level_id`     bigint      FK → `SKILL_LEVELS.id`
  `preferred_date`         date        Preferred playing date
  `preferred_start_time`   time        Preferred window start
  `preferred_end_time`     time        Preferred window end
  `area`                   varchar     Selected city/district preference; does not constrain court
  `status`                 varchar     `OPEN \| MATCHED \| CANCELLED \| EXPIRED`
  `match_duration_minutes` int         Positive duration snapshot; immutable
  `expires_at`             timestamp   Request expiration snapshot, capped at preferred start
  `created_at`             timestamp   Creation timestamp
  `updated_at`             timestamp   Last update timestamp

## 3.12 MATCHMAKING_MATCHES

  Column                     Type        Constraints / Meaning
  -------------------------- ----------- --------------------------------
  `id`                       bigint      PK
  `matchmaking_request_id`   bigint      FK → `MATCHMAKING_REQUESTS.id`
  `match_id`                 bigint      FK → `MATCHES.id`
  `status`                   varchar     `MATCHED`
  `matched_at`               timestamp   Successful match timestamp
  `created_at`               timestamp   Creation timestamp
  `updated_at`               timestamp   Last update timestamp

A partial unique index must enforce at most one successful record per
request:

`UNIQUE (matchmaking_request_id) WHERE status = 'MATCHED'`

## 3.13 MATCHES

  Column                      Type        Constraints / Meaning
  --------------------------- ----------- ---------------------------------------------
  `id`                        bigint      PK
  `match_type`                varchar     `SINGLES \| DOUBLES`
  `court_id`                  bigint      FK → `COURTS.id`; nullable until a Court is assigned (e.g. a tournament match before scheduling)
  `booking_id`                bigint      FK → `BOOKINGS.id`; UNIQUE; nullable. At most one Booking per Match and at most one Match per Booking.
  `scheduled_at`              timestamp   Scheduled start
  `status`                    varchar     `PENDING_COURT \| CONFIRMED \| IN_PROGRESS \| COMPLETED \| CANCELLED`
  `booking_deadline_at`       timestamp   Casual Match original preferred start; nullable for Tournament
  `started_at`                timestamp   Scheduled start for casual Match; actual start for Tournament; nullable
  `completed_at`              timestamp   Booked end for casual Match; actual completion for Tournament; nullable
  `cancellation_reason`       varchar     Reason code for a cancelled Match; nullable
  `created_at`                timestamp   Creation timestamp
  `updated_at`                timestamp   Last update timestamp

`MATCHES` ↔ `BOOKINGS` is one-to-zero/one in the MVP model. The FK
implementing this relationship is UNIQUE on the owning side (`booking_id`) and
may be null until matchmaking assigns a Court/Booking or an Organizer schedules
a tournament match.

A tournament-match booking is a system-created, **non-payment** booking: it
holds the court under the normal overlap/pricing-snapshot rules but has no
payment, refund, or Player ownership. It is released when the tournament match
is cancelled. Scheduling a tournament match to a different Court/time after the
match starts is match rescheduling and is out of MVP.

A Matchmaking Match is created without a Court (`PENDING_COURT`) and becomes
`CONFIRMED` when the request owner links a booking through the Court Booking
flow. There is no automatic court search and no confirmation deadline.

`cancellation_reason` values for Matchmaking: `INSUFFICIENT_PLAYERS`,
`COURT_NOT_BOOKED`, `BOOKING_CANCELLED`. Tournament reason vocabulary is owned by
its Tech Design.

## 3.14 MATCH_PLAYERS

  Column         Type        Constraints / Meaning
  -------------- ----------- --------------------------------------------
  `id`           bigint      PK
  `match_id`     bigint      FK → `MATCHES.id`
  `player_id`    bigint      FK → `USERS.id`
  `team_no`      int         Team assignment; singles/doubles semantics (SINGLES: 1/2; DOUBLES: two Players each)
  `status`       varchar     `ACTIVE \| LEFT`
  `joined_at`    timestamp   Joined timestamp
  `created_at`   timestamp   Creation timestamp
  `updated_at`   timestamp   Last update timestamp

Required unique constraint:

`UNIQUE (match_id, player_id)`

## 3.15 MATCH_CONFIRMATIONS (Removed 2026-10-10)

Removed from the MVP. Matchmaking is invitation-only and accepting an invitation
is the Player's commitment; there is no separate per-Player confirmation step.
The table, its composite participant FK, and its `UNIQUE (match_id, player_id)`
constraint (formerly documented here) are not part of the MVP.

## 3.16 MATCH_GAMES

  Column          Type        Constraints / Meaning
  --------------- ----------- -----------------------
  `id`            bigint      PK
  `match_id`      bigint      FK → `MATCHES.id`
  `game_no`       int         Game sequence
  `team1_score`   int         Team 1 score
  `team2_score`   int         Team 2 score
  `created_at`    timestamp   Creation timestamp
  `updated_at`    timestamp   Last update timestamp

Game results are the source for determining a completed Match winner.

## 3.17 TOURNAMENTS

  Column                 Type        Constraints / Meaning
  ---------------------- ----------- ---------------------------------------
  `id`                   bigint      PK
  `creator_id`           bigint      FK → `USERS.id`; contextual Organizer
  `name`                 varchar     Tournament name
  `description`          text        Nullable
  `format`               varchar     MVP: `SINGLE_ELIMINATION`
  `match_type`           varchar     `SINGLES \| DOUBLES`
  `facility_id`          bigint      FK → `FACILITIES.id`; nullable tournament venue
  `venue_note`           text        Nullable free-text location detail
  `participant_limit`    int         Competitive registration limit
  `entry_fee`            numeric     NOT NULL DEFAULT 0; CHECK (`entry_fee` >= 0); `0` means free
  `status`               varchar     Tournament lifecycle
  `registration_start`   timestamp   Registration start
  `registration_end`     timestamp   Registration end
  `tournament_start`     timestamp   Tournament start
  `tournament_end`       timestamp   Tournament end
  `version`              int         Optimistic concurrency/versioning
  `deleted_at`           timestamp   Soft-delete marker; nullable
  `created_at`           timestamp   Creation timestamp
  `updated_at`           timestamp   Last update timestamp

## 3.18 TOURNAMENT_TEAMS

  Column            Type        Constraints / Meaning
  ----------------- ----------- -----------------------
  `id`              bigint      PK
  `tournament_id`   bigint      FK → `TOURNAMENTS.id`
  `name`            varchar     Team name
  `captain_id`      bigint      FK → `USERS.id`
  `status`          varchar     Team lifecycle
  `created_at`      timestamp   Creation timestamp
  `updated_at`      timestamp   Last update timestamp

Captain must be a member of the same Team. This cross-table invariant is
enforced transactionally/application-side unless implemented with a
database trigger.

## 3.19 TEAM_INVITATIONS

  -----------------------------------------------------------------------------------------------------------
  Column                  Type                    Constraints / Meaning
  ----------------------- ----------------------- -----------------------------------------------------------
  `id`                    bigint                  PK

  `team_id`               bigint                  FK → `TOURNAMENT_TEAMS.id`

  `inviter_id`            bigint                  FK → `USERS.id`

  `invitee_id`            bigint                  FK → `USERS.id`

  `status`                varchar                 `PENDING \| ACCEPTED \| DECLINED \| CANCELLED \| EXPIRED \| WITHDRAWN`

  `expires_at`            timestamp               Expiration snapshot

  `responded_at`          timestamp               Response timestamp; nullable

  `created_at`            timestamp               Creation timestamp

  `updated_at`            timestamp               Last update timestamp
  -----------------------------------------------------------------------------------------------------------

Invitation validity, team membership checks, and the rule that a Player
cannot belong to two different Doubles Teams in one Tournament must be
enforced transactionally/application-side or with suitable database
constraints/triggers.

## 3.20 TOURNAMENT_TEAM_PLAYERS

  Column         Type        Constraints / Meaning
  -------------- ----------- --------------------------------
  `id`           bigint      PK
  `team_id`      bigint      FK → `TOURNAMENT_TEAMS.id`
  `player_id`    bigint      FK → `USERS.id`
  `role`         varchar     Team role, e.g. captain/member
  `joined_at`    timestamp   Membership timestamp
  `created_at`   timestamp   Creation timestamp
  `updated_at`   timestamp   Last update timestamp

Required uniqueness:

`UNIQUE (team_id, player_id)`

Team membership count must be exactly 2 before a Doubles Team can
register.

## 3.21 TOURNAMENT_REGISTRATIONS

  Column                Type        Constraints / Meaning
  --------------------- ----------- ----------------------------------------------
  `id`                  bigint      PK
  `tournament_id`       bigint      FK → `TOURNAMENTS.id`
  `player_id`           bigint      FK → `USERS.id`; used for Singles
  `team_id`             bigint      FK → `TOURNAMENT_TEAMS.id`; used for Doubles
  `registration_type`   varchar     `SINGLES \| DOUBLES`
  `status`              varchar     `PENDING_PAYMENT \| CONFIRMED \| CANCELLED \| EXPIRED`
  `registered_at`       timestamp   Registration timestamp
  `expires_at`          timestamp   Payment deadline snapshot; nullable (free or already confirmed)
  `updated_at`          timestamp   Last update timestamp

Required logical invariants:

-   Singles: `registration_type=SINGLES`, `player_id IS NOT NULL`,
    `team_id IS NULL`.
-   Doubles: `registration_type=DOUBLES`, `player_id IS NULL`,
    `team_id IS NOT NULL`.
-   Unique Singles registration per Tournament/Player.
-   Unique Doubles registration per Tournament/Team.
-   Team must belong to the same Tournament.
-   A Player may register Singles and belong to one Doubles Team in the
    same Tournament.
-   A Player may not belong to two different Doubles Teams in the same
    Tournament.

Payment timeout invariants:

-   `expires_at` is snapshotted at creation for `PENDING_PAYMENT`
    registrations from
    `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`; later configuration
    changes do not alter an existing deadline.
-   Only `PENDING_PAYMENT` registrations expire; a registration past
    `expires_at` becomes `EXPIRED`.
-   Successful payment transitions `PENDING_PAYMENT → CONFIRMED`
    idempotently.

## 3.22 TOURNAMENT_MATCHES

  --------------------------------------------------------------------------------------------------------
  Column                     Type                    Constraints / Meaning
  -------------------------- ----------------------- -----------------------------------------------------
  `id`                       bigint                  PK

  `tournament_id`            bigint                  FK → `TOURNAMENTS.id`

  `match_id`                 bigint                  FK → `MATCHES.id`

  `registration1_id`         bigint                  FK → `TOURNAMENT_REGISTRATIONS.id`; nullable for
                                                     BYE/unresolved slot

  `registration2_id`         bigint                  FK → `TOURNAMENT_REGISTRATIONS.id`; nullable for
                                                     BYE/unresolved slot

  `winner_registration_id`   bigint                  FK → `TOURNAMENT_REGISTRATIONS.id`; nullable until
                                                     resolved

  `next_match_id`            bigint                  FK → `TOURNAMENT_MATCHES.id`; nullable

  `next_registration_slot`   varchar                 Next bracket slot; nullable

  `round_index`              int                     Bracket round

  `match_index`              int                     Match position within round

  `resolution`               varchar                 `NONE \| WALKOVER \| WINNER_DECLARED \| UNRESOLVED`

  `created_at`               timestamp               Creation timestamp

  `updated_at`               timestamp               Last update timestamp
  --------------------------------------------------------------------------------------------------------

Required uniqueness:

-   `UNIQUE (tournament_id, match_id)`
-   `match_id` should be unique if the global rule is one Match → one
    Tournament Match record.

`next_match_id` is a self-referencing FK to `TOURNAMENT_MATCHES.id`.

A cancelled Tournament Match does not automatically advance a
registration.

## 3.23 PLAYER_RATINGS

  Column              Type        Constraints / Meaning
  ------------------- ----------- ---------------------------------------
  `id`                bigint      PK
  `rater_id`          bigint      FK → `USERS.id`; must belong to Match
  `rated_player_id`   bigint      FK → `USERS.id`; must belong to Match
  `match_id`          bigint      FK → `MATCHES.id`
  `skill_rating`      int         Skill rating; `1–5` integer scale; CHECK `chk_player_rating_skill_range`
  `attitude_rating`   int         Attitude rating; `1–5` integer scale; CHECK `chk_player_rating_attitude_range`
  `comment`           text        Nullable
  `created_at`        timestamp   Creation timestamp
  `updated_at`        timestamp   Last update timestamp

Required uniqueness:

`UNIQUE (rater_id, rated_player_id, match_id)`

Required integrity:

Both `(match_id, rater_id)` and `(match_id, rated_player_id)` must
reference `MATCH_PLAYERS(match_id, player_id)`.

Self-rating must be prohibited.

Rating is only valid for a completed Match. A submitted rating is
immutable. The `1–5` integer scale applies to both the skill and attitude
dimensions, stored as `skill_rating` and `attitude_rating` (migration
`0007`; see the Ratings Tech Design). Additional required integrity
constraints: CHECK `chk_player_rating_no_self` (`rater_id <> rated_player_id`)
and an immutability trigger rejecting `UPDATE`/`DELETE`.

## 3.24 NOTIFICATIONS

  Column         Type        Constraints / Meaning
  -------------- ----------- --------------------------
  `id`           bigint      PK
  `user_id`      bigint      FK → `USERS.id`
  `type`         varchar     Notification type
  `title`        varchar     Notification title
  `content`      text        Notification content
  `is_read`      boolean     Read state
  `read_at`      timestamp   Read timestamp; nullable
  `created_at`   timestamp   Creation timestamp

Additional notification columns for reliable linked domain notifications:
`resource_type` varchar nullable, `resource_id` bigint nullable (application-validated
resource reference), and `dedup_key` varchar nullable. UNIQUE (user_id, dedup_key)
WHERE dedup_key IS NOT NULL. Index (user_id, is_read, created_at, id).

## 3.25 REPORTS

  Column                     Type        Constraints / Meaning
  -------------------------- ----------- ---------------------------------
  `id`                       bigint      PK
  `reporter_id`              bigint      FK → `USERS.id`
  `reported_player_id`       bigint      FK → `USERS.id`; nullable
  `reported_facility_id`     bigint      FK → `FACILITIES.id`; nullable
  `reported_tournament_id`   bigint      FK → `TOURNAMENTS.id`; nullable
  `reason_code`              varchar     Report reason
  `description`              text        Nullable
  `status`                   varchar     Report lifecycle
  `resolved_at`              timestamp   Resolution timestamp; nullable
  `created_at`               timestamp   Creation timestamp
  `updated_at`               timestamp   Last update timestamp

Required CHECK invariant: exactly one report target must be non-null.

Self-reporting a Player is prohibited.

## 3.26 SYSTEM_CONFIGS

  -----------------------------------------------------------------------
  Column                  Type                    Constraints / Meaning
  ----------------------- ----------------------- -----------------------
  `id`                    bigint                  PK

  `config_key`            varchar                 UNIQUE

  `config_value`          varchar/text            Configurable value

  `description`           text                    Config description

  `updated_by`            bigint                  FK → `USERS.id`;
                                                  nullable when changed
                                                  by seed/migration if
                                                  required

  `updated_at`            timestamp               Last update timestamp
  -----------------------------------------------------------------------

## 3.27 AUTH_SESSIONS

  Column                   Type        Constraints / Meaning
  ------------------------ ----------- ------------------------------------------------------------
  `id`                     bigint      PK
  `user_id`                bigint      FK → `USERS.id`
  `token_hash`             varchar     UNIQUE; SHA-256 of the opaque session token (raw token is never stored)
  `idle_timeout_minutes`   int         Idle timeout snapshotted at creation from the role's configuration
  `last_seen_at`           timestamp   Last authenticated activity; drives the idle timeout
  `expires_at`             timestamp   Absolute deadline snapshotted at creation
  `revoked_at`             timestamp   Nullable; set on sign-out or when an Admin sets a new password
  `created_at`             timestamp   Creation timestamp

One row per signed-in device. A user may have multiple active rows.

## 3.28 AUTH_LOGIN_LOCKOUTS

  Column              Type        Constraints / Meaning
  ------------------- ----------- ----------------------------------------------------------
  `user_id`           bigint      PK, FK → `USERS.id`
  `failed_attempts`   int         Consecutive failed sign-in attempts; default `0`
  `locked_until`      timestamp   Nullable; lockout deadline snapshotted when the threshold is reached
  `updated_at`        timestamp   Last update timestamp

Lockout state is kept separate from `USERS.status`; a temporary lockout is
not an account status. An Admin setting a new password clears the lockout
state (§6).

## 3.29 MATCHMAKING_INVITATIONS

  Column           Type        Constraints / Meaning
  ---------------- ----------- ------------------------------------------------------------
  `id`             bigint      PK
  `request_id`     bigint      FK → `MATCHMAKING_REQUESTS.id`; sender's request
  `inviter_id`     bigint      FK → `USERS.id`; must own the request
  `invitee_id`     bigint      FK → `USERS.id`
  `status`         varchar     `PENDING \| ACCEPTED \| DECLINED \| CANCELLED \| EXPIRED \| WITHDRAWN`
  `expires_at`     timestamp   Deadline snapshot: min(invitation timeout, request expires_at)
  `responded_at`   timestamp   Response timestamp; nullable
  `created_at`     timestamp   Creation timestamp
  `updated_at`     timestamp   Last update timestamp

A direct invitation is scoped to the sender's `MATCHMAKING_REQUESTS` row and
expires at the earlier of `created_at + MATCHMAKING_INVITATION_TIMEOUT_MINUTES`
and the request's snapshotted `expires_at`. When the request is matched,
cancelled, or expired, its pending invitations are closed (`CANCELLED` or
`EXPIRED`). Acceptance binds the invited Player to the sender's group, which
forms a Match once the full player count is reached (§2.3). If the request
expires before the group is full, accepted invitees are released.

Required integrity:

-   `inviter_id` must equal the owning `MATCHMAKING_REQUESTS.player_id`.
-   `inviter_id <> invitee_id` (a Player cannot invite themselves).

Recommended partial unique index to prevent duplicate pending invitations
for the same request and invitee:

``` sql
CREATE UNIQUE INDEX uq_matchmaking_invites_pending
ON MATCHMAKING_INVITATIONS (request_id, invitee_id)
WHERE status = 'PENDING';
```

## 3.30 PLAYER_SKILL_ADJUSTMENTS

  Column                   Type        Constraints / Meaning
  ------------------------ ----------- ----------------------------------------------------------
  `id`                     bigint      PK
  `player_id`              bigint      FK → `USERS.id`
  `previous_skill_level_id` bigint     FK → `SKILL_LEVELS.id`
  `new_skill_level_id`     bigint      FK → `SKILL_LEVELS.id`
  `average_skill_rating`   numeric     Average of the recent skill ratings used
  `ratings_considered`     int         Number of ratings in the window; CHECK > 0
  `source`                 varchar     `AUTO_RATING` in MVP
  `created_at`             timestamp   Creation timestamp

Audit history for automatic skill-level changes derived from received skill
ratings (`docs/business-rules-config-matrix.md` §6, §8.8). At most one row per
Player per `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`; enforced application-side.
Rows are append-only.

## 3.31 SYSTEM_CONFIG_AUDIT

  Column         Type        Constraints / Meaning
  -------------- ----------- ----------------------------------------------------------
  `id`           bigint      PK
  `config_key`   varchar     The changed `SYSTEM_CONFIGS.config_key`; no FK so history survives key removal
  `old_value`    text        Previous `config_value`; nullable when the key had no prior row
  `new_value`    text        New `config_value`
  `changed_by`   bigint      FK → `USERS.id`; nullable for migration/seed changes with no actor
  `changed_at`   timestamp   Change timestamp

Append-only history of configuration changes written by the Admin configuration
management surface (`docs/features/platform/system-config/tech-design.md` §7.5,
§10). Rows are never updated or deleted. The table is informational and must not
be used as the source of truth for current configuration values; those remain in
`SYSTEM_CONFIGS` (§3.26) and `docs/business-rules-config-matrix.md` §8.

------------------------------------------------------------------------

## 3.31 MATCH_BOOKING_CANCELLATION_JOBS (approved 2026-10-10)

Durable in-process work for automatic cancellation of a linked booking after a
casual Match is cancelled. No external queue is introduced.

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| match_id | bigint | FK MATCHES; UNIQUE |
| booking_id | bigint | FK BOOKINGS |
| status | varchar | PENDING / COMPLETED / FAILED |
| attempts | int | Default 0 |
| next_attempt_at | timestamp | Retry deadline; nullable after terminal outcome |
| last_error_code | varchar | Nullable safe error/policy reason |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

Index (status, next_attempt_at, id). Persist in the Match cancellation transaction.
Worker uses DB claiming, idempotent Booking cancellation and bounded retry batches.
Policy refusal is FAILED and visible to owner; transient errors remain PENDING.
Match cancellation is terminal regardless of job outcome. Refund belongs to Payment.


# 4. Relationship Overview

``` mermaid
erDiagram
    USERS ||--o| PLAYER_PROFILES : has
    USERS ||--o| COURT_OWNER_PROFILES : has
    SKILL_LEVELS ||--o{ PLAYER_PROFILES : assigns

    USERS ||--o{ FACILITIES : owns
    FACILITIES ||--o{ COURTS : contains
    COURTS ||--o{ COURT_PRICINGS : has

    USERS ||--o{ BOOKINGS : creates
    COURTS ||--o{ BOOKINGS : reserved
    BOOKINGS ||--o{ BOOKING_PRICING_DETAILS : snapshots
    COURT_PRICINGS ||--o{ BOOKING_PRICING_DETAILS : source
    BOOKINGS ||--o{ PAYMENTS : paid_by

    USERS ||--o{ MATCHMAKING_REQUESTS : creates
    SKILL_LEVELS ||--o{ MATCHMAKING_REQUESTS : min_skill
    SKILL_LEVELS ||--o{ MATCHMAKING_REQUESTS : max_skill
    MATCHMAKING_REQUESTS ||--o{ MATCHMAKING_MATCHES : produces
    MATCHMAKING_MATCHES }o--|| MATCHES : creates
    MATCHMAKING_REQUESTS ||--o{ MATCHMAKING_INVITATIONS : invites
    USERS ||--o{ MATCHMAKING_INVITATIONS : sends_receives

    MATCHES ||--o| BOOKINGS : uses
    COURTS ||--o{ MATCHES : hosts
    MATCHES ||--o{ MATCH_PLAYERS : contains
    USERS ||--o{ MATCH_PLAYERS : participates
    MATCHES ||--o{ MATCH_GAMES : contains

    USERS ||--o{ TOURNAMENTS : organizes
    TOURNAMENTS ||--o{ TOURNAMENT_TEAMS : has
    TOURNAMENT_TEAMS ||--o{ TEAM_INVITATIONS : invites
    USERS ||--o{ TEAM_INVITATIONS : sends_receives
    TOURNAMENT_TEAMS ||--o{ TOURNAMENT_TEAM_PLAYERS : contains
    USERS ||--o{ TOURNAMENT_TEAM_PLAYERS : joins
    TOURNAMENTS ||--o{ TOURNAMENT_REGISTRATIONS : accepts
    USERS ||--o{ TOURNAMENT_REGISTRATIONS : enters_singles
    TOURNAMENT_TEAMS ||--o{ TOURNAMENT_REGISTRATIONS : enters_doubles
    TOURNAMENTS ||--o{ TOURNAMENT_MATCHES : schedules
    MATCHES ||--o{ TOURNAMENT_MATCHES : represents
    TOURNAMENT_REGISTRATIONS ||--o{ TOURNAMENT_MATCHES : participant
    TOURNAMENT_REGISTRATIONS ||--o{ PAYMENTS : paid_by

    MATCHES ||--o{ PLAYER_RATINGS : receives
    USERS ||--o{ PLAYER_RATINGS : gives
    USERS ||--o{ PLAYER_RATINGS : receives
    USERS ||--o{ PLAYER_SKILL_ADJUSTMENTS : adjusted
    SKILL_LEVELS ||--o{ PLAYER_SKILL_ADJUSTMENTS : previous_level
    SKILL_LEVELS ||--o{ PLAYER_SKILL_ADJUSTMENTS : new_level
    USERS ||--o{ NOTIFICATIONS : receives

    USERS ||--o{ REPORTS : creates
    FACILITIES ||--o{ REPORTS : reports_facility
    TOURNAMENTS ||--o{ REPORTS : reports_tournament
    USERS ||--o{ REPORTS : reports_player

    USERS ||--o{ SYSTEM_CONFIGS : updates
    USERS ||--o{ SYSTEM_CONFIG_AUDIT : changes

    USERS ||--o{ AUTH_SESSIONS : signs_in
    USERS ||--o| AUTH_LOGIN_LOCKOUTS : tracks_failures
```

------------------------------------------------------------------------

# 5. Required Integrity Constraints

## 5.1 Match Player Integrity

`UNIQUE (match_id, player_id)` on `MATCH_PLAYERS`.

## 5.11 User Management Indexes

User Management uses the following indexes for Admin filtering, stable
pagination, and email search:

- `USERS (role, status, id)`
- `USERS (email)`

## 5.2 Match Confirmation Integrity (Removed 2026-10-10)

Removed with `MATCH_CONFIRMATIONS` (§3.15). Matchmaking has no separate
confirmation step in MVP.

## 5.3 Rating Integrity

`UNIQUE (rater_id, rated_player_id, match_id)` on `PLAYER_RATINGS`.

Both rater and rated player must reference membership in the same Match.

Self-rating is forbidden (`chk_player_rating_no_self`).

`skill_rating` and `attitude_rating` are each constrained to `1–5`.
Submitted ratings are immutable (trigger `trg_player_ratings_immutable`).

Automatic skill adjustments are recorded in `PLAYER_SKILL_ADJUSTMENTS`
(§3.30). At most one adjustment per Player per
`PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`; the adjusted Player's
`PLAYER_PROFILES.skill_level_id` and the appended history row must be written
in one transaction.

## 5.4 Matchmaking Success Integrity

Only one successful matchmaking result may exist for a Request:

``` sql
CREATE UNIQUE INDEX uq_matchmaking_matches_success
ON MATCHMAKING_MATCHES (matchmaking_request_id)
WHERE status = 'MATCHED';
```

## 5.5 Tournament Team Membership

`UNIQUE (team_id, player_id)` on `TOURNAMENT_TEAM_PLAYERS`.

A Doubles Team must have exactly two members before registration.

## 5.6 Tournament Registration

Required database checks:

``` text
SINGLES:
  player_id IS NOT NULL
  team_id IS NULL

DOUBLES:
  player_id IS NULL
  team_id IS NOT NULL
```

Recommended partial unique indexes:

``` sql
CREATE UNIQUE INDEX uq_tournament_singles_player
ON TOURNAMENT_REGISTRATIONS (tournament_id, player_id)
WHERE registration_type = 'SINGLES';

CREATE UNIQUE INDEX uq_tournament_doubles_team
ON TOURNAMENT_REGISTRATIONS (tournament_id, team_id)
WHERE registration_type = 'DOUBLES';
```

## 5.7 Tournament Match

`UNIQUE (tournament_id, match_id)`.

`FOREIGN KEY (next_match_id) REFERENCES TOURNAMENT_MATCHES(id)`.

## 5.8 Booking / Court Overlap

Same Court must not have overlapping active booking intervals.

Boundary-touching intervals are allowed.

The implementation uses PostgreSQL range/exclusion constraints, backed by
row locking for the application check. The `btree_gist` extension is required
so `court_id` (bigint) can participate alongside the range column.

`PENDING_PAYMENT` must also participate in overlap protection while its
hold is active.

Conceptually:

``` sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- booking_range is derived from booking_date + start_time/end_time
ALTER TABLE bookings
  ADD CONSTRAINT ex_bookings_court_no_overlap
  EXCLUDE USING gist (court_id WITH =, booking_range WITH &&)
  WHERE (status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS'));
```

A `PENDING_PAYMENT` interval whose `expires_at` has elapsed no longer
participates in overlap protection; the slot is released. Booking creation marks
such elapsed (or deadline-less) holds as `EXPIRED` inside the same transaction
before inserting, so the exclusion constraint does not keep blocking a released
slot.

`booking_range`, the `ex_bookings_court_no_overlap` constraint, and the
`btree_gist` extension are migration-managed objects defined only in hand-written
SQL migrations. They are intentionally not represented in the Drizzle schema
because Drizzle cannot model exclusion constraints. Use `drizzle-kit generate`
for plain schema diffs and the custom `db:migrate` runner to apply raw SQL; do
not run `drizzle-kit push`, which introspects the database and could drop these
objects.

## 5.9 Match / Booking Relationship

A Match may use zero or one Booking; a Booking is associated with at
most one Match.

The implementing FK must therefore be UNIQUE on the Match side that owns
the Booking reference.

A tournament-match booking is system-created and non-payment (no
`PAYMENTS` row); casual matchmaking and Player bookings follow the normal
booking payment lifecycle.

## 5.10 Report Target

Exactly one report target must be set.

Conceptually:

``` text
count(
  reported_player_id IS NOT NULL,
  reported_facility_id IS NOT NULL,
  reported_tournament_id IS NOT NULL
) = 1
```

Self-reporting is prohibited.

## 5.12 Authentication Integrity

-   `UNIQUE (token_hash)` on `AUTH_SESSIONS`.
-   Index `AUTH_SESSIONS (user_id)` for revoking all sessions of a user.
-   `CHECK (idle_timeout_minutes > 0)` on `AUTH_SESSIONS`.
-   `CHECK (failed_attempts >= 0)` on `AUTH_LOGIN_LOCKOUTS`.

## 5.13 Matchmaking Records

-   `UNIQUE (matchmaking_request_id) WHERE status = 'MATCHED'` on
    `MATCHMAKING_MATCHES` (successful matchmaking integrity, §5.4).
-   `UNIQUE (match_id, player_id)` on `MATCH_PLAYERS` (§5.1).
-   `UNIQUE (matches.booking_id)` for the one-to-zero/one
    `MATCHES` ↔ `BOOKINGS` relationship (§5.9).
-   Unique partial index
    `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'` to
    enforce at most one open request per Player and match type.
-   Unique partial index
    `MATCHMAKING_INVITATIONS (request_id, invitee_id) WHERE status = 'PENDING'`
    to prevent duplicate pending direct invitations (§3.29).
-   Supporting indexes:
    -   `MATCHES (status, scheduled_at)` for scheduler time transitions.
    -   `MATCH_PLAYERS (player_id, match_id)` for "my matches" lookups.

-   MATCHMAKING_REQUESTS (status, expires_at, id) for expiry batches.
-   MATCHMAKING_INVITATIONS (status, expires_at, id) for expiry batches.
-   MATCHMAKING_INVITATIONS (invitee_id, created_at, id) and
    (inviter_id, created_at, id) for inbox/sent pagination.
-   MATCHMAKING_INVITATIONS (request_id, status, invitee_id) for group reads.
-   MATCHMAKING_MATCHES (match_id) for feature scoping.
-   MATCHES (status, booking_deadline_at, id) for pending-court expiry.
-   Cross-request schedule exclusion is application-enforced under ascending
    USERS-row locks; unique request/result indexes alone do not enforce it.

## 5.14 Dashboard Supporting Indexes

The Admin Dashboard (`docs/features/admin/dashboard/tech-design.md` §10)
requires supporting indexes for its read-only aggregate queries. These
are additive and do not change any column, table, or constraint:

-   `USERS (role, status, created_at)` — user KPIs and the dashboard
    activity feed.
-   `FACILITIES (status, created_at)` — facility KPIs and the feed.
-   `COURTS (facility_id, status)` — court counts (the foreign key is
    not automatically indexed).
-   `BOOKINGS (created_at)` — total bookings and the growth chart.
-   `BOOKINGS (status, booking_date)` — slot fill rate.
-   `REPORTS (status, created_at)` — unresolved-report KPI and the
    feed.
-   `TOURNAMENTS (status, created_at)` — in-progress tournaments and
    the feed.
-   `TOURNAMENT_REGISTRATIONS (status, registered_at)` — participant
    count.
-   `PAYMENTS (paid_at)` — estimated transaction value.

Optional partial variants (`WHERE deleted_at IS NULL`) may be used where
the table has a soft-delete marker. These indexes are created by a later
migration; see the Admin Dashboard Change Log entry.

## 5.15 Facility / Court Status

- `CHECK (status IN ('ACTIVE','SUSPENDED','PENDING_APPROVAL','REJECTED'))`
  on `FACILITIES` (`chk_facility_status`) and `COURTS` (`chk_court_status`).
- Only `ACTIVE` facilities/courts are bookable.
- Owner-submitted records start as `PENDING_APPROVAL`; Admin approval moves
  them to `ACTIVE` and rejection to `REJECTED`.
- `deleted_at` (deactivation) is distinct from `status` and is irreversible
  in the MVP flow.

## 5.16 System Configuration Audit

- `SYSTEM_CONFIG_AUDIT` is append-only; rows are never updated or deleted
  (enforced application-side, or with a trigger).
- Supporting index `SYSTEM_CONFIG_AUDIT (config_key, changed_at)` for a
  per-key change history.
- A configuration change and its audit row must be written in one transaction.
- `old_value` is nullable so a first-time set is recordable.

------------------------------------------------------------------------

# 6. Cross-Table Rules Requiring Transactional/Application Enforcement

Not every business invariant can be represented safely with a simple FK.

The following must be validated in the same transaction or by database
triggers where appropriate:

-   `TOURNAMENT_TEAMS.tournament_id` must match the Tournament of
    related registration.
-   Team captain must be a member of the same team.
-   Doubles Team must contain exactly 2 players before registration.
-   A Player cannot belong to two different Doubles Teams in the same
    Tournament.
-   Team invitation inviter must be authorized for the Team.
-   Invitee must be eligible to join the Team.
-   Existing invitation `expires_at` must not be recalculated after
    configuration changes.
-   Tournament registration must occur within the allowed registration
    period.
-   Tournament registration status must respect Tournament lifecycle.
-   Tournament structural edits must respect Tournament status.
-   Matchmaking compatibility rules must be evaluated atomically when
    creating a Match.
-   Match must have exactly 2 players for Singles and exactly 4 players
    for Doubles when confirmed/started.
-   Match confirmation must be completed by all required participants
    before confirmation timeout.
-   Player leaving a Match before start must trigger the defined
    cancellation/rematch flow.
-   Tournament Match registrations must belong to the same Tournament.
-   Tournament Match winner must be one of its participants.
-   Tournament bracket advancement must respect `next_match_id` and
    `next_registration_slot`.
-   Tournament Match results must be derived from valid Match Games.
-   `TOURNAMENTS.entry_fee` must be non-negative and is locked once any
    registration is `CONFIRMED`.
-   A `PENDING_PAYMENT` registration must carry a snapshotted `expires_at`
    and expires without affecting `CONFIRMED` registrations.
-   A Tournament Match must have an assigned Court before it starts.
-   Withdrawing a paid `CONFIRMED` registration before registration closes
    must trigger a full refund and payment/refund idempotency still holds.
-   Rating participants must belong to the same Match.
-   Rating self-targeting must be rejected.
-   Booking price snapshot must be immutable after confirmation.
-   Payment success and Booking confirmation must be idempotent.
-   Late payment after Booking expiry must never reopen the Booking.
-   Owner cancellation of a paid Booking must initiate the required
    refund flow.
-   A Player may cancel an unpaid `PENDING_PAYMENT` Booking before
    `start_time`; it becomes `CANCELLED` and the slot is released without
    a refund.
-   When an Admin sets a new password, updating `USERS.password_hash`,
    setting `USERS.must_change_password`, revoking every `AUTH_SESSIONS`
    row of that user, and clearing that user's `AUTH_LOGIN_LOCKOUTS` state
    (`failed_attempts = 0`, `locked_until = NULL`) must happen in one
    transaction.
-   Incrementing `AUTH_LOGIN_LOCKOUTS.failed_attempts` and setting
    `locked_until` when the threshold is reached must be one atomic
    statement.
-   Registering a Player must insert `USERS`, `PLAYER_PROFILES`, and the
    first `AUTH_SESSIONS` row in one transaction.

------------------------------------------------------------------------

# 7. System Configuration Matrix

Configuration semantics:

> A configuration change applies to new transactions/entities. Existing
> pending entities retain their snapshotted `expires_at` or equivalent
> established deadline.

  Key                                              Default Scope
  -------------------------------------------- ----------- -----------------
  `BOOKING_ENABLED`                                 `true` Booking
  `BOOKING_MIN_DURATION_MINUTES`                      `60` Booking
  `BOOKING_MAX_DURATION_MINUTES`                     `180` Booking
  `BOOKING_ADVANCE_WINDOW_DAYS`                        `7` Booking
  `BOOKING_ACTIVE_LIMIT_MODE`                    `LIMITED` Booking
  `BOOKING_MAX_ACTIVE_PER_PLAYER`                      `5` Booking
  `PLAYER_CAN_CANCEL_BOOKING`                       `true` Booking
  `PLAYER_CANCELLATION_DEADLINE_MINUTES`               `0` Booking
  `OWNER_CAN_CANCEL_BOOKING`                        `true` Booking
  `OWNER_CANCELLATION_DEADLINE_MINUTES`                `0` Booking
  `BOOKING_PAYMENT_TIMEOUT_MINUTES`                   `10` Booking
  `REFUND_ENABLED`                                  `true` Payment/Refund
  `MATCHMAKING_ENABLED`                             `true` Matchmaking
  `MATCHMAKING_REQUEST_EXPIRATION_MINUTES`            `30` Matchmaking
  `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`            `15` Matchmaking
  `MATCHMAKING_MIN_LEAD_TIME_MINUTES`                 `60` Matchmaking
  `MATCHMAKING_MATCH_DURATION_MINUTES`                `90` Matchmaking
  `TOURNAMENT_ENABLED`                              `true` Tournament
  `TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT`              `16` Tournament
  `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`   `10` Tournament
  `TOURNAMENT_RATING_ENABLED`                       `true` Tournament
  `TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES`           `15` Tournament
  `TEAM_INVITATION_TIMEOUT_MINUTES`                 `1440` Tournament Team
  `REPORT_ENABLED`                                  `true` Reports
  `AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD`                `5` Authentication
  `AUTH_FAILED_LOGIN_LOCKOUT_MINUTES`                 `15` Authentication
  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER`       `10080` Authentication
  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER`   `43200` Authentication
  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER`  `10080` Authentication
  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER` `43200` Authentication
  `AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN`           `60` Authentication
  `AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN`      `480` Authentication
  `PLAYER_SKILL_ADJUSTMENT_ENABLED`                 `true` Player Skill Adjustment
  `PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS`                `5` Player Skill Adjustment
  `PLAYER_SKILL_ADJUSTMENT_THRESHOLD`                  `1` Player Skill Adjustment
  `PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS`             `14` Player Skill Adjustment

Authentication values are defined in `docs/business-rules-config-matrix.md`
§8.7.

No configuration in this matrix remains intentionally unfrozen.

------------------------------------------------------------------------

# 8. Lifecycle Summary

## Booking

``` text
PENDING_PAYMENT
    → CONFIRMED
    → IN_PROGRESS
    → COMPLETED

PENDING_PAYMENT
    → EXPIRED
    → CANCELLED   (Player cancels an unpaid hold)

CONFIRMED
    → CANCELLED

IN_PROGRESS
    → COMPLETED
```

Payment lifecycle is separate from Booking lifecycle.

## Matchmaking Request

``` text
OPEN
  → MATCHED
  → CANCELLED
  → EXPIRED
```

No return to `OPEN`. Cancelling or expiring a request closes its pending
invitations and releases accepted invitees.

## Matchmaking Invitation

``` text
PENDING
  → ACCEPTED
  → DECLINED
  → CANCELLED
  → EXPIRED
```

ACCEPTED → WITHDRAWN only before formation; historical decisions are retained.

## Match

``` text
PENDING_COURT
  → CONFIRMED
  → IN_PROGRESS
  → COMPLETED

PENDING_COURT
  → CANCELLED   (Player leaves before start)

CONFIRMED
  → CANCELLED   (Player leaves before start)
```

Exact transition rules belong in the Matchmaking/Tournament Tech Design.

## Team Invitation

``` text
PENDING
  → ACCEPTED
  → DECLINED
  → CANCELLED
  → EXPIRED
```

## Tournament

``` text
DRAFT
  → OPEN_FOR_REGISTRATION
  → REGISTRATION_CLOSED
  → READY
  → IN_PROGRESS
  → COMPLETED
```

`CANCELLED` is a terminal lifecycle state reachable according to the
approved cancellation rules.

------------------------------------------------------------------------

# 9. Explicitly Deferred / TBD Decisions

1.  Authentication implementation details. The persistence part is
    resolved (§3.27, §3.28, §5.12); the remaining details are owned by
    `docs/features/platform/authentication-authorization/tech-design.md`.
2.  API error response contract. Resolved: the global JSON error shape is
    defined in `docs/architecture/tech-stack.md` and
    `docs/architecture/conventions.md`.
3.  API pagination conventions. Resolved: offset-based `page`/`limit` with a
    `meta` object in `docs/architecture/conventions.md`.
4.  Realtime transport/notification mechanism. Resolved: HTTP polling and an
    in-app `NOTIFICATIONS` table in `docs/architecture/tech-stack.md`.
5.  Automated test framework/runner/infrastructure. Resolved on
    2026-09-16 in `docs/architecture/tech-stack.md` (Testing Strategy).
6.  Exact rating scale and validation range. Resolved on 2026-09-27 as a
    `1–5` integer scale for both the skill and attitude dimensions
    (`docs/business-rules-config-matrix.md` §6;
    `docs/architecture/tech-stack.md`). The two-dimension storage
    representation remains a feature delta for the Ratings Tech Design.

These are implementation/design decisions for the relevant architecture
or feature documents.

------------------------------------------------------------------------

# 10. Out of MVP

-   Split Bill.
-   Super Admin role.
-   Match rescheduling.
-   Court rating.
-   Independent refund-management module.
-   System-wide content management.
-   Automatic Tournament Organizer replacement.
-   Automatic bracket modification after a cancelled Tournament Match.
-   Automatic Match replacement after confirmation failure.

Refund processing itself remains part of MVP when required by a paid
Booking cancellation; only a standalone refund-management module is out
of MVP.

------------------------------------------------------------------------

# 11. Freeze Status

**Step 6 --- Review and Freeze Database Schema: COMPLETE**

The schema is considered:

**READY / FROZEN**

Any implementation may proceed against this schema.

Future changes must:

1.  Identify the affected table/constraint/business invariant.
2.  Explain the reason for the change.
3.  Update this document.
4.  Re-review affected feature PRDs and Tech Designs.
5.  Update migrations consistently.

------------------------------------------------------------------------

# 12. Change Log

  ------------------------------------------------------------------------------------------------------------
  Date         Change                                   Reason                                  Approved by
  ------------ ---------------------------------------- --------------------------------------- -------------
  2026-09-16   Added `AUTH_SESSIONS` (§3.27),           Server-side sessions with instant       Tech Lead
               `AUTH_LOGIN_LOCKOUTS` (§3.28), §5.12,     revocation, role-based idle/absolute
               relationships (§4), cross-table rules     timeouts, and a persistent lockout
               (§6), and the 8 `AUTH_*` keys (§7).       counter, required by Auth PRD Decisions
                                                        #9, #10, #12, #13, #14.
  ------------------------------------------------------------------------------------------------------------

Reference: `docs/features/platform/authentication-authorization/tech-design.md`
§10 and §21.1 (Decision #8). No existing table or column was changed.
`USERS.must_change_password` was already documented in §3.1; only its
migration is missing.

Decision Gate, 2026-09-16:

-   The Tech Lead explicitly confirmed `AUTH_SESSIONS.idle_timeout_minutes`
    and the two `CHECK` constraints in §5.12, which were added after the
    initial approval of the two tables.
-   §3.28 and §6 now require clearing a user's `AUTH_LOGIN_LOCKOUTS` state
    when an Admin sets a new password (Auth PRD Decision #26), approved by
    the Business Owner and the Tech Lead. No column or constraint changed.

Task review, 2026-09-16 (approved by Tài, Tech Lead):

-   §9 item 5 (automated test framework) marked resolved, pointing to
    `docs/architecture/tech-stack.md`. No table, column, or constraint
    changed.

Tournament Management review, 2026-09-25 (approved by the human owner;
Tech Lead sign-off requested):

-   Added `TOURNAMENTS.facility_id`, `TOURNAMENTS.venue_note`, and
    `TOURNAMENTS.entry_fee` with `CHECK (entry_fee >= 0)` (§3.17).
-   Added `TOURNAMENT_REGISTRATIONS.expires_at` and documented the
    `PENDING_PAYMENT | CONFIRMED | CANCELLED | EXPIRED` lifecycle (§3.21).
-   Noted that `MATCHES.court_id` may be unassigned until the Organizer
    schedules the match (§3.13).
-   Added `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES` with default
    `10` (§7).
-   Removed `REFUND_PROCESSING_TIMEOUT_MINUTES` from the not-frozen list;
    it is `1440` minutes in `docs/business-rules-config-matrix.md` §8.2.
-   Recorded the previously missing `PAYMENTS.registration_id` delta and
    the booking/registration exactly-one CHECK (§3.10).
-   Added entry-fee, payment-timeout, venue, scheduling, and
    withdrawal-refund invariants to §2.4 and §6.

Reference: `docs/features/tournament/tech-design.md`.

Court Booking — Player Flow review, 2026-09-26 (approved by the human owner):

-   Added `BOOKINGS.expires_at` for the payment deadline snapshot (§3.8).
-   Documented the `PENDING_PAYMENT → CANCELLED` transition for an unpaid hold
    cancelled by the Player (§2.2, §6, §8).
-   Specified the court-interval exclusion constraint (`btree_gist`,
    `ex_bookings_court_no_overlap`) and its active-status predicate (§5.8).

Reference: `docs/features/booking/player-booking/tech-design.md` (§10, §21).

Matchmaking review, 2026-09-26 (approved by the human owner):

-   Documented `MATCHES.booking_id` (UNIQUE FK → `BOOKINGS.id`) and the
    one-to-zero/one `MATCHES` ↔ `BOOKINGS` relationship in §3.13; no migration
    change (the column already exists in the Drizzle schema/migration).
-   Added `MATCHES.court_search_expires_at`, `MATCHES.confirmation_expires_at`,
    and `MATCHES.cancellation_reason` with snapshotted deadline semantics
    (§3.13).
-   Documented the `MATCHES`, `MATCH_PLAYERS`, `MATCH_CONFIRMATIONS`, and
    `MATCHMAKING_MATCHES` status vocabularies (§3.12–§3.15).
-   Added matchmaking indexes, including the partial unique index
    `MATCHMAKING_REQUESTS (player_id, match_type) WHERE status = 'OPEN'`
    (§5.13).
-   No CHECK constraints were added; status vocabularies are documentation-only.

Reference: `docs/features/matchmaking/matchmaking/tech-design.md` (§10, §21).

Booking & Matchmaking migrations applied, 2026-09-26:

-   Booking migration (`0003`) added `BOOKINGS.expires_at`, the generated
    `booking_range` (`Asia/Ho_Chi_Minh`), the `ex_bookings_court_no_overlap`
    exclusion constraint, `btree_gist`, and the booking/pricing indexes; the
    `BOOKING_*`, `OWNER_*`, and `REFUND_*` config keys were seeded.
-   Matchmaking migration (`0004`) added the three `MATCHES` columns, the
    partial unique `OPEN`-request index, and the supporting indexes; the
    `MATCHMAKING_*` config keys were seeded.
-   The schema text in §3/§5 was already reviewed; this entry records the
    migration that applied it.

Reference: `docs/features/booking/player-booking/tasks.md` (BK-01) and
`docs/features/matchmaking/matchmaking/tasks.md` (MM-01).

Player Ratings review, 2026-09-27 (approved by the human owner):

-   Resolved §9 item 6: the `PLAYER_RATINGS.rating` scale is a `1–5`
    integer scale, applied to both skill and attitude (§2.6, §3.23).
-   Documented that rating applies to completed matchmaking and
    Tournament Matches, gated for Tournament Matches by
    `TOURNAMENT_RATING_ENABLED` (§2.6).
-   Documented that submitted ratings are immutable (§2.6, §3.23).
-   Recorded the pending two-dimension (skill/attitude) representation
    delta: `PLAYER_RATINGS` currently has a single `rating` value; the
    representation is owned by the Ratings Tech Design (§2.6, §3.23).

Reference: `docs/features/matchmaking/ratings/prd.md`.

Admin Dashboard review, 2026-09-27 (approved by the human owner):

-   Added §5.14: supporting indexes for the read-only Admin Dashboard
    aggregate queries (`USERS`, `FACILITIES`, `COURTS`, `BOOKINGS`,
    `REPORTS`, `TOURNAMENTS`, `TOURNAMENT_REGISTRATIONS`, `PAYMENTS`).
    Additive indexes only; no column, table, or constraint change.
-   No migration has been applied yet; the indexes are created by a
    later Dashboard migration, which must record its application here.

Reference: `docs/features/admin/dashboard/tech-design.md` (§10, §21).

Team review, 2026-10-04 (approved by the human owner, team review 2026-09-30):

-   Added `MATCHMAKING_INVITATIONS` (§3.29), its relationship lines (§4),
      integrity note and partial unique index (§5.13), for the approved
     Matchmaking direct-invitation path (`PROJECT-BRIEF.md` §3.1). No
     existing table or column changed.
-   Applied the Ratings schema delta: `PLAYER_RATINGS` now stores
     `skill_rating` and `attitude_rating` with `1–5` CHECKs, a no-self CHECK,
     and an immutability trigger; added `PLAYER_SKILL_ADJUSTMENTS` (§3.30),
     the `PLAYER_SKILL_ADJUSTMENT_*` config keys (§7), and the §5.3 integrity
     update. `PLAYER_RATINGS.rating` is replaced; ratings tables are expected
     empty.
-   Added the facility/court status vocabulary `ACTIVE | SUSPENDED |
     PENDING_APPROVAL | REJECTED` with CHECKs (§3.5, §3.6, §5.15) and the
     `status` domain in `docs/business-rules-config-matrix.md` §1.3.
-   Clarified that a tournament-match booking is system-created and
     non-payment (§3.13, §5.9).
-   Migrations for the above have not been applied yet; they must be created
     as new ordered migrations after `0006` (the Ratings delta is `0007` in
     `docs/features/matchmaking/ratings/tech-design.md` §10.4) and their
     application recorded here.

References: `docs/features/matchmaking/matchmaking/tech-design.md` (§9, §10),
`docs/features/matchmaking/ratings/tech-design.md` (§10), 
`docs/features/admin/court-management/prd.md` (§7, §8),
`docs/features/tournament/tech-design.md` (§3.3, §4.1).

System Configuration review, 2026-10-10 (requested by the human owner; Tech Lead
review pending):

-   Added `SYSTEM_CONFIG_AUDIT` (§3.31) as an append-only change history for the
    approved Admin configuration management surface, with its relationship line
    (§4) and integrity/index note (§5.16). No existing table, column, or
    constraint changed.
-   `SYSTEM_CONFIGS` itself is unchanged; current values remain authoritative in
    `SYSTEM_CONFIGS` (§3.26) and `docs/business-rules-config-matrix.md` §8.

Reference: `docs/features/platform/system-config/tech-design.md` (§7.5, §10,
§21).

Matchmaking invitation-only scope reduction, 2026-10-10 (approved by the human
owner):

-   Rewrote §2.3: MVP Matchmaking is invitation-only; no automatic matching, no
    distance/centroid, no automatic court selection or booking.
-   Removed `MATCHMAKING_REQUESTS.latitude`, `.longitude`, `.max_distance_km`;
    added `area` (§3.11).
-   Removed `MATCHES.court_search_expires_at` and `MATCHES.confirmation_expires_at`
    (§3.13). The `MATCHES` status vocabulary is now `PENDING_COURT | CONFIRMED |
    IN_PROGRESS | COMPLETED | CANCELLED`; `cancellation_reason` value is
    `INSUFFICIENT_PLAYERS`.
-   Removed `MATCH_CONFIRMATIONS` (§3.15); there is no separate confirmation
    step. Updated §4 (relationship), §5.13 (indexes/integrity), and §8
    (lifecycle summary — added the Matchmaking Invitation lifecycle).
-   Documented the per-invitation timeout in §3.29
    (`MATCHMAKING_INVITATION_TIMEOUT_MINUTES`, capped by the request's
    `expires_at`).
-   Added `MATCHMAKING_MIN_LEAD_TIME_MINUTES` (default 60) to §7; documented the
    skill default-filter/warning, the overlapping-Match block, and the minimum
    lead time in §2.3. `MatchModule` is the single writer of
    `MATCHES`/`MATCH_PLAYERS` (Q17).
-   Migrations for the above have not been applied yet; they must be created as
    new ordered migrations after `0006` and their application recorded here.

References: `docs/features/matchmaking/matchmaking/prd.md` (§14),
`docs/features/matchmaking/matchmaking/tech-design.md` (§10, §21),
`docs/business-rules-config-matrix.md` (§3, §8.3).

Readiness review, 2026-10-10: Human owner approved recommendations 1–21 except
12B (court outside preferred area allowed) and no invitee activity requirement.
Added duration snapshot, pending-court deadline, WITHDRAWN, cancellation reasons,
notification references/dedup, cancellation work and supporting indexes. Schema
changes are approved documentation; migrations remain implementation work.
