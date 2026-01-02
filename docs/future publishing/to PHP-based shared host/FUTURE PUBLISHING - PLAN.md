# Chimera CMS to PHP Shared Hosting: Static Site Deployment

**Objective:** Enable Chimera CMS (running on Cloudflare Workers) to build static Eleventy sites and deploy them to standard PHP shared hosting using atomic deployment for zero-downtime updates.

**Use Case:** Creators who have their own shared hosting accounts (e.g., DreamHost, SiteGround, Bluehost) and want to publish their webcomic to their own domain.

---

## 1. High-Level Architecture

The system decouples **CMS** (data), **Builder** (compute), and **Host** (storage/serving).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Creator's Shared Host                           │
│                     (e.g., mycomic.example.com)                         │
│                                                                         │
│   deployer.php ← receives ZIP, performs atomic symlink swap             │
│   /releases/20250102-131500/  ← timestamped release folders             │
│   /public_html → symlink to current release                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ ZIP upload via HTTPS POST
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                                  │
│                                                                         │
│   Triggered by: repository_dispatch webhook                             │
│   Payload: { comic_slug, comic_id, deploy_url, deploy_secret }          │
│                                                                         │
│   Steps:                                                                │
│   1. Checkout 11ty template repo                                        │
│   2. Build site (11ty fetches from CMS API)                             │
│   3. ZIP the output                                                     │
│   4. POST to creator's deployer.php                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Webhook trigger
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                    Chimera CMS (Cloudflare)                             │
│                                                                         │
│   Two rebuild triggers:                                                 │
│                                                                         │
│   1. Cron Worker (every 5 min)                                          │
│      - Finds pages where publishedDate just passed                      │
│      - Uses lastBuiltAt to avoid redundant builds                       │
│      - Triggers GitHub Actions for affected comics                      │
│                                                                         │
│   2. afterChange Hook (Pages collection)                                │
│      - Fires when creator edits a live page                             │
│      - Triggers immediate rebuild for that comic                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Rebuild Triggers

### Trigger 1: Scheduled Publishing (Cron Worker)

Runs every 5 minutes. Finds pages whose `publishedDate` has newly crossed from future to past.

**Logic:**
```
For each comic with pages where:
  - status = 'published'
  - publishedDate <= NOW()
  - publishedDate > comic.lastBuiltAt

→ Trigger GitHub Actions build
→ Update comic.lastBuiltAt after successful build
```

The `lastBuiltAt` field on Comics prevents redundant rebuilds. A page only triggers a build once - when its publishedDate first crosses the threshold.

See: `SAMPLE CRONJOB.ts.example`

### Trigger 2: Content Edits (afterChange Hook)

Fires immediately when a creator modifies a page that's already live.

**Logic:**
```
If page.status = 'published' AND page.publishedDate <= NOW():
  → Trigger GitHub Actions build for this comic
```

This handles:
- Typo fixes
- Image replacements
- Author notes updates
- Any edit to already-visible content

See: `SAMPLE HOOK.ts.example`

---

## 3. Per-Creator Deployment Configuration

Each comic can have its own deployment target. Add these fields to the Comics collection:

```typescript
// Deployment settings (in Comics collection)
{
  name: 'deployment',
  type: 'group',
  label: 'Deployment Settings',
  admin: {
    description: 'Configure where this comic publishes to',
  },
  fields: [
    {
      name: 'deployUrl',
      type: 'text',
      label: 'Deployer URL',
      admin: {
        description: 'URL to deployer.php on your hosting (e.g., https://mycomic.com/deployer.php)',
      },
    },
    {
      name: 'deploySecret',
      type: 'text',
      label: 'Deploy Secret',
      admin: {
        description: 'Secret key configured in your deployer.php',
      },
    },
    {
      name: 'lastBuiltAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Timestamp of last successful build',
      },
    },
  ],
}
```

This allows each creator to:
1. Set up `deployer.php` on their own hosting
2. Configure their unique deploy URL and secret in the CMS
3. Have builds deploy to their specific host

---

## 4. Component: The Receiver (deployer.php)

A PHP script on the creator's shared host that:
1. Validates the secret key
2. Receives the ZIP upload
3. Extracts to a timestamped release folder
4. Atomically swaps the symlink

**Security features:**
- Secret key validation
- Should be placed outside public_html or protected by .htaccess
- HTTPS required

See: `SAMPLE DEPLOYER.php.example` (rename to deployer.php on host)

---

## 5. Component: GitHub Actions Workflow

A single shared repository with 11ty templates. Builds are parameterized by:
- `COMIC_SLUG` - which comic to build
- `COMIC_ID` - for API queries
- `DEPLOY_URL` - where to send the ZIP
- `DEPLOY_SECRET` - authentication for deployer.php

**Concurrency control:** Only one build per comic runs at a time. Subsequent triggers for the same comic cancel in-progress builds (debouncing).

See: `SAMPLE WORKFLOW.yml`

---

## 6. Component: Deploy Script

Node.js script that runs after 11ty build:
1. ZIPs the `_site` directory
2. POSTs to the creator's `deployer.php`
3. Reports success/failure

See: `SAMPLE DEPLOYER.js.example`

---

## 7. Visibility Logic

The static site generator includes pages based on this logic:

| status | publishedDate | Included in Build? |
|--------|---------------|-------------------|
| `draft` | (any) | No |
| `published` | future | No (not yet) |
| `published` | past/now | Yes |

**Future enhancement:** A "creator preview" mode where logged-in creators can see their upcoming pages. This would require either:
- A separate preview build with all published pages regardless of date
- Client-side JavaScript that fetches preview content from CMS API

---

## 8. Setup Checklist for Creators

### On their shared host:
1. Upload `deployer.php` to a secure location
2. Edit the `$SECRET_KEY` variable to a strong random string
3. Ensure the releases directory is writable
4. Note the full URL to deployer.php

### In Chimera CMS:
1. Go to their comic's settings
2. Enter the Deploy URL (e.g., `https://mycomic.com/deployer.php`)
3. Enter the Deploy Secret (matching what's in deployer.php)
4. Save

### First publish:
1. Set at least one page to status "published" with a past/current date
2. The afterChange hook triggers a build
3. Site appears at their domain

---

## 9. Files in This Directory

| File | Purpose |
|------|---------|
| `FUTURE PUBLISHING - PLAN.md` | This document |
| `SAMPLE WORKFLOW.yml` | GitHub Actions workflow |
| `SAMPLE HOOK.ts.example` | afterChange hook for content edits |
| `SAMPLE CRONJOB.ts.example` | Cron Worker for scheduled publishing |
| `SAMPLE DEPLOYER.js.example` | Node.js script to ZIP and upload |
| `SAMPLE DEPLOYER.php.example` | PHP receiver script for shared host |

---

## 10. Future Considerations

- **Status field rename:** Currently `draft`/`scheduled`/`published`, planned to simplify to `draft`/`public` with publishedDate alone determining visibility
- **Creator preview:** Allow creators to preview scheduled pages before they go live
- **Build notifications:** Email/webhook notification on build success/failure
- **Rollback:** The releases folder structure supports rollback by re-pointing the symlink
