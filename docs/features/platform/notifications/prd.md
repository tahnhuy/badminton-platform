# In-app Notifications — PRD

Status: Ready. Owner: PM. Approved by: Human owner, 2026-10-10 readiness review.

Persist authenticated users' domain notifications; list, inspect and mark them
read, with an unread indicator. In-app only; no email/push. Notifications link to
request, invitation, Match or Booking without granting permission to the linked
resource. Matchmaking events include received/response/withdrawal/timeout,
request cancelled/expired and member release, group ready, booking linked,
Match cancelled and owner-visible booking cancellation failure. Historical
notifications remain readable if resource access ends; actions enforce current
resource authorization. Polling remains the existing platform strategy.

Dependency of Matchmaking MM-10/MM-16 and existing Booking/Payment/Tournament
notifications. No new infrastructure or third-party dependency is approved.

## Social Matchmaking extension — Ready (human-approved 2026-10-31)

This business extension is Ready, approved by the human owner on 2026-10-31 after Phase 1 review. Technical documents and implementation remain pending.
Fulfills: `PROJECT-BRIEF.md` §3.1, §3.4. Rules: `docs/business-rules-config-matrix.md` §3.12–§3.14.

New events confirmed by the human owner on 2026-10-31: Apply received,
approved and rejected; invitation events (including before publishing);
membership changes; overlapping pending Applies/Invites closed after confirmed
participation; post cancelled or closed; recruitment reopened; post closed for
insufficient players (stating that a kept booking remains valid); linked
booking cancelled; comments on one's own post. No notification for reactions.
New messages are reflected only in unread counts, not as notification entries.
Notification link targets will include posts and conversations; links still
grant no permission. Delivery technology is unchanged by this section.
