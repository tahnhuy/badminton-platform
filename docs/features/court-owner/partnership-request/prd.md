# Court Owner Partnership Request — PRD

```text
Status: Ready (approved by the owner in the working session, 2026-11-27)
Owner: taidangdev
Fulfills: PROJECT-BRIEF.md §2 (System Roles: Court Owner) and §4 (Admin)
Scope: Public partnership request form, Admin review queue, and Court Owner account handover by email
```

## Authoritative References

- Project scope, roles, MVP boundaries: `PROJECT-BRIEF.md`
- Documentation lifecycle: `docs/documentation-guide.md`
- Configuration: `docs/business-rules-config-matrix.md` §8 (new key proposed in §8 below)
- Court Owner account rules: [Auth PRD](../../platform/authentication-authorization/prd.md) §6.2 and "Public landing page"
- Admin account management: [User Management PRD](../../admin/user-management/prd.md)

## Related Documents

- Tech Design: [tech-design.md](tech-design.md)
- Tasks: [tasks.md](tasks.md)
- Decisions recorded on 2026-11-27 (owner, in the working session): §14

## 1. Problem

A court owner who wants to list their venue on SmashPro has no way to reach the platform. The
landing page's court-owner band says "Liên hệ quản trị viên" without a link, because the contact
channel was left `[TBD]` (Auth PRD, "Public landing page", item 6). The footer link "Hợp tác chủ
sân" and the header item "Chủ sân" both scroll to that band and stop there.

On the Admin side, Court Owner accounts can be created (Auth PRD §6.2), but step 3 has the Admin
hand the email and initial password to the owner outside the system. The Admin learns the
owner's password, and nothing records who asked for an account or why it was created.

## 2. Goals

- A visitor can ask to become a Court Owner from the landing page, without an account.
- Admins see every request in one queue, record their follow-up, and either create the account
  from the request or reject it with a reason.
- The new Court Owner sets their own password through the existing "Quên mật khẩu" OTP flow, so
  no Admin ever knows or transmits it, and owning the email is proven.

## 3. Non-Goals

- Court Owner self-registration. An Admin still decides and creates every Court Owner account
  (single role per account, Auth PRD; [CONFIRMED] on 2026-11-27).
- Turning a Player account into a Court Owner account.
- Creating a draft facility from the request. The facility details only inform the Admin; the
  owner creates facilities through the existing onboarding after sign-in.
- Document upload (business licence, photos) in the request.

## 4. Scope

### In Scope

- Public page `/hop-tac` with the partnership request form, reachable from the landing page, the
  landing footer and the sign-in page.
- Admin page "Yêu cầu hợp tác": list, filters, detail, internal note, status changes.
- "Tạo tài khoản chủ sân" from a request, with the form pre-filled from the request.
- Rejection with a mandatory reason, emailed to the requester.
- Account-created email that sends the owner to "Quên mật khẩu".
- Admin inbox notification for every new request.
- An Admin setting to switch the public form off.

### Out of Scope

- A public status-tracking page for the requester (the emails are the feedback).
- Editing a request after it is submitted, by either side (the Admin note is separate).
- Reopening a rejected or approved request. The requester sends a new one.

## 5. Target Users and Roles

- Visitor (no account) or any signed-in user: submits a request.
- Court Owner: receives the account and the account-created email; the rest of the journey is
  the existing Court Owner experience.
- Admin: processes requests.
- Player: no change. A signed-in Player may submit a request, but the Court Owner account needs
  a different email (one role per account).

## 6. User Journey

### 6.1 Submitting a request

