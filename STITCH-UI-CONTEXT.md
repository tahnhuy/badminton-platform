# Badminton Platform — Stitch UI Context

## 1. Product Overview
- **Product**: Digital Platform for Badminton Ecosystem
- **Core Goal**: Digitalize key badminton ecosystem activities focusing on three core MVP domains: Matchmaking, Court Booking, and Tournament management.
- **Target Users**: Players, Court Owners, and Admins.
- **MVP Scope**: Matchmaking (auto-court finding), Court Booking (real-time, payment, cancellations), Tournaments (single-elimination, singles/doubles).

---

## 2. System Roles
The system contains exactly three authoritative roles:
- **Player**
- **Court Owner**
- **Admin**

*Note: **Tournament Organizer** is **NOT** a system role. It is a contextual permission granted to a Player within the boundaries of a specific tournament they created.*

---

## 3. MVP Features
### Core MVP
- **Matchmaking**: Finding players based on skill/time/location, Singles/Doubles, auto-booking court.
- **Court Booking**: Real-time availability, real-time booking (no owner approval flow), payment integration, cancellation (Player/Owner), and required refund flow.
- **Tournament**: Singles/Doubles, Single-elimination format, automated bracket generation (power of 2, BYE allocation), match result tracking, winner advancement.

### Supporting Functionality
- **User Authentication**: JWT-based login/registration.
- **Profile Management**: Player profiles (skill level, avatar) and Court Owner profiles.
- **Team Invitations**: For forming Doubles teams (24h timeout).
- **Ratings**: Post-match rating of participants in the same match.
- **Reports**: Reporting Players, Facilities, or Tournaments for violations.
- **Admin Operations**: User management (suspend/deactivate), Facility moderation (suspend/deactivate), Report resolution.

### Explicitly Out-of-MVP
- Split Bill functionality.
- Independent refund-management module.
- Super Admin role.
- Match rescheduling.
- Court rating.
- System content management.
- Automated tournament court booking.
- Alternate tournament formats (Round robin, double elimination).

---

## 4. Player Experience
- **Authentication**: Register, login, manage account.
- **Profile**: View/edit profile details, skill level.
- **Court Discovery & Booking**: Search facilities/courts, view real-time availability, book court, pay (VNPAY), cancel booking if within deadline.
- **Matchmaking**: Create matchmaking requests (Singles/Doubles, skill bounds, time, location), match with others, wait for court finding, confirm match participation, view match details, leave match (before start).
- **Post-Match Rating**: Rate opponents/teammates from the same match.
- **Tournament (Participant)**: Discover tournaments, view rules/details, register for Singles, form Doubles team and invite partner, view brackets and match results.
- **Tournament (Organizer)**: A Player creating a tournament. Configure tournament (DRAFT), open registration, manage participants, close registration, generate bracket and seeding, input match outcomes, conclude tournament.
- **Reports**: Submit reports against another Player, a Facility, or a Tournament.

---

## 5. Court Owner Experience
- **Dashboard**: Oversee facility operations.
- **Facility & Courts**: Manage facility details and individual courts.
- **Pricing**: Define court pricing intervals (which are snapshotted when a Player books).
- **Bookings**: Monitor real-time bookings. **There is no flow to approve/reject pending bookings.**
- **Cancellation**: Cancel bookings due to facility maintenance/issues (this triggers player notification and refund flow).

---

## 6. Admin Experience
- **Dashboard**: General platform statistics.
- **User Management**: View all users, search/filter, view details, deactivate or suspend accounts (soft delete).
- **Court/Facility Management**: View list of facilities/courts, suspend or deactivate facilities (suspends new bookings but does not auto-cancel existing ones).
- **Tournament Management**: View tournaments, cancel tournaments if necessary to enforce rules.
- **Report Management**: View user-submitted reports, review details, change status from `OPEN` to `RESOLVED`.

---

## 7. Navigation Architecture
*DESIGN RECOMMENDATION (As per project context)*:
- **PLAYER**: Header navigation, no persistent sidebar.
- **COURT OWNER**: Header navigation, no persistent sidebar.
- **ADMIN**: Persistent left sidebar on desktop; collapsible/off-canvas on smaller screens (Confirmed via Admin User Management PRD).

---

## 8. Important Business Rules Affecting UI
### Matchmaking
- **Request Lifecycle**: `OPEN` -> `MATCHED` | `CANCELLED` | `EXPIRED`.
- **States**: Can involve `WAITING_FOR_COURT` and `WAITING_FOR_CONFIRMATION`.
- **Confirmation**: Required by default; failure to confirm leads to `CANCELLED`.
- **Court Search**: Prioritizes nearest to group centroid, then price.
- **Leaving**: Allowed before match starts; if insufficient players remain, the match is cancelled (no auto-replacement).

