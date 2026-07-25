# Visibility Model

**Status**: implemented July 25, 2026 (Payload v3.86.0)
**Applies to**: `pages` and `comics` collections, `/api/generate-manifests`, and
the `chimera-app` editors.

This document is the authoritative description of how content becomes publicly
visible. If you are about to add a status-like field, read this first.

## The core rule: two independent axes

Visibility and time are **separate, orthogonal fields**. They were conflated in
the original design — a single `status` enum tried to encode both — and that
conflation is what this model replaces.

For a **page**:

| Axis            | Field           | Values                       |
| --------------- | --------------- | ---------------------------- |
| Visibility      | `visibility`    | `private` \| `public`        |
| Time            | `publishedDate` | any timestamp, or null       |

All four combinations are legal and meaningful. Neither field gates the other:
a user may set a future date on a draft and then flip it to public, or flip to
public first and adjust the date afterwards.

### Derived state

The three states a user actually thinks about are **derived, never stored**:

| `visibility` | `publishedDate` | Derived state | Publicly visible? |
| ------------ | --------------- | ------------- | ----------------- |
| `private`    | null            | **Draft**     | No                |
| `private`    | past            | **Draft**     | No                |
| `private`    | future          | **Draft**     | No                |
| `public`     | null            | **Live**      | Yes (see below)   |
| `public`     | past            | **Live**      | Yes               |
| `public`     | future          | **Queued**    | No                |

A draft is never public, regardless of its timestamp. That is the whole point of
the separation: the timestamp is scheduling metadata, not a visibility switch.

The `public` + null combination is transient — see *Date stamping* below; a
public page never keeps a blank date after a save.

**Do not re-introduce a third `visibility` value such as `scheduled`.** "Queued"
is a reading of two fields, not a state to store. Storing it would recreate the
original bug: a page whose stored status and actual timestamp can disagree.

### Single source of truth for the derivation

Frontend: `derivePageState(page)` in `chimera-app/src/js/utils.js`. Do not
re-derive this inline in a component or template — every place that shows state
must agree, including after a date crosses `now` while a page is open.

Backend: the equivalent is the where-clause predicate

```js
{ visibility: { equals: 'public' }, publishedDate: { less_than_equal: now } }
```

This predicate is what keeps queued pages off the public site. Any new query
that feeds reader-facing output must use **both** halves of it.

## Date stamping rules

Implemented in the Pages `beforeChange` hook.

1. **Fill only, never overwrite.** If a page becomes `public` with no
   `publishedDate`, the date is stamped to `now` and persisted. An existing date
   is the user's intent and is left strictly alone — whether it is in the past (a
   backdated archive page) or the future (a queued page). Clobbering it would
   destroy scheduling.
2. **The system never rewrites a timestamp.** Only the user changes an existing
   date.
3. **Drafts are not required to have a date** and are never stamped. A draft may
   carry a date if the user set one; it is preserved through the draft → public
   transition.
4. **A non-draft never has a blank date.** Rule 1 guarantees this on save.

## Publish requirements (server-enforced)

A page cannot be `public` without a title, a page image, and a chapter
assignment. This is enforced in the Pages `beforeValidate` hook, which throws an
`APIError` naming the missing fields.

Drafts are deliberately exempt — a draft may be as incomplete as the user likes.
This mirrors the frontend's `validatePage()` gate, which skips validation for
drafts. Before this change the rule existed **only** in the frontend, so the API
would happily accept an unpublishable public page; the hook closes that
asymmetry. The two must stay in agreement.

## Comics: visibility and lifecycle

Comics have no timestamp axis, so their second axis is different. The old
`status` enum (`draft|live|hiatus|completed`) mixed visibility with publication
lifecycle in the same way pages mixed it with time.

| Axis        | Field        | Values                                   |
| ----------- | ------------ | ---------------------------------------- |
| Visibility  | `visibility` | `private` \| `public`                    |
| Lifecycle   | `lifecycle`  | `ongoing` \| `hiatus` \| `completed`     |

All six combinations are legal: a comic can be on hiatus and private (paused
while unreleased), completed and private (an archive not yet opened), and so on.

`visibility: public` is **necessary but not sufficient** for a comic to appear
on the public site — `generate-manifests` also requires at least one live page.
Lifecycle is deliberately **not** consulted when generating manifests: a paused
or finished comic is still a readable archive.

Vocabulary note: both collections use `private`/`public` for the visibility
axis. The page editor labels them "Draft"/"Published" because that is what
authors call them; comics use the literal words. The stored values are identical.

## Auto-publish (NOT YET IMPLEMENTED)

A queued page becomes live when its date passes. Because the public read surface
is a set of **static manifests in R2**, nothing changes on its own — the
manifests must be regenerated for a newly-live page to appear.

**Planned**: a Cloudflare Cron Trigger firing every 30 minutes that regenerates
manifests. Until that exists, a queued page's date passing has no public effect
until someone triggers `/api/generate-manifests`.

30 minutes is the deliberate launch granularity. If polling ever needs to be
finer, the project will likely have moved off D1 by then.

Known prerequisites for that work (see the tracked follow-up in
`docs/roadmap/LAUNCH-BLOCKERS.md`):

- OpenNext exposes no config hook for a `scheduled` handler. It needs a
  hand-written `worker.ts` that imports `.open-next/worker.js`, re-exports its
  Durable Object classes, and is pointed at by wrangler's `main`.
- `generate-manifests`'s POST handler requires admin/editor auth. The generation
  logic must be extracted into a plain function callable without headers or a
  user before cron can invoke it.

## Migration

`src/migrations/20260725_visibility_lifecycle_split.ts` performs the split.

Pages: `status IN ('published','scheduled') → visibility 'public'`, else
`private`; then any public page with a null `published_date` is backfilled from
`created_at` (the migration logs an audit count first — it fired on 0 rows in
both the local and remote datasets). `status` is then dropped.

Comics: `status='draft' → private`, else `public`; `lifecycle` derived from
`hiatus`/`completed`, else `ongoing`. `status` is then dropped.

`down()` reconstructs the old enums, mapping public+future → `scheduled`. The one
lossy cell is documented in the migration: a private comic reverts to `draft`,
discarding its lifecycle, because the old model had nowhere to put it.

The `scheduled` value was fully vestigial before this change — declared and
validated against, but never written by any code path. Zero rows carried it.

## Follow-up: `publishSchedule` overlap

`Comics.publishSchedule` still offers `completed` and `inactive`, which now
overlap with `lifecycle`. `publishSchedule` is meant to describe cadence
("weekly"), not state. This is flagged with a `TODO(follow-up)` in
`src/collections/Comics.ts` and is out of scope here.