1. The visitor chooses "Gửi yêu cầu hợp tác" in the landing court-owner band (or "Hợp tác chủ
   sân" in the footer, or the link on the sign-in page) and reaches `/hop-tac`.
2. They fill in the contact person's full name, email and phone; the facility name, street
   address, district and city; the expected number of courts; an optional note; and tick the
   consent "Tôi đồng ý để SmashPro liên hệ qua email và số điện thoại trên".
3. They send the form. The page shows "Đã nhận yêu cầu" with "SmashPro sẽ liên hệ với bạn trong
   1–2 ngày làm việc" and a link back to the landing page.
4. The requester receives the email "SmashPro đã nhận yêu cầu hợp tác" summarising the request and
   the next steps.
5. Every active Admin receives an inbox notification "Yêu cầu hợp tác mới" that opens the request.

Alternatives:

- The email already has a pending or contacted request → the same success screen is shown; no
  second request and no second email are created.
- The email already belongs to an account (for example the person's Player account) → no request
  is created and the form shows under the email field: "Email này đã có tài khoản SmashPro. Mỗi
  tài khoản chỉ có một vai trò, nên tài khoản chủ sân cần một email khác (ví dụ
  ten+chusan@gmail.com vẫn nhận thư ở hộp thư cũ)."

- The form is switched off → the page shows "Hiện SmashPro tạm ngừng nhận yêu cầu hợp tác" and
  no form; the landing button still leads there.
- Too many submissions from the same network → "Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại
  sau".

### 6.2 Admin processing

1. The Admin opens "Yêu cầu hợp tác" from the Admin menu (badge = pending count) or from the
   notification.
2. The list shows newest first with status filter (default "Chờ xử lý") and search by name,
   email, phone or facility name.
3. In the detail the Admin reads the request, calls the owner, and may:
   - save an internal note at any time while the request is open;
   - mark it "Đã liên hệ";
   - choose "Tạo tài khoản chủ sân";
   - choose "Từ chối".
4. "Tạo tài khoản chủ sân" opens the create form pre-filled with email, business name (facility
   name) and phone, all editable except the email. No password field is shown. On confirm:
   - the Court Owner account is created (same account state as Auth PRD §6.2: active, must set a
     password before using the app);
   - the request becomes "Đã tạo tài khoản" and links to the account;
   - the owner receives the account-created email (§6.3).
5. "Từ chối" requires a reason (shown to the requester). On confirm the request becomes "Đã từ
   chối" and the requester receives the rejection email with the reason.

### 6.3 Owner gets access

1. The owner receives "Tài khoản chủ sân SmashPro đã sẵn sàng" with the sign-in email and a
   button "Đặt mật khẩu" that opens the "Quên mật khẩu" page with the email filled in.
2. They receive the OTP, set a password meeting the password policy, and are signed in to the
   Court Owner area. The email is now verified and no forced password change follows.
3. They continue with the existing facility onboarding.

The email never contains a password.

## 7. Functional Requirements

- Anyone can open `/hop-tac`, signed in or not. A signed-in user also sees the note "Tài khoản
  chủ sân dùng email riêng, tách khỏi tài khoản hiện tại của bạn."
- The form is accepted only with every required field valid and consent ticked.
- A new request starts as "Chờ xử lý" (PENDING).
- An Admin can move a request:
  - PENDING → CONTACTED ("Đã liên hệ");
  - PENDING or CONTACTED → APPROVED ("Đã tạo tài khoản"), only by creating the account;
  - PENDING or CONTACTED → REJECTED ("Đã từ chối"), only with a reason.
- APPROVED and REJECTED are final. Their note stays readable but not editable.
- Each processed request records which Admin processed it and when.
- If the email gained an account after the request was sent, "Tạo tài khoản chủ sân" fails with
  "Email đã có tài khoản" and the request stays open so the Admin can reject it.
- The Admin "Tạo tài khoản" in User Management stays as it is (still asks for a password).

## 8. Business Rules

- One account per email and one role per account (Auth PRD). [CONFIRMED]
- At most one open request (PENDING or CONTACTED) per email.
- The form says when an email already has an account (the Player registration page already does
  the same), but never whether an email has an open request.
- Rate limit by network per window, in the same spirit as registration.
- A rejection reason is required, 10–500 characters, and is sent to the requester.
- Field rules: full name 2–100; email valid, ≤ 254; Vietnamese phone number; facility name 2–150;
  street address 5–255; district and city 2–100; expected courts 1–50; note ≤ 1000.
- New configuration key (to be added to `docs/business-rules-config-matrix.md` §8, shared
  document change through PR review):

  | Key | Type | Default | Meaning |
  | --- | --- | --- | --- |
  | `OWNER_PARTNERSHIP_ENABLED` | boolean | true | The public partnership form accepts new requests |

## 9. UI/UX Behavior

- Entry points:
  - landing court-owner band: the "Liên hệ quản trị viên" text becomes a button "Gửi yêu cầu hợp
    tác" → `/hop-tac`;
  - landing footer "Hợp tác chủ sân" → `/hop-tac` (no longer scrolls to the band);
  - sign-in page: "Bạn là chủ sân chưa có tài khoản? Gửi yêu cầu hợp tác".
- `/hop-tac` follows the sign-in/registration page layout: brand logo back to `/`, title "Đưa sân
  của bạn lên SmashPro", short explanation of what happens next (3 steps: gửi yêu cầu → SmashPro
  liên hệ xác minh → nhận email kích hoạt tài khoản), the form, success state.
- States: form, sending, success, switched off, rate limited, validation errors per field, server
  error with retry.
- Admin page: table (status, contact, facility, city, sent at), filter tabs by status with counts,
  search, detail side panel; destructive confirm for "Từ chối"; toast after each action.
- Statuses in Vietnamese: Chờ xử lý, Đã liên hệ, Đã tạo tài khoản, Đã từ chối.
- Accessibility: labelled fields, errors announced, keyboard reachable, mobile layout at 360 px.

## 10. Success Metrics

`N/A — no product metric is required for this scope.`

## 11. Constraints

- No temporary password is emailed (security convention in the email templates).
- Court Owner accounts are created only by Admins (Auth PRD §6.2).

## 12. Risks

- Spam on a public form → rate limit, hidden bot field, one open request per email, Admin switch.
- An attacker submits someone else's email → that inbox receives one receipt email (one open
  request per email, plus the rate limit); an account still needs that inbox's OTP.
