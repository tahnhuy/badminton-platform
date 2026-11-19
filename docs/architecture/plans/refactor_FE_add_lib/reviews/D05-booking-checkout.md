# D05 — Booking checkout

19/11/2026 · DONE · sequential execution authorized by the user.

Scope: summary, pending payment, booking detail and their existing payment/cancel/status presentation. Preserve calculation/coverage validation, consent requirement, mutation payloads, all redirects (including existing matchId behavior), expiry timer, status polling and error/retry branches. No backend/data-layer changes.

Review: summary uses inline card objects and feature CSS; pending is a long centered block without a page heading; details repeat rows/cards. Payment/cancellation dialogs use a manual focus hook. Direction: shared ContentPanel/DetailRow, PageContainer/PageHeader, semantic status badges, Radix dialogs and established Button primitives. Keep native checkbox consent and current enabled/close conditions. No confetti or new payment claims.

Cleanup/checks: replace old markup directly; delete checkout-only selectors after verifying consumers. Shared status/dialog components have Booking list consumers, so regression covers those too. Real backend checks must not seed/reset dev data; mock mutations/terminal/error cases separately.

## Handoff

- Replaced inline checkout UI with PageContainer/PageHeader and shared ContentPanel/DetailRow; semantic status badges, accessible state frames, native consent checkbox, Radix payment/cancel dialogs. The optional DialogContent `showClose` defaults to true; these dialogs keep their original footer/close restrictions.
- Removed 39 checkout-only CSS lines after finding no remaining consumers, and deleted old style objects/manual modal hook imports from migrated components. StateBlocks, MatchBookingContext, badges and cancel dialog still serve the other Booking pages; their public props/conditions remain.
- Exact comparison confirms the orchestration prefixes of Summary/Pending/Detail match the previous commit. Existing hooks/services/backend/types/utils, pricing calculations, consent/expiry/poll rules, redirects (including the existing mock-payment redirect without matchId), payment payload `{}` and cancellation handling are unchanged.
- Build/lint/check:ui PASS (71 files, 30 existing lint warnings); **106 UI tests PASS**, including 7 new checkout tests. Mutations, split pricing/coverage, failure/re-init/success, busy-close guards, cancellation/refund copy and navigation covered with mocked APIs.
- Real dev backend: existing demo account, court 1, 390/1280 summary and consent-disabled state pass, no dev business mutations; account has no bookings. Dedicated real backend **3010 + badminton_test**, separate frontend 5199: created test fixtures without resetting DB; UI hold → pending → real Mock adapter payment → confirmed detail → cancellation PASS. Four pending/detail renders have zero horizontal overflow, no page errors; test sessions logged out 204. This verifies the Mock adapter, not an external VNPAY gateway.
- Evidence: [summary 1280](../evidence/D05-after/summary-1280.png), [pending 390](../evidence/D05-after/pending-390.png), [detail 1280](../evidence/D05-after/detail-1280.png), [verification](../evidence/D05-after/verification.json). Existing legacy booking controller function sizes are retained to avoid unrelated logic refactoring.
- Continue D06 under the user’s sequential authorization. No push.
