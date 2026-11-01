# Product Requirements Document (PRD) - Messaging

## Status and Ownership

```text
Status: Ready
Owner: PM
Fulfills: PROJECT-BRIEF.md §3.4 (Messaging), §5 (Social và Messaging nâng cao), §6, §7 (Messaging)
Scope: Standalone one-to-one and Player-created group conversations (with Group Owner management: rename, lock/unlock sending, add/remove members, dissolve), real-time text/image/file messages, quoted replies, sender message edit, message recall (sender and Group Owner), per-viewer message hide, message reactions, online and typing indicators, history, unread counts, Global Chat Dock (draggable floating bubble + compact 380×540px chat window across all Player pages) and full /messages workspace, blocking, Admin view of reported messages, loading/error/resend/connection states
```

This PRD is Ready, approved by the human owner in the final Phase 2 review on 2026-10-31. It records business behavior approved by the human owner in
Phase 1 (2026-10-31) and the clarifications answered on 2026-10-31 (Phase 2,
question batch 1). It does not approve API, schema, statuses or technology;
those belong to [tech-design.md](tech-design.md). Human readiness approval is recorded; implementation remains pending.

## Authoritative References

- Scope, roles, MVP boundaries: `PROJECT-BRIEF.md` §2, §3.4, §5, §6, §7
- Documentation lifecycle: `docs/documentation-guide.md` §5.2, §6.3
- Business rules: `docs/business-rules-config-matrix.md` §3.13 (Messaging), §3.14 (evidence retention), §7 (reports), §8.9 (configuration)
- Standalone group conversations: any Player can create a group conversation (`title` + initial `memberIds[]`), add members, or leave; Social/Matchmaking UI may optionally call the group-creation API (`POST /api/v1/conversations/group`) as a convenience button without coupling group lifecycle to post/Match states (updated 2026-11-01)
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
- Players can create and manage standalone group conversations (for example with badminton partners or a match group) that remain active long-term across sessions.
- Players exchange text, images and files, react to messages and see unread counts.
- Players see near-real-time online and typing indicators within shared conversations.
- Blocking and per-sender limits protect Players from unwanted contact and spam.
- Admin can review a reported message without access to the rest of the conversation.
- Success metrics: `TBD — product metric needs decision` (measurement only).

## 3. Non-Goals

- Voice and video calls (`PROJECT-BRIEF.md` §5, §7).
- Complex club/tournament organization portals (`PROJECT-BRIEF.md` §5); standalone Player group chat IS in scope.
- Court Owner and Admin taking part in conversations (`docs/business-rules-config-matrix.md` §3.13).
- Individual notification entries for new messages; unread counts only.
- A "hide online" setting.
- Removing a member from a Matchmaking post/Match via chat (removing a member from a group chat only affects that group chat).
- Malware scanning of attachments.

## 4. Scope

### In Scope

- One-to-one conversations between two Players.
- Standalone group conversations created by any Player (`title` and initial `memberIds[]`), where the creator is the **Group Owner (`created_by`)** with permissions to rename the group, lock/unlock sending, add/remove members, recall group messages, and dissolve the group; non-owner active members may voluntarily leave.
- Text messages, quoted replies (`parent_id`), sender text editing (`edited_at`), message recall (`deleted_at`), per-viewer message hide (`message_hides`), images and files; message reactions.
- Global Chat Dock mounted across all Player pages (draggable right-edge bubble persisted in `localStorage` + compact `380×540px` floating chat window) paired with the full-page `/messages` workspace.
- Conversation list, history, new messages and unread counts.
- Real-time message/reaction delivery, online status and typing indicator via WebSocket (with REST gap-recovery on reconnect).
- Starting a conversation; blocking and unblocking; the block list.
- Leaving and rejoining a group conversation.
- Long-lived group conversations (no automatic 24-hour read-only lock).
- Reporting a message or its attachment; Admin view of the reported item only.
- Loading, error, resend and connection-lost states.
- Feature gate `MESSAGING_ENABLED`.

### Out of Scope

- All items in §3.
- Recruitment and membership decisions (Matchmaking).

