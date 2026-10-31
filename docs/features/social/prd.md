# Product Requirements Document (PRD) - Social Feed

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.1 (Social Matchmaking), §5 (Social và Messaging nâng cao), §6, §7 (Social và Matchmaking)
Scope: Feed of free posts and match-finding posts, post images, reactions, comments, author edit/delete, visibility, reporting entry points, Admin hiding of posts/comments, anti-spam limits and Social notification events
```

This PRD is Ready, approved by the human owner in the final Phase 2 review on 2026-10-31. It records business behavior approved by the human owner in
Phase 1 (2026-10-31) and the clarifications answered on 2026-10-31 (Phase 2,
question batch 1). It does not approve API, schema, statuses or technology;
those belong to [tech-design.md](tech-design.md). Human readiness approval is recorded; implementation remains pending.

## Authoritative References

- Scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §3.1, §4, §5, §6, §7
- Documentation lifecycle: `docs/documentation-guide.md` §5.2, §6.3
- Business rules: `docs/business-rules-config-matrix.md` §3.12 (match-finding posts), §3.13 (blocking), §3.14 (Social feed), §7 (reports), §8.9 (configuration)
- Recruitment rules for match-finding posts: [Matchmaking PRD](../matchmaking/matchmaking/prd.md) §15 (authoritative; not repeated here)
- Access matrix: [Authentication & Authorization PRD](../platform/authentication-authorization/prd.md), "Social Matchmaking extension" (§7.8 access rows)

## Related Documents

- Parent or related PRD: [Matchmaking PRD](../matchmaking/matchmaking/prd.md) §15; [Messaging PRD](../messaging/prd.md); [Report Management PRD](../admin/report-management/prd.md) §15; [Notifications PRD](../platform/notifications/prd.md); [Player Profile PRD](../player/profile/prd.md) §15
- Tech Design: [tech-design.md](tech-design.md) (Ready)
- Task or issue: [tasks.md](tasks.md) (Ready)

## 1. Problem

- **Who is affected:** Players who look for partners or extra players on Facebook/Zalo groups, and hosts who recruit there.
- **What is difficult today:** Posts drift away, cannot be filtered by area, time, skill or open slots, and recruitment, discussion and booking happen in separate places (`PROJECT-BRIEF.md` §1).
- **Why it matters in MVP:** The feed is the entry point of the main journey "view profile / find a post → apply or receive an invitation → talk in the group → play → rate" (`PROJECT-BRIEF.md` §6).

## 2. Goals

- A Player can publish a free post to share or discuss with the badminton community.
- A Player can find match-finding posts on one feed and filter them by the match-finding criteria.
- Players can react to and comment on both post types without affecting recruitment.
- Authors control their own content; Admin can hide violating posts and comments without breaking recruitment that is already under way.
- Spam is limited by approved per-Player limits.
- Success metrics: `TBD — product metric needs decision` (measurement only; does not block implementation).

## 3. Non-Goals

- Friends, followers, share/repost and personalized feeds (`PROJECT-BRIEF.md` §5).
- Team vs Team clubs and permanent community groups (`PROJECT-BRIEF.md` §5).
- Nested comment replies and comment editing (`docs/business-rules-config-matrix.md` §3.14).
- Document files on posts (images only).
- Automatic moderation, malware scanning and editorial/system content (`PROJECT-BRIEF.md` §5 "System Content Management").
- Recruitment behavior (Apply/Invite, slots, membership, schedule conflicts, Match creation, court/booking): owned by the Matchmaking PRD §15.
- Messaging: owned by the [Messaging PRD](../messaging/prd.md).

## 4. Scope

### In Scope

- Free posts: text and up to 4 images.
- The content part of match-finding posts: description text and images, displayed together with the structured recruitment information owned by Matchmaking.
- Feed with filters, stable ordering and pagination.
- Post detail with reactions, comments, author information and the Matchmaking actions available to the viewer.
- Reactions (six types) on posts; flat comments.
- Author edit and delete; comment deletion by the comment author or the post author.
- Reporting posts and comments (handled by Report Management).
- Admin hiding of posts and comments.
- Free-post and comment rate limits.
- Notification to a post author when another Player comments.
- Feature gate `SOCIAL_FEED_ENABLED`.

### Out of Scope

- All items in §3.
- Admin review workflow of reports (Report Management PRD).

## 5. Target Users and Roles

- **Player:** reads the feed, publishes, edits and deletes own posts, reacts, comments, deletes own comments and comments on own posts, reports posts/comments.
- **Court Owner:** `N/A` — no access to the feed, posts or comments (Auth PRD §7.8 extension).
- **Admin:** no feed participation. Admin may hide posts and comments and sees reported content only through moderation (Report Management PRD §15).
- **Contextual permission:** post author (edit/delete own post, delete comments on own post); comment author (delete own comment); host of a match-finding post (Matchmaking PRD §15).
- Visitors (not signed in): no access.

No new system role is introduced.

## 6. User Journey

### 6.1 Publish a free post

1. A signed-in Player opens the feed and chooses to write a post.
2. The Player enters text and/or attaches up to 4 images, then publishes.
3. The post appears on the feed for signed-in Players, ordered by publication time.

### 6.2 Find a match-finding post

1. A Player opens the feed and applies filters (post type, match type, date, time range, area, skill, posts with open slots).
2. The Player opens a post, sees the structured recruitment information, the accepted members (name, avatar), the host profile entry point, reactions and comments.
3. The Player may comment to ask questions, react, or use the Matchmaking actions available to them (for example Apply). Commenting or reacting never applies or takes a slot.

### 6.3 React and comment

1. A Player selects one of the six reactions; selecting another type changes it; selecting the same type again removes it.
2. A Player writes a comment. Comments are flat and shown in time order.
3. The post author receives an in-app notification when another Player comments. Reactions do not notify.

### 6.4 Edit or delete

1. The author edits the text and images of a free post. The post shows that it was edited and keeps its feed position.
2. The author of a match-finding post edits it within the locks defined by Matchmaking PRD §15 (start time, post type and capacity are locked once a member is accepted).
3. The author deletes a free post: it disappears from the feed and from links.
4. The author deletes an active match-finding post: the Matchmaking cancellation flow runs first (including the host's choice to keep or cancel a linked booking), then the post is hidden.
5. A comment author or the post author deletes a comment.

### 6.5 Report and Admin hiding

1. A Player who can see a post or comment reports it (not their own content).
2. Admin reviews the report in Report Management and may hide the post or comment.
3. Hidden content disappears from the feed, post detail and links. Hiding a match-finding post does not cancel the post, the Match or the booking; existing members keep access to manage their participation through Matchmaking.

## 7. Functional Requirements

- A Player can publish a free post with text, images, or both; a post with neither is rejected.
- A Player can create a match-finding post whose content part (description, images) is owned by this PRD and whose recruitment part is owned by Matchmaking. A match-finding post and its recruitment information are always created together; one never exists without the other.
- The feed shows free posts and published match-finding posts that are neither deleted nor hidden.
- By default the feed hides match-finding posts that are cancelled, expired or whose start time has passed. Such a post remains viewable by link when it is not hidden by its author or Admin and the viewer has access.
- The feed supports filters: post type, match type (Đơn, Đôi, Giao lưu), date, time range, area, skill, and "has open slots". Recruitment-based filters apply to match-finding posts only.
- The feed order is publication time descending, then post identity descending as a tie-breaker. Editing never moves a post. The feed is paginated.
- An unpublished match-finding post never appears on the feed; who may see it is defined by Matchmaking PRD §15.
- A Player can set, change or remove one reaction per post.
- A Player can comment on a visible post, including a match-finding post that has ended, as long as the post is not hidden.
- A comment author or the post author can delete a comment. Comments cannot be edited.
- The author can edit a free post's text and images, and a match-finding post within Matchmaking locks. The post shows an "edited" indicator. Hidden posts cannot be edited.
- A Player can report a post or a comment they can see, but not their own.
- Admin can hide a post or comment. Hidden content is not reachable through the feed, post detail, links or comment lists.
- The system enforces the free-post and comment rate limits and explains the limit to the Player.
- The system notifies the post author when another Player comments on the post.
- When `SOCIAL_FEED_ENABLED` is `false`, Social behavior follows §8.10.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §3.12, §3.14, §7, §8.9.

### 8.1 Ownership boundary

| Concern | Owner |
| --- | --- |
| Post content (text, images), edit indicator, reactions, comments, feed query and filters, content visibility, author deletion of content, Admin hiding of posts/comments, free-post and comment limits | This PRD |
| Recruitment information, publishing, Apply/Invite, slots, membership, schedule conflicts, close/reopen, cancellation, Match, court and booking link, open-post limit | Matchmaking PRD §15 |
| Blocking, conversations | Messaging PRD |
| Report records and Admin review | Report Management PRD |
| Notification delivery | Notifications PRD |

A rule owned by another PRD is linked, not copied.

### 8.2 Post types

- **Free post:** never creates membership, a Match or a booking.
- **Match-finding post:** the Social content of a Matchmaking recruitment. Every match-finding post has exactly one recruitment, created together.
- A match-finding post has an optional title: trimmed, at most 120 characters. When it is empty, the card builds a title from the recruitment information (for example match type, date/time and area). Free posts have no title.

### 8.3 Visibility

- Feed, posts and comments: signed-in Players only (`docs/business-rules-config-matrix.md` §3.12).
- Accepted members (name, avatar) of a match-finding post: any Player. Applicant list and management data: host only (Matchmaking PRD §15).
- Blocking does not hide posts or comments and never grants additional visibility. Blocking effects are listed in the Messaging PRD.

### 8.4 Content limits (fixed rules, approved 2026-10-31)

- Text is trimmed before validation; text that is empty after trimming counts as empty.
- Post text: at most 2,000 characters. A free post requires non-empty text or at least one image.
- Match-finding title: optional, at most 120 characters (§8.2).
- Comment: 1–500 characters after trimming.
- Cost note of a match-finding post: at most 200 characters (field owned by Matchmaking; limit recorded here for display consistency).
- Images: JPEG/PNG/WebP, at most 5 MB each, at most 4 per post. No document files on posts. Uploads are validated for type, size and permission and are never executed; no malware scanning in MVP (`docs/business-rules-config-matrix.md` §3.14).

### 8.5 Reactions and comments

- Exactly six reaction types: 👍 ❤️ 😂 😮 😢 😡. One reaction per Player per post; it may be changed or removed.
- Comments are flat. Deletion is a soft hide so reports can still be handled.
- Reactions and comments never create membership or take a slot.
- Ended match-finding posts accept reactions and comments while they are not hidden.

### 8.6 Edit, delete and hide

- The author may edit a free post's text and images. Edits show an "edited" indicator; earlier versions are not shown to viewers. Editing does not change feed position.
- Match-finding post edits follow Matchmaking PRD §15 locks.
- Author deletion of a free post or comment is a soft hide.
- Author deletion of an active match-finding post first runs the Matchmaking cancellation flow, then hides the post.
- Admin hiding only hides content. It never cancels a post, Match or booking, and existing members keep authorized access to manage their participation.
- Hidden posts and comments are not reachable through normal posts; evidence access is limited to report handling.

### 8.7 Reports and evidence

- Reportable here: a post or a comment. Each report has exactly one target (`docs/business-rules-config-matrix.md` §7).
- A Player can report content they can see, except their own.
- At report time the system keeps a snapshot of the reported content: the text and the references to its images as they were at that moment. Later edits or deletion do not change the evidence.
- Evidence access is limited to report handling. Content linked to a report is kept at least 180 days after the report becomes `RESOLVED` (a minimum, not a deletion commitment). Hidden content is never permanently deleted automatically in MVP.

### 8.8 Anti-spam limits

- `SOCIAL_FREE_POSTS_PER_DAY` (default 10) per Player per calendar day in `Asia/Ho_Chi_Minh`.
- `SOCIAL_COMMENTS_PER_MINUTE` (default 10) per Player across the platform, sliding 60-second window.
- Deleting a post or comment does not restore quota. Retrying an action that already succeeded is not counted again.
- Match-finding posts are limited by `MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER` (Matchmaking), not by the free-post limit.

### 8.9 Notifications

- The post author is notified when another Player comments on the post.
- No notification for reactions.
- Recruitment notifications for match-finding posts are owned by Matchmaking PRD §15.3.
- A notification link never grants access; access is re-checked when opened.

### 8.10 Feature gates (approved 2026-10-31)

| Gate off | Blocked | Still allowed |
| --- | --- | --- |
| `SOCIAL_FEED_ENABLED = false` | New posts (free and match-finding), edits, comments, reactions | Reading the feed and posts; author deletion of free posts and comments; Admin hiding; reports. Completing existing recruitment is never blocked: accepting/approving pending Apply/Invite, withdrawal, cancellation (including author deletion of an active match-finding post through the cancellation flow) and scheduled processing continue. |
| `MATCHMAKING_ENABLED = false` | Creating match-finding posts, publishing, new Apply, new Invite | Responses to pending Invites, host decisions on pending Applies, Match formation, withdrawal, cancellation, court changes allowed by Matchmaking, scheduled processing, all reads |

The combined behavior when several gates are off is defined once, in the Matchmaking Tech Design, and applies to Social, Matchmaking and Messaging.

## 9. UI/UX Behavior

- **Entry points:** feed (Player area), composer for free posts, entry to create a match-finding post (Matchmaking form plus content), post detail, author profile entry point, report action on posts and comments.
- **Card content:** author name, avatar and skill level; publication time and "edited" indicator; text and images; reaction summary; comment count. Match-finding cards also show the title (entered or generated) and the structured recruitment information: match type label (Đơn, Đôi, Giao lưu), start time and duration, area and court (an external court is labelled as not verified by the platform), skill range, filled/total slots, cost note.
- **Important states:**
  - Loading: feed, next page, post detail, comments.
  - Empty: no posts; no results for the filters (with a reset-filters action); no comments.
  - Unavailable: post deleted, hidden or not accessible. One neutral "content unavailable" message that does not reveal whether the content was hidden by Admin or deleted.
  - Ended: match-finding post cancelled, expired or past its start, shown with its outcome; recruitment actions are disabled.
  - Error and retry: failed load; failed publish or comment, keeping the draft text.
  - Upload: per-image validation errors (type, size, count) before submission.
  - Rate-limited: a message explaining the limit and when the Player can try again.
  - Feature disabled: write actions are hidden or disabled with a neutral "temporarily unavailable" message; reading continues (§8.10).
- **User feedback:** confirmation before deleting a post; extra confirmation for deleting an active match-finding post (it cancels the recruitment and asks about the linked booking, per Matchmaking).
- **Accessibility:** `N/A — no accessibility requirement is approved for this scope`; follow existing platform UI conventions.

## 10. Success Metrics

- `TBD — product metric needs decision` (for example: posts published, comment rate, share of match-finding posts that reach full). Does not affect implementation.

## 11. Constraints

- System roles remain Player, Court Owner and Admin (`PROJECT-BRIEF.md` §2).
- Out-of-MVP items in `PROJECT-BRIEF.md` §5 stay out.
- Recruitment rules are not redefined here (Matchmaking PRD §15).
- Notifications are in-app (`docs/architecture/tech-stack.md`).
- This PRD defines no API, schema or technology.

## 12. Risks

- Spam or abusive content. Mitigation: per-Player limits, reporting and Admin hiding.
- Evidence lost through edits. Mitigation: snapshot at report time (§8.7).
- Admin hiding is mistaken for cancellation by members. Mitigation: hiding never changes recruitment; members keep their management access.
- Feed shows stale slot counts. Mitigation: post detail re-reads current state, and recruitment actions are validated by Matchmaking at the time of the action.

## 13. Dependencies

- Matchmaking recruitment (Matchmaking PRD §15).
- Player profile entry points (Player Profile PRD §15).
- Report Management new targets (Report Management PRD §15).
- In-app notifications (Notifications PRD).
- Configuration keys in `docs/business-rules-config-matrix.md` §8.9.

## 14. Open Questions / TBD / Needs Decision

No open business question. Final technical decisions approved on 2026-10-31 are tracked in [tech-design.md](tech-design.md) §21.

## Decision Log

| Decision | Source | Date |
| --- | --- | --- |
| Feed and content rules, reactions, comments, images, limits, hiding and evidence | Phase 1 approval; `docs/business-rules-config-matrix.md` §3.14 | 2026-10-31 |
| Text length limits; trim before empty check | Human owner, Phase 2 batch 1 (B5) | 2026-10-31 |
| Free-post editing with "edited" indicator; report snapshot keeps text and image references | Human owner, Phase 2 batch 1 (B6) | 2026-10-31 |
| Feed default excludes ended match-finding posts; link access only when not hidden and permitted; ended posts accept comments/reactions; time-range filter; order by publication time then identity, edits do not reorder | Human owner, Phase 2 batch 1 (B7) | 2026-10-31 |
| Blocking grants no additional visibility; unblocking does not restore closed requests | Human owner, Phase 2 batch 1 (B8) | 2026-10-31 |
| Social owns posts and interactions; Matchmaking owns recruitment; a match-finding post and its recruitment are created together | Human owner, Phase 2 batch 1 (T1) | 2026-10-31 |
| Admin hiding of posts/comments is owned by Social; Report Management links to it | Human owner, Phase 2 batch 1 (T8c) | 2026-10-31 |
| Optional match-finding title, trimmed, ≤ 120 characters; generated card title when empty | Human owner, Phase 2 batch 2 (Q2) | 2026-10-31 |
| Feature-gate behavior; disabling Social never blocks completing existing recruitment | Human owner, Phase 2 batch 2 (Q4) | 2026-10-31 |

## Output Rules

This PRD contains no database schema, API contract, framework, library or file-structure decision.