### Booking
- **Lifecycle**: Real-time. `PENDING_PAYMENT` -> `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED`. Or `CANCELLED`/`EXPIRED`.
- **Payment Constraint**: Default 10-minute timeout; if missed, slot is released and booking becomes `EXPIRED`. Late payments must trigger refund, not reopen the booking.
- **Pricing**: Prices are snapshotted; changes to facility pricing do not affect existing bookings.
- **Owner Cancellation**: If owner cancels a paid booking, refund flow is mandatory.

### Tournament
- **Format**: `SINGLE_ELIMINATION`, `SINGLES` or `DOUBLES`.
- **Registration**: 1 registration = 1 player (Singles) or 1 team (Doubles).
- **Team**: Doubles team must have exactly 2 members. Invitations timeout after 24 hours (1440 mins).
- **Bracket**: Size is smallest power of 2 >= registrations. BYEs are automatic. Bracket is locked after generation.
- **Match States**: Resolutions include `NONE`, `WALKOVER`, `WINNER_DECLARED`, `UNRESOLVED`. Walkover applies if 15 mins late.
- **Cancellation**: Organizer can cancel before `IN_PROGRESS`. Admin can cancel anytime.

### Rating
- **Rules**: Must be same match. No self-rating. Can rate multiple participants (opponents, and teammate in Doubles).

### Report
- **Targets**: Exactly ONE object (Player, Facility, or Tournament).
- **Rules**: No self-reporting.

---

## 9. Lifecycle States That Need Distinct UI
**Matchmaking**:
- `OPEN`
- `MATCHED`
- `WAITING_FOR_COURT`
- `WAITING_FOR_CONFIRMATION`
- `CONFIRMED`
- `CANCELLED`
- `EXPIRED`

**Booking**:
- `PENDING_PAYMENT`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED`

**Tournament**:
- `DRAFT`
- `OPEN_FOR_REGISTRATION`
- `REGISTRATION_CLOSED`
- `READY`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`

**Team Invitation**:
- `PENDING`
- `ACCEPTED`
- `DECLINED`
- `CANCELLED`
- `EXPIRED`

**Facility / Court / User**:
- `ACTIVE`
- `SUSPENDED`
- `DEACTIVATED`

**Report**:
- `OPEN`
- `RESOLVED`

---

## 10. UI Screen Inventory
### Player
- P01 — Login
- P02 — Register
- P03 — OTP/Email Verification
- P04 — Player Profile & Dashboard
- P05 — Notifications List
- P06 — Court Discovery (Search & List)
- P07 — Facility Detail
- P08 — Court Detail
- P09 — Select Date
- P10 — Select Time Slots
- P11 — Booking Summary
- P12 — Booking Pending Payment
- P13 — Booking Confirmed
- P14 — Booking Detail
- P15 — Booking Completed
- P16 — Booking Cancelled
- P17 — Booking Expired
- P18 — Refund Status (For Owner-Cancelled Bookings)
- P19 — Matchmaking: Create Request
- P20 — Matchmaking: Request Detail (OPEN)
- P21 — Matchmaking: Waiting For Court
- P22 — Matchmaking: Waiting For Confirmation
- P23 — Matchmaking: Match Detail (CONFIRMED/IN_PROGRESS)
- P24 — Matchmaking: Cancelled/Expired
- P25 — Matchmaking: Post-Match Rating
- P26 — Tournament: Discovery & List
- P27 — Tournament: Detail (Rules, Info)
- P28 — Tournament: Register Singles
- P29 — Tournament: Register Doubles (Create Team)
- P30 — Tournament: Team Invitation Received
- P31 — Tournament: Bracket View
- P32 — Tournament: Match Detail
- P33 — Organizer: Create Tournament (DRAFT)
- P34 — Organizer: Edit Tournament (OPEN_FOR_REGISTRATION)
- P35 — Organizer: Manage Participants
- P36 — Organizer: Generate Bracket & Seeding
- P37 — Organizer: Manage Matches & Results
- P38 — Submit Report (Player/Facility/Tournament)

### Court Owner
- O01 — Owner Dashboard
- O02 — Manage Facility
- O03 — Court List
- O04 — Manage Court Pricing
- O05 — Booking Monitor (Real-time List)
- O06 — Booking Detail (Owner View)
- O07 — Owner Cancel Booking (Maintenance/Issue flow)
- O08 — Owner Profile/Account

### Admin
- A01 — Admin Dashboard
- A02 — User Management List
- A03 — User Detail (Role/Status Update, Soft Delete)
- A04 — Facility/Court Management List
- A05 — Facility Detail (Suspend/Deactivate action)
- A06 — Tournament Management List
- A07 — Tournament Detail (Admin Cancel action)
- A08 — Report Management List
- A09 — Report Detail & Review (Update to RESOLVED)

---

