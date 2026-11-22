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

## Admin operations extension — implemented 2026-11-18

In-app Admin alerts for: payout awaiting approval, refund failure, payout/payment
mismatch, system config changes, high-risk reports and sensitive Admin account
changes. Recipients are active Admins only; security events exclude the actor.
In-app polling and the no-new-infrastructure rule are unchanged. Full catalog,
dedup rules and implementation evidence: [plan 13](../../../plans/13_thong-bao-van-hanh-admin.md).

## Social Matchmaking extension — Ready (human-approved 2026-10-31)

This business extension is Ready, approved by the human owner on 2026-10-31 (along with the Phase 2 technical design in [tech-design.md](tech-design.md) and task `NTF-05` in [tasks.md](tasks.md)). Implementation remains pending.
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
