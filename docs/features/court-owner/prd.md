# Product Requirements Document (PRD) - Court Owner Self-Service (Quản lý cơ sở sân, giá và lịch slot)

## Status and Ownership

```text
Status: Ready
Owner: PM/Business Owner
Fulfills: PROJECT-BRIEF.md §3.2 and §7
Scope: Court Owner self-service portal — manage own facilities and child courts, configure time-based court pricing, monitor real-time booking schedule, lock/unlock maintenance slots, and cancel bookings caused by court-side incidents (with mandatory refund and Player notification)
```

This PRD was approved as `Ready` by the human owner on 2026-09-27. The human owner approved review recommendations 1–14 and Figma alignment decisions F01–F24 (all A) on 2026-10-23; the current behavior includes that revision (see §14 Decision Log). It defines product behavior and business rules only. It does not define API contracts, database schema, migrations, or implementation structure.

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
- Figma review: [frontend-figma-review.md](frontend-figma-review.md) — O01–O17 audit, 2026-10-23; F01–F24 approved as A on 2026-10-23; behavior consolidated in §8.2/§14.2; canvas alignment remains implementation work.

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
- Maintenance slot lock: the Owner can lock a specific time range so that it cannot be booked; the Owner can unlock one complete block by its identity. Partial or bulk unlocking is outside MVP. A lock cannot overlap an active booking.
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
3. If the range overlaps an effective active booking, the system rejects the lock. Owner resolves eligible Player bookings through cancellation first; Tournament reservations require Organizer handling and started bookings cannot be self-service cancelled.
4. The system prevents Players from booking the locked slot; Player availability shows it as unavailable.
5. The Owner can unlock the slot when the court is available again.

### 6.6 Cancel a booking due to a court-side incident

1. The Owner opens an upcoming booking affected by a court-side issue and chooses to cancel it because of an incident/maintenance, providing a mandatory reason.
2. If the booking is paid, the system triggers a full (100%) refund for the Player through the payment lifecycle, exactly once.
3. The system sends an in-app notification to the affected Player explaining the cancellation.
4. The slot is released, and the Owner sees the booking as `CANCELLED`. The Owner may then lock the slot for maintenance via the separate maintenance-lock action (§6.5), which is subject to the same lock rules (no overlap with active bookings). This remains two separate actions; a successful cancellation does not reserve the released interval for maintenance.

### 6.7 Alternative journey — owner cancellation not allowed

1. The Owner attempts to cancel a booking that is not eligible (for example, after the allowed cancellation deadline, or a booking not belonging to their own facility).
2. The system rejects the action and explains why.

### 6.8 Owner notification inbox — 2026-11-23

1. The Owner sees an unread badge and opens `/owner/notifications` from the Owner shell.
2. New confirmed bookings, Player cancellations, payout status changes, earning credits/reversals and facility/court review decisions appear as in-app notifications.
3. Opening a notification re-checks ownership: a booking link opens the matching facility/date/booking detail; a payout/earning link opens the Owner wallet; a facility/court link opens the matching editor. Lost access or a deleted resource shows that the target is unavailable, not a different Owner resource.
4. In-app polling remains the delivery mechanism; no email/SMS/push or new infrastructure is added.

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
- **Facility/court onboarding requires Admin approval.** A Court Owner may submit a new facility or court, but it does not become bookable until an Admin approves it. This is an onboarding review, not a booking approval. The approved status vocabulary is `PENDING_APPROVAL | REJECTED | ACTIVE | SUSPENDED` (schema §3.5/§3.6/§5.15).
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
- **Maintenance slot lock.** A locked slot cannot be booked by Players while the lock is active. A lock may only be placed on a range that does not overlap an active booking (`CONFIRMED` or `PENDING_PAYMENT`); if it does, reject the lock. Eligible Player bookings must be cancelled first (with the refund/notification rules above); Tournament reservations require Organizer handling, and started bookings cannot be self-service cancelled. A lock may be placed from today through today + `MAINTENANCE_ADVANCE_WINDOW_DAYS` (default 90), independently of the Player booking window. Expired `PENDING_PAYMENT` holds do not block maintenance; `IN_PROGRESS` and tournament system bookings do.
- **Owner does not change operational status.** The Owner cannot change facility/court moderation status (`ACTIVE`/`SUSPENDED`); maintenance is handled solely through slot locks. Platform moderation stays with Admin (`docs/features/admin/court-management/prd.md`).
- **Player data visibility.** In schedule monitoring, the Owner sees the booking Player's contact details only for bookings on the Owner's own facilities. This access is restricted to the Owner's owned resources and must not be exposed beyond that scope.
- **Pricing and configuration changes apply to new entities only.** Snapshot semantics of `docs/business-rules-config-matrix.md` §8.1 apply; an existing booking keeps its established price and deadlines.
- **Real-time monitoring uses the confirmed transport.** Schedule refresh uses HTTP polling (5–10 seconds), not WebSocket/SSE (`docs/architecture/tech-stack.md`).

