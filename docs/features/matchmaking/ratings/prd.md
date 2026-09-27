# Product Requirements Document (PRD) - Player Ratings (Đánh giá người chơi sau trận)

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.1
Scope: Post-Match player ratings — a Player rates other participants of the same completed Match on skill and attitude, and the resulting data is recorded as input for skill adjustment
```

This PRD was approved as `Ready` by the human owner on 2026-09-27 after all Open Questions were resolved (see §14 Decision Log). It defines product behavior and business rules only. It does not define API contracts, database schema, or implementation structure.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md` §3.1 (Matchmaking — "Đánh giá đối thủ sau trận", rating trình độ and rating thái độ), §3.3 (Tournament), §4 (Admin), §5 (Out of MVP), §6 (MVP Focus)
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.2 (MVP domains), §5.2 (PRD ownership), §6.3 (status lifecycle)
- Applicable business rules and configuration: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §6 (Rating Rules), §7 (Report Rules), §8.1 (Configuration Semantics), §8.4 (Tournament Configuration)
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §2.6 (Rating), §3.13 (`MATCHES`), §3.14 (`MATCH_PLAYERS`), §3.23 (`PLAYER_RATINGS`), §5.3 (Rating integrity)
- Global technology fact referenced (not redefined): `docs/architecture/tech-stack.md` — Confirmed Decisions (Rating Scale: 1–5 integer scale for post-match player ratings)

## Related Documents

- Parent or related PRD: `N/A — this is the first Rating PRD`
- Tech Design: [tech-design.md](tech-design.md) (Ready)
- Task or issue: [tasks.md](tasks.md)
- Related feature documents:
  - [Matchmaking PRD](../matchmaking/prd.md) — defines the casual Match lifecycle that produces a ratable Match
  - [Tournament PRD](../../tournament/prd.md) — defines Tournament Matches; rating applies to completed Tournament Matches when enabled (§7, §8)
  - [Authentication & Authorization PRD](../../platform/authentication-authorization/prd.md) — Player identity and self-assessed skill level
  - [Report Management PRD](../../admin/report-management/prd.md) — separate abuse-reporting capability; ratings are not reports

## 1. Problem

- **Who is affected:** Players who have completed a Match and want to record how their teammates and opponents performed, both in skill and in attitude/sportsmanship.
- **What is difficult or unavailable today:** There is no structured, trustworthy way to capture post-match opinions about other Players. A Player's skill level is a static self-assessment (`docs/features/platform/authentication-authorization/prd.md` §7.1), and there is no feedback loop from actual play. Untrustworthy behavior (poor sportsmanship, over/under-stated skill) has no structured record.
- **Why it matters within MVP:** `PROJECT-BRIEF.md` §3.1 explicitly lists "Đánh giá đối thủ sau trận" (rating trình độ and rating thái độ) as part of Matchmaking, and states that the rating data is used as input for the system to adjust Player skill. Rating is therefore required for the Matchmaking domain to operate completely.

## 2. Goals

- A Player can rate other participants of the same completed Match on **skill** and **attitude**, without being able to rate themselves.
- Ratings are recorded as durable history for each Player.
- The recorded rating data is available as **input** to a future/system skill-adjustment mechanism (the adjustment algorithm itself is out of scope; see §3).
- The product rules that prevent invalid ratings (self-rating, rating non-participants, duplicate per-Match ratings) are enforced.
- Success Metrics: directional MVP metrics are defined in §10 (no numeric targets in MVP).

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- Court / Facility rating (Out of MVP; `PROJECT-BRIEF.md` §5, `docs/documentation-guide.md` §2.4).
- Any automated ELO/MMR or complex rank-calculation algorithm, and any automatic change of a Player's skill level, rank, or seeding as a consequence of ratings. Ratings are recorded as input only (`PROJECT-BRIEF.md` §3.1; `docs/business-rules-config-matrix.md` §1.2, §3.3).
- Editing or deleting a submitted rating, except where a specific rule is later approved. Submitted ratings are immutable in MVP (§8).
- Rating a Match that is not `COMPLETED`, or rating any Player who did not participate in the same Match.
- A standalone moderation system for ratings. Admin oversight visibility is in scope (§5, §7); punitive moderation (removal, suspension based on a rating) is not included and submitted ratings remain immutable.
- Abuse reporting and violation handling — those belong to the Report Management capability (`docs/business-rules-config-matrix.md` §7).
- Split Bill, Super Admin, Match rescheduling, and the other `PROJECT-BRIEF.md` §5 out-of-MVP items.

