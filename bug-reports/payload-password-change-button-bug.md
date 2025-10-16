# Payload CMS Bug Report: Incorrect Button Label on Password Change Form

## Summary
When changing a user password via the account page (`/admin/account`), the submit button is incorrectly labeled "Force Unlock" instead of "Save" or "Change Password".

## Steps to Reproduce
1. Log into Payload admin panel at `/admin`
2. Navigate to `/admin/account`
3. Click the "Change Password" button
4. Observe the form that appears with two password input fields
5. Note the two buttons at the bottom: "Cancel" and "Force Unlock"

## Expected Behavior
The submit button should be labeled "Save", "Submit", or "Change Password" to clearly indicate it will save the new password.

## Actual Behavior
The submit button is labeled "Force Unlock", which is:
1. Confusing - it suggests a different action (unlocking a locked account)
2. Misleading - clicking it actually saves the password change
3. Potentially dangerous - admins may hesitate to click it during password reset operations

## Environment
- **Payload Version**: 3.59.1
- **Database Adapter**: @payloadcms/db-d1-sqlite (sqliteD1Adapter)
- **Node Version**: 22.18.0
- **Package Manager**: pnpm 10.x
- **Framework**: Next.js 15.4.4
- **Platform**: macOS (darwin arm64)

## Configuration
Standard Users collection with `auth: true`:

```typescript
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  fields: [
    // ... custom fields
  ],
}
```

No custom auth configuration in `buildConfig()`.

## Additional Context
- Users have `login_attempts: 0` and `lock_until: null` in the database (no actual lockout)
- The button functionally works - it does save the password change
- This is purely a labeling issue, but affects critical security operations
- Fresh installation (payload template, not upgraded from earlier version)

## Impact
This mislabeling could cause:
1. Admin confusion during password reset operations
2. Hesitation to complete password changes
3. Loss of confidence in the admin UI
4. Potential security issues if admins avoid using the feature

## Suggested Fix
The button should be labeled appropriately based on the active form:
- When in "Change Password" mode → "Save Password" or "Submit"
- When in "Force Unlock" mode → "Force Unlock"

It appears the form is rendering the wrong button or the button states are not properly separated.