### 8.1 Review decisions approved on 2026-10-23

- **Post-approval edits:** name, description and contact details can be updated directly. Changing street address, ward, district, city or coordinates after onboarding approval creates an Admin review request; the approved location remains effective while the proposal is pending or rejected. Only one pending location proposal per facility is allowed. Operational status is unchanged by a location proposal.
- **Opening hours:** reject an hours change that would exclude any effective future or in-progress booking on a child court. No booking is automatically cancelled. Owner resolves affected bookings through existing eligible cancellation flows first; tournament reservations require Organizer handling.
- **Rejected onboarding:** Owner may edit the same rejected facility/court and explicitly resubmit it to `PENDING_APPROVAL`. Preserve each submission, reviewer outcome and mandatory rejection reason; expose these to the owning Owner. Do not create a duplicate facility/court. Pending submissions cannot be silently edited; edits require a completed review or a new explicit submission after rejection.
- **Parent eligibility:** new bookings require both facility and court to be `ACTIVE` and not deactivated, with valid pricing, opening hours and no conflicting occupancy. Suspension does not hide existing bookings from Owner or disable otherwise eligible incident handling.
- **Court edits:** Owner may edit court name/description, never its moderation status or facility assignment.
- **Pricing edits:** keep upsert; identify an existing interval by its immutable pricing identity. Changing its time range does not implicitly create another interval. Owner can end a price's validity; all writes enforce non-overlap and preserve booking snapshots.
- **Schedule:** lack of a booking does not imply bookability. Distinguish closed hours, missing pricing and inactive court/facility from genuinely free/bookable time; show the cause. An existing booking/block remains visible even when pricing or eligibility changes.
- **History/detail:** provide a paginated booking history and a detail view within ownership scope, including cancelled/expired/completed bookings, cancellation reason and current refund state (none, pending, refunded, failed). Read refund state from Payments; this is read-only visibility, not a refund administration module.
- **Tournament reservations:** show a system/tournament reservation distinctly. Owner cannot directly cancel it; explain that the Organizer must resolve it via Tournament. No Player refund is inferred for this non-payment reservation.
- **Incident after start:** Owner self-service cancellation remains unavailable at/after start. Explain the restriction and direct the Owner to the existing support channel. MVP does not offer partial refunds or an alternative override flow.
- **Maintenance:** independent 90-day default horizon; single interval per creation; release exactly one whole block by ID. No recurring, partial or bulk operation is introduced.
- **Access errors:** missing/non-owned resources are indistinguishable (404); authenticated wrong-role access is 403.
- **UI composition:** O05/O15 become one booking calendar with history access; O06 detail and O07/O16 cancellation/result are panels/modals within that workspace. Keep existing screen codes as design references, not requirements for separate routes. Escrow, facility rankings and numerical reputation remain excluded.

### 8.2 Figma alignment decisions — approved 2026-10-23

All twenty-four A choices in [frontend-figma-review.md](frontend-figma-review.md) are approved. The following govern the target Owner UI; the existing Figma canvas is a visual reference and has not yet been aligned.

