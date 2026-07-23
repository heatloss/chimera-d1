# Launch Blockers — Hosting Someone Else's Comic

Cross-cutting, prioritized. This is the "what must be true before we let a
non-Chimera artist on the platform" list. Detail lives in the per-surface files
under `surfaces/`.

Priority tiers:
- **P0 — Safety/legal/data-integrity.** Do not onboard anyone until these are
  fixed. Some are active security holes or data-corruption bugs, verified in
  code.
- **P1 — Core product.** Without these there is no self-service product; a
  creator literally cannot get on or use it unaided.
- **P2 — Table-stakes quality.** Needed for a credible public launch, but a
  hand-held pilot with one or two friendly artists could precede them.
- **P3 — Growth/scale.** Matters as the roster grows or to monetize.

---

## P0 — Safety, legal, data integrity (fix before anyone else touches it)

- [ ] **[BUG] Unauthenticated destructive endpoint.** `POST/DELETE/PUT
  /api/d1-diagnostic` (`src/app/api/d1-diagnostic/route.ts`) run raw
  `DELETE FROM pages` / `DELETE FROM comics_rels` with **no auth check**
  (verified: DELETE handler at line 238 goes straight to the D1 delete). Any
  anonymous caller can delete pages. Also `test-delete/[pageId]`. **Remove or
  lock these diagnostic routes before hosting anyone.** — backend
- [ ] **[BUG] Cross-tenant read/write leaks in custom endpoints.** — backend
  - `pages-with-media` calls `payload.find` **without `req`/`user`**, so access
    control is bypassed (`overrideAccess` defaults true) → any authenticated
    user reads any comic's pages.
  - `bulk-create-pages` checks role but **never verifies the caller owns
    `comicId`** → write pages into another creator's comic.
  - `Pages` collection `delete` access returns `true` for any creator (role-only,
    not owner-scoped) — a creator can delete another creator's pages via the
    standard API.
- [ ] **[BUG] Reactions not scoped per-comic (data corruption).** In
  chimera-comments, `reactions` PK is `(page_id, emoji_id)` and queries key on
  `page_id` only; `comic_id` is stored but never used. Two comics that reuse a
  `page_id` string (e.g. both `"page-1"`) share and corrupt each other's
  counts. — comments
- [ ] **[ABSENT] No origin↔comic ownership binding in comments.** Any origin in
  the single global `ALLOWED_ORIGINS` can read/write comments for any
  client-supplied `comic_id`. No creator auth exists on the comments service at
  all. — comments
- [ ] **[ABSENT] No comment moderation whatsoever.** Everything auto-approves
  (`status='approved'` hardcoded). No queue, no ban, no report/flag, no spam
  filter, no rate limiting. Hosting a stranger's public comment section with
  zero moderation is a non-starter. — comments
- [ ] **[LEGAL] Reader carries unauthorized-scraper legacy.** `comicviewer`
  began as a scraper of ~70 third-party comics; `js/comics.js` (607 lines) and
  `js/module.Archiveparser.js` plus third-party cover thumbnails in `img/` still
  ship in the repo. Strip all of it before this repo is public or hosts others'
  work — it's an IP/legal liability. — reader
- [ ] **[ABSENT] Unthrottled, ungated self-upgrade to creator.**
  `/api/request-creator-role` lets any authenticated reader **instantly become a
  publishing creator** with no approval/gating; `/api/register` has no email
  verification. Combined with no rate limiting and `Access-Control-Allow-Origin: *`
  on custom endpoints, this is an open-signup abuse vector. — backend
- [ ] **[PARTIAL] Media files served with no access control.**
  `(payload)/api/media/file/[filename]` streams any R2 object by filename
  regardless of `isPublic`/`uploadedBy`. Draft/unpublished art leaks if a
  filename is guessed/known. — backend

## P1 — Core product (no self-service platform without these)

- [ ] **[ABSENT] No comic-creation UI.** The admin never calls `POST /comics`
  (only GET list + PATCH). A new creator has no way to start a comic. — admin
- [ ] **[ABSENT] No signup / creator-onboarding UI.** Backend has `/register`
  and `/request-creator-role`; the front end never surfaces them. Login is the
  only entry point. No onboarding, no "create your first comic." — admin
  (depends on the P0 gating fix for `request-creator-role`)
- [ ] **[BUG] Comic slug is globally unique, not per-tenant.** `Comics.slug` is
  `unique: true` DB-wide (`src/collections/Comics.ts:194`), contradicting
  CLAUDE.md's "slugs are unique per-comic." Two creators cannot both have
  `/my-comic`. Blocks multi-tenant naming. (Chapters/Pages correctly scope slug
  per-comic.) — backend
- [ ] **[ABSENT] No per-comic theming/branding, and hardcoded single-comic
  content in the SSG.** `chimera-ssg` `theme.css` is static (manifest theme data
  never injected), and `about.webc` is hand-written for *The Automan's Daughter*
  with that comic's character images copied into every build. Every hosted site
  would look identical and ship the wrong About page. — ssg (+ backend needs
  theme fields on Comics)
