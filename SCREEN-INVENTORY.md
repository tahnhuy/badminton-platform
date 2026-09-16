# SCREEN-INVENTORY.md

# SmashPro Digital Badminton Ecosystem — Screen Inventory

> Status: DRAFT
> Total Screens: 122
> Purpose: Define the complete UI screen inventory for Google Stitch.
>
> IMPORTANT:
> This document is a UI production inventory.
> It does NOT modify business rules, database schema, permissions,
> lifecycle definitions, or product scope.

---

# 1. Authoritative Sources

The UI must follow these sources in order:

1. `PROJECT-BRIEF.md`
2. Product / Feature PRDs
3. `STITCH-UI-CONTEXT.md`
4. `SCREEN-INVENTORY.md`
5. Approved Tech Design
6. Approved Task

If a screen in this inventory conflicts with a higher-level source,
the higher-level source wins.

Stitch MUST NOT silently resolve conflicts by inventing requirements.

---

# 2. Global Constraints

## System Roles

Only three system roles exist:

- Player
- Court Owner
- Admin

Tournament Organizer is NOT a system role.

Tournament Organizer is a contextual capability of a Player.

---

## Payment

Payment provider is TBD.

DO NOT invent:

- VNPAY
- MoMo
- ZaloPay
- Stripe
- QR payment provider
- wallet
- payment provider-specific UI

unless explicitly defined by an approved requirement.

---

## Rating

Rating scale is TBD.

DO NOT invent:

- 1–5 stars
- 1–10 points
- specific rating labels
- weighted rating formulas

unless explicitly defined by an approved requirement.

---

## Skill

Skill values are TBD.

DO NOT invent numeric skill values or ranking formulas.

---

## General Invention Rule

Stitch MUST NOT invent:

- new roles
- new permissions
- new business rules
- new entities
- new database fields
- new payment providers
- new rating scales
- new algorithms
- wallet features
- QR features
- IoT features
- social-feed features
- chat systems
- unapproved workflows

---

# 3. Player Screens

## P01–P12 — Authentication & Booking

| ID | Screen |
|---|---|
| P01 | Login |
| P02 | Register |
| P03 | OTP / Email Verification |
| P04 | Player Profile & Dashboard |
| P05 | Notifications List |
| P06 | Court Discovery (Search & List) |
| P07 | Facility Detail |
| P08 | Court Detail |
| P09 | Select Date |
| P10 | Select Time Slots |
| P11 | Booking Summary |
| P12 | Booking Pending Payment |

---

## P13–P24 — Booking & Matchmaking

| ID | Screen |
|---|---|
| P13 | Booking Confirmed |
| P14 | Booking Detail |
| P15 | Booking Completed |
| P16 | Booking Cancelled |
| P17 | Booking Expired |
| P18 | Refund Status |
| P19 | Matchmaking: Create Request |
| P20 | Matchmaking: Request Detail |
| P21 | Matchmaking: Waiting For Court |
| P22 | Matchmaking: Waiting For Confirmation |
| P23 | Matchmaking: Match Detail |
| P24 | Matchmaking: Cancelled / Expired |

---

## P25–P37 — Tournament

| ID | Screen |
|---|---|
| P25 | Matchmaking: Post-Match Rating |
| P26 | Tournament: Discovery & List |
| P27 | Tournament: Detail |
| P28 | Tournament: Register Singles |
| P29 | Tournament: Register Doubles |
| P30 | Tournament: Team Invitation Received |
| P31 | Tournament: Bracket View |
| P32 | Tournament: Match Detail |
| P33 | Organizer: Create Tournament |
| P34 | Organizer: Edit Tournament |
| P35 | Organizer: Manage Participants |
| P36 | Organizer: Generate Bracket & Seeding |
| P37 | Organizer: Manage Matches & Results |

---

## P38–P50 — Player Account & Tournament

| ID | Screen |
|---|---|
| P38 | Submit Report |
| P39 | Player Booking History |
| P40 | Player Match History |
| P41 | Player Tournament History |
| P42 | Player Account Settings |
| P43 | Change Password |
| P44 | Edit Player Profile |
| P45 | Notification Detail |
| P46 | Activity / Recent Activity |
| P47 | Matchmaking: Leave Match Confirmation |
| P48 | Matchmaking: Confirmation Detail |
| P49 | Tournament: Team Detail |
| P50 | Tournament: Team Invitation Pending |