## 4. Scope

### In Scope

- Rating other participants of a Match after that Match reaches `COMPLETED`, for both casual (matchmaking) Matches and Tournament Matches. Tournament-related rating is gated by `TOURNAMENT_RATING_ENABLED`; casual matchmaking rating is always enabled.
- Capturing both a **skill** rating and an **attitude** rating for each rated Player (`PROJECT-BRIEF.md` §3.1). Both dimensions are required together.
- In `DOUBLES`, rating both teammates and opponents; in `SINGLES`, rating the single opponent.
- Enforcing at most one rating per (rater, rated player, Match); the same pair may rate each other again in a different Match.
- A rating may include an optional free-text comment.
- A Player viewing the ratings they have given and the aggregate of ratings they have received; rater identity is not disclosed to the rated Player.
- Admin read-only visibility of rating records for oversight; submitted ratings are immutable.

### Out of Scope

- All items in §3 Non-Goals.
- Rating before Match completion, rating a cancelled Match, and rating a Player outside the Match.
- Any representation detail of how the two dimensions are stored — that is a Tech Design concern (see §13).
- Notifications related to rating (no rating notification event is confirmed in MVP).
- Any change to the underlying skill-level catalog or the automatic use of rating data.

## 5. Target Users and Roles

- **Player:** rates other participants after a completed Match; views the ratings they gave and the aggregate ratings they received.
- **Court Owner:** `N/A` — no Court Owner behavior is involved in post-Match player ratings.
- **Admin:** can view rating history/records for oversight of abnormal ratings (`PROJECT-BRIEF.md` §4, §3.1). Admin does not play, does not rate, and cannot edit or delete submitted ratings in MVP.
- **Contextual permission:** `N/A — rating requires only the Player role and Match participation; no contextual permission is involved.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

### 6.1 Normal journey — rate participants after a Match

1. A Match reaches `COMPLETED` (the Match lifecycle is owned by the [Matchmaking PRD](../matchmaking/prd.md) for casual Matches and by the [Tournament PRD](../../tournament/prd.md) for Tournament Matches).
2. A Player who participated in that Match opens the completed Match from their match history and chooses to rate the other participants.
3. The system shows the other participants of that Match and, for each, presents a skill rating and an attitude rating input, plus an optional comment.
4. The Player submits a rating for one or more of the other participants. The Player cannot rate themselves, and only actual participants of that Match are offered.
5. The system records each rating for the (rater, rated player, Match) combination, including both dimensions.
6. The Player can view the ratings they submitted, and the aggregate of ratings they received; the identity of a rater is not shown to the rated Player.

### 6.2 Alternative journey — Doubles Match

1. A `DOUBLES` Match with four Players reaches `COMPLETED`.
2. A Player rates each of the three other participants, covering both teammates and opponents.
3. The same rules apply: no self-rating, and only participants of the same Match.

### 6.3 Alternative journey — invalid or duplicate rating attempt

1. A Player attempts to rate the same participant a second time in the same Match. The system rejects the duplicate; one rating per (rater, rated player, Match) is allowed.
2. A Player attempts to rate themselves. The system rejects the self-rating.
3. A Player attempts to rate a Player who did not participate in the Match, or attempts to rate before the Match is `COMPLETED`. The system rejects the attempt.
4. A Player attempts to rate in a Tournament Match while `TOURNAMENT_RATING_ENABLED` is `false`. The system does not offer rating for that Match.
5. The Player may instead rate that participant in a different, later completed Match in which both participated.

### 6.4 Optional journey — skip rating

1. A Match reaches `COMPLETED`.
2. A Player chooses not to rate any participant.
3. No rating is recorded and the Player experiences no penalty or enforcement in MVP.

### 6.5 Admin oversight

1. An Admin opens the rating records.
2. The Admin can view rating history/records to identify abnormal patterns.
3. Submitted ratings are immutable; the Admin cannot edit or delete them in MVP. Abuse cases are handled through Report Management.

## 7. Functional Requirements

- The system offers rating only for Matches in the `COMPLETED` state.
- A Player can rate another Player only when both Players participated in the same Match.
- A Player cannot rate themselves.
- In `DOUBLES`, a Player can rate teammates and opponents; in `SINGLES`, the Player can rate the opponent.
- For each rated Player, one rating captures both a **skill** rating and an **attitude** rating; both dimensions are required together.
- A rating uses a 1–5 integer scale for each dimension (`docs/business-rules-config-matrix.md` §6).
- A rating may include an optional free-text comment.
- A Player can rate multiple other participants in the same Match.
- A Player can submit at most one rating per (rater, rated player, Match).
- A Player may rate the same other Player again only in a different Match in which both participated.
- Submitting a rating is optional; a Player may skip rating without penalty.
- There is no rating deadline in MVP; a Player may rate any time after the Match is `COMPLETED`.
- Submitted ratings are immutable; they cannot be edited or deleted in MVP.
- The system records rating data as history for the rated Player.
- The rating data is available as input to the system's skill-adjustment mechanism; the system does not automatically change a Player's skill level, rank, or seeding in this scope.
- A Player can view the ratings they gave and the aggregate of ratings they received; the identity of individual raters is not disclosed to the rated Player.
- A Player's aggregate ratings may be shown on their public profile to authenticated Players (visibility rule per §8; see `docs/features/player/profile/prd.md` §14 #3).
- An Admin can view rating records for oversight, without edit or delete capability.
- Rating of Tournament Matches is available only when `TOURNAMENT_RATING_ENABLED` is `true`; casual matchmaking rating is always available. Rating availability is evaluated when the completed Match is viewed (no rating record is pre-created at Match completion).
- The system rejects self-ratings, ratings of non-participants, ratings outside the `COMPLETED` state, duplicate (rater, rated player, Match) ratings, and Tournament-Match ratings when `TOURNAMENT_RATING_ENABLED` is `false`.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §6 (Rating Rules), §8.4 (Tournament Configuration); `docs/architecture/database-schema.md` §2.6, §3.23, §5.3; `PROJECT-BRIEF.md` §3.1.
- A Player may rate another participant of the same Match.
- Self-rating is forbidden.
- A rater may rate multiple other Players in the same Match.
- In `DOUBLES`, a Player may rate teammates and opponents.
- The same rater → rated-player pair may be rated again in another Match.
- The same rater may rate the same Player at most once per Match.
- Both the rater and the rated Player must belong to the same Match.
- A rating is only meaningful once its Match is `COMPLETED`; the Match lifecycle is owned by Matchmaking (casual) and Tournament (tournament matches).
- Each rating expresses two required dimensions: skill and attitude/sportsmanship (`PROJECT-BRIEF.md` §3.1).
- The rating scale is a **1–5 integer scale**, applied to both dimensions (`docs/business-rules-config-matrix.md` §6; `docs/architecture/tech-stack.md` Confirmed Decisions).
- Rating is optional; no penalty, cooldown, or incentive is applied for skipping or for abnormal rating behavior in MVP.
- Submitted ratings are immutable: no edit or delete after submission, including by Admin; the Comment field is also immutable once submitted.
- Visibility of received ratings is **aggregate only**: a rated Player sees aggregate values/counts and not the identity of individual raters. A rater can see their own submitted ratings.
- A Player's aggregate skill/attitude ratings may also be shown on their **public Player profile** to authenticated Players, still without revealing individual rater identity (see `docs/features/player/profile/prd.md` §14 #3). The player profile may apply a minimum-ratings threshold before showing an average.
- Rating applies to completed casual (matchmaking) Matches and to completed Tournament Matches when `TOURNAMENT_RATING_ENABLED` is `true`; casual rating is always enabled. `TOURNAMENT_RATING_ENABLED` is evaluated at rating time and applies to new rating submissions only.
- Rating data is recorded as input for skill adjustment; automatic rank/ELO computation is out of scope (`PROJECT-BRIEF.md` §3.1; §3 of this PRD).

## 9. UI/UX Behavior

- Entry points: the Player's completed Match / match history, for both casual and Tournament Matches. A rating entry point is available from a Match that has reached `COMPLETED` (Tournament Matches only when `TOURNAMENT_RATING_ENABLED` is `true`).
- Important states:
  - Loading (loading the Match's participants and existing ratings).
  - Empty (no completed Match yet; no ratings received yet).
  - Available (a completed Match with ratable other participants).
  - Success (rating submitted; rating visible in the rater's history).
  - Error (attempt to self-rate, rate a non-participant, rate before completion, submit a duplicate rating, or rate a Tournament Match while disabled; the system explains why the rating is not allowed).
  - Already-rated (the rater has already rated a given participant for this Match; the input is unavailable or shown as already submitted).
  - Immutable (a submitted rating cannot be edited or deleted).
- User feedback:
  - Clear indication of which participants may be rated and which have already been rated.
  - Confirmation when a rating is submitted successfully.
  - A clear message when a rating is rejected, consistent with the reason (self-rating, not a participant, Match not completed, duplicate, tournament rating disabled).
  - Received ratings are shown only in aggregate; individual rater identity is never displayed.
  - No exposure of implementation errors or sensitive details.
- Content requirements: show the rated Player, the Match context (type, date), and both rating dimensions (skill and attitude), plus the optional comment input. A submitted rating is shown as read-only.
- Accessibility or content requirements: `N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.`

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP):
  - Rating participation rate: share of completed Matches that receive at least one rating.
  - Ratings given per completed Match versus the number of ratable participants.
  - Share of completed Matches where every participant rated every other participant.
  - Distribution of skill and attitude ratings.
- Numeric targets are `TBD — product metric target needs decision`; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve the three system roles; no new role is introduced (`PROJECT-BRIEF.md` §2).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including Court rating.
- Must not introduce ELO/MMR or any complex rank-calculation algorithm; ratings are recorded as input only (`PROJECT-BRIEF.md` §3.1; `docs/business-rules-config-matrix.md` §1.2, §3.3).
- Must preserve the Rating Rules in `docs/business-rules-config-matrix.md` §6 and the integrity rules in `docs/architecture/database-schema.md` §5.3; these are not redefined here.
- A rating depends on a `COMPLETED` Match; Match lifecycle and completion are owned by the Matchmaking module for casual Matches and the Tournament module for Tournament Matches.
- Config-driven behavior uses the existing configuration semantics (`docs/business-rules-config-matrix.md` §8.1). `TOURNAMENT_RATING_ENABLED` gates Tournament-Match rating only.
- Submitted ratings are immutable; no edit/delete capability is introduced for any role in MVP.
- Must not define API contracts, database fields, or implementation component structure in this PRD.

## 12. Risks

- Risk: Low rating participation, so the recorded data is too sparse to be useful as skill-adjustment input.
  Mitigation: keep the rating flow short and reachable from the completed Match; measure participation in §10.
- Risk: Retaliatory or reciprocal rating (a Player rates low because they expect to be rated low).
  Mitigation: received ratings are shown in aggregate only and rater identity is not disclosed (§8), which limits retaliation.
- Risk: Rating abuse or distorting patterns that misrepresent a Player's skill or attitude.
  Mitigation: Admin oversight visibility is in scope; ratings are immutable. Punitive action is handled through Report Management (`docs/business-rules-config-matrix.md` §7).
- Risk: Rating data is mistaken for an automatic skill change, but no adjustment algorithm exists in MVP.
  Mitigation: clearly present ratings as recorded feedback/input; automatic rank change is an explicit non-goal (§3).
- Risk: A Player uses ratings as a substitute for abuse reporting.
  Mitigation: keep Report Management separate and direct abuse cases there (`docs/business-rules-config-matrix.md` §7).
- Risk: Duplicate, self, or Tournament-disabled ratings are recorded because validation is only in the user interface.
  Mitigation: enforce the rules at business and data-integrity boundaries (a Tech Design concern); the product rules are fixed in §7 and §8.

## 13. Dependencies

- Player account and authentication (`docs/features/platform/authentication-authorization/prd.md`).
- Match lifecycle and completion, and Match participant data, including team assignment for `DOUBLES` ([Matchmaking PRD](../matchmaking/prd.md), [Tournament PRD](../../tournament/prd.md); `docs/architecture/database-schema.md` §3.13, §3.14).
- Skill-level catalog used as the shared skill reference (`docs/business-rules-config-matrix.md` §1.2).
- Rating rules and confirmed 1–5 rating scale (`docs/business-rules-config-matrix.md` §6; `docs/architecture/tech-stack.md`).
- `TOURNAMENT_RATING_ENABLED` configuration for Tournament-Match rating (`docs/business-rules-config-matrix.md` §8.4).
- Report Management capability for abuse cases (`docs/business-rules-config-matrix.md` §7).
- Technical design dependency: the Ratings Tech Design (Ready, Decision Status: Approved, §21 Decision Log) owns the approved representation of the skill and attitude dimensions. `PLAYER_RATINGS` currently models a single `rating` value (`docs/architecture/database-schema.md` §3.23); the approved delta is applied by the RT-01 migration together with the consolidated schema update.

## 14. Decision Log

All Open Questions were resolved by the human owner on 2026-09-27, and the PRD was marked `Ready`.

| Question or behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- |
| Exact rating scale (previously inconsistent across `tech-stack.md`, `business-rules-config-matrix.md` §6, `database-schema.md` §3.23/§9.6). | Human owner | 1–5 integer scale, applied to both dimensions. `business-rules-config-matrix.md` §6 and `database-schema.md` were reconciled to match `tech-stack.md`. | 2026-09-27 | RESOLVED |
| Which completed Matches are ratable. | Human owner | Both casual (matchmaking) and Tournament Matches; Tournament rating gated by `TOURNAMENT_RATING_ENABLED`; casual rating always enabled. | 2026-09-27 | RESOLVED |
| How the skill and attitude dimensions are submitted. | Human owner | Both dimensions are required and submitted together in one rating. | 2026-09-27 | RESOLVED |
| Allowed time window for submitting a rating after Match completion. | Human owner | No deadline in MVP; a Player may rate any time after the Match is `COMPLETED`. | 2026-09-27 | RESOLVED |
| Visibility model for received ratings. | Human owner | Aggregate only; rater identity is not disclosed to the rated Player. A rater can see their own submissions. | 2026-09-27 | RESOLVED |
| Whether rating is optional or mandatory. | Human owner | Optional; a Player may skip rating. | 2026-09-27 | RESOLVED |
| Whether a rating supports a free-text comment. | Human owner | Optional free-text comment per rating; immutable once submitted. | 2026-09-27 | RESOLVED |
| Admin capability on rating records. | Human owner | Read-only oversight; submitted ratings are immutable (no edit or delete). | 2026-09-27 | RESOLVED |
| Penalties or incentives for not rating or abnormal behavior. | Human owner | None in MVP; abnormal cases go through Admin oversight or Report Management. | 2026-09-27 | RESOLVED |

No Open Questions remain. The two-dimension storage representation is a Tech Design item (§13), not a product Open Question.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.
