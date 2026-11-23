# Product Requirements Document (PRD) - Player Profile (Hồ sơ và thông tin cá nhân người chơi)

## Ảnh hưởng từ giải đấu và trình độ — 2026-11-08

Theo [PROJECT-BRIEF.md](../../../../PROJECT-BRIEF.md), quyết định ngày 2026-11-08: chỉ giải chuyên nghiệp là cơ sở nâng trình; giải phong trào không tính rank và người tham gia không cần tài khoản. Thành tích giải chuyên nghiệp phải được lưu/hiển thị trên Social và trang cá nhân. Hình thức hiển thị, quyền công khai và xử lý kết quả sửa/hủy còn TBD; chưa có API/schema mới được duyệt. Các yêu cầu dùng rating để tự nâng trình được thay thế; lịch sử dữ liệu không bị xóa trong lần cập nhật tài liệu này.

---

## Status and Ownership

```text
Status: Ready
Owner: PM / Platform Team
Fulfills: PROJECT-BRIEF.md §3.1
Scope: Player personal profile management and Public Profile viewing — edit display information (name, avatar), view current skill level, aggregate ratings, and summary match statistics; view another Player's public profile during Matchmaking/Tournament discovery
Extension status: Social Matchmaking extension (PROJECT-BRIEF.md 2026-10-28/2026-10-31) — Ready (human-approved 2026-10-31); see §15
```

The human owner approved §15 as Ready on 2026-10-31 (and its corresponding Tech Design extension, schema §13.8, and Tasks in Phase 2 on 2026-10-31). It supersedes the identified earlier requirements at the business level; existing code still implements the previous scope until the tasks are executed.

This PRD was approved as `Ready` by the human owner on 2026-09-27 after all Open Questions in §14 were resolved (see §14 Decision Log). It defines product behavior and business rules only. It does not define API contracts, database schema, queries, or implementation structure.

## Authoritative References

- Project scope, roles, MVP boundaries, confirmed decisions: `PROJECT-BRIEF.md` §2 (System Roles), §3.1 (Matchmaking — "Xem hồ sơ"), §4 (Admin), §5 (Out of MVP), §6 (MVP Focus)
- Documentation lifecycle and ownership: `docs/documentation-guide.md` §2.1 (System Roles), §2.2 (MVP Domains), §5.2 (PRD ownership)
- Applicable business rules/config: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §6 (Rating Rules)
- Global schema facts referenced (not redefined): `docs/architecture/database-schema.md` §3.1 `USERS`, §3.2 `SKILL_LEVELS`, §3.3 `PLAYER_PROFILES`, §3.23 `PLAYER_RATINGS`
- Global technology facts referenced (not redefined): `docs/architecture/tech-stack.md` (local filesystem file storage for the `/uploads` directory)

## Related Documents

- Parent or related PRD:
  - [Authentication & Authorization PRD](../../platform/authentication-authorization/prd.md) — registration captures full name and initial skill level; its handoff assigns post-registration display/editing of full name and skill level to this PRD
  - [Player Ratings PRD](../../matchmaking/ratings/prd.md) — aggregate skill/attitude ratings and the aggregate-only visibility rule
  - [Matchmaking PRD](../../matchmaking/matchmaking/prd.md) — the "view profile" step during discovery
  - [Tournament PRD](../../tournament/prd.md) — participant viewing and profile access
  - [Admin User Management PRD](../../admin/user-management/prd.md) — Admin's detailed user view
- Tech Design: [tech-design.md](tech-design.md)
- Task list: [tasks.md](tasks.md)

## 1. Problem

- **Who is affected:** Players who want a trustworthy identity in the ecosystem, and Players who need to evaluate potential teammates/opponents before committing to a match.
- **What is difficult or unavailable today:** There is no way for a Player to maintain a display profile (name/avatar) after registration, to see their own skill level, aggregate ratings, and match summary in one place, or to inspect another Player's non-sensitive profile when deciding whether to play with them.
- **Why it matters within MVP:** `PROJECT-BRIEF.md` §3.1 lists "Xem hồ sơ" as part of Matchmaking, and the Authentication PRD explicitly defers post-registration profile display/editing to a Player Profile feature. A consistent, privacy-safe profile is needed for matchmaking and tournament participation.

