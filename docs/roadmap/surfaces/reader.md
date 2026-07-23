# Reader — comicviewer (vanilla-JS SPA)

A working **prototype** reader with a genuinely strong swipe/touch core, already
migrated to consume CMS JSON manifests. Not launch-ready for third parties: the
whole supplementary layer (a11y, content warnings, theming, comments, accounts)
exists only as unimplemented plans, and it still carries legacy scraper code.

Repo: `/Users/mike/Sites/comicviewer`

## What it is
Vanilla ES-module SPA (19 modules, ~2,858 LOC), no framework, no build step.
Custom mini-framework (router, zone/tab systems, templater). Service worker.
Deployed as static assets to Cloudflare. Self-described as a prototype.

**Origin matters:** it began as an **unauthorized scraper** of ~70 third-party
public webcomics. It's since been migrated to Chimera's own CMS manifests, but
the scraper code and third-party cover art still physically ship (see P0 legal).

## Inventory (what exists)
- **Navigation:** PREV/NEXT, three-image "ghostmount" slide transitions,
  jump-to-page range slider, chapter menu from `storylines[]`, "rack" chapter
  covers, home grid of comics, between-chapter interstitials, first/last edge
  handling.
- **Keyboard:** left/right arrows only (deprecated `keyCode`, single global
  `document.onkeydown`). No space/Home/End/PageUp-Down.
- **Touch/swipe:** full custom engine (drag, snap, momentum, orientation),
  gated on `pointer:coarse`. The most polished part.
- **Tap behavior:** configurable (advance / hide bars / nothing).
- **Progress:** `setReadingPosition()` → localStorage per slug (per-device).
- **Subscriptions:** "follow" comics in localStorage.
- **Settings:** color mode (light/dark/system), grid sort, tap behavior.
- **Data:** fetches static JSON manifests at runtime — index
  `api.chimeracomics.org/api/pub/v1/index.json`, per-comic
  `.../comics/{slug}/manifest.json`; `transformManifest()` maps CMS
  `chapters[].pages[]` → SPA `storylines[].pages[]`.

## NOT present (searched)
- **Zoom / pinch-zoom** — absent.
- **Fit modes** — single `object-fit: contain` only.
- **Thumbnail strip / page picker inside reader** — only home grid / chapter covers.

## Planned vs done (docs/)
All forward-looking features are **plans/specs only, none implemented**:
- `MIGRATION-TO-CMS-MANIFESTS.md` — mostly done (manifest plumbing works).
- `STATE-MANAGEMENT-PLAN.md` — not started; proposes a `module.State.js` store to
  replace DOM-as-state. Prerequisite for the others; `module.State.js` doesn't exist.
- `READER-ENHANCEMENTS-PLAN.md` — not started; content warnings, author notes,
  alt-text display, comments.
- `refactoring-recommendations.md` — not started; includes a **documented,
  still-unfixed router bug** (history-encoding discards its map result).
- `module.DownloadManager.md`, `reader-accounts-spec.md` — not started.

Manifest fields `altText`/`authorNote` are carried by the parser but never
rendered; `contentWarning` isn't even mapped.

## Gaps (launch-blockers for hosting others)

### P0 — Legal
- **[LEGAL] Legacy scraper code + third-party cover art still ship.**
  `js/comics.js` (607 lines), `js/module.Archiveparser.js`, and `img/hubbox_*.png`
  covers of real third-party comics remain despite being "removed." Strip before
  this hosts others' work.

### P2 — Table stakes
- **[ABSENT] Accessibility near-zero.** No `alt` on comic images (data available,
  dropped in `generateGhostMount`), zero ARIA/roles/tabindex, arrows-only
  keyboard, no focus management.
- **[ABSENT] Content-warning UI.** `contentWarning` in manifest schema but not
  mapped or rendered. Hard blocker for varied/NSFW third-party content. (Note:
  the SSG *does* render CW overlays; the SPA reader doesn't — divergence.)
- **[ABSENT] Author notes / creator attribution not surfaced** despite data
  being present.
- **[PARTIAL] Known unfixed router bug** affects URL/bookmark encoding.
- **[PARTIAL] Service worker** points offline fallback at a **missing
  `/offline.html`**; unbounded cache, no versioning/eviction.

### P3 — Growth
- **[PARTIAL] Responsive images** — variants exist but reader always serves
  `desktop`; mobile downloads full-size.
- **[ABSENT] Zoom/pinch, fit modes** — blocker for dense/high-res varied art.
- **[ABSENT] Per-comic theming; reading direction (RTL/vertical)** — global
  light/dark only; left=prev/right=next hardcoded.
- **[ABSENT] Comments** — no module (planned only).
- **[PARTIAL] Cross-device progress / accounts** — localStorage only.
- **[PARTIAL] Naive prefetch** — eagerly loads ±6 full-res pages on main thread;
  no `loading="lazy"`, no `srcset`.
- **[PARTIAL] Scattered state** (DOM attrs + module globals) — the
  STATE-MANAGEMENT-PLAN calls this the blocker for building any planned feature.
- **[ABSENT] No tests/CI; leftover console.log debugging.**

## Relationship to chimera-ssg
Two halves of one intended system — see ARCHITECTURE-DECISIONS AD-2. This reader
is meant to become the `reader/` SPA shell the SSG feeds. Blocking conflict:
live-API vs static-manifest source of truth, and nested vs flat manifest schema.
