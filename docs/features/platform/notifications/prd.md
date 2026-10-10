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
