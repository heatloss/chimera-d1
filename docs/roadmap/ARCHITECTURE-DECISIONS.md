# Architecture Decisions — Unresolved Forks

These are decisions that gate real work. Until they're made, effort on the SSG
and reader risks going down a path you later reverse. None require code today —
they require a call.

---

## AD-1 — The three publishing models are one funnel, not a fork

**Corrected 2026-07-22 (was: "pick one model").** The three architectures in
`docs/future publishing/` are **not** competing alternatives to choose between.
They are three tiers of a single onboarding funnel, intended to be **maintained
together**, each a heavier commitment than the last:

| Tier | Model | Role in the funnel | Who hosts | Monetization |
|------|-------|--------------------|-----------|--------------|
| **1 — On-ramp** | PHP shared-host SSG | Let artists *borrow* the CMS while keeping their existing (e.g. DreamHost) site independent — a low-risk trial of the interface + features without leaving their current host | Artist (their own hosting) | none |
| **2 — The hub** | Cloudflare R2 + Worker | The "real" product: a curated, **invitation-only** collective in the spirit of SpiderForest / Hiveworks | Platform | none expected at launch |
| **3 — The app** | SPA / native, API-fed | Elevated, mobile-optimized reading layered on the hub | Platform | subscriptions (the revenue vehicle) |

Built status today: **Tier 1 is proven end-to-end** (live on
comic.the-ottoman.com); Tier 2 is plan-only (`.example` files); Tier 3 exists as
a working prototype reader (`comicviewer`) that already consumes manifests.

### Why this framing matters for prioritization

- **The funnel runs easiest-first.** The most-built tier (1) is also the
  lowest-risk and cheapest to ship; each tier up adds a heavier ring of
  requirements (serving isolation → custom domains → hosting cost → billing).
  Sequence work up the tiers.
- **Tier 1 does NOT let you skip the backend P0s.** All three tiers share one
  Payload CMS. The moment a *second invited artist* has a login, the
  cross-tenant leaks and the unauthenticated `d1-diagnostic` DELETE are P0 —
  regardless of where their site is served. What tier 1 *does* defer: serving
  isolation, custom domains, hosting cost/quotas, and the entire reader/SPA
  surface.
- **Curation shrinks the tier-1 path.** All tiers are **invitation-only /
  curated** (confirmed 2026-07-22 — opening the floodgates before extensive
  dogfooding "would be inviting disaster"). So open self-service signup is *not*
  needed for launch; an **invite/admin-onboard path** is. The ungated
  `request-creator-role` self-upgrade must still be **closed** (it's a hole
  either way), but the "no public signup UI" item drops off the tier-1 critical
  path.
- **Comments defer to tier 2.** A tier-1 artist keeps whatever commenting their
  own PHP host already has (or Disqus, etc.). The comments Worker only becomes
  necessary for *unified* commenting on the hub — so its P0s largely leave the
  tier-1 path (see AD-3).

### Not a permanent commitment

All three pathways will be **actively maintained**, but which get *emphasized* at
launch is deliberately left open — testers' and the public's reception may lead
to de-emphasizing one (the app may remain a future prospect; PHP publishing may
become an unpublicized legacy-user feature). So: **do not delete or bet against
any tier**, but treat tier 1 as the near-term launch target and tier 3 as the
furthest horizon. The only cross-tier decision that can't wait is the manifest
contract — see AD-2.

## AD-2 — Reader (comicviewer) vs SSG (chimera-ssg): one system or two?

The reader's own `docs/cms reference/hybrid SPA SSG/ARCHITECTURE-PLAN.md` says
they are **two halves of one system**: the SSG produces SEO/static HTML *plus* a
`manifest.json`, and `comicviewer` is meant to become the `reader/` SPA shell
that consumes it. `MODULE-MIGRATION-MAP.md` even maps the reader's existing
modules into that architecture. So they're complementary, not competitors.

**But there's an unresolved integration conflict that blocks convergence:**

- **Source of truth differs.** The live reader fetches from a **live Worker
  API** (`api.chimeracomics.org/api/pub/v1/...`); the hybrid plan wants **static
  per-comic `manifest.json` files** co-located with each comic's static site.
- **Manifest schema differs.** Reader uses nested `chapters[].pages[]` (v1.1)
  with `original/mobile/desktop` image objects; the SSG sample uses a **flat
  `pages[]`** array with a single `image` string and global page numbers.

**Decision needed:** settle one manifest contract (schema + whether it's a live
API or a static file) that both the SSG and the reader consume. This is itself a
launch-blocking integration decision — without it, work on either side may not
compose. Recommend: static co-located manifest (matches the "no runtime CMS
dependency" goal and the chosen publishing model), one schema version, both
tools updated to it.

## AD-3 — Comments: build out the existing service, or defer?

`chimera-comments` has a 700-line spec describing full moderation/multi-tenancy,
but only ~15–20% is built, and what's built has isolation bugs (see
LAUNCH-BLOCKERS P0). Two viable paths:

- **Defer comments for the first pilot.** Ship with comments disabled (the SSG
  has a `showComments` prop). Removes several P0 items from the critical path.
- **Invest in the service now.** Requires, at minimum: comic-ownership/origin
  binding + creator auth, the reaction-keying bug fix, a moderation queue +
  banning, and rate limiting — roughly the bulk of the spec.

**Recommendation:** defer for the first hand-held pilot unless a pilot artist
specifically needs comments; the moderation surface is large and every piece is
P0-sensitive when strangers can post.

## AD-4 — Tenancy model: `author`-scoping vs a real tenant boundary

Today isolation is purely `author == user.id`, enforced per-collection in app
code — which is why it's already leaked in three endpoints (LAUNCH-BLOCKERS P0).
There is no tenant object. Two directions:

- **Harden the current model.** Audit every endpoint/collection for ownership
  checks, add owner-scoping to `Pages.delete`, thread `user` through all
  `payload.find` calls. Lower effort, but fragile — easy to forget again.
- **Introduce a first-class tenant/ownership primitive** (e.g. a membership
  table, per-comic roles) so collaboration (P3) and isolation share one
  mechanism. Higher up-front cost, sturdier foundation.

**Decision needed before P3 collaboration work**, because a co-author model and
a leak-proof isolation model are the same problem. For the first pilot, hardening
the current model is enough; don't build the tenant primitive until collaboration
is actually on the roadmap.