- [ ] **[ABSENT] No automated multi-comic build orchestration.** The SSG builds
  one comic per run (`COMIC_SLUG` env); the CMS-side webhook that would trigger
  builds on publish is still only `.example` sample code. Publishing is
  effectively manual. No orchestrator fans out builds across creators. — ssg
  (+ backend cron/afterChange hook)
- [ ] **[ABSENT] Account settings / password reset are non-functional.**
  `settings.html` is an explicit mock; no working profile edit or password
  change, and no forgot-password flow despite backend `/users/forgot-password`.
  No email adapter is configured in Payload, so password reset can't work
  server-side either. A locked-out creator cannot self-recover. — admin + backend

## P2 — Table-stakes quality for a credible public launch

- [ ] **[PARTIAL] Fake analytics shipped to production.** `dashboard.html`
  renders hardcoded "Imaginary Subscriber count: 24 / Simulated Page views: 771"
  and a static chart; the prod build does not strip it. Would ship to real
  creators. — admin
- [ ] **[ABSENT] Admin-only maintenance ops exposed to all users.** Backfill,
  recalc-pagination, publish-manifests buttons show with no role check. — admin
- [ ] **[ABSENT] Admin is desktop-only.** No `<meta viewport>` in any admin HTML
  file; essentially no responsive CSS. — admin
- [ ] **[ABSENT] Reader accessibility is near-zero.** No `alt` on comic images
  (data is available in the manifest but dropped), zero ARIA/roles, arrows-only
  keyboard nav. — reader
- [ ] **[ABSENT] Content warnings not rendered in the SPA reader.**
  `contentWarning` is in the manifest schema but not even mapped by the reader's
  parser. Hard blocker for hosting varied/NSFW third-party content. (The SSG
  *does* render a content-warning overlay; the SPA reader does not.) — reader
- [ ] **[ABSENT] No SEO essentials in generated sites.** No `sitemap.xml`, no
  `robots.txt`; `SITE_URL` defaults to `https://example.com` and isn't set in
  automated builds, so canonical/feed URLs are wrong; feed image URLs miss the
  API-base prefix. — ssg
- [ ] **[PARTIAL] Comments embed points at a personal dev Worker.**
  `chimera-comments.mike-17c.workers.dev` is hardcoded in the SSG template and
  is a `*.workers.dev` dev URL, not production-grade or per-comic configurable.
  — ssg + comments
- [ ] **[ABSENT] No GDPR / data-deletion path anywhere.** No account
  self-deletion, no data export/erasure, no consent capture, in either the CMS
  or comments. Storing reader emails (comments) with no erasure path is a
  compliance gap for EU readers. — backend + comments
- [ ] **[PARTIAL] Consistent user-facing error handling.** Admin failures mostly
  `console.error` and leave blank state; a `notify()` toast exists but is used
  inconsistently. — admin

## P3 — Growth / scale / monetization

- [ ] **[ABSENT] Billing / plans / quotas / storage caps.** No Stripe, no
  subscription, nothing tracking or capping per-creator R2 usage or page counts.
  Relevant given the financial-viability motivation for this pivot. — backend + admin
- [ ] **[ABSENT] Collaboration model.** One `author` per comic; `credits[]` is
  display-only; `editor` role is all-or-nothing (sees every comic). No
  co-author/per-comic-editor. Creators can't even delete their own comics
  (admin-only). — backend
- [ ] **[ABSENT] Custom domains.** Single hardcoded host; static CORS/CSRF
  lists; no per-tenant domain mapping. (The PHP-shared-host publishing model
  sidesteps this by putting creators on their own domains — see
  ARCHITECTURE-DECISIONS.) — backend + ssg
- [ ] **[ABSENT] Email / notifications.** No email adapter → no verification,
  invites, password reset, publish or reply notifications. — backend + comments
- [ ] **[ABSENT] Per-creator data export / portability.** Only whole-DB owner
  backups exist. — backend
- [ ] **[ABSENT] Incremental builds.** Every publish rebuilds and re-uploads the
  entire comic site. Fine for small comics, wasteful at scale. — ssg
- [ ] **[PARTIAL] Reader responsive images, zoom, fit modes, RTL.** Reader always
  serves the desktop image variant; no pinch-zoom, no fit-mode control, no
  reading-direction support. — reader
- [ ] **[ABSENT] Cross-device reading progress / accounts in reader.** Progress
  is localStorage-only; no reader accounts. — reader

---

## The shortest credible path to a first outside pilot

If the goal is one or two *friendly, hand-held* artists rather than open
signup, the critical path collapses to:

1. **All of P0** (non-negotiable — safety, legal, data integrity).
2. **Comic-creation UI + slug-per-tenant fix** (P1) so a second comic can exist
   cleanly.
3. **Per-comic theming + data-driven About + a build trigger** (P1) so their
   site doesn't look like Chimera's or ship Chimera's content.
4. **Basic comment moderation** (P0/P1) *or* ship the pilot with comments
   disabled.

Open signup, billing, custom domains, and collaboration (P3) can wait until the
model is proven with a handful of invited creators. See
[ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) first — the publishing-model
choice determines how much of the P1/P3 SSG work you even need.
