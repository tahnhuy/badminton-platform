# Database Schema

## Schema hiện tại và delta cần thiết kế — 2026-11-08

Quyết định ngày 2026-11-08 bổ sung ví toàn sàn (một ví/người dùng), hai loại giải, thành tích giải chuyên nghiệp và nâng trình chỉ từ giải chuyên nghiệp. Schema PAYMENTS/PLAYER_RATINGS/PLAYER_SKILL_ADJUSTMENTS và participant hiện tại là hiện trạng legacy, chưa đáp ứng toàn bộ phạm vi mới. Thiết kế bảng ví/sổ giao dịch, phân loại giải, người tham gia không tài khoản và lịch sử nâng trình theo giải còn TBD; không tự coi các bảng cũ đã triển khai các nghiệp vụ này. Không xóa dữ liệu hoặc viết lại migration để loại cơ chế cũ.

Delta đã có trong working tree: MATCHMAKING_REQUEST_CONVERSATIONS gồm request_id bigint PRIMARY KEY, FK → MATCHMAKING_REQUESTS.id; conversation_id bigint NOT NULL UNIQUE, FK → CONVERSATIONS.id. Migration 0017_matchmaking_request_conversations.sql. Một kèo liên kết tối đa một hội thoại; khi rời/bị loại, membership chat liên kết chuyển LEFT trong cùng transaction, không xóa tin nhắn. Delta này bổ sung §13.7; mô tả cũ không có liên kết kèo–hội thoại được thay thế cho nhóm tạo từ kèo. Đây là mô tả code chưa commit, chưa xác nhận migration đã áp dụng.

---

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
  `phone`           varchar(20) Nullable; private optional contact, human choice B 2026-10-23
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
  `ward`           varchar     Nullable; optional ward (human owner approved A, 2026-10-23)
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
  `price`        decimal     Hourly price; booking amounts snapshot applicable rates
  `valid_from`   date        Pricing validity start
  `valid_to`     date        Pricing validity end; nullable
  `created_at`   timestamp   Creation timestamp
  `updated_at`   timestamp   Last update timestamp

Pricing is per hour; generated `pricing_time_range int4range` (seconds since midnight, half-open) and `validity_range daterange` (inclusive validity dates) enforce same-court overlapping time intervals over overlapping validity dates, rejected by service check plus exclusion constraint. Updates identify the existing pricing row by ID; valid_to may end applicability, with valid_from <= valid_to. Booking snapshots remain unchanged. Cross-midnight pricing is unsupported.

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
  `cancellation_reason` text   Nullable; required when Owner cancels for an incident
  `cancelled_at`   timestamp   Nullable; set atomically on cancellation
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
dimensions, stored as `skill_rating` and `attitude_rating` (implemented by
migration `0008_ratings_two_dimensions`; see the Ratings Tech Design). Additional required integrity
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
  `reported_post_id`         bigint      FK → `POSTS.id`; nullable
  `reported_comment_id`      bigint      FK → `POST_COMMENTS.id`; nullable
  `reported_message_id`      bigint      FK → `MESSAGES.id`; nullable
  `reported_attachment_id`   bigint      FK → `MESSAGE_ATTACHMENTS.id`; nullable; requires a message
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


## 3.32 COURT_SLOT_BLOCKS (approved; implementation pending)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| court_id | bigint | FK COURTS.id, not null |
| booking_date | date | Not null, business date |
| start_time / end_time | time | Not null, single-day half-open interval |
| block_range | tsrange | Stored generated range from booking_date + times, `[)` |
| reason | text | Not null, non-empty |
| status | varchar | Not null, ACTIVE or RELEASED |
| created_by | bigint | FK USERS.id, not null; owning Owner |
| created_at / updated_at | timestamp | Not null |

CHECK end_time > start_time; CHECK status vocabulary; partial GiST EXCLUDE `(court_id WITH =, block_range WITH &&) WHERE status='ACTIVE'`; index `(court_id, booking_date)`. Booking and block creation take the same transaction advisory lock per court/date and cross-check effective occupancy. Expired holds are released under Booking rules before checks. All booking creation paths (Player and Tournament) take the facility row lock before the court-date advisory lock, shared with opening-hours updates. One-ID whole-block release; no partial split. Maintenance horizon is configuration, not a per-row column.

## 3.33 COURT_OWNER_REVIEWS (approved; implementation pending)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK; identifies one submission attempt |
| facility_id | bigint nullable | FK FACILITIES.id; exactly one target |
| court_id | bigint nullable | FK COURTS.id; exactly one target |
| kind | varchar | ONBOARDING or ADDRESS_CHANGE |
| submitted_values | jsonb | Not null; validated metadata/location snapshot, no secrets |
| status | varchar | PENDING, APPROVED or REJECTED |
| submitted_by | bigint | FK USERS.id, submitting Owner |
| reviewed_by | bigint nullable | FK USERS.id, reviewing Admin |
| rejection_reason | text nullable | Non-empty and required for REJECTED |
| created_at | timestamp | Submission time, not null |
| reviewed_at | timestamp nullable | Required on a completed review |

CHECK exactly one of facility_id/court_id; ADDRESS_CHANGE requires facility_id. CHECK kind/status vocabulary; pending rows have null reviewer/time/rejection reason; decided rows require reviewer/time; rejected rows require non-empty rejection_reason. Partial unique indexes on each target/kind WHERE status='PENDING', and target/created_at indexes for paginated history. Service enforces Owner/Admin permissions, immutable pending onboarding snapshots and append-only decided attempts. Each resubmission creates a new attempt against the same resource. Admin decides the pending review and updates resource fields/status in one transaction. Approved address remains live while an ADDRESS_CHANGE attempt is pending or rejected; operational status is never changed by that review.


## 3.34 WALLET_ACCOUNTS (G0 D9, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| user_id | bigint | PK; FK USERS.id; exactly one wallet per user |
| balance | numeric(14,2) | Total balance including HELD funds; CHECK >= 0 |
| created_at | timestamp | Creation time, not null |
| updated_at | timestamp | Last balance change, not null |

Available balance = `balance - SUM(WALLET_HOLDS.amount WHERE status='HELD')`.

