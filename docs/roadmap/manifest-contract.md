# Manifest Contract — Working Decision Log

**Status:** in active discussion (started 2026-07-22)
**Scope:** the published JSON contract emitted by `generate-manifests` and
consumed by the SSG (tier 1), the hub (tier 2), and the app/reader (tier 3).
This is the one cross-tier decision that can't wait (see
[ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) AD-2).

This doc is a **running log** — decisions get recorded as we reach them.
`SETTLED` = decided, don't relitigate. `OPEN` = still deciding. `PARKED` =
deferred to its own session.

**Paused 2026-07-22.** Contract's decidable layer is done (S1–S5, OPEN empty).
Resume with a PARKED item — recommend **P2 (theme)** next: it couples with S5
(both are Comics-schema + admin work). **P1 (images)** is the bigger rabbit hole
(stateful deployer). Two follow-up edits to OTHER docs still pending, deferred
intentionally until the discussion closes: (1) correct AD-2's "live-vs-static"
framing in `ARCHITECTURE-DECISIONS.md` (superseded by S1); (2) mark the
flat-schema plan docs in `docs/future publishing/` as superseded (per S2).

---

## Ground truth (verified against code, 2026-07-22)

The producer is `src/app/api/generate-manifests/route.ts`. It queries D1 and
writes **static JSON files to R2** under `pub/v1/`:
- `pub/v1/index.json` — master index of published comics
- `pub/v1/comics/{slug}/manifest.json` — per-comic, `version: '1.1'`

The `(payload)/api/pub/[...path]` route just does `bucket.get()` — it **streams
the pre-generated static file**, it is NOT a live DB query. So
`api.chimeracomics.org/api/pub/...` is a static file behind a Worker URL.

**Current per-comic manifest shape (v1.1):**
```
meta { id, slug, title, tagline, description, thumbnail, credits, links, genres, tags }
chapters[] { id, slug, title, order,
             pages[] { slug, globalPageNumber, chapterPageNumber,
                       image { original, mobile, desktop },
                       thumbnail, thumbnailLarge, width, height,
                       title, altText, authorNote, contentWarning, publishedDate } }
navigation { firstPage, lastPage, totalPages }
```

---

## SETTLED

### S1 — There is no live-API-vs-static-file conflict
Corrects an earlier claim in AD-2. Both the SSG and the reader consume the same
static nested v1.1 manifest served from R2. The producer and both shipping
consumers already agree on the nested shape. **The contract to ratify already
exists and already ships.**

### S2 — The "nested vs flat schema" conflict is code-vs-docs, not code-vs-code
The flat `pages[]` schema exists ONLY in the aspirational planning docs
(`docs/future publishing/.../SSG CONSTRUCTION PLAN.md`, hybrid
`ARCHITECTURE-PLAN.md`, and the `SAMPLE-MANIFEST-*.example` files). The two
actual shipping consumers (chimera-ssg, comicviewer) both speak nested v1.1.
The flat-schema plan docs are **superseded** and should be marked as such so they
stop generating phantom conflicts.

### S3 — Database IDs stay numeric (not up for debate)
Per `docs/known-issues.md:100` — Payload v3 + D1 adapter only supports integer
IDs; UUID/string-PK attempts all failed and were reverted. The DB layer is
settled. This is a separate layer from the public contract (see S4). Same doc,
line 118, already states the intended separation: "Public-facing sites can still
use slugs or UUIDs in URLs (independent of CMS IDs)."

### S4 — The public manifest should key on slug; numeric id is vestigial in the JSON (resolves O1)
Evidence gathered 2026-07-22 across all three consumers:
- **Admin (chimera-app):** keys on numeric id everywhere (API calls, URLs,
  localStorage, DOM) — BUT is **not a manifest consumer at all**. It's a pure
  Payload REST client; its only manifest touch is triggering
  `POST /generate-manifests` (`comicManagerOps.js:128`). So the admin's numeric-id
  use is on the CMS-API layer and does NOT constrain the public contract.
