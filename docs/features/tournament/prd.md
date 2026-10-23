# Product Requirements Document (PRD)

## Status and Ownership

```text
Status: Ready
Owner: PM/Business Owner
Fulfills: PROJECT-BRIEF.md §3.3, §4, §5
Scope: Tournament Management
```

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle and ownership: `docs/documentation-guide.md`
- Applicable business rules/configuration: `docs/business-rules-config-matrix.md`

## Related Documents

- Parent or related PRD: N/A
- Tech Design: `docs/features/tournament/tech-design.md`
- Task or issue: `docs/features/tournament/tasks.md`

## 1. Problem

Players need a structured way to find, register for, and participate in badminton tournaments. Currently, there is no unified platform to manage tournament lifecycles, team formations, bracket generations, and match results. This matters because "Tournament" is one of the three core business areas identified in the MVP scope, providing competitive engagement for the user base.

## 2. Goals

- Players can discover, view details, and register for tournaments (both Singles and Doubles).
- Players can act as Tournament Organizers to create, configure, and manage their own tournaments.
- The Organizer controls seed order and triggers the draw; the system generates a single-elimination bracket with proper BYE placement and randomizes unseeded registrations (`PROJECT-BRIEF.md` §3.3).
- The system seamlessly tracks match outcomes and automatically advances winners through the tournament bracket.

## 3. Non-Goals

- Double elimination or round-robin formats (MVP supports `SINGLE_ELIMINATION` only).
- Split Bill functionality for tournament fees.
- Super Admin role for tournament management.
- Match rescheduling features.
- Automatic bracket modifications after a cancelled Tournament Match.
- Automatic Tournament Organizer replacement.
- Dedicated refund-management module.

## 4. Scope

### In Scope

- Tournament lifecycle management (`DRAFT` → `COMPLETED`).
- Singles and Doubles registration workflows, including Player withdrawal before close.
- Doubles Team formation and invitation management.
- Entry fee configuration and paid-registration payment/refund handling.
- Bracket generation (power of 2, BYE allocation) with Organizer-controlled seeding and an explicit draw action (`PROJECT-BRIEF.md` §3.3).
- Match scheduling (Court/time), match start, and match result recording with participant advancement.
- Organizer capabilities (configuration, cancellation before `IN_PROGRESS`).
- Admin override capabilities (cancellation).

### Out of Scope

- Alternative tournament formats.
- Team substitutes.
- Automated tournament court booking **with payment/refund**. Tournament matches reserve a Court through a system-created, non-payment booking so the Booking overlap rule protects the slot; no payment or refund is involved (`PROJECT-BRIEF.md` §3.3, `docs/features/booking/player-booking/tech-design.md`).
- System content management for tournament promotions.

## 5. Target Users and Roles

- Player: Can search, view, and register for tournaments. Can invite teammates for Doubles.
- Court Owner: N/A
- Admin: Can manage all tournaments and cancel them if necessary.
- Contextual permission: **Tournament Organizer** (A Player who creates a tournament has contextual management rights over that specific tournament).

## 6. User Journey

**Player (Participant) Journey:**
1. Player browses active tournaments on the platform.
2. Player selects a tournament and reviews the format, participant limit, and rules.
3. Player registers (as Singles, or creates a Doubles team and invites a partner).
4. System confirms the registration.
5. Player views the generated bracket and tracks match schedules and results.