## 3.35 WALLET_LEDGER_ENTRIES (G0 D9, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK USERS.id |
| entry_type | varchar | TOP_UP, PAYMENT, REFUND, WITHDRAWAL, PAYOUT, ADMIN_ADJUSTMENT, OWNER_EARNING, OWNER_EARNING_REVERSAL |
| amount | numeric(14,2) | Signed amount; CHECK <> 0 |
| balance_after | numeric(14,2) | Balance after entry; CHECK >= 0 |
| reference_type | varchar nullable | BOOKING, TOURNAMENT_REGISTRATION, TOP_UP, WITHDRAWAL, OWNER_PAYOUT, ADMIN_ADJUSTMENT |
| reference_id | bigint nullable | Owning entity id |
| description | varchar(200) nullable | Human-readable note, required for Admin adjustment |
| idempotency_key | varchar(120) nullable | Unique per user when set |
| created_by | bigint nullable | FK USERS.id; Admin actor for adjustments |
| created_at | timestamp | Entry time, not null |

Append-only: no update/delete API. Partial unique index `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`; index `(user_id, created_at, id)`.

## 3.36 WALLET_HOLDS (G0 D9, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK USERS.id |
| amount | numeric(14,2) | CHECK > 0 |
| status | varchar | HELD, CAPTURED, RELEASED |
| reference_type | varchar nullable | BOOKING or TOURNAMENT_REGISTRATION |
| reference_id | bigint nullable | Owning entity id |
| idempotency_key | varchar(120) nullable | Unique per user when set |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last status change |
| released_at | timestamp nullable | Required when RELEASED |
| captured_at | timestamp nullable | Required when CAPTURED |

Hold reserves available balance but does not change `balance`; capture creates a negative ledger entry and decrements `balance`; release only changes hold status. Partial unique index `(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL`; index `(user_id, status)`.

## 3.37 WALLET_TOP_UPS (G0 D9, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK USERS.id |
| amount | numeric(14,2) | CHECK > 0 |
| status | varchar | PENDING, SUCCESS, FAILED, EXPIRED |
| provider | varchar | MOCK or VNPAY |
| txn_ref | varchar(120) | Unique provider reference |
| provider_transaction_id | varchar(120) nullable | VNPAY transaction number |
| idempotency_key | varchar(120) nullable | Unique per user when set |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last status change |
| paid_at | timestamp nullable | Required on SUCCESS |
| expires_at | timestamp nullable | Top-up intent expiry |

VNPAY IPN is verified before any write; a successful IPN updates the row and credits the wallet in one transaction with ledger idempotency key `wallet-topup:<id>`. Return URL never credits.

## 3.38 PAYMENT_REFUNDS (G0 D3, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| payment_id | bigint | PK; FK PAYMENTS.id; one refund per payment |
| status | varchar | PENDING, PROCESSING, REFUNDED, FAILED |
| attempts | integer | Processing attempts, default 0 |
| last_error | text nullable | Last failure reason |
| reason | varchar(200) nullable | Cancellation/refund reason |
| claimed_at | timestamp nullable | Worker claim time |
| completed_at | timestamp nullable | Refund completion time |
| created_at | timestamp | Intent creation |
| updated_at | timestamp | Last change |

Status vocabulary check and `(status)` index. The cancellation transaction inserts the intent; the worker claims with `FOR UPDATE SKIP LOCKED`, credits the wallet with ledger idempotency `payment-refund:<paymentId>`, then marks both payment and refund `REFUNDED`. Retries are bounded by attempts.

## 3.39 WALLET_BANK_ACCOUNTS (WAL-05, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK USERS.id |
| bank_code | varchar(50) | VietQR/SePay bank code |
| account_number | varchar(50) | Receiving account |
| account_name | varchar(120) | Account holder |
| is_default | boolean | Default account flag |
| created_at | timestamp | Creation time |

Unique `(user_id, bank_code, account_number)`.

## 3.40 WALLET_PAYOUT_REQUESTS (WAL-05/06, 2026-11-15)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| user_id | bigint | FK USERS.id |
| request_type | varchar | WITHDRAWAL or OWNER_PAYOUT |
| amount | numeric(14,2) | CHECK > 0 |
| status | varchar | PENDING, APPROVED, REJECTED, PAID, FAILED |
| bank_account_id | bigint | FK WALLET_BANK_ACCOUNTS.id |
| hold_id | bigint nullable | FK WALLET_HOLDS.id |
| admin_id | bigint nullable | FK USERS.id |
| admin_note | varchar(200) nullable | Review/rejection note |
| transfer_reference | varchar(120) nullable | Manual bank transfer reference |
| requested_at | timestamp | Request time |
| reviewed_at | timestamp nullable | Approve/reject time |
| paid_at | timestamp nullable | Paid time |
| created_at / updated_at | timestamp | Audit timestamps |

Request creation reserves a HELD wallet hold. Reject releases it; mark-paid captures it and writes a WITHDRAWAL/PAYOUT ledger entry. No provider payout call.

## 3.41 FINANCE_AUDIT_EVENTS (FIN-01/FIN-02, 2026-11-19)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| actor_id | bigint | FK USERS.id; Admin actor |
| action | varchar(40) | EXPORT, PAYOUT_APPROVE, PAYOUT_REJECT, PAYOUT_MARK_PAID, WALLET_CREDIT, WALLET_DEBIT, REFUND_RETRY, REFUND_RESOLVE, OWNER_EARNING_SWEEP, OWNER_EARNING_REVERSAL, RECONCILIATION_RESOLVE, TOP_UP_MANUAL_MATCH |
| entity_type | varchar(40) | PAYOUT, REFUND, WALLET, EXPORT, BOOKING, TOP_UP, RECONCILIATION |
| entity_id | varchar(80) nullable | Numeric id or stable reconciliation key |
| metadata | jsonb nullable | Filters, amounts, reason, before/after state, row count; no secrets or full bank account numbers |
| created_at | timestamp | Event time, not null |

Append-only. Indexes: `(actor_id, created_at)`, `(entity_type, entity_id)`, `(action, created_at)`.

`OWNER_EARNING` is a positive credit to the facility Owner wallet with `reference_type='BOOKING'` and idempotency `owner-earning:<bookingId>`; `OWNER_EARNING_REVERSAL` is a negative correction with a mandatory Admin reason (idempotency `owner-earning-reversal:<bookingId>`). The sweep uses `BOOKING.total_amount`; platform fee is 0 in MVP.

