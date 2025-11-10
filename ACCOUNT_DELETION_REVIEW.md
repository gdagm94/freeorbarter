# Account Deletion Compliance Notes

## Feature Summary
- Backend edge function `delete-account` validates the signed-in session, purges relational data via `delete_user_account_data`, deletes the Supabase auth user, and removes related storage objects.
- Postgres function `delete_user_account_data` enforces cascading deletes and writes a minimal audit record (`user_id`, `email`, `metadata`, `deleted_at`) to `account_deletion_audit` for compliance.
- Web app: `Profile` page includes an **Account deletion** card with confirmation modal, reason capture, and acknowledgement checkbox before invoking the edge function.
- Mobile (iOS & Android): `Settings` screen mirrors the web flow with modal confirmation, reasons, optional feedback, and acknowledgement.
- Privacy policy screens now document self-service deletion paths and the limited audit log retained after deletion.

## Navigation Paths
- **Web:** `Profile` → **Account deletion** → Confirm in modal (requires acknowledgement).
- **iOS / Android:** `Settings` → **Delete account** button → Confirm in modal (requires acknowledgement).

## Minimal Data Retention
- We retain only `account_deletion_audit` entries (user ID, email, deletion timestamp, optional metadata) for legal, safety, and fraud-prevention purposes.
- No item listings, messages, or media persist after deletion.

## QA Checklist
- [ ] Web: Delete account with default reason, confirm sign-out, verify login blocked afterward.
- [ ] Web: Attempt deletion with “Other” reason left blank and ensure validation prevents submission.
- [ ] Mobile (iOS & Android): Delete account flow completes, triggers haptic feedback, signs out, and redirects to auth screen.
- [ ] Backend: Confirm audit record written, Supabase `users` row removed, and storage assets deleted (avatar, item images, message files).
- [ ] Regression: Create new account, add listing, send message, delete account, ensure related data disappears from counterpart views.

## App Store Review Note Template
```
We now provide in-app account deletion to satisfy guideline 5.1.1(v).

- Open the app → Settings → “Delete account”.
- The confirmation modal requires selecting a reason and acknowledging permanence before finishing.
- Once confirmed, the account, listings, messages, and notifications are deleted immediately and the session ends.

Web users have the same flow via Profile → Account deletion, and both experiences call the same Supabase function `delete-account`.
```