## 11. Screen State Matrix
| Screen | Normal | Loading | Empty | Error | Permission | Conflict | Other states |
|---|---|---|---|---|---|---|---|
| Lists (Bookings, Courts, Tournaments, Users, Reports) | Data table/grid | Skeleton | "No results found" | Fetch error | N/A | N/A | Filtered state |
| Booking Detail | Active details | Skeleton | N/A | Load error | Unauthorized | Slot overlap | PENDING_PAYMENT countdown |
| Matchmaking Detail | Status overview | Skeleton | N/A | Load error | Unauthorized | N/A | Waiting Confirmation, Cancelled |
| Tournament Bracket | Tree view | Skeleton | No registrations | Load error | N/A | N/A | Generated / Locked |
| Admin User Detail | User info | Skeleton | N/A | Load error | Read-only self | N/A | SUSPENDED/DEACTIVATED badge |

---

## 12. Design System Context
*DESIGN RECOMMENDATION*:
- **Theme**: Modern Badminton Club / Premium Sports SaaS.
- **Attributes**: Clean, sporty, energetic, premium, trustworthy, social, minimal.
- **Colors**:
  - Primary Green: `#16A34A`
  - Primary Dark: `#15803D`
  - Primary Light: `#DCFCE7`
  - Deep Navy: `#0F172A`
  - Background: `#F8FAFC`
  - Surface: `#FFFFFF`
  - Border: `#E2E8F0`
  - Secondary: `#64748B`
  - Accent Lime: `#A3E635`
  - Badminton Yellow: `#FACC15`
- **Typography**: Inter preferred.

---

## 13. Responsive Requirements
- **Desktop**: Full UI capability.
- **Tablet**: Optimized grid and tables.
- **Mobile**: Critical player flows (Booking, Matchmaking, Tournament tracking) must be mobile-first.
- **Layout Constraints**:
  - **Player & Court Owner**: Header navigation, no persistent sidebar.
  - **Admin**: Persistent sidebar on desktop; collapsible/off-canvas on smaller screens.

---

## 14. Data Display Guidance
- **Player Profiles**: `full_name`, `skill_level` (from schema), `avatar_url`.
- **Facility**: `name`, `address`, `ward`, `district`, `city`, `phone`, `status`, `opening_time`, `closing_time`.
- **Court Pricing**: Start/End times, Price.
- **Booking**: `booking_date`, `start_time`, `end_time`, `total_amount`, `status`, `payment_method` (VNPAY for MVP).
- **Matchmaking Request**: `match_type` (SINGLES/DOUBLES), min/max skill, preferred date/time, max distance, `status`.
- **Tournament**: `name`, `format` (SINGLE_ELIMINATION), `participant_limit`, start/end dates, `status`.
- **Report**: Target identifier, `reason_code`, `description`, `status`.

---

## 15. Important "DO NOT INVENT" Rules For Stitch
**STITCH MUST NOT INVENT:**
- Business rules.
- System Roles (Do not invent Super Admin; Organizer is just a Player capability).
- Permissions.
- Payment providers (MVP uses VNPAY).
- Rating scale logic (Use generic numeric or star representations).
- Skill rating numeric values (Use generic ranks).
- Matchmaking scoring algorithms.
- Refund destination (E.g., no "Wallet" system).
- QR Access / IoT integrations.
- Court hardware controls.
- Undocumented notification behavior.
- Undocumented features (Split Bill, Court Rating).

If placeholder data is needed, use generic examples:
- "Player Name"
- "Facility Name"
- "Court 01"
- "Booking Date"
- "Payment Status"

---

## 16. Ambiguities / TBD
### TBD-01
- **Topic**: Exact rating scale values.
- **Current status**: TBD in business configuration.
- **UI implication**: Use a flexible UI component (like stars or 1-10 generic selector) that can adapt once defined.

### TBD-02
- **Topic**: Avatar File Storage.
- **Current status**: Tech design pending.
- **UI implication**: Design standard avatar fallbacks (initials) in case URLs are missing.

### TBD-03
- **Topic**: Real-time Booking Transport Tech.
- **Current status**: WebSockets vs Polling is TBD.
- **UI implication**: Ensure UI accounts for latency/refresh states visually regardless of transport mechanism.

---

## 17. Conflicts
No conflicts identified across authoritative documentation. The project strictly adheres to the definitions in `PROJECT-BRIEF.md` and `database-schema.md`.

---

# Instructions For Google Stitch
- Every screen in the Screen Inventory must be designed as a separate screen/artboard.
- Do not merge screens.
- Do not summarize multiple lifecycle states into one screen (e.g., Booking PENDING_PAYMENT vs CONFIRMED must be distinct).
- Do not omit screens.
- Do not invent product functionality outside of this context.
- Do not invent business values or domains.
- Do not invent unsupported data fields.
- Use the design system consistently.
- Keep Player and Court Owner on header navigation.
- Keep Admin on persistent sidebar.
- Make important lifecycle states visually distinct (color, icons, disabled states).
- Keep the entire product visually consistent.