## 3.42 OWNER_EARNING_SETTLEMENTS (FIN-15, 2026-11-19)

| Column | Type | Meaning |
| --- | --- | --- |
| id | bigint | PK |
| booking_id | bigint | FK BOOKINGS.id; unique, one settlement per booking |
| owner_id | bigint | FK USERS.id; facility Owner recipient |
| amount | decimal(14,2) | `BOOKING.total_amount`; check > 0 |
| status | varchar(20) | `PENDING`, `CREDITED`, `REJECTED` |
| mode | varchar(10) | `AUTO` or `MANUAL` |
| ledger_entry_id | bigint nullable | FK WALLET_LEDGER_ENTRIES.id; unique when present |
| decided_by | bigint nullable | FK USERS.id; Admin actor for manual decisions |
| decided_at | timestamp nullable | Decision time; set for auto credit and manual decisions |
| note | varchar(500) nullable | Approval note or mandatory rejection reason |
| created_at | timestamp | Creation time, not null |
| updated_at | timestamp | Last update, not null |

Indexes: unique `(booking_id)`, unique `(ledger_entry_id)` where not null,
`(status, created_at, id)`, `(owner_id, created_at, id)`.

Settlement is the workflow state only; `WALLET_LEDGER_ENTRIES` remains the money
source of truth. When a booking payment is `SUCCESS`, the payment transaction creates
the settlement: `CREDITED/AUTO` + `OWNER_EARNING` ledger when
`OWNER_EARNING_AUTO_CREDIT_ENABLED` is `true`, or `PENDING/MANUAL` when `false`.
Admin approval later credits the ledger with the same idempotency key
`owner-earning:<bookingId>`. A successful refund rejects a pending settlement or
writes `OWNER_EARNING_REVERSAL` for a credited one when the Owner wallet can cover it.

# 4. Relationship Overview

