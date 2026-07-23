# SSG — chimera-ssg (11ty / WebC → PHP shared host)

A well-built **single-comic** generator that already proved the full
CMS-manifest → 11ty → PHP-host pipeline for one comic (live on
comic.the-ottoman.com). The gap is everything that makes it *many* comics.

Repo: `/Users/mike/Sites/chimera-ssg`

## Architecture verdict (up front)
- **Builds are automated in design but not yet wired.** The GitHub Actions
  workflow (`.github/workflows/build-deploy.yml`) works via `workflow_dispatch`
  (manual) and listens for `repository_dispatch` type `build-comic` — but the
  CMS side that fires that webhook doesn't exist (only `.example` files). Today:
  **effectively manual.**
- **Architected for many comics, builds one per run.** One shared template repo
  builds exactly one comic per invocation (`COMIC_SLUG`/`COMIC_ID`). No single
  build emits many sites; no orchestrator iterates comics.

## Inventory (what exists)
- **Content source:** Payload public API over HTTP —
  `${CMS_API_URL}/api/pub/v1/comics/${COMIC_SLUG}/manifest.json`
  (`src/_data/comic.js`). One manifest supplies everything; no build-time DB.
- **Generates:** per-page comic pages (WebC pagination → `comic/{slug}/index.html`),
  home (latest page), archive (grouped by chapter, jump-to-chapter select, lazy
  thumbs), about page, Atom feed (`/feed.xml`, last 20 pages).
- **Reader experience** (`comic-page.webc`): title, top+bottom nav
  (First/Prev/Next/Latest, aria-disabled at edges), click-image-to-advance,
  responsive `srcset` (mobile 960w / desktop 1440w), alt text, posted date,
  conditional author's note. Keyboard (arrows) + mobile nav toggle
  (`src/js/navigation.js`).
- **Content warnings** (recent commit): per-page overlay box with "View Page"
  reveal button (client-side CSS gate; image markup still in HTML).
- **Comments:** embedded via `chimera-comments.mike-17c.workers.dev/embed.js`
  with `data-page-id`/`data-comic-id`. Single hardcoded Worker endpoint.
- **Deployment:** PHP shared hosting via atomic symlink-swap `deployer.php` on
  the creator's own host (releases/ + site/ + .htaccess). Confirmed working on
  Dreamhost.

## Gaps (launch-blockers for hosting others)

### P1 — Core product
- **[PARTIAL/ABSENT] Theming not generated per comic.** `theme.css` is static
  and shared (header comment says it'll be generated from manifest — it isn't;
  passthrough-copied unprocessed). Manifest `theme` data never injected. Every
  hosted comic renders identical default colors/fonts. (Needs theme fields on
  Comics collection too — backend.)
- **[ABSENT] Hardcoded single-comic content.** `src/about.webc` is hand-written
  for *The Automan's Daughter* (cast, credits, FAQ) — not data-driven.
  `src/images/` holds that comic's character JPGs, copied into every build. Would
  ship the wrong About page + wrong images for every other creator.
- **[ABSENT] No multi-comic orchestrator + automated trigger.** Builds one comic
  per run; the CMS cron/afterChange hooks that fire `repository_dispatch` are
  only `.example` files. Publishing is manual.

### P2 — Table stakes
- **[ABSENT] No `sitemap.xml`, no `robots.txt`.**
- **[PARTIAL] Broken URLs in automated builds.** `SITE_URL` defaults to
  `https://example.com` and isn't set by the workflow → wrong canonical/feed
  URLs. Feed image URLs miss the `apiBase` prefix that page templates apply
  (`feed.njk` vs `comic-page.webc`) → likely broken feed images.
- **[PARTIAL] Comments endpoint is a personal dev Worker**, not per-comic
  configurable or production-grade.
- **[PARTIAL] Accessibility.** Good baseline (aria on nav, alt text) but the
  content-warning reveal button has no focus management/ARIA on the gated region,
  and the whole-image-as-next-link pattern is awkward for keyboard/SR users. No
  skip-link.

### P3 — Growth / scale
- **[ABSENT] Incremental builds.** Every trigger rebuilds + re-zips + re-uploads
  the whole `_site`.
- **[PARTIAL] Concurrency/scale.** Only a per-comic concurrency guard; no global
  throughput control or queueing for many simultaneous publishes.
- **[ABSENT] Creator preview / draft build mode.**
- **[ABSENT] Build notifications / rollback UI / per-comic error reporting.**

## Reader features
- **[ABSENT]** bookmarks / reading-position memory.
- **[PARTIAL]** navigation solid, but no in-reader chapter jump on comic pages
  (only archive), no page-number picker, no resume.

## Relationship to comicviewer
Complementary, not competing — see ARCHITECTURE-DECISIONS AD-2. This SSG is the
SEO/static/HTML + manifest-generation half; `comicviewer` is the rich SPA reader
half. The manifest-schema / live-API-vs-static-file conflict between them is
unresolved and launch-blocking.

## Maps to prior art
This is the "PHP shared-host SSG" plan in `docs/future publishing/` (in the
chimera-d1 repo). Plan Phases 1–3 are done; Phase 4 (theme system), Phase 7
(GitHub Actions trigger from CMS), and data-driven content are not.