## 5. Target Users and Roles

- **Player:** starts and uses one-to-one conversations; creates and uses standalone group conversations; reacts; reports; blocks and unblocks.
- **Court Owner:** `N/A` — no messaging in MVP.
- **Admin:** no conversation access. Through moderation Admin sees only a reported message and its reported attachment.
- **Contextual permission:** active conversation member (`state = 'ACTIVE'`) and **Group Owner (`created_by`)** for group administration (rename, lock/unlock sending, add/remove members, recall any message in the group, dissolve group).
- Companions without an account are never members.

No new system role is introduced.

## 6. User Journey

### 6.1 Start a one-to-one conversation

1. From another Player's profile or a post, a Player chooses "Nhắn tin".
2. If a conversation already exists between the two, it opens; otherwise a new one opens.
3. The Player sends the first message. Starting a conversation with a Player never messaged before counts toward the daily new-conversation limit; reopening an existing one does not.
4. If either Player has blocked the other, no message can be sent.

### 6.2 Create and manage a group conversation (updated 2026-11-01)

1. Any Player can create a group conversation by supplying a group title and selecting at least one other non-blocked Player (so the group starts with at least 2 active members, up to `MESSAGING_GROUP_MAX_MEMBERS`). The creator becomes the **Group Owner (`created_by`)**. Social/Matchmaking screens may also invoke this same group-creation API (`POST /api/v1/conversations/group`).
2. The **Group Owner** can rename the group, lock/unlock sending (`is_locked` — when locked, only the Group Owner can send new messages), add or reactivate (`LEFT → ACTIVE`) non-blocked Players, remove a member (`ACTIVE → LEFT`), recall any message in the group, or dissolve the group (`status = 'DISSOLVED'`).
3. Group conversations are completely independent of Matchmaking status transitions and remain active long-term until dissolved by the Group Owner.




### 6.3 Leave, remove, rejoin, and dissolve a group conversation (updated 2026-11-01)

1. A non-owner member chooses to leave the group conversation (`LEFT`), or the Group Owner removes a member (`LEFT`). The Group Owner cannot leave without dissolving the group.
2. A `LEFT` member stops receiving new messages, unread counts and presence through that group, and can no longer read the history or download attachments through that group.
3. A `LEFT` member can be re-added (`LEFT → ACTIVE`) by the Group Owner.
4. When the Group Owner dissolves the group (`DISSOLVED`), the group disappears immediately in real time for all members and the owner, while database records and media files are retained as report evidence.

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
- Any Player can create a group conversation with a non-empty title (`1–120` chars) and non-blocked Player members (`2` to `MESSAGING_GROUP_MAX_MEMBERS` total members including the creator).
- Group membership is managed directly in Messaging (`ACTIVE` or `LEFT`); it is completely decoupled from Matchmaking.
- A newly added member sees the full conversation history.
- A member who leaves the group (`LEFT`) stops receiving new messages/unread counts and can be re-added by any current `ACTIVE` member.
- Active members may send messages at any time (no automatic 24-hour read-only lock).

- A Player can send text together with either up to 4 images (JPEG/PNG/WebP, ≤ 5 MB each) or exactly 1 file (PDF/DOCX/XLSX/TXT, ≤ 10 MB). One message never combines images and a file.
- A Player can quote-reply (`parent_id`) to any non-recalled message in the same conversation, edit the text of their own non-recalled message (`edited_at`), recall their own message (`deleted_at`; Group Owner may also recall any message in their group), or hide any message from their own view (`message_hides`).
- A Player cannot start a conversation with, or send to, an account that is locked or deleted. An active Player can still read their own history with that account; only the display data allowed for such accounts is shown.
- A message has trimmed text of at most 2,000 characters, or at least one attachment.
- A Player can set, change or remove one reaction per message among six types.
- The conversation list shows each conversation with its latest message and unread count; the history is paginated from newest to oldest.
- Online status is visible only to Players who share a conversation; typing is visible only inside that conversation. Leaving a group or a block removes presence through that relationship.
- Real-time message/reaction delivery, online status and typing indicator are pushed over WebSocket (`docs/architecture/tech-stack.md`).
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
| Conversations (1-to-1 and Group), membership, messages, attachments, message reactions, read state, real-time presence and typing, blocking, message limits | This PRD |
| Optional UI shortcut to create a group conversation from a post's member list | Social / Matchmaking UI calling Messaging API |
| Report records and Admin review | Report Management PRD |