- Email delivery fails → the Admin can tell the owner by phone to use "Quên mật khẩu"; the detail
  shows the account email.

## 13. Dependencies

- Existing "Quên mật khẩu" OTP flow (Auth PRD §6.10) clears the forced change and verifies email.
- Existing email outbox and Admin inbox notifications.

## 14. Decisions (2026-11-27)

| # | Decision |
| --- | --- |
| 1 | Admin creates every Court Owner account; no self-registration. |
| 2 | The owner sets the password through "Quên mật khẩu" OTP; the Admin never chooses or sees it for accounts created from a request. |
| 3 | The requester is emailed on rejection, with the reason. |
| 4 | No facility draft is created from the request in v1. |
| 5 | The form lives on its own public page `/hop-tac`. |
| 6 | Landing band, footer and sign-in page link to `/hop-tac`; signed-in users may still open it. |
| 7 | One role per account stays. An email that already has an account is told so, with the `+alias` hint. |
| 8 | The requester receives a receipt email when a request is created. |
| 9 | Handing over an imported (Google Places) facility at approval is left for a later version. |

## 15. Follow-ups for Other Documents

- Auth PRD "Public landing page" item 6: replace the `[TBD]` contact channel with `/hop-tac`; add
  the acceptance criterion for the button. §6.2: add the request-based path (step 2–3 alternative).
- User Management PRD: link to this PRD for request-based creation.
- `docs/business-rules-config-matrix.md` §8: add `OWNER_PARTNERSHIP_ENABLED`.
- `docs/architecture/frontend.md`: routes `/hop-tac` and `/admin/partnership-requests`.

## 16. Future Directions

- **One account, several roles** (Player + Court Owner on one email, with a role switcher). It
  changes `PROJECT-BRIEF.md` §2, authentication, authorization, notifications and wallet rules,
  so it needs its own PRD. With it, "Tạo tài khoản chủ sân" on a request whose email already has a
  Player account becomes "cấp vai trò chủ sân"; the form, queue and emails stay.
- **Facility handover at approval**: the Admin picks an imported facility without an owner and the
  new owner only confirms it (today the owner requests the handover after sign-in).

## 17. Open Questions

None. All business decisions above were taken on 2026-11-27.
