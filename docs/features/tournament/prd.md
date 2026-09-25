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
- Tech Design: `docs/features/admin/tournament-management/tech-design.md`
- Task or issue: N/A - Task chưa được tạo

## 1. Problem

Players need a structured way to find, register for, and participate in badminton tournaments. Currently, there is no unified platform to manage tournament lifecycles, team formations, bracket generations, and match results. This matters because "Tournament" is one of the three core business areas identified in the MVP scope, providing competitive engagement for the user base.

## 2. Goals

- Players can discover, view details, and register for tournaments (both Singles and Doubles).
- Players can act as Tournament Organizers to create, configure, and manage their own tournaments.
- The system automatically generates single-elimination brackets with proper seeding and BYE placements.
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
- Singles and Doubles registration workflows.
- Doubles Team formation and invitation management.
- Bracket generation (power of 2, BYE allocation, basic seeding).
- Match result recording and participant advancement.
- Organizer capabilities (configuration, cancellation before `IN_PROGRESS`).
- Admin override capabilities (cancellation).

### Out of Scope

- Alternative tournament formats.
- Team substitutes.
- Automated tournament court booking.
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
5. Organizer triggers bracket generation (System handles BYEs and seeds automatically).
6. Organizer updates match results as games conclude.
7. System automatically advances the winners.
8. Organizer concludes the tournament and final results are published.

## 7. Functional Requirements

- The user (Player) can search and view tournaments based on status.
- The user (Player) can register for a Singles tournament.
- The user (Player) can form a Doubles team and invite another Player to join.
- The system can enforce participant limits (1 registration = 1 player for Singles, 1 registration = 1 team for Doubles) and registration periods.
- The user (Organizer) can create and edit a `DRAFT` tournament.
- The user (Organizer) can transition the tournament to `OPEN_FOR_REGISTRATION`.
- The user (Organizer) can transition the tournament to `REGISTRATION_CLOSED` and generate the bracket.
- The system can generate a single-elimination bracket with a size equal to the smallest power of 2 >= registrations, automatically placing BYEs.
- The user (Organizer) can update tournament match results.
- The system can automatically advance winners to the next match in the bracket.
- The user (Organizer) can cancel a tournament before it becomes `IN_PROGRESS`.
- The user (Admin) can cancel any tournament regardless of its state.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` (Sections 4 & 5)
- Feature rule: MVP strictly supports `SINGLE_ELIMINATION` format for `SINGLES` or `DOUBLES`.
- Feature rule: Organizer cannot self-cancel an `IN_PROGRESS` Tournament.
- Feature rule: Bracket size must be the smallest power of 2 >= number of registrations.
- Feature rule: A Tournament requires >= 2 players (Singles) or >= 2 teams (Doubles) to proceed; otherwise, it is `CANCELLED`.
- Feature rule: A Player may belong to only one Doubles Team within the same Tournament.
- Feature rule: Winner advances based on the underlying Match result; the loser is eliminated.
- Feature rule: Cancelled Tournament Match does not result in automatic advancement.

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
| Payment and fee handling mechanics for paid tournaments | PM/Business Owner | Organizer configures the entry fee. The Player must pay the full fee before registration is `CONFIRMED`. Split Bill is not supported. A tournament may be free when the fee is `0`. | 2026-09-13 | RESOLVED |
| Handling of entry fee refunds if a tournament is cancelled by Admin/Organizer | PM/Business Owner | Refund 100% of the paid entry fee for each paid registration. | 2026-09-13 | RESOLVED |