- **Payment and cancellation (F01–F03):** use the approved payment capability (VNPAY); expose actual booking amounts/payment state, with cancellation separate from refund progress. Unpaid holds show no refund; paid cancellations may remain pending or fail. Do not promise instant receipt, fabricate banking/transaction details or expose provider-private fields. No wallet, escrow, payout, revenue settlement, voucher, email/SMS/Zalo/push workflow is added; Player cancellation notification remains in-app with the reason.
- **Setup and edits (F04–F09, F13):** creation sends the facility/court to Admin review. Show pending, rejected, reason, history and explicit resubmit. Separate direct metadata saves from location proposals; retain the approved location and reject hours that conflict with effective bookings. Owner cannot edit platform booking/cancellation limits or facility/court moderation state. Use only approved form fields and optional free-text description; no structured equipment/legal/certification catalog, image upload/gallery, Google Business or interactive map integration. Use explicit submit/save actions; no persisted drafts, server autosave or resumable setup wizard.
- **Pricing (F10–F12):** one selected court at a time; create or edit its hourly time/date intervals, ending validity when needed. No shared/tier/inherited/versioned price lists, bulk pricing, holiday/weekend surcharge engine, AI surge pricing or per-minute publication workflow. Display hourly currency, validity dates, overlap errors and unpriced gaps. Snapshot price at booking/hold creation, including unpaid holds; changing a price never re-prices existing holds/bookings.
- **Calendar and incidents (F07, F14–F18):** one single-day O05/O15 workspace with paginated history; O06 detail and O07/O16 cancellation/result are panels/modals. Distinguish FREE/BOOKED/BLOCKED/UNAVAILABLE and causes, using Vietnamese labels mapped to existing lifecycle values. Keep booked/blocked intervals visible after pricing/status changes. Maintenance is a separate single-range action with mandatory reason, default 90-day horizon, overlap feedback and whole-block release. Do not imply maintenance means a refund completed. Tournament system bookings show tournament context and Organizer guidance, with no Owner cancellation/payment action; after-start incidents show the limitation and a confirmed support path where available. No week/month calendar, export, printing/PDF, Owner-created/offline/multi-court/recurring booking, check-in/QR, chat, live score, smart gate or equipment automation is added.
- **Dashboard/account (F19–F21):** O01 provides owned facility/court access, calendar and approved operational actions only. No financial/occupancy analytics, projections, invented KPI, AI suggestions, facility rating, numerical reputation, BWF/diamond certification or automatic suspension threshold. O08 is read-only for existing account identity with links to supported Auth actions; no Owner profile editor, eKYC/legal verification, bank setup, MFA or Player-role switch. Only real Admin moderation outcomes are displayed.
- **Multi-facility, contact and errors (F22–F24):** provide a selector scoped to owned facilities, first-facility setup, empty states for missing courts/pricing/bookings, pending/rejected views, loading and retryable failures. Do not retain another facility’s data on selection changes. Allow full Player contact in owned booking detail (optionally masked until revealed), never across ownership boundaries or in logs. Use existing authentication/role/resource/business errors, not a fabricated permission tier. Only confirmed support contact details may be shown; omit sample hotline/email, unverified 24/7/SLA/technician assignments. If no contact is configured, show the cancellation restriction without inventing a support workflow.

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
- Maintenance blocks and submission/review history use the approved consolidated schema and the Tech Design delta. Schema/migration and cross-module implementation remain required before these capabilities are available.
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
- System configuration values owned by `docs/business-rules-config-matrix.md` §8.2 (`OWNER_CAN_CANCEL_BOOKING`, `OWNER_CANCELLATION_DEADLINE_MINUTES`, `MAINTENANCE_ADVANCE_WINDOW_DAYS`, `BOOKING_*`, `REFUND_*`) and system configuration management.
- Implementation of maintenance blocks and submission/review history, whose approved representation is recorded in the consolidated schema; facility/court status values already exist there.

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
| 10 | Future-dated maintenance locks. | Human owner | Originally booking window (7 days); superseded on 2026-10-23 by independent `MAINTENANCE_ADVANCE_WINDOW_DAYS` (default 90). | 2026-09-27; revised 2026-10-23 | RESOLVED |

### 14.1 Review approval — 2026-10-23

Human owner explicitly instructed updating documentation according to all fourteen recommendations from the Court Owner review. This approves the following product changes; shared-document/schema edits still require teammate PR review before merge.

| Review # | Approved choice | Result |
| --- | --- | --- |
| 1 | B | Direct simple edits; Admin reviews proposed post-approval location changes while the approved location stays live. |
| 2 | A | Reject opening-hour changes conflicting with effective bookings. |
| 3 | A | Edit/resubmit rejected resource in place; retain review history/reason. |
| 4 | A | Both facility and court must be active; existing booking operations remain accessible. |
| 5 | A | Add name/description court-edit API. |
| 6 | A | Pricing upsert uses explicit ID for updates and supports ending validity. |
| 7 | A | Unpriced/closed time is unavailable with an explicit cause. |
| 8 | A | Owner-scoped history/detail with current refund status. |
| 9 | A | Owner cannot directly cancel a tournament system reservation. |
| 10 | A | Keep pre-start-only cancellation; explain support path after start. |
| 11 | B | Independent maintenance horizon, default 90 days. |
| 12 | A | Unlock one whole block by ID. |
| 13 | A | Resource access 404; wrong role 403. |
| 14 | A | Synchronize stale docs, merge calendar screens, compose detail/result panels. |

### 14.1.1 Implementation decision — optional ward

On 2026-10-23 human owner selected A: facility ward is optional. Omission persists NULL, existing values remain, and Player/Admin/Owner display omits missing address components. No invented empty-string placeholder is required.

### 14.2 Figma review approval — 2026-10-23

Human owner explicitly confirmed “ok tiến hành chốt theo đề xuất” after the 24-question Figma review. All choices below are approved; options B are not selected. §8.2 is the product behavior, with technical/UI acceptance in Tech Design §9.8 and Tasks. Approval does not claim canvas/code implementation or teammate merge review is complete.