## 2. Goals

- A Player can view and update their own display profile (display name, avatar).
- A Player can see their own current skill level, aggregate ratings, and summary match statistics in one place.
- A Player can view another Player's non-sensitive public profile (display name, avatar, skill level, aggregate ratings, matches played) to help decide whether to play together.
- Public profile information is privacy-safe: no credentials, session data, or sensitive contact information.
- Aggregate ratings are shown without revealing individual raters.

## 3. Non-Goals

The following are explicitly out of scope for this PRD and for the MVP:

- Social networking (friends, follower feeds, posts, direct messaging) — out of MVP. *(Superseded by the approved extension (§15): feed posts and messaging are in MVP per `PROJECT-BRIEF.md` §3.1/§3.4 but are owned by Matchmaking and the [Social](../../social/prd.md)/[Messaging](../../messaging/prd.md) PRDs (Ready), not this PRD. Friends/followers remain out of MVP.)*
- Arbitrary ELO/Rank changes outside platform rules; no self-service rank manipulation (`PROJECT-BRIEF.md` §5; this PRD does not define a rating algorithm).
- Court Owner profile management (owned by the Court Owner feature; `PLAYER_PROFILES` and `COURT_OWNER_PROFILES` are separate).
- Admin user management behavior (owned by `docs/features/admin/user-management/prd.md`); Admin's detailed view is referenced, not redefined.
- Authentication concerns: email/password, sign-in, sessions, password change (owned by the Authentication PRD).
- Editing account status, deleting accounts, or moderation actions.
- Match result/score recording (not owned here; casual match results are not recorded in MVP).
- Court rating / facility rating (`PROJECT-BRIEF.md` §5).

## 4. Scope

### In Scope

- A Player viewing their own profile: display name, avatar, skill level, aggregate ratings, and summary match statistics.
- A Player editing their own display name and avatar.
- A Player viewing another Player's **public** profile with non-sensitive fields only.
- Public profile access from Matchmaking/Tournament contexts ("Xem hồ sơ").
- Display of aggregate skill/attitude ratings and matches-played count on both own and public profiles.
- Privacy-safe rendering: no email, password, session, or sensitive contact information on any profile view.

### Out of Scope

- All items in §3 Non-Goals.
- Private messaging between Players. *(Remains outside this PRD; messaging is in MVP and owned by the [Messaging PRD](../../messaging/prd.md) (Ready). A profile may later offer an entry point — §15.)*
- Editing email, password, or account status from the profile.
- Defining the aggregate rating calculation (owned by the Ratings feature) or the skill-level catalog (owned by `docs/business-rules-config-matrix.md` §1.2).
- Uploading/hosting mechanics for avatars beyond the confirmed local file storage (`tech-stack.md`); the storage implementation is a Tech Design concern.

## 5. Target Users and Roles

- **Player:** manages their own profile (display name, avatar); views their own skill level, aggregate ratings, and summary statistics; views other Players' public profiles.
- **Court Owner:** `N/A` — Court Owner profiles are separate and out of scope; a Court Owner has no player-facing behavior in this PRD.
- **Admin:** views detailed player profile information for monitoring and support through Admin User Management (`docs/features/admin/user-management/prd.md`); this PRD does not add new Admin capability.
- **Contextual permission:** `N/A — this PRD is exercised through the PLAYER role; it does not involve Tournament Organizer.`

No new system role is introduced. The system roles remain Player, Court Owner, and Admin.

## 6. User Journey

### 6.1 Player views and edits their own profile

1. A signed-in Player opens "My Profile".
2. The system shows their display name, avatar, skill level, aggregate ratings, and summary match statistics.
3. The Player edits their display name and/or avatar and saves.
4. The system validates and saves the changes and shows the updated profile.

### 6.2 Player views another Player's public profile

1. From a Matchmaking result or a Tournament participant list, the Player opens another Player's public profile.
2. The system shows only non-sensitive fields: display name, avatar, skill level, aggregate ratings, and matches played.
3. The Player uses this information to decide whether to play together.

### 6.3 Alternative journey — invalid profile edit

1. The Player submits an invalid display name or an unsupported avatar.
2. The system rejects the change and explains what must be corrected; the previous profile remains.

### 6.4 Admin support view