Blocking is owned here and is also consulted by Matchmaking (Apply/Invite) and, where needed, by Social. Those modules consult Messaging's blocking rule; they do not redefine it.

### 8.2 Conversation types and access

- One-to-one: two Players. Court Owner and Admin never take part.
- Group: standalone group conversation (`title`, `2` to `MESSAGING_GROUP_MAX_MEMBERS` members, `status = 'ACTIVE'`). The creator is the **Group Owner (`created_by`)**, who can rename, lock/unlock sending (`is_locked`), add/remove members, recall any message in the group, and dissolve the group (`status = 'DISSOLVED'`). Regular `ACTIVE` members can read, send (when not locked), react, reply, edit/recall their own messages, hide messages for themselves, and voluntarily leave (`LEFT`).
- Leaving or being removed from a conversation never withdraws the Player from any Matchmaking post or Match.

### 8.3 Group lifecycle

- Created explicitly via `POST /api/v1/conversations/group` with `title` and initial `memberIds[]`.
- New members see the full history.
- Leaving (`LEFT`) stops new messages/unread/presence; an `ACTIVE` member may re-add a `LEFT` member. Group conversations remain active long-term and never automatically lock to read-only after 24 hours.




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
- Recalled messages (`deleted_at`) and dissolved groups (`status = 'DISSOLVED'`) hide content from Player views and block attachment downloads via `GET /media/:id`, while preserving the underlying message rows and media files in the database as report evidence (updated 2026-11-01).

### 8.9 Feature gate (approved 2026-10-31)

| `MESSAGING_ENABLED = false` | Behavior |
| --- | --- |
| Blocked | Starting conversations, sending messages, message reactions, presence heartbeats and typing updates (no online/typing state is recorded or shown) |
| Still allowed | Reading conversation lists and history, downloading attachments the Player may read, marking messages as read, leaving a group conversation, reports, blocking/unblocking |
| Standalone boundary | Messaging has no internal background sync with Matchmaking; when `MESSAGING_ENABLED = false`, new conversation creation (1-to-1 and group) is blocked. |

The combined behavior with other gates is defined once in the Matchmaking Tech Design.

## 9. UI/UX Behavior

- **Global Chat Dock & Entry points (updated 2026-11-01):**
  - A global `MessagingProvider` and floating `GlobalChatDock` are mounted in `PlayerLayout` across all Player pages so real-time WebSocket updates, unread badges, and messaging work everywhere on the platform.
  - **Floating Draggable Bubble:** positioned along the right viewport edge, vertically draggable with position persisted in `localStorage` (`useDraggableBubbleOffset`) so it never blocks page CTAs; hidden automatically when viewing `/messages*`.
  - **Compact Floating Window (`380×540px` desktop, full-screen mobile):** toggles open from the bubble or "Nhắn tin" actions, with an expand button (`⤢`) to open the full two-column `/messages/:conversationId` workspace.
- **Conversation view & Composer UX (updated 2026-11-01):**
  - Header flyout menu (`Tên nhóm / Người chơi ▾`) providing compact access to Members (`Thành viên (N)`), Add Members (`Thêm thành viên`), Group Settings (`Đổi tên nhóm`, `Khóa gửi tin`, `Giải tán nhóm` for Group Owner), Leave Group (`Rời nhóm` for regular members), and Block/Profile for direct chats.
  - Consecutive messages by the same sender are visually grouped (suppressing repeated sender header/avatar) with compact timestamps and `"Chủ nhóm"` badge for the group owner.
  - Hover action bar beside each message bubble: Reactions (`👍 ❤️ 😆 😮 😢 😡`), Reply (`↩`), and More (`⋯`: Edit own text, Recall own/group message, Hide for me, Report).
  - Clicking a quoted reply scrolls smoothly to the parent message and highlights it.
  - Composer supports separate Image and File buttons, clipboard image paste (`Ctrl+V`), drag-and-drop file/image overlay, emoji picker at cursor, `Enter` to send (`Shift+Enter` newline), and a character counter appearing above `1,500 / 2,000` characters.
