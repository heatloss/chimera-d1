# How to Report the Password Change Button Bug

## Quick Links
- **Payload GitHub Issues**: https://github.com/payloadcms/payload/issues
- **Bug Report File**: `bug-reports/payload-password-change-button-bug.md`

## Steps to Report

### 1. Check for Existing Issues
Search for existing reports:
https://github.com/payloadcms/payload/issues?q=is%3Aissue+force+unlock+password

If a similar issue exists, add your report as a comment with your specific details.

### 2. Create New Issue (if needed)
If no existing issue found:

1. Go to: https://github.com/payloadcms/payload/issues/new
2. Title: **"Account page: Password change button incorrectly labeled 'Force Unlock'"**
3. Copy content from `bug-reports/payload-password-change-button-bug.md`
4. Add screenshots if possible (see below)

### 3. Screenshots to Include

**Screenshot 1: Account Page**
- Navigate to `http://localhost:3333/admin/account`
- Show the "Change Password" and "Force Unlock" buttons side by side

**Screenshot 2: Password Change Form**
- Click "Change Password"
- Capture the form showing:
  - Two password input fields
  - "Cancel" button
  - Incorrectly labeled "Force Unlock" button

**Screenshot 3: Database State (optional)**
```bash
pnpm wrangler d1 execute chimera-d1 --local --command "SELECT email, login_attempts, lock_until FROM users;"
```
This proves the user is not locked, making the "Force Unlock" label incorrect.

## Issue Labels to Request
- `bug`
- `admin-ui`
- `needs-triage`

## Priority
**Medium-High** - This affects critical security operations and could cause admin confusion or hesitation during password resets.

## Additional Context
- This was discovered on a fresh Payload 3.59.1 installation
- Not caused by custom code or configuration
- Button functionally works but is mislabeled
- Similar to potential state management or conditional rendering bug