``` mermaid
erDiagram
    USERS ||--o| PLAYER_PROFILES : has
    USERS ||--o| COURT_OWNER_PROFILES : has
    SKILL_LEVELS ||--o{ PLAYER_PROFILES : assigns

    USERS ||--o{ FACILITIES : owns
    FACILITIES ||--o{ COURTS : contains
    COURTS ||--o{ COURT_PRICINGS : has
    COURTS ||--o{ COURT_SLOT_BLOCKS : blocked
    FACILITIES ||--o{ COURT_OWNER_REVIEWS : reviewed
    COURTS ||--o{ COURT_OWNER_REVIEWS : reviewed
    USERS ||--o{ COURT_OWNER_REVIEWS : submits_reviews
    USERS ||--o| WALLET_ACCOUNTS : owns
    WALLET_ACCOUNTS ||--o{ WALLET_LEDGER_ENTRIES : records
    WALLET_ACCOUNTS ||--o{ WALLET_HOLDS : holds
    WALLET_ACCOUNTS ||--o{ WALLET_TOP_UPS : tops_up
    USERS ||--o{ WALLET_BANK_ACCOUNTS : owns
    USERS ||--o{ WALLET_PAYOUT_REQUESTS : requests
    WALLET_BANK_ACCOUNTS ||--o{ WALLET_PAYOUT_REQUESTS : receives
    USERS ||--o{ OWNER_EARNING_SETTLEMENTS : receives
    BOOKINGS ||--o| OWNER_EARNING_SETTLEMENTS : settles
    WALLET_LEDGER_ENTRIES ||--o| OWNER_EARNING_SETTLEMENTS : credits

    USERS ||--o{ BOOKINGS : creates
    COURTS ||--o{ BOOKINGS : reserved
    BOOKINGS ||--o{ BOOKING_PRICING_DETAILS : snapshots
    COURT_PRICINGS ||--o{ BOOKING_PRICING_DETAILS : source
    BOOKINGS ||--o{ PAYMENTS : paid_by
    PAYMENTS ||--o| PAYMENT_REFUNDS : refunds

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
  `MATCHMAKING_INVITATION_TIMEOUT_MINUTES`         `1440` Matchmaking
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
  `PLAYER_SKILL_ADJUSTMENT_ENABLED`                `false` Player Skill Adjustment (set by migration 0023; legacy, keep false — §13.8)
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

## Migration reconciliation — 2026-11-15 (INF-00)

- Added the missing journal entry for `0017_matchmaking_request_conversations.sql` and generated `meta/0017_snapshot.json` from the current Drizzle schema. `drizzle-kit generate` now reports no schema diff.
- `0015`/`0016` had journal entries but no historical snapshots; the latest snapshot (`0017`) represents the current schema. No table, column or constraint changed.
- Fresh and populated scratch databases applied `0000`–`0017` twice without error. The dev database has a stale `0011` checksum from a post-apply merge and requires reset or separate review; applied migration files remain immutable.
- At INF-00 time `0018` was the next slot; WAL-01 now uses it, so the next number is `0019`. See `docs/plans/migration-slot-log.md` and `npm run verify:migrations --prefix backend`.

## Wallet ledger migration — 2026-11-15 (WAL-01)

- Added `WALLET_ACCOUNTS` (§3.34), `WALLET_LEDGER_ENTRIES` (§3.35) and `WALLET_HOLDS` (§3.36) via `0018_wallet_ledger.sql`; snapshot `0018` generated.
- `balance` includes held funds; available balance is derived from HELD holds. Ledger rows are append-only; no update/delete API.
- Next migration number is `0019`; see `docs/plans/migration-slot-log.md`.

## Wallet top-up migration — 2026-11-15 (WAL-02)

- Added `WALLET_TOP_UPS` (§3.37) via `0019_wallet_top_ups.sql`; snapshot `0019` generated.
- VNPAY IPN credits the wallet once and is idempotent; Return URL does not credit.
- Next migration number is `0020`; see `docs/plans/migration-slot-log.md`.

## Payment refund migration — 2026-11-15 (WAL-04)

- Added `PAYMENT_REFUNDS` (§3.38) via `0020_payment_refunds.sql`; snapshot `0020` generated.
- Player cancellation inserts a PENDING intent; the refund worker credits the wallet and marks payment/refund REFUNDED exactly once.
- Next migration number is `0021`; see `docs/plans/migration-slot-log.md`.

## Wallet payout migration — 2026-11-15 (WAL-05/06)

- Added `WALLET_BANK_ACCOUNTS` (§3.39) and `WALLET_PAYOUT_REQUESTS` (§3.40) via `0021_wallet_payouts.sql`; snapshot `0021` generated.
- Withdrawal/Owner payout reserves a wallet hold; Admin approval + manual transfer; mark-paid captures the hold and writes a ledger entry.
- Next migration number is `0022`; see `docs/plans/migration-slot-log.md`.

## Report targets and evidence migration — 2026-11-16 (RP-05)

- Added `REPORTS.reported_post_id`, `reported_comment_id`, `reported_message_id` and `reported_attachment_id` (FKs) via `0022_classy_tarantula.sql`; `chk_report_target` now counts exactly one of six target columns and `chk_report_attachment_requires_message` keeps attachments message-only.
- Added `REPORT_EVIDENCE` (§13.8) and `REPORT_EVIDENCE_MEDIA` (§13.8). Existing reports remain valid; evidence rows are append-only and reference retained media.
- Seeded `REPORT_ENABLED=true` in `SYSTEM_CONFIGS` (matrix §8.6).
- Next migration number is `0023`; see `docs/plans/migration-slot-log.md`.

## Admin Dashboard indexes migration — 2026-11-19 (AD-01)

- Added the nine §5.14 supporting indexes via `0024_dashboard_indexes.sql`; snapshot `0024` generated.
- `USERS (role, status, created_at)`, `FACILITIES (status, created_at)`, `COURTS (facility_id, status)`,
  `BOOKINGS (created_at)`, `BOOKINGS (status, booking_date)`, `REPORTS (status, created_at)`,
  `TOURNAMENTS (status, created_at)`, `TOURNAMENT_REGISTRATIONS (status, registered_at)`,
  `PAYMENTS (paid_at)`.
- Additive only; no column/table/constraint change. Next migration number is `0025`; see
  `docs/plans/migration-slot-log.md`.

## Admin Finance migration — 2026-11-19 (FIN-01)

- Added `FINANCE_AUDIT_EVENTS` (§3.41) via `0025_plain_sister_grimm.sql`; snapshot `0025` generated.
- Extended `chk_wallet_entry_type` with `OWNER_EARNING` and `OWNER_EARNING_REVERSAL`.
- Added finance supporting indexes: `WALLET_LEDGER_ENTRIES (entry_type, created_at, id)`,
  `WALLET_LEDGER_ENTRIES (reference_type, reference_id)`, `PAYMENTS (status, paid_at, id)`,
  `WALLET_TOP_UPS (status, created_at, id)`, `WALLET_PAYOUT_REQUESTS (status, requested_at, id)`,
  `PAYMENT_REFUNDS (status, updated_at, payment_id)`.
- Additive only; no data backfill. Next migration number is `0026`; see
  `docs/plans/migration-slot-log.md`.

## Owner earning switch migration — 2026-11-19 (FIN-15)

- Added `OWNER_EARNING_SETTLEMENTS` (§3.42) via `0026_owner_earning_settlements.sql`; snapshot `0026` generated.
- Seeded `OWNER_EARNING_AUTO_CREDIT_ENABLED=true` in `SYSTEM_CONFIGS`.
- Backfilled one `CREDITED/AUTO` settlement for each existing `OWNER_EARNING` ledger entry.
- Additive only. Next migration number is `0027`; see `docs/plans/migration-slot-log.md`.

## Payout auto-approval config — 2026-11-19 (FIN-15)

- Seeded `WALLET_AUTO_APPROVE_PAYOUTS=true` in `SYSTEM_CONFIGS` via `0027_wallet_auto_approve_payouts_config.sql`; snapshot `0027` generated.
- No schema change. Next migration number is `0028`; see `docs/plans/migration-slot-log.md`.

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
-   Recorded the approved target Ratings schema delta (not yet migrated): `PLAYER_RATINGS` now stores
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
     as new ordered migrations after `0006` (the Ratings delta is `0008` in
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

Rating implementation review, 2026-10-15 (human owner approved all twelve recommendations):

- §2.6/§3.23 and §3.30 describe the approved target schema. Current Drizzle code still has `PLAYER_RATINGS.rating`; the two dimensions, constraints, triggers and adjustment table are not yet implemented/applied. Do not treat the earlier target-schema description as evidence of migration execution.
- `0007_matchmaking_invitation_only` already exists. Use the next unused migration, currently `0008`, for Ratings; recheck the journal at implementation and never rewrite existing migrations. Record actual application separately after verification.
- Adjustment history remains append-only; enforce UPDATE/DELETE rejection in the new migration. Profile locks serialize adjustment and cooldown checks; no new uniqueness constraint replaces the configurable cooldown.
- The rating insert, profile update and history insert share one transaction. No additional business columns are introduced by this review. Target migration must preserve existing participant FKs and natural-key uniqueness.

Reference: Ratings Tech Design §7.7, §10, §23. Shared-document/schema changes require the existing teammate PR review before merge; this record is human approval of the design, not a record of that merge review.

Ratings migration application, 2026-10-15 (RT-01 implementation; shared-doc PR review pending):

- Applied `0008_ratings_two_dimensions`: renamed `PLAYER_RATINGS.rating` to `skill_rating`, added `attitude_rating` (`NOT NULL` with mirror backfill), added CHECKs `chk_player_rating_skill_range`, `chk_player_rating_attitude_range`, `chk_player_rating_no_self`, added indexes `player_ratings_match_rater_idx` and `player_ratings_rated_player_idx`, and added the `trg_player_ratings_immutable` trigger.
- Added `PLAYER_SKILL_ADJUSTMENTS` (§3.30) with its `player_skill_adjustments_player_created_idx` index and the `trg_player_skill_adjustments_immutable` trigger; seeded the five Rating config keys (`TOURNAMENT_RATING_ENABLED`, `PLAYER_SKILL_ADJUSTMENT_*`).
- Application verified on the local development database; the separate test database receives the same migration through the test harness. Existing ratings tables were empty, so the backfill was a safety net (§10.5). The journal records this as `0008` after `0007_matchmaking_invitation_only`; no earlier migration was modified.

Reference: `docs/features/matchmaking/ratings/tech-design.md` (§10.4, §17), `docs/features/matchmaking/ratings/tasks.md` (RT-01).

Court Owner revision, 2026-10-23 (human owner approved review recommendations 1–14; teammate PR review pending): added approved maintenance/review entities (§3.32–§3.33), cancellation metadata (§3.8), hourly pricing/edit semantics (§3.7), and facility→court-date locking requirement. These are documentation of the target schema; migrations are not applied by this review. Existing facility/court status CHECKs remain unchanged.

Court Owner CO-01 implementation, 2026-10-23: migration 0009_court_owner_foundation implements §3.32/§3.33, cancellation fields, pricing generated ranges/exclusion, moderation CHECKs, maintenance seed and nullable ward (explicit user choice A). Migration verified on isolated test database; development/production migration not applied. Shared-doc/schema teammate PR review remains pending.

2026-10-23 Player phone decision: optional private PLAYER_PROFILES.phone approved by human choice B; self-service collection/edit, owned-booking contact only, no public-card disclosure or phone-based authentication.

Social Matchmaking and Messaging target delta, 2026-10-31 (Phase 2; Ready): added §13. The
target records the Phase 2 decisions, including the final review approved by the human owner. §13 is the approved target and takes precedence for the extension; §1–§11 remain the
implemented baseline until the migrations are applied and recorded here. Nothing in §13
is claimed migrated by this approval. Shared-document/schema
changes require teammate PR review before merge.
Social completion step 1 implementation, 2026-11-01 (branch `feat/social`; not merged; teammate PR review pending):
- `0011_social_media_foundation` (SOC-01): §13.1 `MEDIA_FILES` and §13.2 `POSTS`, `POST_IMAGES`, `POST_REACTIONS`, `POST_COMMENTS` with the listed CHECKs, FKs, unique/partial indexes (`uq_posts_author_client_request`, `posts_feed_idx`, `posts_author_type_created_idx`, `uq_post_images_active_position`, `uq_post_comments_author_client_request`, `post_comments_post_created_idx`, `post_comments_author_created_idx`, `uq_media_files_storage_key`). `POSTS.creation_hash` is nullable (legacy backfill); `POST_COMMENTS.creation_hash` is NOT NULL (no legacy rows). "Immutable" is enforced by function `social_reject_creation_hash_change` and triggers `trg_posts_creation_hash_immutable` / `trg_post_comments_creation_hash_immutable` (implementation choice, needs review). No recruitment (§13.3–§13.6) or Messaging (§13.7) object is created.
- `0012_social_matchmaking_config_seed` (SC-12): preflight that stops when a stored §8.9 value, the MIN_MATCHES copy source or the effective group bounds are invalid; seeds absent §8.9 keys with `ON CONFLICT DO NOTHING`; seeds `PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES` from the stored `MIN_RATINGS` (default 5) only when absent. No existing row is updated.
- `0013_notification_references` (NTF-01): §3.24 `resource_type`, `resource_id`, `dedup_key` (nullable; existing rows unchanged), `uq_notifications_user_dedup_key` (partial, `dedup_key IS NOT NULL`) and `notifications_user_read_created_idx`.
- Verified on isolated scratch databases (fresh and populated, created and dropped by the tests) and applied to the separate test database `badminton_test` by the test harness. Not applied to the development database (which is behind at `0008`) or any production database.
Social completion step 2, 2026-11-01 (branch `feat/social`; not merged; teammate PR review pending):
- `0014_recruitment_membership_foundation` (MM-21): preflight DO block (reports status counts and booking-linked Matches; stops on unsupported match type, a request with several bookings or a booking shared by several requests, invalid/short duration snapshot or confirmed-booking duration, duplicate PENDING/ACCEPTED rows, inviter = invitee, team_no outside (1, 2), several cancellation jobs per request); §13.3 columns, CHECKs and UNIQUE `post_id`/`booking_id`; one unpublished `MATCH_FINDING` post per request (author = host, timestamps preserved, `creation_hash` NULL); `start_at`/`duration_minutes` from a CONFIRMED/IN_PROGRESS/COMPLETED linked booking, otherwise window start + snapshot; capacity/min_players 2/4; matchmaking Match `booking_id` copied to the recruitment; legacy window columns and `expires_at` become nullable; `uq_matchmaking_open_request` dropped; §13.5 rename `invitee_id → player_id`, `inviter_id → created_by` (FK and index names renamed), `kind` (backfilled `INVITE`, no default), `decided_by`, `close_reason`, CHECKs and `uq_matchmaking_membership_active`; §13.6 nullable `team_no` with CHECK, cancellation jobs `request_id` UNIQUE (backfilled from the Match link) and nullable `match_id`. No conversation is created.
- Implementation choices to review: `capacity`/`min_players` are NOT NULL (the per-type CHECK would otherwise pass on NULL); legacy rows keep `decided_by`/`close_reason` NULL; snapshot `0014` is regenerated by `src/db/scripts/write-snapshot.ts` because the renames make `drizzle-kit generate` interactive.
- Read-only preflight: `npx tsx src/db/preflight/mm21-preflight.ts [url]` runs the same block in a READ ONLY transaction.
- Verified on fresh and populated scratch databases and applied to `badminton_test`; not applied to development or production. Migration numbers `0011`–`0014` belong to this branch; the Messaging branch starts at `0015` (changed from the step-1 note) and MSG-01 must follow `0011`.

------------------------------------------------------------------------

# 13. Target Delta — Social Matchmaking and Messaging (Ready, 2026-10-31)

Status: Ready, human-approved 2026-10-31. This section is the single schema home for the target delta; feature Tech Designs
link here and record only rationale:
[Social](../features/social/tech-design.md),
[Messaging](../features/messaging/tech-design.md),
[Matchmaking §24](../features/matchmaking/matchmaking/tech-design.md),
[Ratings §25](../features/matchmaking/ratings/tech-design.md),
Auth, Profile, Report Management and System Config extension sections.
Status vocabularies stay `varchar` as today unless a CHECK is listed. Migration numbers are
assigned at implementation (next unused journal entry; currently `0011`).

## 13.1 Shared private media

`MEDIA_FILES` — private uploaded images/files for posts and messages. Never served by the public
`/uploads` static handler.

  Column            Type          Constraints / Meaning
  ----------------- ------------- --------------------------------------------------------------
  `id`              bigint        PK
  `owner_id`        bigint        FK → `USERS.id` (uploader)
  `kind`            varchar       CHECK IN (`IMAGE`, `FILE`)
  `mime_type`       varchar       Validated server-side type (never the client value)
  `byte_size`       integer       CHECK > 0
  `sha256`          char(64)      Content hash (idempotency comparison, integrity check)
  `storage_key`     varchar       UNIQUE; random relative path under the private root
  `original_name`   varchar(255)  Sanitized display name; FILE only
  `state`           varchar       CHECK IN (`READY`, `MISSING`); see §13.9
  `created_at`      timestamptz

A row is inserted only after its file is fully written to its final path (§13.9). Rows are never
deleted in MVP.

## 13.2 Social

`POSTS`

  Column               Type           Constraints / Meaning
  -------------------- -------------- -----------------------------------------------------------
  `id`                 bigint         PK
  `author_id`          bigint         FK → `USERS.id`
  `type`               varchar        CHECK IN (`FREE`, `MATCH_FINDING`)
  `title`              varchar(120)   Nullable; CHECK `type = 'MATCH_FINDING' OR title IS NULL`
  `body`               text           Nullable; CHECK `char_length(body) <= 2000`
  `published_at`       timestamptz    Nullable; CHECK `type = 'MATCH_FINDING' OR published_at IS NOT NULL`
  `edited_at`          timestamptz    Nullable; set on author edit
  `deleted_at`         timestamptz    Nullable; author soft delete
  `hidden_at`          timestamptz    Nullable; Admin hide
  `hidden_by`          bigint         FK → `USERS.id`; CHECK `(hidden_at IS NULL) = (hidden_by IS NULL)`
  `client_request_id`  uuid           Nullable; idempotency key
  `creation_hash`      char(64)       Immutable canonical initial-payload SHA-256; new writes require it; legacy backfill may be NULL
  `created_at`/`updated_at` timestamptz

Indexes: UNIQUE (`author_id`, `client_request_id`) WHERE `client_request_id IS NOT NULL`; feed
index (`published_at DESC`, `id DESC`) WHERE `published_at IS NOT NULL AND deleted_at IS NULL AND
hidden_at IS NULL`; (`author_id`, `type`, `created_at`) for quota counting.
`published_at`, `deleted_at` and `hidden_at` are independent of the recruitment status (§13.4).

`POST_IMAGES` — `id` PK; `post_id` FK → `POSTS.id`; `media_id` FK → `MEDIA_FILES.id`
(kind `IMAGE`); `position` smallint CHECK 1–4; `detached_at` timestamptz nullable (removed by an
edit; the media row is kept). UNIQUE (`post_id`, `position`) WHERE `detached_at IS NULL`.

`POST_REACTIONS` — PK (`post_id`, `user_id`); `type` varchar CHECK IN (`LIKE`, `LOVE`, `HAHA`,
`WOW`, `SAD`, `ANGRY`) mapping 👍 ❤️ 😂 😮 😢 😡; `created_at`, `updated_at`.

`POST_COMMENTS` — `id` PK; `post_id` FK; `author_id` FK → `USERS.id`; `body` varchar(500) NOT NULL
CHECK `char_length(btrim(body)) BETWEEN 1 AND 500`; `client_request_id` uuid nullable;
`creation_hash` char(64) immutable (target post ID + initial body; required for new writes);
`deleted_at`, `deleted_by` (comment author or post author); `hidden_at`, `hidden_by`;
`created_at`. Indexes: (`post_id`, `created_at`, `id`); (`author_id`, `created_at`); UNIQUE
(`author_id`, `client_request_id`) WHERE not null.

## 13.3 Matchmaking recruitment (`MATCHMAKING_REQUESTS` delta, §3.11)

Added columns:

  Column                       Type          Constraints / Meaning
  ---------------------------- ------------- ---------------------------------------------------
  `post_id`                    bigint        UNIQUE FK → `POSTS.id`; NOT NULL after backfill (§13.8)
  `start_at`                   timestamptz   Post start; NOT NULL after backfill
  `duration_minutes`           integer       NOT NULL after backfill; CHECK 1–1440 (business range enforced by the service)
  `capacity`                   smallint      Slots including the host; CHECK per type below
  `min_players`                smallint      CHECK per type below
  `companion_count`            smallint      DEFAULT 0; CHECK `companion_count >= 0`
  `cost_note`                  varchar(200)  Nullable
  `external_court_name`        varchar(120)  Nullable
  `external_court_city`        varchar       Nullable; shared address catalog value
  `external_court_district`    varchar       Nullable; shared address catalog value
  `external_court_address`     varchar(200)  Nullable
  `booking_id`                 bigint        Nullable; UNIQUE FK → `BOOKINGS.id` (Q1, approved with conditions)
  `cancellation_reason`        varchar       Nullable; see §13.4
  `closed_early_at`            timestamptz   Nullable; casual-group early close

`match_type` adds `GROUP` (displayed "Giao lưu").

CHECKs:

-   `SINGLES`: `capacity = 2 AND min_players = 2 AND companion_count = 0`.
-   `DOUBLES`: `capacity = 4 AND min_players = 4 AND companion_count = 0`.
-   `GROUP`: `capacity BETWEEN 3 AND 20 AND min_players BETWEEN 2 AND capacity AND 1 + companion_count <= capacity`
    (configured bounds `MATCHMAKING_GROUP_MIN_SLOTS`/`MAX_SLOTS` are service-enforced).
-   External court fields are all set or all null.
-   Court consistency: `booking_id IS NULL OR external_court_name IS NULL OR
    court_same_venue_confirmed_at IS NOT NULL`. When a booking replaces a declared external
    court, the external fields are kept as history and the host's same-venue confirmation is
    required (Matchmaking Tech Design §24.15).
-   Added `court_same_venue_confirmed_at` timestamptz nullable and `court_same_venue_confirmed_by`
    bigint FK → `USERS.id` nullable; both set or both null.

Retained for history: `preferred_date`, `preferred_start_time`, `preferred_end_time`,
`match_duration_minutes`, `expires_at` become nullable for new rows (new rows set `expires_at =
start_at`). The partial unique index `uq_matchmaking_open_request` is dropped; the open-post limit
is service-enforced under the host's `USERS` row lock (§6).

## 13.4 Recruitment states (no new values)

`MATCHMAKING_REQUESTS.status` keeps `OPEN | MATCHED | CANCELLED | EXPIRED` and now means the
recruitment state only. Publication is `POSTS.published_at`. Transitions and guards are owned by
Matchmaking Tech Design §24.4; the schema-relevant facts are:

-   `MATCHED → OPEN` is allowed only for `GROUP` (non-host withdrawal after full, before start); the
    `MATCHMAKING_MATCHES` row and Match are kept.
-   `cancellation_reason` values (proposed): `HOST_CANCELLED`, `HOST_LEFT`, `COURT_NOT_BOOKED`,
    `INSUFFICIENT_PLAYERS`, `BOOKING_CANCELLED`, `PLAYER_LEFT`, `AUTHOR_DELETED`.

## 13.5 Membership (`MATCHMAKING_INVITATIONS` delta, §3.29)

-   Rename `invitee_id` → `player_id` (the joining Player) and `inviter_id` → `created_by`.
-   Add `kind` varchar CHECK IN (`INVITE`, `APPLY`); existing rows backfill `INVITE`.
-   Add `decided_by` bigint FK → `USERS.id` nullable (invitee for INVITE, host for APPLY).
-   Add `close_reason` varchar nullable (`SCHEDULE_CONFLICT`, `BLOCKED`, `RECRUITMENT_CLOSED`,
    `POST_CANCELLED`, `POST_STARTED`).
-   CHECK `player_id <> created_by OR kind = 'APPLY'`; CHECK `kind = 'INVITE' OR created_by = player_id`.
-   Replace `uq_matchmaking_invites_pending` with one partial UNIQUE (`request_id`, `player_id`)
    WHERE `status IN ('PENDING', 'ACCEPTED')`. A Player therefore has at most one active row per
    request across both kinds; service code also re-checks inside the transaction.
-   The host is never a row; the host is `MATCHMAKING_REQUESTS.player_id`.
-   Current membership of a request = host + rows with `status = 'ACCEPTED'`. Rows in other states
    are history.

## 13.6 Matches

-   `MATCHES.match_type` adds `GROUP`.
-   `MATCH_PLAYERS.team_no` becomes nullable with CHECK `team_no IS NULL OR team_no IN (1, 2)`.
    `GROUP` ⇔ NULL is a cross-table rule enforced by `MatchModule` (§6).
-   A replacement who previously LEFT the same `GROUP` Match reuses their `MATCH_PLAYERS` row
    (`LEFT → ACTIVE`, `joined_at` updated) because of `uq_match_player`.
-   Matchmaking stops writing `MATCHES.booking_id`/`court_id` for posts; the post's court lives in
    §13.3. `MATCHES.booking_id` is unchanged for other consumers; its consumer review is owned by
    Matchmaking Tech Design §24.3.
-   `MATCH_BOOKING_CANCELLATION_JOBS`: add `request_id` FK (UNIQUE) and make `match_id` nullable,
    because a booking can be linked before any Match exists (blocked with MM-20).

## 13.7 Messaging

`CONVERSATIONS` — `id` PK; `type` CHECK IN (`DIRECT`, `GROUP`); `title` varchar(120) nullable, CHECK `(type = 'GROUP' AND char_length(btrim(title)) BETWEEN 1 AND 120) OR (type = 'DIRECT' AND title IS NULL)`; `created_by` bigint FK → `USERS.id` nullable (Group Owner for `GROUP`, CHECK `type = 'DIRECT' OR created_by IS NOT NULL`); `is_locked` boolean NOT NULL DEFAULT false (when `true` on `GROUP`, only `created_by` may send new messages); `status` varchar NOT NULL DEFAULT 'ACTIVE' CHECK IN ('ACTIVE', 'DISSOLVED'); `dissolved_at` timestamptz nullable;
`direct_user_low_id`, `direct_user_high_id` FK
nullable, UNIQUE pair WHERE `type = 'DIRECT'`, CHECK low < high; CHECK type/column consistency;
`last_seq` bigint NOT NULL DEFAULT 0; `activity_version` bigint NOT NULL DEFAULT 0;
`last_message_at` timestamptz; `created_at`. (Standalone Messaging: no `matchmaking_request_id`, `closed_at` or `read_only_at` coupling.)

`CONVERSATION_MEMBERS` — PK (`conversation_id`, `user_id`); `state` CHECK IN (`ACTIVE`,
`LEFT`); `last_read_seq` bigint NOT NULL DEFAULT 0; `first_sent_at` timestamptz
nullable (direct-conversation quota); `joined_at`, `updated_at`. Index (`user_id`, `state`).

`MESSAGES` — `id` PK; `conversation_id` FK; `seq` bigint NOT NULL; `sender_id` FK; `parent_id` bigint FK → `MESSAGES.id` nullable (quoted reply within the same conversation); `body`
text nullable CHECK `char_length(body) <= 2000`; `client_message_id` uuid NOT NULL;
`content_hash` char(64) NOT NULL; `reaction_version` bigint NOT NULL DEFAULT 0; `edited_at` timestamptz nullable; `deleted_at` timestamptz nullable (soft-delete recall); `deleted_by_user_id` bigint FK → `USERS.id` nullable, CHECK `(deleted_at IS NULL) = (deleted_by_user_id IS NULL)`; `created_at`.
UNIQUE (`conversation_id`, `seq`); UNIQUE (`sender_id`, `conversation_id`, `client_message_id`);
index (`sender_id`, `created_at`) for quota counting.

`MESSAGE_ATTACHMENTS` — `id` PK; `message_id` FK; `media_id` FK → `MEDIA_FILES.id`; `position`
smallint 1–4. Mixed kinds per message are rejected by the service (one FILE, or up to 4 IMAGE).

`MESSAGE_REACTIONS` — PK (`message_id`, `user_id`); `type` same six values as posts; timestamps.

`MESSAGE_HIDES` — PK (`message_id`, `user_id`); `created_at` timestamptz NOT NULL DEFAULT now(). Hides a message only for the caller (`user_id`); hidden messages are excluded from that caller's history, sync, unread counts, and conversation preview.

`USER_BLOCKS` — PK (`blocker_id`, `blocked_id`); CHECK `blocker_id <> blocked_id`; `created_at`.
Unblock deletes the row.

`USER_PRESENCE` — `user_id` PK FK; `last_seen_at` timestamptz NOT NULL.

`CONVERSATION_TYPING` — PK (`conversation_id`, `user_id`); `expires_at` timestamptz NOT NULL.

Presence and typing are separate from `USERS` so heartbeat writes never contend with the
`USERS` row locks used for scheduling and quotas.

## 13.8 Reports, ratings, registration and profile

-   `REPORTS`: add `reported_post_id`, `reported_comment_id`, `reported_message_id` (FKs) and
    `reported_attachment_id` (FK → `MESSAGE_ATTACHMENTS.id`, allowed only with
    `reported_message_id`). `chk_report_target` becomes exactly one of the six target columns.
    The attachment-belongs-to-message rule is enforced in the report transaction.
-   `REPORT_EVIDENCE` — `report_id` PK FK; `content_text` text nullable; `captured_at`.
    `REPORT_EVIDENCE_MEDIA` — PK (`report_id`, `media_id`). Media referenced here are retained per
    `docs/business-rules-config-matrix.md` §3.14 and are never collected.
-   `PLAYER_SKILL_ADJUSTMENTS`: add `match_entries_considered` integer nullable (NULL for legacy
    rows). New `PLAYER_SKILL_ADJUSTMENT_MATCHES` — PK (`adjustment_id`, `match_id`);
    `entry_average` numeric(5,4); `ratings_count` integer; append-only like its parent.
-   **Registration skill survey (updated 2026-11-15, Draft pending human review)** — replaces the
    earlier six-answer `PLAYER_SKILL_SURVEYS` design (`answers` smallint[6], `inactive_over_6m`,
    `capped_reason`). Rules: `docs/business-rules-config-matrix.md` §1.2; rationale:
    `docs/research/bao-cao-cong-thuc-danh-gia-trinh-do.md` §10.
    -   `SKILL_SURVEY_VERSIONS` — `version` smallint PK; `status` varchar NOT NULL CHECK IN
        (`DRAFT`, `ACTIVE`, `RETIRED`); `definition` jsonb NOT NULL (steps, questions, options with
        scores, skill list and scale, weights, experience mix, returning penalty, bands, G1
        `bottleneckRef`, G2 `experienceCap`); `note` text nullable; `created_by` FK → `USERS.id`
        nullable; `created_at`; `published_by` FK → `USERS.id` nullable; `published_at` nullable.
        Unique partial index: at most one row `WHERE status = 'ACTIVE'`. Trigger: `definition`
        cannot change once `status` is `ACTIVE` or `RETIRED`. Version 1 is seeded as `ACTIVE` by
        migration.
    -   `PLAYER_SKILL_SURVEYS` — `user_id` PK FK → `PLAYER_PROFILES.user_id`; `survey_version`
        smallint NOT NULL FK → `SKILL_SURVEY_VERSIONS.version`; `answers` jsonb NOT NULL (keyed by
        question id); `score_k`, `score_r`, `score_x`, `score_p`, `score_a`, `score_t`
        numeric(5,2) NOT NULL CHECK 0–100; `raw_score`, `final_score` numeric(5,2) NOT NULL
        CHECK 0–100 and `final_score <= raw_score`; `nominal_skill_level_id` and
        `resulting_skill_level_id` FK → `SKILL_LEVELS.id` NOT NULL; `applied_guardrails` text[]
        NOT NULL DEFAULT `'{}'` CHECK subset of (`G1_BOTTLENECK`, `G2_EXPERIENCE_CAP`);
        `created_at`. One row per Player; no retake.
    -   `PLAYER_PROFILES`: add `is_skill_tentative` boolean NOT NULL DEFAULT true (set to false
        only by a future official promotion through professional tournaments). The survey score
        is not copied to the profile.
    -   `SKILL_LEVELS`: data change to the seven-level catalog — rename `GOOD` to "Khá", insert
        `EXCELLENT` "Giỏi" with rank 7, update all descriptions (matrix §1.2). Score boundaries
        live in the survey definition, not in this table.
    -   `SYSTEM_CONFIGS`: data change `PLAYER_SKILL_ADJUSTMENT_ENABLED = 'false'`.
-   `PLAYER_PROFILES`: add `activity_city`, `activity_district` (shared address catalog values,
    nullable), `play_style` varchar nullable CHECK IN (`ATTACK`, `DEFENSE`, `ALL_ROUND`,
    `NET_CONTROL`), `bio` varchar(300) nullable.
-   `NOTIFICATIONS`: no structural change beyond §3.24; new `type`/`resource_type` values are
    listed in the Notifications Tech Design extension.

## 13.9 Private media file lifecycle (integrity rule)

1.  Validate in memory, then write to `<private-root>/tmp/<uuid>`, fsync, and rename to
    `<private-root>/media/<storage_key>` (same filesystem, atomic rename).
2.  Insert the `MEDIA_FILES` row (`READY`) and its owning content in one transaction.
3.  On rollback, delete the final file best-effort; a crash leaves an orphan file without a row.
4.  The cleanup job deletes only: tmp files older than 1 hour, and final files that have no
    `MEDIA_FILES` row and are older than 1 hour. A file that has a row is never deleted.
5.  On serving, a row whose file is missing is marked `MISSING`, logged, and returns 404.

## 13.10 Final approval — 2026-10-31

The human owner approved the remaining decisions after review: global lock order
(Matchmaking §24.7), cancellation jobs keyed by UNIQUE request_id with nullable match_id,
and exact `yauzl@3.4.0` (no schema impact). The Social creation hashes above preserve the
initial request across later edits. §13 is Ready as the target schema, not an applied
migration, except the registration skill survey item of §13.8, which was rewritten on
2026-11-15 and is Draft. BK-15 and Booking/Payment dependencies still gate booking integration.
Shared-document/schema teammate PR review remains required before merge.
