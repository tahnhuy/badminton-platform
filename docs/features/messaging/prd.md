# Product Requirements Document (PRD) - Messaging

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.4 (Messaging), §5 (Social và Messaging nâng cao), §6, §7 (Messaging)
Scope: One-to-one and post-group conversations, text/image/file messages, message reactions, online and typing indicators, history, unread counts, starting conversations, blocking, group membership sync with match-finding posts, history access, post-close grace period, Admin view of reported messages, loading/error/resend/connection states
```

This PRD is Ready, approved by the human owner in the final Phase 2 review on 2026-10-31. It records business behavior approved by the human owner in
Phase 1 (2026-10-31) and the clarifications answered on 2026-10-31 (Phase 2,
question batch 1). It does not approve API, schema, statuses or technology;
those belong to [tech-design.md](tech-design.md). Human readiness approval is recorded; implementation remains pending.

## Authoritative References

- Scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §3.4, §5, §6, §7
- Documentation lifecycle: `docs/documentation-guide.md` §5.2, §6.3
- Business rules: `docs/business-rules-config-matrix.md` §3.13 (Messaging), §3.14 (evidence retention), §7 (reports), §8.9 (configuration)
- Membership of post groups: [Matchmaking PRD](../matchmaking/matchmaking/prd.md) §15 (authoritative for who is a member)
- Access matrix: [Authentication & Authorization PRD](../platform/authentication-authorization/prd.md), "Social Matchmaking extension"

## Related Documents

- Parent or related PRD: [Social PRD](../social/prd.md); [Matchmaking PRD](../matchmaking/matchmaking/prd.md) §15; [Report Management PRD](../admin/report-management/prd.md) §15; [Notifications PRD](../platform/notifications/prd.md); [Player Profile PRD](../player/profile/prd.md) §15
- Tech Design: [tech-design.md](tech-design.md) (Ready)
- Task or issue: [tasks.md](tasks.md) (Ready)

## 1. Problem

- **Who is affected:** Players who need to ask about a post privately, and hosts and members who must coordinate a post (time, court, cost, changes).
- **What is difficult today:** Coordination moves to Zalo/Facebook, exposing phone numbers and splitting the conversation from the recruitment and its membership.
- **Why it matters in MVP:** Messaging is the "talk in the group" step of the main journey (`PROJECT-BRIEF.md` §6) and is in MVP (`PROJECT-BRIEF.md` §7).

## 2. Goals

- A Player can message another Player one-to-one from a profile or a post.
- The host and accepted members of a match-finding post share one group conversation that follows membership automatically.
- Players exchange text, images and files, react to messages and see unread counts.
- Players see near-real-time online and typing indicators within shared conversations.
- Blocking and per-sender limits protect Players from unwanted contact and spam.
- Admin can review a reported message without access to the rest of the conversation.
- Success metrics: `TBD — product metric needs decision` (measurement only).

## 3. Non-Goals

- Voice and video calls (`PROJECT-BRIEF.md` §5, §7).
- Group conversations that are not tied to a match-finding post; clubs and permanent communities (`PROJECT-BRIEF.md` §5).
- Court Owner and Admin taking part in conversations (`docs/business-rules-config-matrix.md` §3.13).
- Individual notification entries for new messages; unread counts only.
- A "hide online" setting.
- Host removal of an accepted member (no such action in MVP; decision 2026-10-31).
- Malware scanning of attachments.

## 4. Scope

### In Scope

- One-to-one conversations between two Players.
- One group conversation per match-finding post for the host and accepted members.
- Text messages, images and files; message reactions.
- Conversation list, history, new messages and unread counts.
- Online status and typing indicator, near-real-time.
- Starting a conversation; blocking and unblocking; the block list.
- Leaving and rejoining a group conversation.
- Grace period after the post or Match ends, then read-only.
- Reporting a message or its attachment; Admin view of the reported item only.
- Loading, error, resend and connection-lost states.
- Feature gate `MESSAGING_ENABLED`.

### Out of Scope

- All items in §3.
- Recruitment and membership decisions (Matchmaking).

## 5. Target Users and Roles

- **Player:** starts and uses one-to-one conversations; uses the group conversations of posts where they are host or accepted member; reacts; reports; blocks and unblocks.
- **Court Owner:** `N/A` — no messaging in MVP.
- **Admin:** no conversation access. Through moderation Admin sees only a reported message and its reported attachment.
- **Contextual permission:** conversation member (read/send); post host and accepted members (group conversation, as defined by Matchmaking).
- Companions without an account are never members.

No new system role is introduced.

## 6. User Journey

### 6.1 Start a one-to-one conversation

1. From another Player's profile or a post, a Player chooses "Nhắn tin".
2. If a conversation already exists between the two, it opens; otherwise a new one opens.
3. The Player sends the first message. Starting a conversation with a Player never messaged before counts toward the daily new-conversation limit; reopening an existing one does not.
4. If either Player has blocked the other, no message can be sent.

### 6.2 Group conversation of a post

1. The group conversation is created when the first member is accepted (through Apply or Invite), including before the post is published.
2. Each newly accepted member joins automatically and sees the full history.
3. A member who withdraws loses read and send access to the conversation, including its history and attachments.
4. The conversation continues when the post forms a Match.
5. When the Match completes, or the post is cancelled or expires, members may keep messaging for the grace period (default 24 hours). Then the conversation becomes read-only. Only Players with access at that event keep read access.
6. Closing recruitment (full or early close) does not start the grace period.

### 6.3 Leave and rejoin a group conversation

1. A member chooses to leave the group conversation.
2. Their post membership does not change. They stop receiving new messages, unread counts and presence through that group, and they can no longer read the history or download attachments through that group.
3. They may rejoin from the post or Match detail only while they still have the right to take part in the conversation. A valid rejoin restores access; rejoining does not restart or extend the grace period. A Player who has withdrawn from the post is never restored automatically.

### 6.4 Send, react and read

1. A Player writes text and/or attaches images or a file and sends.
2. The message shows as sending, then sent. On failure it shows as failed with a resend action; resending never produces a duplicate.
3. A Player reacts to a message with one of six types; changing or removing works as on posts.
4. Messages count as read only when they have actually been loaded and shown to the Player. Unread counts never include the Player's own messages.

### 6.5 Block and unblock

1. A Player blocks another Player from a profile or a one-to-one conversation.
2. Neither can send new one-to-one messages or new Apply/Invite to the other; pending requests between them close. The blocked Player is not notified.
3. One-to-one history remains readable. Neither Player is removed from any shared post or group conversation.
4. The Player can view their block list and unblock. Unblocking does not restore closed requests.

### 6.6 Report a message

1. A member who can read a message reports the message, or one specific image/file in it.
2. Admin sees only that message and the reported attachment in Report Management.

## 7. Functional Requirements

- A Player can open or start a one-to-one conversation with another Player unless either has blocked the other.
- Exactly one one-to-one conversation exists for a pair of Players.
- Exactly one group conversation exists per match-finding post, created when the first member is accepted, including before publishing.
- Group membership follows Matchmaking membership: host and accepted members only. Pending applicants/invitees and companions without an account have no access.
- A newly accepted member sees the full history.
- A Player who withdraws from the post loses read and send access, including history and attachments.
- A member can leave the group conversation without leaving the post, and rejoin while still entitled; neither action changes the grace period.
- Members may send messages until the grace period after the terminal event ends; afterwards the conversation is read-only for the Players who had access at the terminal event.
- A Player can send text together with either up to 4 images (JPEG/PNG/WebP, ≤ 5 MB each) or exactly 1 file (PDF/DOCX/XLSX/TXT, ≤ 10 MB). One message never combines images and a file.
- Messages cannot be edited, deleted or recalled in MVP.
- A Player cannot start a conversation with, or send to, an account that is locked or deleted. An active Player can still read their own history with that account; only the display data allowed for such accounts is shown.
- A message has trimmed text of at most 2,000 characters, or at least one attachment.
- A Player can set, change or remove one reaction per message among six types.
- The conversation list shows each conversation with its latest message and unread count; the history is paginated from newest to oldest.
- Online status is visible only to Players who share a conversation; typing is visible only inside that conversation. Leaving a group or a block removes presence through that relationship.
- Online and typing indicators are near-real-time and may lag by a few seconds.
- Sending is protected by per-sender limits; failures explain the limit.
- A failed send can be resent without creating a duplicate message.
- A member who can read a message can report it or one of its attachments.
- Admin can view only the reported message and its reported attachment.
- When `MESSAGING_ENABLED` is `false`, behavior follows §8.9.

## 8. Business Rules

- Source reference: `docs/business-rules-config-matrix.md` §3.13, §3.14, §7, §8.9.

### 8.1 Ownership boundary

| Concern | Owner |
| --- | --- |
| Conversations, messages, attachments, message reactions, read state, presence and typing, blocking, message limits | This PRD |
| Who is host or accepted member of a post; when membership starts and ends; post/Match terminal events | Matchmaking PRD §15 |
| Report records and Admin review | Report Management PRD |

Blocking is owned here and is also consulted by Matchmaking (Apply/Invite) and, where needed, by Social. Those modules consult Messaging's blocking rule; they do not redefine it.

### 8.2 Conversation types and access

- One-to-one: two Players. Court Owner and Admin never take part.
- Post group: host and accepted members of one match-finding post. Read/send permission follows conversation membership.
- Leaving a conversation never withdraws the Player from the post or Match.
- There is no host action to remove a member in MVP; membership ends only through the member's own withdrawal or the post's own lifecycle as defined by Matchmaking.

### 8.3 Group lifecycle

- Created at the first accepted member, including before publishing.
- New members see the full history.
- Withdrawal ends read and send access.
- Grace period `MESSAGING_GROUP_GRACE_PERIOD_MINUTES` (default 1440) starts when the Match completes or the post is cancelled or expires. Recruitment closing never starts it.
- After the grace period the conversation is read-only. Only Players with access at the terminal event keep read access.
- Leaving and rejoining (§6.3) never restart or extend the grace period.

### 8.4 One-to-one conversations

- Any Player may start one with another Player unless either has blocked the other.
- `MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY` (default 20) counts only the first conversation with a Player not messaged before, per sender per calendar day in `Asia/Ho_Chi_Minh`.
- `MESSAGING_MESSAGES_PER_MINUTE` (default 30) counts per sender across all conversations, sliding 60-second window.
- Resending a message that was already stored is not counted again.

### 8.5 Blocking

- Two-way: blocks new one-to-one messages and new Apply/Invite between the two Players, and closes pending requests between them.
- Does not remove either Player from an existing post or group conversation.
- The blocked Player is not notified.
- One-to-one history remains readable; no new message can be sent.
- Blocking removes presence through the one-to-one relationship.
- Blocking never grants additional visibility to any content.
- Unblocking does not restore closed requests.

### 8.6 Content and attachments

- Text is trimmed before validation; at most 2,000 characters; a message needs text or an attachment.
- A message has text and either images or one file, never both (approved 2026-10-31).
- Images: JPEG/PNG/WebP, at most 5 MB each and 4 per message.
- Files: PDF/DOCX/XLSX/TXT, at most 10 MB and 1 per message.
- Format checks confirm the declared type; they do not certify that a file is safe.
- Uploads are validated for type, size and permission and are never executed; no malware scanning in MVP.
- Attachments are available only to Players who can read the message.

### 8.7 Reactions, unread and notifications

- Six reaction types, as on posts; one reaction per Player per message.
- Unread counts exclude the Player's own messages and count only messages the Player has not yet been shown.
- New messages are reflected in unread counts only, never as individual notification entries.

### 8.8 Moderation and evidence

- Reportable: a message, optionally pointing to one specific image or file. Each report has exactly one target.
- Admin sees only the reported message and its reported attachment, never the whole conversation.
- At report time the reported message text and attachment references are kept as evidence. Evidence follows the retention rule in `docs/business-rules-config-matrix.md` §3.14 (at least 180 days after the report becomes `RESOLVED`; never deleted automatically in MVP).
- Messages are never edited, deleted, recalled or hidden in MVP. Admin only views reported content; there is no message-hiding action (approved 2026-10-31).

### 8.9 Feature gate (approved 2026-10-31)

| `MESSAGING_ENABLED = false` | Behavior |
| --- | --- |
| Blocked | Starting conversations, sending messages, message reactions, presence heartbeats and typing updates (no online/typing state is recorded or shown) |
| Still allowed | Reading conversation lists and history, downloading attachments the Player may read, marking messages as read, leaving and rejoining a group conversation (membership and access deadline are still checked; rejoining creates no conversation, does not extend the 24-hour period and does not enable sending, typing or presence), reports, blocking/unblocking |
| Internal sync continues | Group conversations are still created and their membership kept in sync with Matchmaking, so re-enabling never needs repair. Players cannot initiate new conversations. |

The combined behavior with other gates is defined once in the Matchmaking Tech Design.

## 9. UI/UX Behavior

- **Entry points:** "Nhắn tin" on a Player profile and on posts; group conversation entry from post detail and Match detail; a conversation list in the Player area with an overall unread indicator.
- **Conversation view:** members and online indicators (only for Players sharing the conversation), typing indicator, history with "load older", message composer with image/file attachment, reactions, report action, block action for one-to-one, leave action for groups.
- **Important states:**
  - Loading: list, history, older messages.
  - Empty: no conversations; no messages yet.
  - Sending, sent and failed (with resend). Draft text and selected attachments are kept after a failure.
  - Connection lost: an indicator while updates cannot be fetched; it recovers and refreshes on reconnection or when the page becomes visible again.
  - Read-only: after the grace period, with the reason shown and the composer disabled.
  - Blocked: one-to-one composer disabled with a neutral message; the blocked Player sees no block notice beyond being unable to send.
  - Left group: a rejoin action while still entitled.
  - Access lost: after withdrawal, the conversation and its attachments are no longer available.
  - Upload errors: per-attachment validation errors (type, size, count).
  - Rate-limited: a message explaining the limit and when sending is possible again.
  - Feature disabled: composer and new-conversation actions disabled with a neutral "temporarily unavailable" message; history stays readable; no online/typing indicators (§8.9).
  - Locked or deleted counterpart: composer disabled; history readable with the allowed display data only.
- **Presence wording:** indicators are near-real-time; the UI must not claim instant delivery.
- **Accessibility:** `N/A — no accessibility requirement is approved for this scope`; follow existing platform UI conventions.

## 10. Success Metrics

- `TBD — product metric needs decision`. Does not affect implementation.

## 11. Constraints

- System roles remain Player, Court Owner and Admin (`PROJECT-BRIEF.md` §2).
- Voice/video calls stay out of MVP (`PROJECT-BRIEF.md` §5).
- Membership is never decided here; it follows Matchmaking.
- Notifications are in-app; new messages never create notification entries.
- Real-time technology is not chosen in this PRD; any change to `docs/architecture/tech-stack.md` requires approval.

## 12. Risks

- Players expect instant delivery. Mitigation: near-real-time wording and visible sending/failed states.
- A withdrawn member keeps attachments through cached links. Mitigation: every attachment access re-checks permission (Tech Design).
- Spam through one-to-one conversations. Mitigation: per-sender limits and blocking.
- Evidence lost when content changes. Mitigation: snapshot at report time.

## 13. Dependencies

- Matchmaking membership and terminal events (Matchmaking PRD §15).
- Player profile entry points (Player Profile PRD §15).
- Report Management new targets (Report Management PRD §15).
- Configuration keys in `docs/business-rules-config-matrix.md` §8.9.

## 14. Open Questions / TBD / Needs Decision

No open business question. Final technical decisions approved on 2026-10-31 are tracked in [tech-design.md](tech-design.md) §21.

## Decision Log

| Decision | Source | Date |
| --- | --- | --- |
| Messaging scope, group lifecycle, one-to-one rules, blocking, attachments, presence, reactions, moderation, notifications | Phase 1 approval; `docs/business-rules-config-matrix.md` §3.13 | 2026-10-31 |
| No host removal of members in MVP | Human owner, Phase 2 batch 1 (B3) | 2026-10-31 |
| Leaving a group conversation keeps post membership, stops new messages/unread/presence through that group; rejoin only while entitled; grace period never restarts | Human owner, Phase 2 batch 1 (B4) | 2026-10-31 |
| Message text ≤ 2,000 characters, trimmed before empty check | Human owner, Phase 2 batch 1 (B5) | 2026-10-31 |
| Report snapshot keeps text and attachment references | Human owner, Phase 2 batch 1 (B6) | 2026-10-31 |
| Block list and unblock; unblocking does not restore closed requests; blocking grants no visibility | Human owner, Phase 2 batch 1 (B8) | 2026-10-31 |
| Read state advances only to messages actually loaded/shown; unread excludes own messages; resend never duplicates | Human owner, Phase 2 batch 1 (T7) | 2026-10-31 |
| Online/typing are near-real-time with visible delay | Human owner, Phase 2 batch 1 (T4) | 2026-10-31 |
| Feature-gate behavior: reads and mark-read allowed, internal group sync continues, no presence/typing | Human owner, Phase 2 batch 2 (Q4) | 2026-10-31 |
| Left-chat members have no history/attachment access until a valid rejoin; never restored after withdrawal; leave/rejoin allowed while disabled with full checks | Human owner, Phase 2 batch 3 | 2026-10-31 |
| No edit, delete, recall or Admin hiding of messages in MVP | Human owner, Phase 2 batch 2 (Q5) | 2026-10-31 |
| Text with up to 4 images or 1 file, never both | Human owner, Phase 2 batch 2 (Q6) | 2026-10-31 |
| No new conversation or message with locked/deleted accounts; own history stays readable with limited display data | Human owner, Phase 2 batch 2 (Q7) | 2026-10-31 |

## Output Rules

This PRD contains no database schema, API contract, framework, library or file-structure decision.