**Player (Organizer) Journey:**
1. Player creates a new tournament (`DRAFT`).
2. Player sets tournament parameters (format, participant limit, registration window) and opens registration.
3. Players register during the open period.
4. Organizer closes registration.
5. Organizer sets the seed order for registrations (optionally using the system's skill-based suggestion), then triggers the draw; the system randomizes unseeded registrations and places BYEs (priority to high seeds).
6. Organizer updates match results as games conclude.
7. System automatically advances the winners.
8. Organizer concludes the tournament and final results are published.

## 7. Functional Requirements

- The user (Player) can search and view tournaments based on status.
- The user (Player) can register for a Singles tournament.
- The user (Player) can form a Doubles team and invite another Player to join.
- The user (Player) can create a Doubles Team, becoming its captain.
- The user (Player, captain) can invite exactly one other Player and cancel a pending invitation.
- The user (Player, invitee) can accept or decline a pending invitation.
- The system expires pending invitations after `TEAM_INVITATION_TIMEOUT_MINUTES` (24h default).
- The user (Player) can withdraw a registration before registration closes.
- The system can enforce participant limits (1 registration = 1 player for Singles, 1 registration = 1 team for Doubles) and registration periods.
- The user (Organizer) can create and edit a `DRAFT` tournament.
- The user (Organizer) can configure the entry fee and the tournament venue/location.
- The user (Organizer) can transition the tournament to `OPEN_FOR_REGISTRATION`.
- The user (Organizer) can transition the tournament to `REGISTRATION_CLOSED`.
- The user (Organizer) can view and adjust the seed order of registrations (using the skill-based suggestion as a starting point) before generating the bracket.
- The user (Organizer) can trigger the draw, which generates the bracket: seeded registrations are placed by seed, unseeded registrations are randomized, and BYEs are placed with priority to high seeds.
- The system can generate a single-elimination bracket with a size equal to the smallest power of 2 >= registrations, placing BYEs accordingly.
- The user (Organizer) can schedule tournament matches (Court and time) before they start.
- The user (Organizer) can start a tournament match; starting the first match moves the tournament to `IN_PROGRESS`.
- The user (Organizer) can record tournament match game scores.
- The user (Organizer) can update tournament match results.
- The system can automatically advance winners to the next match in the bracket.
- The user (Organizer) can cancel a tournament before it becomes `IN_PROGRESS`.
- The user (Admin) can cancel any tournament regardless of its state.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` (Sections 4 & 5)
- Feature rule: MVP strictly supports `SINGLE_ELIMINATION` format for `SINGLES` or `DOUBLES`.
- Feature rule: Organizer cannot self-cancel an `IN_PROGRESS` Tournament.
- Feature rule: Bracket size must be the smallest power of 2 >= number of registrations.
- Feature rule: The Organizer sets the seed order before the draw; if the Organizer does not seed, the system uses its skill-based suggestion. The draw randomizes all unseeded registrations. Seeding cannot change after the bracket is generated.
- Feature rule: BYE placement prioritizes high seeds, and high seeds are kept apart in early rounds.
- Feature rule: A Tournament requires >= 2 players (Singles) or >= 2 teams (Doubles) to proceed; otherwise, it is `CANCELLED`.
- Feature rule: A Player may belong to only one Doubles Team within the same Tournament.
- Feature rule: A Doubles Team has exactly 2 members before registration; the creator is the captain and must be a member; membership locks once the team is registered.
- Feature rule: An invitation is only valid while `PENDING`; `expires_at` is snapshotted from `TEAM_INVITATION_TIMEOUT_MINUTES` and later configuration changes do not alter it.
- Feature rule: Team creation and invitation actions are available only while the Tournament is `OPEN_FOR_REGISTRATION`; remaining `PENDING` invitations become `CANCELLED` when it closes.
- Feature rule: Winner advances based on the underlying Match result; the loser is eliminated.
- Feature rule: Cancelled Tournament Match does not result in automatic advancement.
- Feature rule: `entry_fee` is a non-negative amount; `0` means free; it is locked once any registration is `CONFIRMED`.
- Feature rule: A paid registration is `PENDING_PAYMENT` until the full fee is paid, then `CONFIRMED`; it becomes `EXPIRED` if not paid within `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES`.
- Feature rule: Withdrawing a paid `CONFIRMED` registration before registration closes triggers a 100% refund.
- Feature rule: A Tournament Match must have an assigned Court before it starts. Scheduling a match to a Court creates a system-created, non-payment booking that reserves the slot under the normal no-overlap rule; changing the Court or time after the match starts is out of MVP (match rescheduling).

## 9. UI/UX Behavior

- Entry points: Primary "Tournaments" navigation tab.
- Important states: 
  - `DRAFT` (configuration interface for Organizer).
  - `OPEN_FOR_REGISTRATION` (registration CTA visible).
  - Bracket View (visual representation of the tree structure).
- User feedback: Clear alerts for pending team invitations, confirmation of successful registration, and real-time updates on bracket progression.
- Content requirements: Easy-to-read tournament rules, clear display of format and participant limits.

## 10. Success Metrics

- Primary metric: Tournament completion rate, defined as the percentage of
  tournaments that start and reach `COMPLETED` successfully.
- Decision: Confirmed by PM/Business Owner on 2026-09-13.

## 11. Constraints

- Must rely on the existing system roles (`PLAYER`, `ADMIN`) without introducing a new persistent `ORGANIZER` role.
- Bracket generation logic must strictly adhere to the mathematical power of 2 constraints and predefined BYE allocations.

## 12. Risks

- Risk: Complex bracket generation edge cases if registrations are low or prime numbers.
- Mitigation: Strict validation ensuring bracket size is a power of 2, with predictable BYE injection.
- Risk: Doubles team invitation timeouts causing incomplete teams at registration close.
- Mitigation: Clear UI warnings about incomplete teams and automatic enforcement of the `TEAM_INVITATION_TIMEOUT_MINUTES` configuration.

## 13. Dependencies

- Player account system.
- Match resolution module (Tournament matches depend on the core match result entity).
- Team invitation mechanism.

## 14. Decision Log

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Exact seeding algorithm when insufficient ranking data is available | PM/Business Owner | Use skill ranking when sufficient information exists; randomize when information is insufficient; keep high seeds apart in early rounds; prioritize high seeds for BYE placement. | 2026-09-13 | RESOLVED |
| Who controls seeding and the draw (`PROJECT-BRIEF.md` §3.3 lists "Bốc thăm" and "Seed player"). | Human owner | The Organizer views and adjusts the seed order (system suggests by skill), then triggers the draw; the system randomizes unseeded registrations and places BYEs. Seed and bracket lock after generation. | 2026-10-04 | RESOLVED |
| How a Tournament Match reserves its Court. | Human owner | Special non-payment booking: scheduling a match creates a system booking that holds the slot under the normal no-overlap rule. No payment, refund, or Court Owner approval is involved. | 2026-10-04 | RESOLVED |
| Payment and fee handling mechanics for paid tournaments | PM/Business Owner | Organizer configures the entry fee. The Player must pay the full fee before registration is `CONFIRMED`. Split Bill is not supported. A tournament may be free when the fee is `0`. | 2026-09-13 | RESOLVED |
| Handling of entry fee refunds if a tournament is cancelled by Admin/Organizer | PM/Business Owner | Refund 100% of the paid entry fee for each paid registration. | 2026-09-13 | RESOLVED |
| Tournament entry fee field and editability | Human owner | Store `TOURNAMENTS.entry_fee` as a non-negative amount (`0` = free); editable in `DRAFT` and locked once any registration is `CONFIRMED`. | 2026-09-25 | RESOLVED |
| Payment record linkage for tournament registrations | Human owner | A payment references exactly one of `booking_id`/`registration_id`; `booking_id` becomes nullable and a CHECK enforces the exactly-one rule. | 2026-09-25 | RESOLVED |
| Registration payment timeout and snapshot | Human owner | Add `TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES` (default 10) and snapshot it into `TOURNAMENT_REGISTRATIONS.expires_at`. | 2026-09-25 | RESOLVED |
| Registration status values | Human owner | `PENDING_PAYMENT \| CONFIRMED \| CANCELLED \| EXPIRED`, with `EXPIRED` for payment timeout and `CANCELLED` for Player withdrawal. | 2026-09-25 | RESOLVED |
| Tournament venue storage | Human owner | Store an optional `facility_id` reference and/or a free-text `venue_note`. | 2026-09-25 | RESOLVED |
| Tournament match court assignment | Human owner | `MATCHES.court_id` may be unassigned until the Organizer schedules the match; it must be assigned before the match starts. | 2026-09-25 | RESOLVED |
| Refund when a Player withdraws a paid registration | Human owner | Full refund when the Player withdraws a paid `CONFIRMED` registration before registration closes. | 2026-09-25 | RESOLVED |
| Team and invitation window | Human owner | Team/invitation actions only during `OPEN_FOR_REGISTRATION`; `PENDING` invitations are `CANCELLED` when the Tournament stops accepting registrations. | 2026-09-25 | RESOLVED |

## Ratings integration alignment — approved 2026-10-15

Completed Tournament Matches are ratable only when actually played with valid standard result (`WINNER_DECLARED`) and `TOURNAMENT_RATING_ENABLED` permits it. `WALKOVER`, `UNRESOLVED` and `NONE` are not ratable. Preserve actual completed-match participants for Ratings. Rating eligibility does not depend solely on Tournament completion or populated participant rows.

Ratings RT-05 integrates the reusable ratings component into the real participant-facing Tournament Match Detail (P32), using the underlying Match ID for Ratings APIs, not the bracket-link ID. Keep Tournament and casual host routes separate; do not widen casual Matchmaking endpoints. Implement the Tournament host in its own feature scope; its absence is an explicit RT-05 dependency. Ratings owns error/response contracts and UI behavior: see Ratings PRD §15, Tech Design §9 and §23, tasks RT-05. These additions do not authorize implementing unrelated Tournament work as part of Ratings.

Court Owner integration approved 2026-10-23: system reservations remain visible to the owning court operator and block maintenance overlaps. Owner cannot directly cancel these bookings; the UI directs the Owner to the Organizer, who handles the linked match through the existing Tournament flow. No Player payment/refund is inferred. Booking creation must respect maintenance locks and both facility/court eligibility; no new automatic match rescheduling behavior is introduced.