---

## P51–P62 — Tournament States & Booking States

| ID | Screen |
|---|---|
| P51 | Tournament: Team Invitation Accepted |
| P52 | Tournament: Team Invitation Declined |
| P53 | Tournament: Team Invitation Expired |
| P54 | Tournament: Participant View |
| P55 | Tournament: Participant Withdrawal |
| P56 | Tournament: Match Result |
| P57 | Tournament: Match Walkover |
| P58 | Tournament: Match Unresolved |
| P59 | Tournament: Completion |
| P60 | Booking: Cancellation Confirmation |
| P61 | Booking: Payment Failure |
| P62 | Booking: Refund Processing |

---

## P63–P74 — Matchmaking & Tournament Lifecycle

| ID | Screen |
|---|---|
| P63 | Booking: Refund Completed |
| P64 | Matchmaking: Search / Matching Activity |
| P65 | Matchmaking: Confirmation Timeout |
| P66 | Matchmaking: No Court Available |
| P67 | Matchmaking: Player Left Before Start |
| P68 | Tournament: Registration Success |
| P69 | Tournament: Registration Closed |
| P70 | Tournament: Ready |
| P71 | Tournament: Cancelled |
| P72 | Tournament: In Progress |
| P73 | Tournament: Completed |
| P74 | Report: Submission Success |

---

## P75–P86 — Player System States

| ID | Screen |
|---|---|
| P75 | Report: Submission Error |
| P76 | Player Permission / Unauthorized |
| P77 | Player Empty State |
| P78 | Player Loading State |
| P79 | Player Generic Error State |
| P80 | Player Search / Filter State |
| P81 | Player Notification Empty State |
| P82 | Player Booking Empty State |
| P83 | Player Matchmaking Empty State |
| P84 | Player Tournament Empty State |
| P85 | Player Profile Empty State |
| P86 | Player Session / Authentication Error |

---

# 4. Court Owner Screens

## O01–O08 — Owner Core

| ID | Screen |
|---|---|
| O01 | Owner Dashboard |
| O02 | Manage Facility |
| O03 | Court List |
| O04 | Manage Court Pricing |
| O05 | Booking Monitor |
| O06 | Booking Detail |
| O07 | Owner Cancel Booking |
| O08 | Owner Profile / Account |

---

## O09–O17 — Owner Management

| ID | Screen |
|---|---|
| O09 | Facility Create / Setup |
| O10 | Facility Edit |
| O11 | Court Create |
| O12 | Court Edit |
| O13 | Pricing Create |
| O14 | Pricing Edit |
| O15 | Booking Calendar / Schedule |
| O16 | Booking Cancellation Result |
| O17 | Owner Permission / Error State |

---

# 5. Admin Screens

## A01–A09 — Admin Core

| ID | Screen |
|---|---|
| A01 | Admin Dashboard |
| A02 | User Management List |
| A03 | User Detail |
| A04 | Facility / Court Management List |
| A05 | Facility Detail |
| A06 | Tournament Management List |
| A07 | Tournament Detail |
| A08 | Report Management List |
| A09 | Report Detail & Review |

---

## A10–A19 — Admin Management

| ID | Screen |
|---|---|
| A10 | Booking Management List |
| A11 | Booking Detail |
| A12 | Matchmaking Requests |
| A13 | Matchmaking Match Detail |
| A14 | Tournament Participant Management |
| A15 | User Status / Suspension Confirmation |
| A16 | Facility / Court Status Confirmation |
| A17 | Admin Empty / Filtered State |
| A18 | Admin Error / Permission State |
| A19 | System Configuration |

---

# 6. Screen Count

Player:

- P01–P86 = 86 screens

Court Owner:

- O01–O17 = 17 screens

Admin:

- A01–A19 = 19 screens

Total:

86 + 17 + 19 = 122 screens

---

# 7. Stitch Production Protocol

Google Stitch can produce a maximum of 4 screens per batch.

Therefore every production request MUST create exactly 4 screens.

## Before Every Batch

Stitch MUST:

