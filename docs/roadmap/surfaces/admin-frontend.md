# Admin Front End — chimera-app (Alpine.js SPA)

Functional single-owner admin tool, actively maintained and current with the
backend. The product *scope* is the gap, not freshness — the backend is ahead of
the UI on multi-tenant primitives.

Repo: `/Users/mike/Sites/chimera-app`

## Inventory (what exists)

### Stack & build
- Alpine.js 3.x from CDN via import maps; vanilla ES modules; one HTML file per
  page at repo root, per-page logic in `src/js/*Ops.js`. Only runtime dep:
  `tiny-markdown-editor`.
- Custom `build.js`: copies to `dist/`, strips `// DEV-ONLY` blocks, uncomments
  `// PROD-ONLY` blocks, rewrites `localhost:3333` → `API_BASE_URL`. Deployed to
  Cloudflare via Wrangler (`worker.js` serves static `dist/`).

### Pages
- `index.html` — login (email/password)
- `dashboard.html` — active-comic summary, recent pages, **fake analytics**
- `comicmanager.html` — chapters/pages tree, comic switcher, admin op buttons
- `comiceditor.html` — comic metadata (description, credits, links, genres, tags,
  schedule, status, cover)
- `chaptereditor.html` — create/edit/delete/reorder chapters
- `pageeditor.html` — edit single page
- `uploader.html` — upload pages (client-side thumbnails via `thumbnailWorker.js`)
- `batcheditor.html` — bulk reorder (drag), batch PATCH/DELETE
- `settings.html` — **explicit non-functional mock**

### Backend integration
- Talks to the chimera-d1 Payload API. Central client `config.js`
  `authenticatedFetch()` — JWT injection, 30s timeout, 401 handling.
- Consumes: `/comics` (GET/PATCH), `/comic-with-chapters/:id`, `/pages`
  (GET/PATCH/DELETE), `/chapters` (POST/PATCH/DELETE), `/reorder-chapters`,
  `/reorder-pages`, `/media` (POST), `/metadata`, `/users/{login,logout,me}`,
  and admin utils `/generate-manifests`, `/backfill-page-authors`,
  `/recalculate-comic-pages`.
- Auth: JWT in **localStorage**; dev auth-bypass on localhost; **prod has no real
  token refresh** (24h expiry → re-login).

### What a creator can do
Edit an **existing** comic's metadata; create/edit/delete/reorder chapters;
upload pages (single + bulk); edit page metadata/images/notes/warnings; batch
ops; switch between visible comics; trigger manifest publish.

### Freshness
Actively maintained — Jan 2026 commits track the backend's Jan 2026 changes
(links field, recalc pagination, content warnings). Not stale; built as an
internal single-tenant admin.

## Gaps (launch-blockers for hosting others)

### P1 — Core product
- **[ABSENT] No comic-creation UI.** Never calls `POST /comics` — only GET list +
  PATCH. A new creator cannot start a comic.
- **[ABSENT] No signup / creator-role-request UI.** Backend has `/register` and
  `/request-creator-role`; UI never calls them. Login is the only entry.
- **[ABSENT] No onboarding / first-run.** Empty state is a bare "No comics found."
- **[ABSENT] Settings/password reset non-functional.** `settings.html:42` states
  it's a mock; no profile edit, no password change, no forgot-password link
  (despite backend `/users/forgot-password`).

### P2 — Table stakes
- **[PARTIAL] Fake analytics ship to prod.** `dashboard.html:70-89` — hardcoded
  "Imaginary Subscriber count: 24 / Simulated Page views: 771" + static chart.
  Not stripped by the prod build (plain markup, not a DEV-ONLY block).
- **[ABSENT] Admin-only ops exposed to all users.** publishManifests, backFill,
  recalcComicPages buttons shown with no role check.
- **[ABSENT] No responsive support.** **No `<meta viewport>` in any HTML file**;
  ~0 `@media` rules. Desktop-only.
- **[PARTIAL] Error handling console-oriented.** Most failures `console.error`
  and leave blank state; `notify()` toast used inconsistently.

### P3 — Growth
- **[PARTIAL] Single-owner UI model.** Relies on one `activeComicId`; auto-selects
  `comics[0]`. `loadOtherComics()` fetches ALL comics into the switcher — assumes
  cross-comic visibility. No per-creator portfolio dashboard, no role-scoped views.
- **[ABSENT] No billing UI.** No plans/Stripe/quotas anywhere.
- **[ABSENT] No team/collaborator management UI** despite backend roles.
- **[PARTIAL] Auth robustness thin.** JWT in localStorage (XSS-exposed); dev
  refresh stores plaintext password in localStorage.
- **[ABSENT] No terms/privacy/legal surface, no per-creator public-site config.**

## Note
The backend already exposes the multi-tenant primitives (register,
request-creator-role, role-based access) that this UI lacks a surface for.
Closing the P1 gaps here is largely wiring existing endpoints — not new backend
work — except the `request-creator-role` gating fix (backend P0).
