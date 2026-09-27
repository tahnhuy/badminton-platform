# Product Requirements Document (PRD) - Court Owner Self-Service (Quản lý cơ sở sân, giá và lịch slot)

## Status and Ownership

```text
Status: Ready
Owner: PM/Business Owner
Fulfills: PROJECT-BRIEF.md §3.2 and §7
Scope: Court Owner self-service portal — manage own facilities and child courts, configure time-based court pricing, monitor real-time booking schedule, lock/unlock maintenance slots, and cancel bookings caused by court-side incidents (with mandatory refund and Player notification)
```

This PRD was approved as `Ready` by the human owner on 2026-09-27 after all Open Questions in §14 were resolved (see §14 Decision Log). It defines product behavior and business rules only. It does not define API contracts, database schema, migrations, or implementation structure.

> **Note on the requested reference.** The reading list cited `PROJECT-BRIEF.md §1.3`; the brief has §1 "Tổng quan" with no §1.3. This PRD fulfills `PROJECT-BRIEF.md §3.2` (Court Booking — Court Owner role) and §7 (Confirmed Business Decisions — real-time booking), as stated in `Fulfills`.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md` §2 (System Roles), §3.2 (Court Booking), §4 (Admin), §5 (Out of MVP), §6 (MVP Focus), §7 (Confirmed Business Decisions)
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.1 (System Roles), §2.3 (Booking Rules), §5.2 (PRD ownership)
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md` §2 (Court Booking Rules), §8.1 (Configuration Semantics), §8.2 (Booking Configuration)
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §3.4 `COURT_OWNER_PROFILES`, §3.5 `FACILITIES`, §3.6 `COURTS`, §3.7 `COURT_PRICINGS`, §3.8 `BOOKINGS`, §3.9 `BOOKING_PRICING_DETAILS`, §2.2 (Booking invariants)
- Global technology facts referenced (not redefined): `docs/architecture/tech-stack.md` (in-app notifications; HTTP polling for near-real-time slot availability)

## Related Documents

- Parent or related PRD:
  - [Player Booking PRD](../booking/player-booking/prd.md) — Player-facing booking flow; explicitly defers owner-side monitoring, slot locking, and owner cancellation to this Owner feature
  - [Admin Court Management PRD](../admin/court-management/prd.md) — Admin facility/court moderation, onboarding, and approval of Owner submissions
  - [Payments & Refunds PRD](../platform/payments-refunds/prd.md) — payment and refund lifecycle executed for owner-side cancellations
  - [Authentication & Authorization PRD](../platform/authentication-authorization/prd.md) — `COURT_OWNER` identity and permission scope
- Tech Design: [tech-design.md](tech-design.md) (Ready, Decision Status: Approved)
- Task or issue: [tasks.md](tasks.md)

## 1. Problem

- **Who is affected:** Court Owners who operate badminton facilities and must keep their facility information, courts, prices, and daily schedule accurate, while handling incidents (maintenance, broken courts) that force bookings to be cancelled.
- **What is difficult or unavailable today:** There is no self-service workspace. Court Owners cannot maintain their own facility/court data, configure time-based pricing, see the live booking schedule for their courts, or proactively block a court for maintenance. Incident handling and refunds for owner-side cancellations have no owner-facing path.
- **Why it matters within MVP:** Court Booking is one of the three core MVP business areas (`PROJECT-BRIEF.md` §3.2, §6). Court Owner actions (supervise bookings, manage slots, adjust for incidents, lock slots, cancel due to court-side problems with Player notification and refund) are part of the confirmed booking model (`PROJECT-BRIEF.md` §7). Without this workspace, facilities, pricing, and incident handling depend on Admin or manual intervention.

## 2. Goals

