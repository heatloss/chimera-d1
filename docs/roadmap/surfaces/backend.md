# Backend — chimera-d1 (Payload CMS v3, D1, R2, Workers)

The foundation everything else depends on. Solid single-tenant core; the
multi-tenant story is where the gaps are. This repo.

## Inventory (what exists)

### Collections (`src/collections/`)
- **Comics** — title, `slug` (globally unique — see gap), description, `author`
  (→users, auto-set to `req.user` on create), coverImage, `credits[]`,
  `links[]`, status (draft/live/hiatus/completed), publishSchedule,
  genres/tags (hasMany), `isNSFW`, `seoMeta`, `stats`. `afterChange` runs
  `deduplicateRelationships` (raw D1 SQL) to work around the adapter's hasMany
  duplication bug. Access: create=creator/editor/admin; read/update scoped to
  `author==user.id` for creators; **delete=admin only**.
- **Chapters** — comic (auto-selected if user has one comic), title, `slug`
  (unique *within comic*), `order` (read-only, auto), seoMeta, stats.
  `beforeDelete` reassigns orphaned pages to an auto-created "Unassigned Pages"
  chapter. Creator access via runtime subquery on owned comics.
- **Pages** — (~660 lines, largest) comic, `author` (denormalized from
  `comic.author` to avoid a D1 JOIN "ambiguous column" bug), chapter,
  chapterPageNumber, `globalPageNumber` (auto across comic), pageImage,
  pageExtraImages[], thumbnailImage, altText, contentWarning, authorNotes,
  status, publishedDate, navigation group, seoMeta, stats. Uses raw D1
  `updateComicPageStatistics()` to bypass Payload UPSERT (D1 UNIQUE-constraint
  workaround).
- **Media** — upload, `disableLocalStorage` (R2 only), image/*, `imageSizes`
  JSON (dodges D1 100-param limit), mediaType, `uploadedBy`, `isPublic`,
  comicMeta. `beforeChange` manually uploads to R2 + generates thumbnails
  (Photon WASM in Workers / Sharp in dev).
- **Users** — `auth:true`, single `role` field (admin/editor/creator, default
  **creator**). create/delete=admin only.
- **Genres / Tags** — global taxonomies shared across all comics.

### Custom API endpoints (`src/app/api/`)
- `comic-with-chapters/[comicId]` (GET) — ownership-checked ✓
- `bulk-create-pages` (POST) — up to 50 files/10MB; **no comicId ownership check** ✗
- `reorder-chapters` / `reorder-pages` (POST) — ownership-checked ✓
- `pages-with-media` (GET) — **`payload.find` without `user`, access bypassed** ✗
- `register` (POST) — public signup, `reader` role, CORS `*`
- `request-creator-role` (POST) — **self-upgrade to creator, no gating** ✗
- `recalculate-comic-pages`, `generate-manifests` (POST) — admin/editor only ✓
- `metadata` (GET) — public select-field options
- `d1-diagnostic` (GET/POST/DELETE/PUT) — **POST/DELETE/PUT unauthenticated, raw destructive SQL** ✗
- `test-delete/[pageId]` (DELETE) — diagnostic raw deletes (role-gated)

### Serving routes (`src/app/(payload)/api/`)
- Standard Payload REST + GraphQL + playground (fully exposed)
- `media/file/[filename]`, `media/thumbnail/[filename]` — **no access check** ✗
- `pub/[...path]`, `pub/media/[size]/[filename]` — published manifests/media,
  path-traversal guard ✓

### Frontend in this repo (`src/app/(frontend)/`)
- **Only the default Payload starter page.** No reader-facing frontend here; the
  real reader is the separate `comicviewer` SPA, fed by `generate-manifests`/`pub`.

### Infra
- Auth: Payload JWT, 24h expiry, **no refresh tokens, no email adapter** (so no
  password reset / verification server-side).
- Storage: R2 via manual hook uploads (official plugin disabled). D1 via custom
  lazy-binding Proxy (fixes stale-context DELETE bug — do not simplify).

## Gaps (launch-blockers for hosting others)

### P0 — Safety / integrity (verified against code)
- **[BUG] `d1-diagnostic` POST/DELETE/PUT unauthenticated + destructive.**
  DELETE handler (`route.ts:238`) → `DELETE FROM pages WHERE id=?` with no auth.
  PUT deletes `comics_rels`. Remove/lock before hosting anyone.
- **[BUG] Cross-tenant leaks:** `pages-with-media` (find without `user`),
  `bulk-create-pages` (no comicId ownership check), `Pages.delete` returns
  `true` for any creator (role-only, not owner-scoped).
- **[ABSENT] `request-creator-role` self-upgrades with no gating**, `register`
  has no email verification, no rate limiting, custom endpoints use CORS `*`.
- **[PARTIAL] Media file serving ignores `isPublic`/`uploadedBy`** — draft art
  leaks by filename.

### P1 — Core product
- **[BUG] `Comics.slug` globally `unique`** (`Comics.ts:194`) — contradicts
  CLAUDE.md; blocks two creators sharing a slug. (Chapters/Pages scope correctly.)
- **[ABSENT] No email adapter** → password reset/verification impossible
  server-side.

### P3 — Growth
- **[ABSENT] Billing / quotas / storage caps** — nothing tracks per-creator R2 usage.
- **[ABSENT] Collaboration** — one `author`/comic; `editor` all-or-nothing; no
  per-comic editor; creators can't delete own comics.
- **[ABSENT] Custom domains** — single hardcoded host, static CORS/CSRF.
- **[ABSENT] GDPR/deletion** — no self-delete, no cascade export/erase, no consent.
- **[PARTIAL] Backup** — whole-DB owner scripts only; no per-creator export.
- **[PARTIAL] Tenancy is app-code `author`-scoping**, no tenant primitive — see
  ARCHITECTURE-DECISIONS AD-4.

## Notes
- Known D1 workarounds (hasMany dedup, array-field stats, JSON thumbnails, lazy
  binding) are documented in CLAUDE.md and `docs/known-issues.md` — these are
  deliberate, not gaps.