| Review | Choice | Approved decision |
| --- | --- | --- |
| F01 | A | Bỏ ví/escrow/quyết toán; hiển thị số tiền booking và trạng thái thanh toán/hoàn tiền thực tế. |
| F02 | A | Tách trạng thái đã hủy khỏi NONE/PENDING/REFUNDED/FAILED; chỉ báo hoàn thành khi Payments xác nhận, bỏ dữ liệu ngân hàng không thuộc DTO. |
| F03 | A | Giữ thông báo trong ứng dụng kèm lý do; bỏ các cam kết kênh ngoài và voucher. |
| F04 | A | Đổi CTA thành gửi Admin duyệt; thêm pending/rejected/reason/history/resubmit; chỉ cho đặt khi cả cơ sở và sân ACTIVE cùng các điều kiện khác. |
| F05 | A | Tách lưu metadata khỏi gửi đề xuất địa chỉ; hiển thị bản live/bản chờ và lịch sử; chặn đổi giờ xung đột; bỏ yêu cầu hợp đồng BWF khi đổi tên. |
| F06 | A | Hiển thị giá trị thật từ cấu hình/quyền thao tác server, không cho Owner ghi đè; tách rõ 7 ngày đặt sân và 90 ngày khóa bảo trì. |
| F07 | A | Bỏ toggle trạng thái; form khóa một sân/một khoảng với lý do; hủy booking và khóa là hai thao tác; mở toàn bộ một block theo ID, chỉ FREE khi mọi điều kiện cho phép. |
| F08 | A | Form có cấu trúc chỉ dùng các trường đã đặc tả; mô tả tự do cho thông tin bổ sung, bỏ chứng nhận/tính toán suy diễn. |
| F09 | A | MVP giữ địa chỉ/toạ độ theo hợp đồng; bỏ upload/gallery/Google Business, không gán AI bán kính ghép cặp cho tọa độ. |
| F10 | A | Chọn một sân rồi tạo/sửa các interval của sân đó; ID hiện hữu cho sửa; dùng ngày kết thúc để ngừng hiệu lực. |
| F11 | A | Bỏ engine phụ thu/hệ số/tier; dùng giá theo khoảng giờ và khoảng ngày không chồng lấn đã duyệt. |
| F12 | A | Viết rõ snapshot từ lúc tạo booking; hiệu lực theo validFrom/validTo, chỉ booking mới dùng giá mới; hiển thị lỗi overlap và thời gian chưa có giá. |
| F13 | A | Bỏ lưu nháp/autosave server; giữ form đơn giản và hành động gửi/lưu tường minh. |
| F14 | A | Một workspace lịch ngày; chi tiết/hủy/kết quả là panel/modal, có lịch sử mọi trạng thái; bỏ tuần/tháng/export khỏi MVP. |
| F15 | A | Nhãn tiếng Việt ánh xạ lifecycle chuẩn; FREE/BOOKED/BLOCKED/UNAVAILABLE và nguyên nhân; booking/block vẫn thấy sau đổi giá hoặc đình chỉ. |
| F16 | A | Thêm context Tournament không tiền/không action hủy, hướng dẫn Organizer; thêm các trạng thái đủ/không đủ điều kiện hủy và support sau start. Bỏ tỷ số live nếu không có contract. |
| F17 | A | Bỏ tạo booking Owner/booking nhiều sân/vé tháng; chỉ hiển thị booking hợp lệ từ luồng đã duyệt. |
| F18 | A | Bỏ CTA/cam kết này; giữ đọc chi tiết và hủy đủ điều kiện. |
| F19 | A | Dashboard tối giản: cơ sở/sân đang quản lý, lịch và tác vụ hiện có; bỏ analytics/AI/projection/export. |
| F20 | A | O08 chỉ đọc thông tin tài khoản hiện có và dẫn sang hành động Auth đã hỗ trợ; bỏ eKYC/bank/role switch, chưa thêm profile-edit riêng. |
| F21 | A | Bỏ sao/hạng/bảo chứng và ngưỡng tự đình chỉ; chỉ hiển thị trạng thái Admin duyệt/đình chỉ thật. |
| F22 | A | Bổ sung chọn cơ sở thuộc Owner, đường tạo cơ sở đầu tiên, empty/loading/error/retry và trạng thái chờ duyệt; không hiển thị KPI giả. |
| F23 | A | Cho xem số đầy đủ trong detail thuộc quyền (có thể che mặc định và bấm hiện); không log hoặc lộ ở tài nguyên khác Owner. |
| F24 | A | Phân biệt 401/403/404/lỗi nghiệp vụ theo contract, bỏ eKYC nâng quyền; chỉ dùng kênh hỗ trợ thực đã được xác nhận, bỏ số/email/SLA/đội kỹ thuật mẫu. |

No Open Questions remain for the approved documentation revision. Implementation and teammate PR review of shared-document/schema changes remain outstanding; this is not an implementation-completion claim.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.

2026-10-23 schedule clarification approved A: past time, beyond the Player advance window and globally disabled booking appear as unavailable with distinct causes. Keep existing booking/block visibility and the independent maintenance horizon.