1. An Admin uses User Management to view a Player's detailed information.
2. The Admin sees the profile detail available to Admin (`docs/features/admin/user-management/prd.md`); this PRD adds no new Admin path.

## 7. Functional Requirements

- The system can let a signed-in Player view their own profile: display name, avatar, skill level, aggregate ratings, and summary match statistics.
- The system can let a Player edit their display name and avatar.
- The system can validate an edited display name and avatar and reject invalid input.
- The system can display the Player's skill level from the shared catalog (`docs/business-rules-config-matrix.md` §1.2), which has seven levels (ranks 1–7; changed from six on 2026-11-15).
- The system can display aggregate skill and attitude ratings for a Player without revealing individual rater identities (`docs/features/matchmaking/ratings/prd.md`).
- The system can display summary match statistics (matches played and win/loss) for a Player.
- The system can let a Player view another Player's public profile with non-sensitive fields only; this requires an authenticated Player.
- The system can make the public profile reachable from Matchmaking and Tournament contexts.
- The system can ensure no email, password, session token, or sensitive contact information is returned on any profile view.
- The system can show an empty/first-time state when a Player has no avatar and/or no ratings yet, or has fewer than the minimum number of ratings to display an average.
- The system can restrict a public profile to active users only; suspended/deactivated/soft-deleted players do not expose a public profile.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §1.2 (Skill Level Catalog), §6 (Rating Rules); `PROJECT-BRIEF.md` §3.1; `docs/features/matchmaking/ratings/prd.md` §8.
- **Role scope.** Profile management is a `PLAYER` capability; Court Owner and Admin profile behaviors are separate (`PROJECT-BRIEF.md` §2; `docs/features/admin/user-management/prd.md`).
- **Public fields only.** A public profile exposes only non-sensitive fields: display name, avatar, skill level code/name, aggregate skill/attitude ratings, and matches played. It never exposes email, password material, session data, or sensitive contact information.
- **Aggregate ratings only.** Ratings on a profile are aggregate/average values; individual rater identity is never shown, consistent with the Ratings feature (`docs/features/matchmaking/ratings/prd.md` §8).
- **Skill level source.** A Player's skill level comes from the shared catalog in `docs/business-rules-config-matrix.md` §1.2 (seven levels, ranks 1–7, since 2026-11-15) and is initialized from the Player's self-assessment at registration (`docs/features/platform/authentication-authorization/prd.md`). *(Superseded by the approved extension (§15): initialized by the one-time registration skill survey.)*
- **Skill level is not self-editable.** A Player cannot change their skill level after registration through the profile; it is preserved according to platform rules. This PRD does not allow arbitrary rank/ELO self-manipulation (`PROJECT_BRIEF.md` §5; §3 Non-Goals). Any future skill adjustment is a system/platform rule, not a profile edit (Decision Log §14 #2).
- **Profile display fields.** The editable display fields are display name (`PLAYER_PROFILES.full_name`) and avatar (`PLAYER_PROFILES.avatar_url`); other identity fields (email, password, account status) are not editable here.
- **Display name rules.** The display name is not required to be unique; it is trimmed and must be between 2 and 50 characters (Decision Log §14 #8).
- **Cross-feature ratings visibility.** A Player's aggregate skill/attitude ratings are available on their public profile to authenticated Players, without individual rater identity. The 2026-10-15 review enforces active-target access and the three-rating threshold on the Ratings API itself for another-Player views, suppressing distributions as well as averages below threshold. Self/Admin retain full aggregate access; Profile still hides averages below three on its own views.
- **Minimum ratings threshold.** An average rating is displayed only when the Player has received at least three ratings in that dimension; below the threshold, the profile shows a "not enough data" state instead of a number (Decision Log §14 #9).
- **Match statistics source.** There is no dedicated player-statistics table; summary statistics are derived from existing match data. The profile label is “Trận hoàn tất”. Count completed casual matches and completed Tournament matches with valid results, plus resolved Tournament WALKOVERs; exclude BYEs and unresolved/cancelled matches without a WALKOVER result. A WALKOVER contributes one match and one win/loss to each actual participant, including the forfeiting side. See §14 decisions #11–#14; these extend the original decisions #4–#5.
- **Public profile access.** A public profile is viewable only by an authenticated Player; it is not exposed without authentication (Decision Log §14 #6).
- **Inactive players.** A suspended, deactivated, or soft-deleted player does not expose a public profile; the system responds as unavailable (Decision Log §14 #10).
- **Avatar storage and constraints.** Avatars use the confirmed local filesystem file storage (`tech-stack.md`); accepted types are JPEG, PNG, and WebP, with a maximum size of 2 MB (Decision Log §14 #7).
- **No new roles.** No social graph, no new role, and no multi-tier Admin in scope (`PROJECT-BRIEF.md` §5).

## 9. UI/UX Behavior

- Entry points: an Admin-independent Player "My Profile" area, and public profile links from Matchmaking results and Tournament participant lists.
- Important states:
  - Loading (loading own/public profile).
  - Empty/first-time (no avatar yet; no ratings yet).
  - Success (profile loaded or saved).
  - Error (save fails; invalid input).
  - Unavailable/Forbidden (no access to a non-visible profile).
- User feedback:
  - Clear confirmation after saving profile changes.
  - Clear indication when a field is invalid.
  - Aggregate ratings shown as averages with counts, only when at least the minimum number of ratings exists; no rater identity.
  - A clear "not enough ratings yet" indication below the minimum threshold.
  - No exposure of implementation errors or sensitive details.
- Content requirements: show display name, avatar (or placeholder), skill level name/description, aggregate skill/attitude ratings (or the not-enough-data state), matches played and win/loss, and the context-appropriate back navigation to the Matchmaking/Tournament view.
- Accessibility or content requirements: `N/A — no accessibility requirement is approved for this scope; follow existing platform UI conventions.`

### 9.1 Figma reference and implementation mapping

Approved clarification — 2026-10-19. The human owner approved the Figma adaptation and profile logic decisions below in this session; the original approval remains the basis for unchanged business rules. Figma remains unchanged. Implement the approved behavior using its layout, typography, colors, spacing, and shared UI patterns; apply the adaptations below in application code.

Design source: [Badminton SmashPro](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD).

| Reference | Use in implementation | Required adaptation |
| --- | --- | --- |
| [P04 — Profile & Dashboard](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-55160) | Profile identity/statistics card styling. | Show the approved profile fields. Booking, matchmaking, tournament, and notification dashboard sections remain owned by their respective features; this feature does not implement the entire dashboard. |
| [P44 — Edit Profile](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-66826) | Own-profile identity card, form, save/cancel controls. | Editable fields are display name and avatar only. Replace ELO with the current catalog value, read-only (six levels until 2026-11-15, seven since; shown as "x / 7" with a "tạm thời" label while the level is tentative). Avatar help text is JPEG/PNG/WebP, maximum 2 MB. |
| [P85 — New Player](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=6-20549) | Placeholder avatar and empty-data presentation within the same profile view. | Preserve the skill level selected at registration/currently assigned by the platform. Show zero match counts and insufficient-rating states; no second onboarding or skill survey. The survey confirmed on 2026-10-31 belongs to registration (Auth), not to the profile; this row is unchanged. |
| [P42 — Account Settings](https://www.figma.com/design/D9NrjgxLpE066BcE5Sk8HD?node-id=12-66326) | Navigation styling where applicable. | Account settings are not a Player Profile deliverable. Password changes belong to Auth. |
| Public player card/modal | Reuse profile card styling and the platform modal conventions. | No dedicated complete public-profile frame was identified in the review. Compose the required allow-listed fields and states from existing patterns; do not wait for a Figma edit. |

Do not implement the following Figma content under this feature:

- Nickname/handle, cover image, gender, birth date, city, club, bio, dominant hand, jersey/shoe size, playing style, or racket/string fields.
- ELO/MMR, regional rankings, numeric reputation/FairPlay/community scores, punctuality rates, skill radar charts, badges/certificates, or profile-completion percentages.
- Email/phone display, KYC/identity-verification badges, federation endorsements, cloud-encryption claims, 2FA/device settings, social-group links, or self-deactivation controls.
- FairPlay deductions, deposit incentives, or claims of improved matchmaking accuracy.

Both own and public profiles show separate skill and attitude averages with their respective counts; each average requires at least three ratings in that dimension. Individual rater identity is never shown. Replace the Figma win-rate metric with the approved matches-played and win/loss counts: the “Trận hoàn tất” count includes completed casual matches, completed Tournament matches with valid results, and resolved WALKOVERs; BYEs are excluded. Wins/losses cover valid Tournament results, including WALKOVERs, only. Explain this scope even when counts are zero; do not derive a win rate from all matches played.

Avatar changes are saved immediately through a separate control, with explicit success/failure feedback. The display-name form uses “Lưu tên” and “Hủy”; cancellation affects only unsaved name input and cannot undo a saved avatar. Skill description comes from the shared catalog and is omitted when absent. With no valid Tournament result, show “Chưa có kết quả giải đấu”; always explain that win/loss covers Tournament results only.

Required variants use the same visual language: loading; missing avatar; zero matches; insufficient ratings per dimension; load error with retry; unavailable public profile; invalid display name; rejected avatar type/size; saving/uploading; save/upload success and failure. Loading must not appear as an empty profile. A failed operation must not be presented as saved.

### 9.2 Frontend preview authorization — 2026-10-19

The human owner authorized completing the visual interface with sample data while backend dependencies remain blocked. A separate authenticated profile page is reachable from the top-right profile shortcut/account menu; the home page remains unchanged. This preview is labelled as sample data and supports local name/avatar interactions only; it does not update the real account. This is a delivery-stage UI exception, not a change to the approved live Profile business rules or field scope.

### 9.3 Identity-first delivery — approved 2026-10-19

The human owner approved switching `/profile` to real account data and saving display-name changes before remaining aggregate/upload dependencies are complete. Display the stored name, avatar (or placeholder), and current catalog skill level. Clearly distinguish unavailable ratings/statistics from zero data; do not show sample scores/counts. Existing avatars remain visible; subsequent PP-06 completion enables immediate validated avatar upload. Share saved identity changes with the header, and retain the existing home page. The identity-first step did not mark Ratings, Tournament integration or avatar upload complete; the subsequent delivery below completes name/avatar management.

### 9.4 Name/avatar and Matchmaking delivery — 2026-10-19

The human owner instructed completion of the remaining independent Profile tasks. Players can now change their avatar with immediate persistence, retain it when cancelling unsaved name edits, see updated identity in the header/public card, and open public profiles from Matchmaking candidates, group members, invitation counterparts and match participants. Failed/rejected upload preserves the existing image; uncertain network outcomes offer a reload check. Ratings/statistics continue to show unavailable until their owning integrations are ready. Tournament entry points remain a pending integration, not a completed capability.

## 10. Success Metrics

- Directional MVP metrics (no numeric targets are set for MVP):
  - Share of Players who complete a display name/avatar.
  - Profile views during Matchmaking/Tournament discovery.
  - Profile edit completion rate.
- Numeric targets are `TBD — product metric target needs decision`; this is a measurement target only and does not affect implementation.

## 11. Constraints

- Must preserve the three system roles; no new role is introduced (`PROJECT-BRIEF.md` §2).
- Must keep all `PROJECT-BRIEF.md` §5 out-of-MVP items out of scope, including social features and a dedicated analytics/BI system.
- Must expose only non-sensitive public fields and never credentials, session data, or sensitive contact information.
- Must keep ratings aggregate-only and never reveal individual raters (`docs/features/matchmaking/ratings/prd.md` §8). Public aggregate display is limited to authenticated Players.
- Must use the shared skill-level catalog and not invent a second skill model (`docs/business-rules-config-matrix.md` §1.2). The catalog has seven levels (since 2026-11-15).
- Must not allow a Player to self-edit their skill level.
- Must not define API contracts, database fields, queries, or implementation structure in this PRD.
- Must not duplicate Admin User Management behavior; the Admin view is referenced only.
- The cross-feature ratings visibility scope must be updated in the Ratings PRD/Tech Design in the same working session, and the statistics definitions must be implemented as decided in §14.

## 12. Risks

- Risk: A public profile leaks sensitive information.
  Mitigation: restrict the public field set and verify that no email/session/contact data is returned; a Tech Design must enforce output minimization.
- Risk: Aggregate ratings are misread as a definitive skill judgment.
  Mitigation: present them as averages with counts, apply the minimum-ratings threshold, and clearly label them as aggregate.
- Risk: The cross-feature ratings-visibility change is implemented inconsistently.
  Mitigation: update the Ratings PRD/Tech Design in the same session (Decision Log §14 #3); keep individual rater identity hidden.
- Risk: Match statistics are undefined because casual match results are not recorded in MVP.
  Mitigation: fixed scope (Decision Log §14 #4, #5): count `COMPLETED` matches and derive win/loss only where a valid result exists.
- Risk: A Player attempts to game their displayed skill level.
  Mitigation: skill level is not self-editable (Decision Log §14 #2).
- Risk: Avatar upload introduces unsafe file types or oversized data.
  Mitigation: accept only JPEG/PNG/WebP up to 2 MB (Decision Log §14 #7) and validate at the boundary.

## 13. Dependencies

- Player account and authentication (`docs/features/platform/authentication-authorization/prd.md`); registration already stores full name and initial skill level.
- Skill-level catalog (`docs/business-rules-config-matrix.md` §1.2).
- Aggregate ratings data and its visibility rules (`docs/features/matchmaking/ratings/prd.md`).
- Match/participant data for summary statistics (`docs/features/matchmaking/matchmaking/prd.md`, `docs/features/tournament/prd.md`; `docs/architecture/database-schema.md` §3.13, §3.14).
- File storage for avatars (local filesystem; `docs/architecture/tech-stack.md`).
- Admin User Management for the Admin support view (`docs/features/admin/user-management/prd.md`).
- A resolved cross-feature decision on aggregate-rating visibility (Decision Log §14 #3); the Ratings PRD/Tech Design is updated in the same working session.

## 14. Decision Log

All Open Questions were resolved by the human owner on 2026-09-27, and the PRD was marked `Ready`.

| # | Question or unresolved behavior | Authority/owner | Decision | Decided on | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | Skill-level catalog size (request said 1–7). | Human owner | Use the authoritative catalog: six levels, ranks 1–6 (`BEGINNER`, `WEAK`, `AVERAGE_MINUS`, `AVERAGE`, `AVERAGE_PLUS`, `GOOD`). No catalog change. *Superseded 2026-11-15: the catalog now has seven levels (`EXCELLENT` added as rank 7), matrix §1.2.* | 2026-09-27 | RESOLVED |
| 2 | Whether a Player may change skill level after registration. | Human owner | No; skill level is not self-editable by a Player and is preserved per platform rules. | 2026-09-27 | RESOLVED |
| 3 | Cross-feature aggregate-rating visibility on a public profile. | Human owner + Tech Lead | Allow a Player's aggregate skill/attitude ratings to be shown on their public profile to authenticated Players, with individual rater identity still hidden. The Ratings PRD/Tech Design must be updated in the same session. | 2026-09-27 | RESOLVED |
| 4 | Which matches count for "matches played". | Human owner | Originally completed casual/Tournament matches; extended by decision #11 to include resolved WALKOVERs and exclude BYEs. | 2026-09-27 | RESOLVED |
| 5 | Which summary match statistics are shown. | Human owner | Matches and Tournament win/loss; decision #11 specifies BYE exclusion and WALKOVER inclusion. | 2026-09-27 | RESOLVED |
| 6 | Public profile access scope. | Human owner | Authenticated Players only; no unauthenticated access. | 2026-09-27 | RESOLVED |
| 7 | Avatar constraints. | Human owner | JPEG/PNG/WebP, maximum 2 MB, stored on the confirmed local filesystem (`/uploads`). | 2026-09-27 | RESOLVED |
| 8 | Display name validation rules. | Human owner | Not required to be unique; trimmed, 2–50 characters. | 2026-09-27 | RESOLVED |
| 9 | Minimum ratings threshold before showing an average. | Human owner | Show the average only when at least three ratings exist in that dimension; otherwise show a "not enough data" state. | 2026-09-27 | RESOLVED |
| 10 | Public profile of suspended/deactivated/soft-deleted Players. | Human owner | Do not expose a public profile for inactive players; respond as unavailable. | 2026-09-27 | RESOLVED |
| 11 | BYE and WALKOVER statistics. | Human owner | Exclude BYEs from matches/wins/losses. Include a resolved WALKOVER in both match count and official Tournament win/loss for each actual participant; no attendance inference is made. Use the label “Trận hoàn tất”. | 2026-10-19 | RESOLVED |
| 12 | Meaning of result availability. | Human owner | Results are available when at least one valid Tournament win/loss exists, including WALKOVER. No results is an empty-data state; a failed query is an error. Never imply complete result coverage for casual matches. | 2026-10-19 | RESOLVED |
| 13 | Skill description display. | Human owner | Retain shared-catalog descriptions; show a description when present and omit its text when absent. | 2026-10-19 | RESOLVED |
| 14 | Avatar save/cancel behavior. | Human owner | Save avatars immediately and independently; save/cancel buttons belong to the display-name form. Report each operation accurately. | 2026-10-19 | RESOLVED |

No Open Questions remain. The aggregate-rating query implementation, the derived match-statistics queries, and the avatar upload mechanics are Tech Design items.

## Output Rules

This PRD does not contain database schema, SQL, migrations, indexes, or field definitions; API endpoints, request/response payloads, status-code contracts, or API versioning; framework, library, provider, infrastructure, or file-structure decisions; or controllers, services, repositories, component designs, or implementation code.

## Ratings review alignment — approved 2026-10-15

Status remains Ready. Public aggregate restrictions are enforced server-side, not only by Profile presentation: another Player's target must be active/not soft-deleted; below three ratings expose count and not-enough-data state without averages/distributions. Own Profile continues to hide averages below three, even though self aggregate API access is fuller. Reuse Ratings policy/query; see Ratings PRD §15 and Tech Design §9.3/§23. No manual skill editing is introduced.

## Optional Player phone — approved implementation extension, 2026-10-23

Human owner selected B at the Court Owner contact decision gate: add optional Player phone with collection/editing UI and show it in owned booking details. Store it privately on PLAYER_PROFILES; existing Players retain NULL. Player may provide it during registration or add/change/clear it in their own contact settings. No uniqueness, SMS/OTP verification, identity assertion or phone sign-in is introduced. Public player cards and aggregate/profile summaries never disclose it. Owner access is limited to their own booking schedule/detail; never reuse a facility/Owner number when absent. Show “Chưa cung cấp số điện thoại” for NULL, with the existing email contact available in that authorized context.

This approved phone edit extends the earlier name/avatar-only edit scope; all other excluded profile fields remain excluded. Implement contact as a narrow independent slice so full profile/rating/statistics/avatar implementation is not implied complete.

## 15. Social Matchmaking extension — Ready (human-approved 2026-10-31)

Fulfills: `PROJECT-BRIEF.md` §3.1 (hồ sơ cầu lông, trình độ hai giai đoạn). Ready — business scope and Phase 2 technical design ([tech-design.md](tech-design.md)) approved by the human owner on 2026-10-31; implementation is pending.

Confirmed on 2026-10-31:

- The initial skill level comes from a one-time survey inside registration (Auth PRD, “Social Matchmaking extension”). The profile still shows the level read-only; no retake and no self-editing. *Updated 2026-11-15:* the level is one of seven catalog levels and is tentative until an official promotion through professional tournaments; ratings no longer change the level; existing accounts are sample data and are recreated.
- Approved consequence: under the existing statistics rule, a completed casual group Match counts in "Trận hoàn tất" for its participants; companions without an account are not participants and have no profile statistics.

- The badminton profile adds three Player-editable fields: activity area, play style and a short bio. Public visibility uses a fixed allow-list (no per-field privacy settings in MVP). Email and phone are never public by default. Affected by this approval: §2, §4, §6, §7, §8 "Public fields only"/"Profile display fields", §9.1 exclusion list (area, playing style, bio) and `docs/architecture/frontend.md` §9.4.
- Profile entry points will also be needed from feed posts, applicants, members and conversations (exact screens pending UI specification).

- Field details approved 2026-10-31: activity area uses the existing shared address catalog (no profile-specific catalog); play style is one of Tấn công / Phòng thủ / Toàn diện / Kiểm soát lưới; bio is at most 300 characters. All three are optional and the Player may clear them.

§15 supersedes conflicting business exclusions in §8 and §9.1. The earlier scope remains an implementation baseline only, not the target specification.