1. Read `STITCH-UI-CONTEXT.md`.
2. Read `SCREEN-INVENTORY.md`.
3. Inspect existing screens/artboards.
4. Determine which inventory IDs already exist.
5. Select the next 4 uncreated IDs.
6. Cross-check those IDs against the source documents.
7. Create exactly those 4 screens.
8. Stop immediately after 4 screens.

---

# 8. Continue Protocol

When the user says:

> Continue

interpret it as:

> Re-read the authoritative documentation and continue with the next four
> uncreated screen IDs from SCREEN-INVENTORY.md.

Do NOT:

- restart from P01
- skip IDs
- invent IDs
- create more than 4 screens
- create fewer than 4 screens
- redesign existing screens unnecessarily

---

# 9. Existing Screen Conflict Rule

If existing Stitch screens have incorrect IDs, names, layouts,
roles, or features:

DO NOT propagate those errors.

Existing screens are visual drafts unless they match the authoritative
documentation.

The documentation always wins.

---

# 10. Screen State Rule

Where `STITCH-UI-CONTEXT.md` defines state requirements,
Stitch must represent those states consistently.

Examples:

### List screens

- Loading
- Empty
- Error
- Filtered
- Normal data

### Booking Detail

- Loading
- Error
- Unauthorized
- Slot overlap
- Pending payment countdown
- Normal state

### Matchmaking

- Loading
- Error
- Unauthorized
- Waiting for confirmation
- Cancelled

### Tournament Bracket

- Loading
- No registrations
- Error
- Generated / locked
- Normal bracket

---

# 11. Responsive Rule

All screens must support:

- Desktop
- Tablet
- Mobile

Player critical flows should prioritize mobile usability.

Court Owner screens should remain usable on desktop and tablet,
with responsive mobile behavior where appropriate.

Admin uses:

- Persistent sidebar on desktop
- Collapsible / off-canvas navigation on smaller screens

Player and Court Owner do NOT use a persistent desktop sidebar.

---

# 12. Visual Design Direction

Design language:

**Modern Badminton Club / Premium Sports SaaS**

Characteristics:

- clean
- sporty
- energetic
- premium
- trustworthy
- social
- minimal

Avoid:

- gaming neon
- childish UI
- excessive gradients
- excessive shadows
- excessive rounded cards
- unnecessary icons
- overly corporate dashboard aesthetics

## Color Direction

Primary:

`#16A34A`

Dark Green:

`#15803D`

Light Green:

`#DCFCE7`

Navy / Text:

`#0F172A`

Background:

`#F8FAFC`

Surface:

`#FFFFFF`

Border:

`#E2E8F0`

Secondary Text:

`#64748B`

Accent:

`#A3E635`

Badminton Yellow:

`#FACC15`

Preferred typography:

`Inter`

Use subtle badminton / court-line geometry as a visual motif.

---

# 13. Navigation Rule

## Player

Use top/header navigation.

Do not use a persistent desktop sidebar.

## Court Owner

Use top/header navigation.

Do not use a persistent desktop sidebar.

## Admin

Use a persistent left sidebar on desktop.

Sidebar should collapse or become off-canvas on smaller screens.

---

# 14. Data Display Rule

Only display data fields supported by the source documentation.

Examples:

### Player

- full_name
- skill_level
- avatar_url

### Facility

- name
- address
- ward
- district
- city
- phone
- status
- opening_time
- closing_time

### Court

- court information
- pricing information

### Booking

- booking_date
- start_time
- end_time
- total_amount
- status
- payment_method

### Matchmaking

- match_type
- min_skill
- max_skill
- preferred_date
- preferred_time
- max_distance
- status

### Tournament

- name
- format
- participant_limit
- start_date
- end_date
- status

### Report

- target
- reason
- description
- status

---

# 15. No Silent Product Expansion

A visually reasonable feature is NOT automatically an approved feature.

For example, Stitch must not add:

- chat
- friend system
- social feed
- wallet
- QR check-in
- court IoT
- loyalty points
- subscriptions
- advertisements
- AI matchmaking scoring
- advanced analytics
- payment-provider-specific UI

unless those features are explicitly approved elsewhere.

---

# 16. Human Approval

This inventory is currently:

**DRAFT**

AI must NOT mark this document:

- Ready
- Approved
- Frozen

Only the human project owner can approve/freeze the inventory.

After approval, this inventory becomes the authoritative UI production map.