- A Court Owner can manage the information of the facility/facilities they own and the child courts under them.
- A Court Owner can submit new facilities/courts, which become usable only after Admin approval.
- A Court Owner can configure time-based court pricing (per hour), and pricing changes affect only new bookings.
- A Court Owner can monitor the booking schedule for their courts in near real time.
- A Court Owner can proactively lock a slot for maintenance so Players cannot book it.
- A Court Owner can cancel a booking caused by a court-side incident, which triggers a full (100%) refund and an in-app notification to the affected Player.
- The system preserves the confirmed real-time booking model with no manual owner approval queue.

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- Any manual booking approval flow: `Player → Pending → Court Owner approve/reject` (`PROJECT-BRIEF.md` §7; `docs/documentation-guide.md` §2.3). The facility/court onboarding approval in §2/§8 is an onboarding review, not a booking approval.
- A dedicated refund-management / settlement module for Court Owners (`PROJECT-BRIEF.md` §5). Only the refund required by an owner-side booking cancellation is in scope, executed through the payment lifecycle.
- Split Bill (`PROJECT-BRIEF.md` §5).
- Court/Facility rating (`PROJECT-BRIEF.md` §5).
- Platform-level facility/court moderation (suspend, re-evaluate, deactivate), which stays owned by Admin (`docs/features/admin/court-management/prd.md`). Owner-submitted creation that requires Admin approval is in scope here (§4); the moderation itself is not.
- The Player-facing booking flow (search, hold, payment, Player cancellation) owned by `docs/features/booking/player-booking/prd.md`.
- Match rescheduling (`PROJECT-BRIEF.md` §5).
- Financial analytics, settlement reports, or payout management.
- Cross-midnight pricing and cross-midnight bookings (schema §3.7 leaves cross-midnight pricing undefined; Player Booking PRD excludes cross-midnight bookings).
- Changing an existing booking's snapshotted price (`docs/business-rules-config-matrix.md` §2.3).

## 4. Scope

### In Scope