- **SSG (chimera-ssg):** routes entirely by `COMIC_SLUG`
  (`_data/comic.js:10,16`); fetches `.../comics/${comicSlug}/manifest.json`. Never
  reads `meta.id`. Only numeric-id use is `chapter.id` as an HTML anchor string
  (`#chapter-N`) for the archive jump-select (`archive.webc:25,29`) — cosmetic,
  not identity; any stable per-comic value (e.g. `order`) would do.
- **Reader (comicviewer):** fetches by slug and **builds its own ids from slug** —
  page id `${meta.slug}-page-${globalPageNumber}`, comic id `meta.slug`
  (`Manifestparser.js:128,153`). Ignores manifest `meta.id` entirely.

**Conclusion:** the published JSON's numeric `meta.id` is consumed by nobody;
`chapter.id` is used only as a throwaway anchor. Slug (forced unique) is the de
facto public key already. **Decision: the public contract keys on slug.** Whether
to physically remove `meta.id`/`chapter.id` from the emitted JSON or leave them as
harmless-but-deprecated is a minor cleanup (lean: drop `meta.id`; replace the
`chapter.id` anchor with `chapter.order` or `chapter.slug` in the SSG). The DB
layer is untouched (S3) — this is purely about what the JSON exposes.

### S5 — Two authored description fields, no "tagline" (resolves O2)
`generate-manifests` currently emits `tagline: comic.description?.substring(0, 200)`
— a mid-word truncation with no authored field behind it, feeding real SEO/social
slots (chimera-ssg `<meta name="description">` / `og:description` / Atom
`<subtitle>` in `base-layout.webc`, `feed.njk`, `index.webc`; comicviewer
description fallback `Manifestparser.js:158`).

**Domain decision (author's call, 2026-07-22):** "tagline" is the wrong concept —
it implies a movie-style marketing slogan. Webcomics rarely have taglines, and
when they do, the identity lives in the logo art, not a catalog field. Authors
should instead provide **two real fields**:
- **short description** — ~one sentence; feeds SEO/social/feed-subtitle slots
  (naturally lands in the ~150-160 char window, no truncation needed).
- **full description** — 1-3 paragraphs; feeds About page, hub detail view.

The derived `tagline` field is **removed**. Suggested field names:
`shortDescription` (new) + `description` (existing full one) — avoid "tagline"
and "summary" (both carry baggage).

**Scope note — this is more than a manifest change:** requires (a) a new
`shortDescription` field on the Comics collection, (b) admin UI to author it
(chimera-app comic editor), (c) generator emits it, (d) consumers read it for the
SEO/social slots instead of `tagline`. Sequence with the theming/collection work
(P2) since both touch the Comics schema + admin.

---

## OPEN

_(none — O1 → S4, O2 → S5.)_

---

## PARKED

### P1 — Image URLs & CMS-independence (the thorny one)
Tabled 2026-07-22 for its own focused session — has real engineering weight.
Summary of the problem so it's not lost:
- Tier 1 promises independence ("your PHP site keeps working if the CMS goes
  away"), but the SSG emits HTML that **links back to CMS-hosted images**, so the
  independence is currently an illusion — images 404 if the CMS is down.
- Naive fix (bundle all images per publish) breaks small/cheap publishes —
  re-uploads the whole comic every update.
- Proposed reframe (not yet decided): **separate the two lifecycles** — HTML is
  mutable+small (replace wholesale, fine); images are write-once+large (sync only
  new ones to a persistent `media/` dir outside the atomic release swap). HTML
  references images by local relative path; the manifest's base-URL rule governs
  the rewrite. Cost: the deployer becomes **stateful** (must track which images
  already exist on the host) — real work in `deploy-to-host.js` + `deployer.php`.
- Related contract need: a documented **base-URL rule** for image paths (manifest
  emits CMS-root-relative `/api/media/...`; consumers must resolve/rewrite).

### P2 — Theme / siteSettings block
Deferred as its own item. The contract has nowhere to carry per-comic theming
(P1 launch blocker for tiers 1 & 2). Old plan docs specced
`theme.{colorBackground,...}` + `siteSettings`. Needs: theme fields on the Comics
collection AND a theme block in the manifest. Tackle when theming work starts.