- **Important states:**
  - Loading: list, history, older messages.
  - Empty: no conversations; no messages yet.
  - Sending, sent and failed (with resend). Draft text and selected attachments are kept after a failure.
  - Connection lost: an indicator while updates cannot be fetched; it recovers and refreshes on reconnection or when the page becomes visible again.
  - Group conversations remain active long-term (no 24-hour read-only lock).
  - Blocked: one-to-one composer disabled with a neutral message; the blocked Player sees no block notice beyond being unable to send.
  - Left group: leaving (`LEFT`) immediately removes conversation history and attachment access until an active member re-adds the Player.

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
- Group membership is managed directly in Messaging (`POST /conversations/group`, `POST /conversations/:id/members`, `POST /conversations/:id/leave`), decoupled from Matchmaking.
- Notifications are in-app; new messages never create notification entries.
- Real-time delivery uses WebSocket (`ws` on the Node.js HTTP server) paired with REST `afterSeq` catch-up on reconnect (`docs/architecture/tech-stack.md`).

## 12. Risks

- Players expect instant delivery. Mitigation: near-real-time wording and visible sending/failed states.
- A member who left a group (`LEFT`) keeps attachments through cached links. Mitigation: every attachment access re-checks `ACTIVE` membership permission (Tech Design).
- Spam through one-to-one conversations. Mitigation: per-sender limits and blocking.
- Evidence lost when content changes. Mitigation: snapshot at report time.

## 13. Dependencies

- Standalone Messaging APIs require no Matchmaking dependency; Social/Matchmaking screens may optionally call `POST /api/v1/conversations/group`.
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
| Decouple Messaging from Matchmaking (standalone group chat creation/membership, no 24-hour read-only lock) and use WebSocket for real-time chat | Human owner | 2026-11-01 |
| Message text ≤ 2,000 characters, trimmed before empty check | Human owner, Phase 2 batch 1 (B5) | 2026-10-31 |
| Report snapshot keeps text and attachment references | Human owner, Phase 2 batch 1 (B6) | 2026-10-31 |
| Block list and unblock; unblocking does not restore closed requests; blocking grants no visibility | Human owner, Phase 2 batch 1 (B8) | 2026-10-31 |
| Read state advances only to messages actually loaded/shown; unread excludes own messages; resend never duplicates | Human owner, Phase 2 batch 1 (T7) | 2026-10-31 |
| Online/typing are near-real-time with visible delay | Human owner, Phase 2 batch 1 (T4) | 2026-10-31 |
| Feature-gate behavior: reads, mark-read, and leaving a group allowed; new conversation creation, sending, reactions, and presence/typing blocked | Human owner, Phase 2 batch 2 (Q4), updated 2026-11-01 | 2026-11-01 |
| Left-chat members (`LEFT`) have no history/attachment access until re-added by an active member; leaving allowed while disabled | Human owner, Phase 2 batch 3, updated 2026-11-01 | 2026-11-01 |
| Expand Messaging with Group Owner administration (rename, lock, add/remove members, dissolve), message Reply/Edit/Recall/Hide-for-me, Global Chat Dock (draggable bubble + 380×540px window across all Player pages), and Ctrl+V / Drag-and-Drop / Emoji / Message Grouping UX | Human owner | 2026-11-01 |
| Text with up to 4 images or 1 file, never both | Human owner, Phase 2 batch 2 (Q6) | 2026-10-31 |
| No new conversation or message with locked/deleted accounts; own history stays readable with limited display data | Human owner, Phase 2 batch 2 (Q7) | 2026-10-31 |

## Output Rules

This PRD contains no database schema, API contract, framework, library or file-structure decision.
