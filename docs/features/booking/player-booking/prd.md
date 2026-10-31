# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Ready
Owner: PM/Business Owner
Fulfills: PROJECT-BRIEF.md §3.2 and §7
Scope: Court Booking — Player Flow
```

> Ready: drafted by an AI agent and reviewed/approved by the human owner on
> 2026-09-26 (open questions resolved in §14). Implementation may proceed
> against this document. Feature API, schema deltas, state-machine details, and
> acceptance criteria belong in the Booking Player-Flow Tech Design.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md`
  (§3.2 Court Booking, §5 Out of MVP, §6 MVP Focus, §7 Confirmed Business Decisions)
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`
  (§2 Court Booking Rules, §8.2 Booking Configuration)
- Global schema and schema invariants: `docs/architecture/database-schema.md`
  (§2.2 Booking, §3.8 `BOOKINGS`, §3.9 `BOOKING_PRICING_DETAILS`, §3.10 `PAYMENTS`, §5.8, §8)
- Payment/refund capability: `docs/features/platform/payments-refunds/prd.md`

## Related Documents

- Parent or related PRD:
  - `docs/features/platform/payments-refunds/prd.md` (payment and refund lifecycle)
  - `docs/features/admin/court-management/prd.md` (facility/court status and availability)
- Tech Design: [tech-design.md](tech-design.md)
- Task or issue: [tasks.md](tasks.md)

## 1. Problem

Players need to secure a badminton court at a specific date and time without
phone calls, manual coordination, or waiting for an owner to confirm. Today the
slot may be taken by someone else while the Player is arranging payment, and
there is no reliable way to know whether a slot is actually available.

This matters because Court Booking is one of the three core MVP business areas
defined in `PROJECT-BRIEF.md` §6, and the confirmed booking model requires
real-time confirmation rather than an owner approval queue
(`PROJECT-BRIEF.md` §7).

## 2. Goals

- A Player can search for courts by area and desired date/time and see which
  slots are currently available.
- A Player can hold a selected slot, pay the full booking amount online, and
  receive immediate real-time confirmation of the booking.
- A Player can view upcoming and past bookings with their current status.
- A Player can cancel an eligible booking before its start time and receive a
  refund according to policy.
- The system automatically releases unpaid holds and never reopens an expired
  booking.

## 3. Non-Goals

- Court Owner dashboard, slot management, opening-hours configuration, and
  pricing management (owned by the Court Owner feature).
- Owner-initiated booking cancellation and its refund handling (owned by the
  Court Owner / Booking Owner-side flow); only the effect visible to the Player
  is referenced here.
- Deposit/partial-payment booking (MVP charges the full booking amount online).
- A standalone refund-management module (out of MVP per `PROJECT-BRIEF.md` §5).
- Split bill or group payment (out of MVP per `PROJECT-BRIEF.md` §5).
- Recurring, seasonal, or fixed monthly booking (out of MVP).
- Court rating and reviews (out of MVP per `PROJECT-BRIEF.md` §5).
- Match rescheduling (out of MVP per `PROJECT-BRIEF.md` §5).
- Automated court booking on behalf of Matchmaking or Tournament (owned by
  those features). Direction confirmed 2026-10-31 (`PROJECT-BRIEF.md` §3.1):
  a host may link their own CONFIRMED booking to a match-finding post before
  or after gathering players, and cancellation of a linked booking cancels the
  Match. When the host cancels the post, the host chooses to keep the booking
  or cancel it under this PRD's cancellation policy; a casual group cancelled
  below its minimum keeps the booking. Linking and its consequences are owned
  by the Matchmaking PRD §15; this PRD's booking lifecycle, ownership and
  payment rules are unchanged.
- Cross-midnight bookings (slots must fall within a facility's opening/closing
  hours on a single calendar day).

## 4. Scope

### In Scope

- Court discovery: search courts by area (city/district), date, and time.
- Court detail view: court/facility information, pricing, and available slots.
- Real-time (near real-time) slot availability checking for a selected court and date.
- Booking creation for a single court, including a temporary hold on the selected slot while payment is pending.
- Selection of a start time and a duration within the configured minimum/maximum, which may span multiple contiguous pricing intervals.
- Full online payment to confirm a booking, with real-time confirmation on success.
- Automatic expiration and slot release when payment is not completed in time.
- Booking list: upcoming bookings and booking history with status, including
  cancelled and expired bookings.
- Player-initiated cancellation of an eligible booking, including an unpaid
  `PENDING_PAYMENT` hold, before start time.
- Refund triggering for a paid booking cancelled under the allowed conditions.
- Enforcement of the configured booking constraints (duration limits, advance window, active-booking limit, booking enabled/disabled).

### Out of Scope

- Creating, editing, or moderating facilities, courts, and pricing (Owner/Admin features).
- Owner-side monitoring, slot locking, incident handling, and owner cancellation console.
- Deposit/partial payment, independent refund management, partial refunds, or configurable refund amounts.
- Split bill, recurring/seasonal booking, and group booking.
- Payment methods other than the approved provider.
- Multi-court bookings and cross-midnight bookings.
- Any change to the frozen booking lifecycle or non-overlap rules defined in
  `docs/business-rules-config-matrix.md` §2.2 and `docs/architecture/database-schema.md` §2.2.

## 5. Target Users and Roles

- Player: searches courts, checks slot availability, selects a slot, pays
  online, views upcoming/past bookings, and cancels an eligible booking.
- Court Owner: N/A directly in this PRD. Owner slot/schedule/price management
  and owner-side cancellation are addressed in a separate Owner feature; this
  PRD only covers the Player-visible effect.
- Admin: N/A directly in this PRD. Admin manages system configuration; the
  Player-visible effect of facility/court status is referenced from
  `docs/features/admin/court-management/prd.md`.
- Contextual permission: N/A — this PRD does not involve Tournament Organizer.

## 6. User Journey

**Normal booking journey**

1. Player opens Court Booking and searches by area (city/district), date, and
   time.
2. System shows matching courts and their available slots with prices.
3. Player opens a court, selects a start time and a duration within the
   configured minimum/maximum.
4. System places a temporary hold on the selected slot and presents the total
   to pay (the full booking amount).
5. Player completes online payment.
6. System confirms the booking immediately on successful payment, with no owner
   approval step.
7. Player sees the confirmed booking in their upcoming bookings.

**Payment not completed (hold expiry)**

1. Player selects a slot but does not complete payment within the hold timeout.
2. System expires the booking and releases the slot for other Players.
3. Player can start a new search and select a slot again.

**Cancellation of an unpaid hold**

1. Player decides not to continue after a slot is held but before payment.
2. Player cancels the `PENDING_PAYMENT` booking; the slot is released
   immediately. No refund is involved because no payment was made.

**Player cancellation of a paid booking**

1. Player opens an eligible upcoming booking and chooses to cancel before the
   start time.
2. System applies the cancellation policy and cancels the booking.
3. The system triggers a full refund automatically and shows the refund status
   (`REFUND_PENDING`, then `REFUNDED` or `REFUND_FAILED`).

**Payment arriving after expiry**

1. A payment is completed after the booking has already expired.
2. System never reopens the expired booking.
3. If the Player was charged, the amount is handled through the refund flow and
   the Player is informed.

## 7. Functional Requirements

- The system can let a Player search for courts by area (city/district), date,
  and time, and order results by price.
- The system can show court details, applicable prices, and available slots for
  a selected court and date.
- The system can show slot availability as a per-court grid for the selected
  date, refresh it while the Player is on the screen, and re-check availability
  when the Player creates the booking.
- The system can let a Player select a start time and a duration within the
  configured minimum and maximum duration, spanning one or more contiguous
  pricing intervals.
- The system can restrict bookable slots to the configured advance window, to
  the court's operating hours, and to a single calendar day (no cross-midnight
  booking).
- The system can hold the selected slot while payment is pending and calculate
  the full total from the applicable pricing for the selected interval(s).
- The system can let a Player pay the full booking amount online and confirm the
  booking immediately and automatically once payment succeeds.
- The system can expire an unpaid booking after the configured payment timeout
  and release the slot.
- The system can let a Player cancel an unpaid `PENDING_PAYMENT` hold before
  start time, releasing the slot immediately.
- The system can prevent overlapping active bookings for the same court, while
  allowing boundary-touching intervals (for example, 18:00–19:00 and
  19:00–20:00).
- The system can let a Player view upcoming bookings and booking history with
  the current booking status, including `CANCELLED` and `EXPIRED` bookings.
- The system can let a Player cancel an eligible paid booking before its start
  time and automatically trigger a full refund under the allowed conditions.
- The system never reopens an expired booking and handles a late payment by
  refunding when the Player was charged.
- The system can enforce the configured active-booking limit per Player, where
  an active booking is one in `PENDING_PAYMENT`, `CONFIRMED`, or `IN_PROGRESS`.
- The system can hide or reject booking when booking is disabled or when the
  court/facility is not eligible for new bookings.
- The system can send in-app notifications for booking confirmation, an
  expiring/expired payment hold, booking cancellation, and refund status.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §2 and §8.2;
  `docs/architecture/database-schema.md` §2.2.
- Booking is real-time. There is no `Player → Pending → Owner
  approval/rejection` workflow (`PROJECT-BRIEF.md` §7).
- Booking lifecycle: `PENDING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED`;
  `PENDING_PAYMENT → EXPIRED`; `PENDING_PAYMENT → CANCELLED` (Player cancels an
  unpaid hold); `CONFIRMED → CANCELLED`.
- Automatic transitions: at `start_time` a `CONFIRMED` booking becomes
  `IN_PROGRESS`; at `end_time` an `IN_PROGRESS` booking becomes `COMPLETED`;
  on payment timeout a `PENDING_PAYMENT` booking becomes `EXPIRED`.
- A selected slot is held through `PENDING_PAYMENT` while payment is pending.
- The online payment is the full booking amount; MVP supports no deposit or
  partial payment.
- Payment timeout defaults to 10 minutes via `BOOKING_PAYMENT_TIMEOUT_MINUTES`.
  The deadline is snapshotted for the pending booking; changing the
  configuration does not change an existing pending booking's deadline.
- Bookings for the same court must not overlap; boundary-touching intervals are
  allowed. `PENDING_PAYMENT` also participates in overlap protection while its
  hold is active.
- A booking covers exactly one court and may span multiple contiguous pricing
  intervals; booking pricing is snapshotted so later pricing changes do not
  affect an existing booking.
- A booking's slots must fall within the facility's opening and closing hours on
  a single calendar day; cross-midnight booking is not supported.
- Minimum and maximum booking durations are governed by
  `BOOKING_MIN_DURATION_MINUTES` (60) and `BOOKING_MAX_DURATION_MINUTES` (180).
- The advance booking window is governed by `BOOKING_ADVANCE_WINDOW_DAYS` (7).
- Active-booking limits are governed by `BOOKING_ACTIVE_LIMIT_MODE` (`LIMITED`)
  and `BOOKING_MAX_ACTIVE_PER_PLAYER` (5). A booking counts as active while it is
  in `PENDING_PAYMENT`, `CONFIRMED`, or `IN_PROGRESS`.
- Booking availability is gated by `BOOKING_ENABLED`.
- Player cancellation is governed by `PLAYER_CAN_CANCEL_BOOKING` and
  `PLAYER_CANCELLATION_DEADLINE_MINUTES`. With the default value of `0`, the
  Player may cancel any time before `start_time`.
- An unpaid `PENDING_PAYMENT` booking may be cancelled by the Player before
  start time; the slot is released immediately and no refund is involved.
- A paid booking cancelled before `start_time` under the allowed conditions
  results in a full (100%) refund, triggered automatically through the payment
  lifecycle.
- Booking cancellation and the payment/refund lifecycle are separate concerns.
- A late payment must never reopen an expired booking; if the provider charged
  the Player, a refund is required.
- Payment success and booking confirmation must be idempotent.
- Booking history retains all bookings, newest first, including `CANCELLED` and
  `EXPIRED` bookings.

## 9. UI/UX Behavior

- Entry points: the Court Booking / court search area for discovery, the court
  detail view for slot selection, and the Player's "My Bookings" area for
  upcoming and past bookings.
- Important states:
  - Loading (searching courts, checking availability, loading booking list).
  - Empty (no courts match the search; no slots available for the selected
    date).
  - Success (booking confirmed after payment).
  - Error (search, payment, or booking action fails; recoverable).
  - Unavailable (a selected slot was taken before confirmation).
  - Expired (payment hold timed out and the slot was released).
  - Cancelled (booking cancelled; refund status shown when applicable).
  - Refund in progress / failed (`REFUND_PENDING`, `REFUND_FAILED`).
- User feedback:
  - A visible countdown or clear deadline while a slot is held for payment.
  - An explicit confirmation when the booking is confirmed.
  - A clear message when a slot is no longer available, with the option to pick
    another slot.
  - Explicit confirmation with refund implications before cancelling a paid
    booking, and immediate release feedback when cancelling an unpaid hold.
  - Refund status shown for a cancelled paid booking.
  - In-app notifications for confirmation, hold expiry, cancellation, and
    refund status.
- Content requirements: show facility/court information, date and time,
  duration, the price breakdown, the total (full booking amount), and the
  applicable cancellation policy at the point of booking and cancellation.
- Accessibility or content requirements: N/A — no accessibility requirement is
  approved for this scope; follow existing platform UI conventions.

## 10. Success Metrics

- TBD — product metric needs decision (candidate metrics: hold-to-confirmation
  rate, booking completion rate, cancellation-with-refund rate, double-booking
  incidents). This is a product metric and does not block implementation.

## 11. Constraints

- Must preserve real-time booking confirmation; the normal
  `Player → Pending → Owner approval/rejection` flow must not be introduced
  (`PROJECT-BRIEF.md` §7).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope.
- Must preserve the booking lifecycle and non-overlap rules from
  `docs/business-rules-config-matrix.md` §2 and
  `docs/architecture/database-schema.md` §2.2.
- Configuration defaults and snapshot semantics are owned by
  `docs/business-rules-config-matrix.md` §8.1–§8.2 and are not redefined here.
- Payment and refund behavior must align with the payments/refunds capability
  and the approved provider (`docs/architecture/tech-stack.md`).
- Must use only the existing system roles (`PLAYER`, `COURT_OWNER`, `ADMIN`);
  no new role is introduced.
- Facility/court status affects new-booking availability per
  `docs/features/admin/court-management/prd.md`; existing confirmed bookings
  are not automatically cancelled there.

## 12. Risks

- Risk: Concurrent Players attempt to book the same slot, causing a double
  booking.
  Mitigation: the selected slot is held as the real-time source of truth, and
  non-overlap is preserved for active holds and confirmed bookings.
- Risk: A Player abandons a hold, blocking a slot.
  Mitigation: automatic expiration and slot release after the payment timeout.
- Risk: Late or duplicate payment callbacks change booking state incorrectly.
  Mitigation: idempotent payment and confirmation handling; expired bookings are
  never reopened and charged amounts are refunded.
- Risk: Players misunderstand cancellation and refund conditions.
  Mitigation: show the applicable cancellation policy before booking and before
  cancellation confirmation.
- Risk: Booking availability driven by stale data on the client.
  Mitigation: availability is refreshed on screen and re-checked at booking
  time; a taken slot produces a recoverable "unavailable" state.

## 13. Dependencies

- Player account and authentication capability.
- Facility, court, and pricing data maintained by the Court Owner and Admin
  modules.
- Payments and refunds capability (`docs/features/platform/payments-refunds/prd.md`).
- Notification capability, for booking-related notifications such as
  confirmation, hold expiry, cancellation, and refund status.
- System configuration values owned by
  `docs/business-rules-config-matrix.md` §8.2 and system configuration
  management.

## 14. Decision Log

All open questions were resolved by the human owner on 2026-09-26.

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Deposit vs full online payment | Business Owner | MVP charges the **full booking amount** online; no deposit/partial payment. `PROJECT-BRIEF.md` §3.2 "thanh toán / đặt cọc" is read as "online payment" for this scope. | 2026-09-26 | RESOLVED |
| Definition of an "active booking" for the active-booking limit | Business Owner | A booking counts as active while it is in `PENDING_PAYMENT`, `CONFIRMED`, or `IN_PROGRESS`. | 2026-09-26 | RESOLVED |
| Cancelling an unpaid `PENDING_PAYMENT` hold | Business Owner | The Player may cancel an unpaid hold before start time; the booking becomes `CANCELLED`, the slot is released immediately, and no refund applies. | 2026-09-26 | RESOLVED |
| `PLAYER_CANCELLATION_DEADLINE_MINUTES = 0` semantics and refund scope | Business Owner | `0` means the Player may cancel any time before `start_time`; a full (100%) refund applies only to a paid booking cancelled under the allowed conditions. | 2026-09-26 | RESOLVED |
| Minimum search/filter criteria | PM/Business Owner | Search by area (city/district), date, and time; order results by price. | 2026-09-26 | RESOLVED |
| Multi-court booking | Business Owner | A booking covers exactly one court. | 2026-09-26 | RESOLVED |
| Slot selection model | PM/Business Owner | The Player selects a start time and a duration within the configured min/max, which may span multiple contiguous pricing intervals. | 2026-09-26 | RESOLVED |
| Availability display and data freshness | PM/Business Owner | Availability is shown as a per-court slot grid for the selected date, refreshed while on screen, and re-checked when the Player creates the booking. | 2026-09-26 | RESOLVED |
| Refund initiation and Player-visible status | PM/Business Owner | The system triggers the refund automatically through the payment module; the Player sees `REFUND_PENDING`, then `REFUNDED` or `REFUND_FAILED`. | 2026-09-26 | RESOLVED |
| Booking history retention | PM/Business Owner | Retain all bookings, newest first, including `CANCELLED` and `EXPIRED` bookings. | 2026-09-26 | RESOLVED |
| Opening-hours and cross-midnight handling | Business Owner | Slots must fall within the facility's opening/closing hours on a single calendar day; cross-midnight booking is not supported. | 2026-09-26 | RESOLVED |
| Player in-app notification events | PM/Business Owner | Notify on booking confirmation, expiring/expired payment hold, booking cancellation, and refund status. | 2026-09-26 | RESOLVED |
| Success metric definition | PM/Business Owner | Candidate metrics listed in §10 (hold-to-confirmation rate, booking completion rate, cancellation-with-refund rate, double-booking incidents). | 2026-09-26 | TBD (non-blocking; product metric only) |

## Phase 1 business review — Ready, 2026-10-31

The human owner approved the Phase 1 business changes in this document after review. This approval covers the Social Matchmaking/Messaging changes only; it does not approve unrelated Draft content, new routes, schema, API, technology, or implementation. The affected technical documents and Tasks must be updated before implementation.
