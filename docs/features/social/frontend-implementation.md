# Social frontend — delivery, 2026-11-01

Owner approval: the human owner accepted the [Figma audit proposal](frontend-figma-review.md) and requested implementation. Ready Social/Matchmaking contracts remain authoritative. This document records delivery, not a replacement API specification or a claim that the whole module is DONE.

## Decisions applied

- Keep approved `/feed` and `/posts/:postId`; reuse Player shell/profile modal and retain `/`.
- Ignore Figma's obsolete automatic chat creation/sync/revocation and 24-hour lock; no group shortcut in this delivery.
- External court and KEEP only while booking providers remain blocked.
- Recruitment filters use current server contracts: area from external court, Vietnamese local start-time range, only MATCH_FINDING results when recruitment filters are active; pending unpublished access expires with the invitation.
- Retain current server refusal of author deletion after start while recruitment is non-terminal. Terminal deletion may remove the post without cancellation again; UI lets the server distinguish these cases rather than inferring Match completion from request status alone.
- No legacy auto-matching/ELO/court automation/split billing/penalties, report attachment uploads/sanctions, bulk notification read or fake progress/counts.

## Delivered

- Feed uses server data, URL filters, `asOf` load-more and ID de-duplication; refresh on demand and visibility, no Social polling. Empty/error/loading/retry variants retain a usable path.
- One multipart post composer shared by feed and Matchmaking creation: FREE or MATCH_FINDING, optional title, GROUP fields, preview, private images, external court, public/unpublished creation. No second recruitment-creation API.
- Author content edit with `keepImageIds`, delete confirmation, current server errors, six reactions, flat paginated comments, comment deletion by permitted viewers, plain text rendering and neutral unavailable post.
- Draft text/files remain after failure. Identical creation retries reuse `clientRequestId`; changed content/files use another key. Comment retries follow the same principle. Mutation buttons block overlapping submission. HTTP client preserves multipart/CSRF and exposes server `Retry-After` seconds.
- Shared authorized image/lightbox, reaction picker and accessible dialog, including Escape, focus trap, scroll lock and focus restoration. API-supplied imagery remains dynamic; Figma ellipsis is downloaded locally at its native 20×20 geometry. Existing shell assets/components are reused.
- Request management composes role-aware data: publish, candidate invitations, pending invitation cancellation, received invitation accept/decline, withdraw, host cancel/KEEP, GROUP early close and external court. Pending invitees of published posts also get invitation response, not Apply. Slot threshold alone cannot enable GROUP close without an accepted registered member.
- Management reads the authorized request resource, preserving host/member entry when Social content is hidden. Content itself stays unavailable.
- Desktop three-column feed and 390px responsive feed/filter dialog/composer/detail. Existing Player header/footer are retained; their unrelated differences from the Figma shell are outside this task.

## Remaining acceptance gates

| Gap | Current treatment | Owner / unblock condition |
| --- | --- | --- |
| Apply and applicant management | Send/pending/cancel, scoped host list/decisions, skill warning and my history are wired; mutation errors never fabricate membership | Real BlockPort foundation/integration from MSG-08 remains unmerged; new Apply/accept fail closed until registered |
| Player report and evidence | Report action unavailable; no duplicate report form | RP-06/07/08 and media evidence resolver; reuse shared report dialog when delivered |
| Booking link / cancel booking | Actions absent; KEEP supported | MM-19/MM-20, Booking and Payments provider acceptance |
| Chat entry / unread | No Social chat side effects or placeholder conversation navigation | Messaging teammate delivery; optional create-group shortcut remains deferred |
| Notifications | Existing backend comment producer used; no new notification UI or bulk read | NTF-04/05, resource resolution and remaining MM-31 producers |
| Historical edit lock | Existing members disable time/type/capacity immediately; an acceptance-history rejection locks those fields and preserves editable draft fields for retry. GROUP minimum/duration supported | Current detail has no historical lock flag; after all members withdraw, the first prohibited edit is rejected by the server. A future approved read-model flag can remove that extra attempt |
| Configurable form bounds | Backend authoritative; current form reflects documented GROUP defaults | No approved Player-facing Social/Matchmaking config reader exists; do not invent one. Reconcile configured bounds before final MM-29 acceptance |
| Real end-to-end acceptance | UI tests intercept APIs; no database reset | SOC-09/MM-29 must verify real providers, invitee flows, scheduler transitions, media authorization and concurrency |

SOC-08 and MM-29 remain IN_PROGRESS. Integration blockers are not reasons to fake behavior or mark either task DONE.

## Verification

- `npm run build --prefix frontend`: passes; Vite warns about the existing large application bundle.
- `npm run lint --prefix frontend`: exits successfully; React effect warnings remain, including async-loading/image-preview effects in the new UI.
- `cd frontend && npx playwright test --config playwright.social.config.ts`: contract browser tests with Chrome and Vite only; API interception avoids any database reset. 18 tests cover pagination snapshot/dedupe/retry, filters, multipart/CSRF, idempotency, reactions, comment quota, GROUP close guard, KEEP deletion, hidden-content management, mobile layout/focus, creation, image validation, content editing, gate behavior, invitation response and historical edit-lock recovery.
- Visually inspected desktop feed and 390px composer screenshots in `/tmp/social-desktop-feed.png` and `/tmp/social-mobile-composer.png`; screenshots are verification output, not runtime assets or committed build artifacts.

Shared architecture documentation changes require teammate PR review before merge under `.agents/AGENTS.md`. No commit or push was performed.

## Seed-data schedule regression fix — 2026-11-01

Social recruitment leaves legacy preferred-window columns NULL. Request summary/detail and invitation-list responses now derive missing date/time values from the fixed `start_at`/`duration_minutes` interval in Vietnam time; existing legacy windows are preserved. The response field names and stored data do not change. Feed/request/invitation views also tolerate NULL legacy fields, and request countdown is omitted without an expiry. Verified with three isolated time-projection tests and a Playwright regression spanning all three views; no seed reset is required.


## MM-24 Apply delivery — 2026-11-01

The owner authorized API/UI implementation while the real BlockPort integration remains pending. ApplicationPanel composes host applicants, the viewer pending state and Player history in the existing `/matchmaking?tab=applications` route. Host acceptance/decline and applicant cancellation have confirmation dialogs; failed send/approval shows an error and reloads authoritative state without optimistic success. Approved members retain a request-management entry when Social content is hidden. Out-of-range skill is a warning, not an eligibility restriction. Host lists and personal history paginate independently and expose no post body/media or other applicant management data.

The backend uses the existing membership table/acceptance transaction and neutral block errors. APPROVAL rechecks publication, block, expiry, capacity and schedule; transactional notifications cover received/accepted/declined with the approved keys. Apply rows never become invitation response actions. BLOCKED closure reasons are masked in application DTOs. Production registers no test BlockPort. No schema changes, new routes outside the approved API table, chat groups or booking behavior were added.

Validation: 53 backend tests (Apply, membership, lifecycle) and 23 Social Playwright contract tests pass. Frontend/backend builds pass; frontend lint exits successfully with existing React-effect warnings. These tests use a test-only BlockPort or intercepted browser APIs; MM-24 remains IN_PROGRESS until real-provider acceptance passes.


Missing-BlockPort UX correction (2026-11-01): the registry now returns the existing neutral `409 MATCHMAKING_ACTION_NOT_AVAILABLE` with a safe temporary-unavailability message, which the UI displays. Apply/Invite/acceptance remain denied; no permissive provider is installed. Unexpected failures still return generic 500 responses.