- Facility profile management for the facilities the Owner owns: edit facility information (name, description, contact phone, address, opening/closing hours) within the Owner's own scope.
- Court management for the Owner's facilities: maintain the list of child courts (add/edit courts within the Owner's own facilities).
- Facility/court creation submitted by the Owner, subject to Admin approval before the facility/court becomes bookable (see §14 Decision Log #2).
- Time-based court pricing configured **per hour**: create and edit hourly pricing intervals per court, with validity dates, used to price new bookings.
- Real-time (near-real-time) booking schedule monitoring for the Owner's courts, showing the booking Player's contact details for the Owner's own facilities only.
- Maintenance slot lock: the Owner can lock a specific time range so that it cannot be booked; the Owner can unlock it again. A lock cannot overlap an active booking.
- Owner-side booking cancellation for a court-side incident/maintenance, including the refund trigger and Player notification.
- Owner-facing status/feedback for the above actions.

### Out of Scope

- All items in §3 Non-Goals.
- Admin facility/court moderation (suspend, reactivate, deactivate) and direct Admin onboarding (`docs/features/admin/court-management/prd.md`).
- Refund execution details, provider behavior, and the independent refund module (`docs/features/platform/payments-refunds/prd.md`).
- Bulk operations, reporting/export, or financial analytics.

## 5. Target Users and Roles

- **Court Owner:** manages facilities, courts, and pricing they own; submits new facilities/courts for approval; monitors bookings; locks/unlocks maintenance slots; cancels bookings due to court-side incidents. The Owner's authority is limited to the facilities/courts they own (`owner_id`).
- **Player:** receives an in-app notification and a full refund when the Owner cancels their paid booking due to a court-side incident; sees a slot as unavailable when the Owner has locked it for maintenance. The Player does not gain any new management capability.
- **Admin:** supervises facilities and Owner account/operational status at platform level (`PROJECT-BRIEF.md` §4; `docs/features/admin/court-management/prd.md`), and reviews/approves or rejects facility/court creation submitted by a Court Owner. Admin does not participate in the Owner's day-to-day operations.
- **Contextual permission:** `N/A — this PRD is exercised through the COURT_OWNER system role scoped to the Owner's own resources; it does not involve Tournament Organizer.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

### 6.1 Facility and court setup

1. A signed-in Court Owner opens the Owner workspace and selects one of their facilities.
2. The Owner reviews/edits the facility information (name, contact, address, opening/closing hours).
3. The Owner views the list of child courts and adds or edits a court within that facility.

### 6.2 Submit a new facility/court for approval

1. The Owner chooses to create a new facility or a new court.
2. The Owner provides the required information and submits it.
3. The submitted facility/court is not bookable until an Admin approves it.
4. On approval, the facility/court becomes active and usable; on rejection, the Owner sees the outcome and reason.

### 6.3 Configure time-based pricing

1. The Owner selects a court and opens its pricing configuration.
2. The Owner creates or edits hourly pricing intervals (time range, hourly price, validity dates).
3. The system validates the pricing; overlapping intervals for the same court and validity period are rejected.
4. New bookings use the updated pricing; existing bookings keep their snapshotted price.

### 6.4 Monitor booking schedule

1. The Owner opens the booking schedule/calendar for a court or facility.
2. The system shows the bookings and their current status for the relevant date(s), refreshed while the Owner is on screen, including the booking Player's contact details for the Owner's own facilities.
3. The Owner can inspect a booking's details and identify upcoming or problem bookings.

### 6.5 Lock a maintenance slot

1. The Owner identifies a slot that must be blocked (e.g., court repair).
2. The Owner locks a specific time range with a mandatory reason, within the allowed advance window.
3. If the range overlaps an active booking, the system rejects the lock and the Owner must cancel that booking first.
4. The system prevents Players from booking the locked slot; Player availability shows it as unavailable.
5. The Owner can unlock the slot when the court is available again.

### 6.6 Cancel a booking due to a court-side incident

1. The Owner opens an upcoming booking affected by a court-side issue and chooses to cancel it because of an incident/maintenance, providing a mandatory reason.
2. If the booking is paid, the system triggers a full (100%) refund for the Player through the payment lifecycle, exactly once.
3. The system sends an in-app notification to the affected Player explaining the cancellation.
4. The slot is released, and the Owner sees the booking as `CANCELLED`. The Owner may then lock the slot for maintenance via the separate maintenance-lock action (§6.5), which is subject to the same lock rules (no overlap with active bookings).

### 6.7 Alternative journey — owner cancellation not allowed

1. The Owner attempts to cancel a booking that is not eligible (for example, after the allowed cancellation deadline, or a booking not belonging to their own facility).
2. The system rejects the action and explains why.

## 7. Functional Requirements

- The system can let a Court Owner view and edit the facilities they own, scoped strictly by `owner_id` (schema §3.5).
- The system can let a Court Owner view and add/edit courts that belong to their own facilities (schema §3.6).
- The system can let a Court Owner submit a new facility or court; the submission is not bookable until Admin approves it.
- The system can let an Admin approve or reject an Owner-submitted facility/court.
- The system can let a Court Owner create and edit hourly pricing intervals for their courts, with an hourly price and validity dates (schema §3.7).
- The system rejects pricing intervals that overlap for the same court over overlapping validity dates.
- The system can apply pricing to new bookings only; an existing booking keeps its snapshotted price and pricing detail (schema §3.8, §3.9; `docs/business-rules-config-matrix.md` §2.1, §2.3).
- The system can show the Owner a booking schedule for their courts with current booking status and the booking Player's contact details for the Owner's own facilities, refreshed while the Owner is on screen (near-real-time via HTTP polling).
- The system can let a Court Owner lock a specific slot range on a court for maintenance with a mandatory reason, within the allowed advance window, and unlock it again.
- The system rejects a maintenance lock whose range overlaps an active booking.
- The system can reflect a locked slot as unavailable in Player-facing availability.
- The system can let a Court Owner cancel an eligible booking before its start time because of a court-side incident/maintenance, with a mandatory reason.
- When an Owner cancels a paid (`CONFIRMED`) booking, the system triggers a full (100%) refund through the payment lifecycle, idempotently (exactly one refund per cancellation).
- When an Owner cancels an unpaid `PENDING_PAYMENT` hold, the system cancels it and releases the slot with no refund.
- When an Owner cancels a booking, the system sends an in-app notification to the affected Player with the cancellation reason.
- The system can show the Owner the resulting booking status (`CANCELLED`) and, where applicable, the refund status reference for the cancelled booking.
- The system can reject Owner actions that target facilities/courts the Owner does not own.
- The system can reject Owner actions that violate the configuration gates in §8.
- The system applies the existing system roles and does not introduce a booking approval queue.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §2 (Court Booking Rules), §8.1 (Configuration Semantics), §8.2 (Booking Configuration); `docs/architecture/database-schema.md` §2.2, §3.8; `PROJECT-BRIEF.md` §3.2, §7.
- **No booking approval flow.** Booking remains real-time; there is no `Player → Pending → Court Owner approve/reject` step. The Owner supervises, manages slots, and handles incidents (`PROJECT-BRIEF.md` §7).
- **Ownership scope.** A Court Owner may manage only the `FACILITIES` and `COURTS` whose `owner_id` is their own user id (schema §3.5, §3.6). Cross-owner access is forbidden.
- **Facility/court onboarding requires Admin approval.** A Court Owner may submit a new facility or court, but it does not become bookable until an Admin approves it. This is an onboarding review, not a booking approval. The representation of the pending/approved state is a Tech Design/schema concern (schema §3.5/§3.6 `status` vocabulary is not yet defined).
- **Pricing unit is per hour.** A `COURT_PRICINGS` price is an hourly rate; a booking's total uses the applicable hourly rates across its intervals, snapshotted at booking time.
- **Pricing intervals must not overlap.** For the same court and overlapping validity dates, pricing time intervals must not overlap; the system rejects a conflicting interval.
- **Pricing snapshot.** Changing court pricing never changes an existing booking's price; the price and pricing inputs are snapshotted at booking creation (`docs/business-rules-config-matrix.md` §2.1, §2.3; schema §3.9).
- **Owner cancellation eligibility.** Owner cancellation is allowed before `start_time`, gated by `OWNER_CAN_CANCEL_BOOKING` with deadline `OWNER_CANCELLATION_DEADLINE_MINUTES` (`docs/business-rules-config-matrix.md` §2.4, §8.2). With the default value `0`, the Owner may cancel any time before `start_time`.
- **Owner cancellation scope.** The Owner may cancel a paid `CONFIRMED` booking (full refund + notification) and an unpaid `PENDING_PAYMENT` hold (cancel and release the slot, no refund).
- **Owner cancellation due to court-side incident.** When the cancellation is caused by a Court issue/maintenance, the Player must be notified, and if the booking is paid the refund flow is triggered (`docs/business-rules-config-matrix.md` §2.4; schema §2.2).
- **A reason is mandatory** for both a maintenance lock and an owner-side cancellation; it is used for audit and in the Player notification.
- **Refund is full and idempotent.** A paid booking cancelled by the Owner results in a full (100%) refund, executed through the payment lifecycle exactly once (`docs/business-rules-config-matrix.md` §2.8; `docs/architecture/tech-stack.md` payment idempotency). A standalone refund-management module is out of scope.
- **Notification is required and in-app.** Owner cancellation must notify the affected Player with the reason, delivered as an in-app notification (no email/push in MVP; `docs/architecture/tech-stack.md`).
- **Cancellation and refund are separate lifecycles.** Booking status and payment/refund status are managed separately (`docs/business-rules-config-matrix.md` §2.4).
- **Maintenance slot lock.** A locked slot cannot be booked by Players while the lock is active. A lock may only be placed on a range that does not overlap an active booking (`CONFIRMED` or `PENDING_PAYMENT`); if it does, the Owner must cancel the overlapping booking first (which triggers the refund/notification rules above). A lock may be placed for a date within `BOOKING_ADVANCE_WINDOW_DAYS` (default 7).
- **Owner does not change operational status.** The Owner cannot change facility/court moderation status (`ACTIVE`/`SUSPENDED`); maintenance is handled solely through slot locks. Platform moderation stays with Admin (`docs/features/admin/court-management/prd.md`).
- **Player data visibility.** In schedule monitoring, the Owner sees the booking Player's contact details only for bookings on the Owner's own facilities. This access is restricted to the Owner's owned resources and must not be exposed beyond that scope.
- **Pricing and configuration changes apply to new entities only.** Snapshot semantics of `docs/business-rules-config-matrix.md` §8.1 apply; an existing booking keeps its established price and deadlines.
- **Real-time monitoring uses the confirmed transport.** Schedule refresh uses HTTP polling (5–10 seconds), not WebSocket/SSE (`docs/architecture/tech-stack.md`).

## 9. UI/UX Behavior

- Entry points: a Court Owner workspace/dashboard, with facility and court management, pricing configuration, a booking schedule/calendar, and an incident/cancellation action.
- Important states:
  - Loading (loading facilities, courts, pricing, schedule).
  - Empty (Owner has no facility/court yet; no bookings for the selected date; no pricing configured).
  - Pending approval (a submitted facility/court is awaiting Admin approval and is not yet bookable).
  - Success (facility/court/pricing saved; slot locked/unlocked; booking cancelled).
  - Error (save fails; an action targets a non-owned resource; a cancellation is not eligible; a lock overlaps an active booking).
  - Maintenance (a slot is locked; shown clearly in the Owner schedule and as unavailable in Player availability).
  - Cancelled (a booking cancelled by the Owner, with reason and refund status reference where applicable).
  - Unavailable/Forbidden (an action the Owner is not allowed to perform).
- User feedback:
  - Clear confirmation for facility/court/pricing saves and submission-for-approval.
  - Clear indication of which slots are locked and why.
  - An explicit, high-friction confirmation before cancelling a booking, stating the refund and Player-notification consequences.
  - Clear messaging when an action is rejected (non-owned resource, ineligible cancellation, overlapping lock, disabled configuration).
  - No exposure of implementation errors or sensitive details.
- Content requirements: show facility/court identity, pricing intervals with currency and the per-hour unit, schedule with booking status/times and Player contact for owned facilities, lock reason and range, and cancellation reason and refund status reference.
- Accessibility or content requirements: `N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.`

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP):
  - Share of facilities/courts with configured pricing.
  - Owner-side cancellation rate and refund completion rate.
  - Maintenance lock usage and average lock duration.
  - Schedule-monitoring engagement.
- Numeric targets are `TBD — product metric target needs decision`; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve real-time booking confirmation; the normal `Player → Pending → Court Owner approval/rejection` flow must not be introduced (`PROJECT-BRIEF.md` §7; `docs/documentation-guide.md` §2.3).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including a dedicated refund-management module, Split Bill, and Court rating.
- Must authorize strictly by the `COURT_OWNER` role scoped to the Owner's own `owner_id` resources; no cross-owner access (`docs/architecture/conventions.md`, authorization).
- Must preserve the booking lifecycle and non-overlap rules (`docs/business-rules-config-matrix.md` §2; `docs/architecture/database-schema.md` §2.2).
- Must preserve snapshot semantics: pricing changes do not affect existing bookings (`docs/business-rules-config-matrix.md` §8.1).
- Payment/refund behavior must align with the payments/refunds capability and the approved provider; owner-side cancellation triggers the refund but does not redefine refund execution.
- Notifications are in-app only (`docs/architecture/tech-stack.md`).
- Near-real-time schedule refresh uses HTTP polling (`docs/architecture/tech-stack.md`).
- Owner visibility of Player contact details is limited to bookings on the Owner's own facilities.
- The maintenance slot lock entity and the facility/court pending-approval state have no approved representations yet; dependent implementation waits for the Tech Design/schema decisions noted in §14.
- Must not define API contracts, database fields, or implementation component structure in this PRD.

## 12. Risks

- Risk: A Court Owner locks slots or cancels bookings improperly, harming Players.
  Mitigation: mandatory reason capture, rejection of locks overlapping active bookings, high-friction cancellation confirmation, mandatory Player notification, and Admin oversight.
- Risk: Owner cancellation triggers a refund more than once.
  Mitigation: idempotent refund handling through the payment lifecycle (`docs/architecture/tech-stack.md`); exactly one refund per cancellation.
- Risk: Owner-submitted facilities/courts are used before approval, or approval is inconsistent.
  Mitigation: submitted facilities/courts are not bookable until Admin approval; the approval state is surfaced to both Owner and Admin.
- Risk: Pricing changes are mistaken as applying to existing bookings, causing disputes.
  Mitigation: snapshot semantics are preserved and surfaced in the UI; existing bookings retain their original price.
- Risk: Exposing full Player contact details to the Owner is broader than privacy-minimizing practice (`docs/architecture/conventions.md`, security coding practices).
  Mitigation: access is restricted to the Owner's own facilities' bookings only, is never logged, and is not exposed beyond the Owner scope; the platform may revisit this scope in future.
- Risk: Cross-owner data access through crafted requests.
  Mitigation: authorization is enforced at the service boundary by `owner_id`; resource checks and database foreign keys back this up; failures are rejected, not silently ignored.

## 13. Dependencies

- Court Owner account and authentication (`docs/features/platform/authentication-authorization/prd.md`); a real `COURT_OWNER` identity is required.
- Player Booking flow and `BOOKINGS`/`BOOKING_PRICING_DETAILS` data (`docs/features/booking/player-booking/prd.md`).
- Payments and refunds capability, for owner-side cancellation refunds (`docs/features/platform/payments-refunds/prd.md`).
- Notification capability, for in-app Player notifications (`docs/architecture/tech-stack.md`).
- Admin Court Management, for approval of Owner-submitted facilities/courts and platform moderation (`docs/features/admin/court-management/prd.md`).
- System configuration values owned by `docs/business-rules-config-matrix.md` §8.2 (`OWNER_CAN_CANCEL_BOOKING`, `OWNER_CANCELLATION_DEADLINE_MINUTES`, `BOOKING_ADVANCE_WINDOW_DAYS`, `BOOKING_*`, `REFUND_*`) and system configuration management.
- An approved schema/feature decision for the maintenance slot lock entity and the facility/court pending-approval state (neither exists in the consolidated schema today; see §14).

## 14. Decision Log

All Open Questions were resolved by the human owner on 2026-09-27, and the PRD was marked `Ready`.

| # | Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Maintenance lock granularity. | Human owner | Slot-level lock for a specific time range. The lock entity is a Tech Design/schema delta (no such entity exists today). | 2026-09-27 | RESOLVED |
| 2 | Whether the Court Owner may create Facilities/Courts. | Human owner | The Owner may create facilities/courts, but they require Admin approval before becoming active/bookable. Cross-feature impact: `docs/features/admin/court-management/prd.md` must reflect Owner submission + Admin approval (follow-up update). | 2026-09-27 | RESOLVED |
| 3 | Pricing-unit semantics. | Human owner | Per hour. A booking total uses applicable hourly rates across its intervals, snapshotted at booking time. | 2026-09-27 | RESOLVED |
| 4 | Pricing interval overlap for the same court. | Human owner | Overlapping intervals over overlapping validity dates are rejected. | 2026-09-27 | RESOLVED |
| 5 | Owner cancellation scope and `OWNER_CANCELLATION_DEADLINE_MINUTES = 0` semantics. | Human owner | Owner may cancel a paid `CONFIRMED` booking (full refund + notify) and an unpaid `PENDING_PAYMENT` hold (release, no refund). `0` means any time before `start_time`. | 2026-09-27 | RESOLVED |
| 6 | Lock overlapping an active booking. | Human owner | Reject the lock; the Owner must cancel the overlapping booking first (triggering refund/notification). | 2026-09-27 | RESOLVED |
| 7 | Whether the Owner may change facility/court operational status. | Human owner | No; platform moderation status stays Admin-only. Maintenance uses slot locks only. | 2026-09-27 | RESOLVED |
| 8 | Player information visible to the Owner in monitoring. | Human owner | Full contact details, restricted to bookings on the Owner's own facilities. | 2026-09-27 | RESOLVED |
| 9 | Whether a reason is mandatory. | Human owner | Required for both maintenance locks and owner-side cancellations. | 2026-09-27 | RESOLVED |
| 10 | Future-dated maintenance locks. | Human owner | Allowed within `BOOKING_ADVANCE_WINDOW_DAYS` (default 7), consistent with the booking window. | 2026-09-27 | RESOLVED |

No Open Questions remain. The maintenance lock entity and the facility/court pending-approval state are Tech Design/schema items (Dependencies and §14 #1–#2), not product Open Questions.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.
