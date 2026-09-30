# Architecture Audit — September 2026

**Date:** 2026-09-08
**Scope:** All of `src/` (collections, custom routes, config, migrations), repo
hygiene, docs accuracy. Read-only audit; no code was changed.
**Method:** Three parallel reviews (access control / security, data integrity /
concurrency, engineering hygiene). Every finding marked CONFIRMED was read in
the code and, where noted, checked against the local D1 database or Payload's
own source in `node_modules`. LIKELY means it follows from the code but was not
executed.

This document is written so that a model with less context can execute the
fixes. Each work item has: what is wrong, where, what "done" looks like, and how
to verify. Work items are ordered by priority. Do them in order unless a later
item is a prerequisite for an earlier one (none are).

Items already tracked in `LAUNCH-BLOCKERS.md` are marked **[KNOWN]**. Items
first identified by this audit are marked **[NEW]**.

---

## Executive summary

**Verdict:** A well-reasoned core (Cloudflare/D1 plumbing, the visibility model,
the manifest retraction logic) wrapped in a data layer that is held together by
patches, plus several security holes that become critical the moment a second
user has a login.

**Three things to fix before anything else (all NEW):**

1. Any authenticated user can set their own `role` to `admin`.
2. The GitHub repo is public and contains plaintext temp passwords, password
   hashes, salts and session rows.
3. Every media file is enumerable via the stock REST API and fetchable with no
   visibility check.

**The structural flaw:** `globalPageNumber`, `navigation.*`, `chapters.stats.*`
and `comics.stats.*` are all stored caches of one underlying fact (chapter
order + within-chapter position). There are 4 / 5 / 4 / 2 independent
implementations of recomputing them. Most write paths never recompute
downstream values. The database enforces none of the invariants. This is the
root cause of the open page-numbering corruption bug, and the reason every
patch so far has added another implementation instead of removing one.

**What is good and must be preserved:**

- The lazy D1 binding Proxy in `src/payload.config.ts` (see the comments there
  and `CLAUDE.md`). Do not simplify it.
- The visibility/timestamp split (`docs/visibility-model.md`). Derived state is
  never stored. Keep it that way.
- Manifest retraction in `src/app/api/generate-manifests/route.ts`.
- All raw SQL is parameterised via `.bind()`. Keep it so.

---

## Priority 0 — Security (fix before anyone else has a login)

### P0-1 [NEW] Role self-escalation

**What:** `src/collections/Users.ts` `access.update` lets any user update their
own record (`{ id: { equals: user.id } }`). The `role` field has no field-level
`access`. Chain: `POST /api/register` → log in → `PATCH /api/users/<own-id>`
with `{"role":"admin"}` → full admin.

**Fix:** Add field-level access to the `role` field:

```ts
{
  name: 'role',
  type: 'select',
  // ...existing config...
  access: {
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
  },
}
```

Also add `access.admin` to the Users collection so `reader` accounts cannot
open the admin panel:

```ts
access: {
  admin: ({ req: { user } }) => ['admin', 'editor', 'creator'].includes(user?.role),
  // ...existing rules...
}
```

**Verify:** As a `reader`, `PATCH /api/users/<own-id>` with `{"role":"admin"}`
must return 403 or leave role unchanged. `/api/request-creator-role` still works
(it runs server-side with Local API; confirm it uses `overrideAccess: true` or
an admin-context update).

### P0-2 [NEW] Credentials committed to a public repository

**What:** `gh repo view heatloss/chimera-d1` reports `visibility: PUBLIC`. The
following are git-tracked:

- `backups/temp-passwords-2025-10-15T20-17-23.579Z.txt` and
  `backups/temp-passwords-2025-10-15T20-25-51.455Z.txt` — plaintext email +
  password pairs.
- `backups/remote-export-20251122-154410/users.json` — `hash`, `salt`,
  `reset_password_token` columns.
- `backups/remote-backup-20251123-*.sql`, `backups/remote-backup-20251215-*.sql`
  — user and `users_sessions` rows.
- Root-level SQL dumps: `.temp-d1-export.sql`, `local-db-export.sql`,
  `local-db-no-pragma.sql`, `local-data-*.sql`, `drop-remote-tables.sql`.

`backups/` is in `.gitignore` (line 58) but the files were added before that
rule, so they remain tracked.

**Fix (in order):**

1. Make the repo private until steps 2-4 are done.
2. Force a password reset for every user in the dumps (all accounts as of
   2025-12-15). Invalidate all sessions.
3. `git rm --cached` every file listed above plus the whole `backups/` tree.
   Move anything worth keeping outside the repo.
4. Rewrite history to remove them (`git filter-repo` or BFG), force-push, and
   have any other clone re-clone. Rotating credentials (step 2) matters more
   than the rewrite because forks and caches may already exist.
5. Add `*.sql` at repo root to `.gitignore`.

**Verify:** `git ls-files | grep -iE 'passw|backups/|\.sql$'` returns nothing.
`git log --all --diff-filter=A -- 'backups/*'` returns nothing after rewrite.

### P0-3 [KNOWN] Unauthenticated destructive endpoint

**What:** `src/app/api/d1-diagnostic/route.ts` has no auth on any verb. `DELETE
?id=N` runs `DELETE FROM pages WHERE id = ?` for anonymous callers. `POST`
inserts a raw row into hardcoded comic 4 / chapter 10. `PUT` rewrites
`comics_rels`. `GET` dumps table contents, `Object.keys(env)` (every binding
and secret *name*), and `error.stack`. It is deployed to production.

Also: `src/app/api/test-delete/[pageId]/route.ts` (role-checked but not
owner-scoped, returns `err.stack`), `src/app/my-route/route.ts` (template
stub), and empty dirs `src/app/api/test-wasm/`, `src/app/api/pages/[id]/delete/`.

**Fix:** Delete all four. If d1-diagnostic is genuinely still needed for
debugging the binding-staleness issue, keep only the GET, gate it on
`user.role === 'admin'`, and strip the env-keys and stack-trace output. Update
the comment in `src/payload.config.ts` (lines 45-46) that says the global is
kept partly for this route.

**Verify:** `curl -X DELETE https://<host>/api/d1-diagnostic?id=1` returns 404.

### P0-4 [NEW, extends KNOWN] Media enumerable and unprotected

**What:**

- `src/collections/Media.ts:142-144` — `isPublic` defaults to `true`.
- `src/collections/Media.ts:23-38` — anonymous `read` returns
  `{ isPublic: { equals: true } }`. Combined, the stock `GET /api/media` lists
  every media doc (filename, sizes, related comic) to anyone.
- `src/app/(payload)/api/media/file/[filename]/route.ts`,
  `.../media/thumbnail/[filename]/route.ts`, and
  `.../pub/media/[size]/[filename]/route.ts` stream any R2 `media/*` object with
  no auth and no visibility check, with `Cache-Control: public, max-age=31536000,
  immutable`. The `pub/media` route also lazily generates and *writes* resized
  images to R2 for any original, so anonymous callers can burn image-worker CPU
  and R2 writes.

**Fix:**

1. Change `isPublic` default to `false`. **Caution:** `docs/known-issues.md`
   says changing a `defaultValue` triggered a catastrophic Drizzle migration in
   the past. `push: false` is set in the config so auto-push is off, but test
   the change locally first and back up the DB. If it still misbehaves, leave
   the schema default and set `isPublic: false` in a `beforeChange` hook on
   create instead.
2. Add an `afterChange` hook on Pages (or extend the existing one) that sets
   the page image's `isPublic` to whether the page is live (public + past
   date). Alternatively resolve it at serve time (step 3).
3. In the three image routes, before streaming: look up the media doc by
   filename, and if `isPublic` is false, require `payload.auth` and check the
   caller owns it or is admin/editor. Drop the 1-year cache header for
   non-public files.
4. Anonymous `Media.read` should return `false` unless there is a concrete need
   for the REST listing. The public surface is the manifests and the image
   routes, not the collection.

**Verify:** As anonymous, `GET /api/media` returns an empty list or 403. A
draft page's image URL returns 403/404 anonymously and 200 for its author.

### P0-5 [NEW] Creators can write into other creators' comics via stock REST

**What:**

- `src/collections/Pages.ts:27-29` and `src/collections/Chapters.ts:15-17` —
  `access.create` checks role only, never that `data.comic` is owned by the
  caller. `Pages.ts:714-725` then sets `author = comic.author`, attributing the
  injected page to the victim.
- `Pages.update` scopes by the *existing* doc's author, but `data.comic` is not
  validated, so a creator can move their own page into another creator's comic.
- `src/collections/Comics.ts:224` `author` field has no field-level access; a
  creator can create a comic with `author: <someone else>` or reassign their own.
- `src/collections/Media.ts:120-140` `uploadedBy` likewise.

**Fix:** Add a shared helper, e.g. `src/lib/access.ts`:

```ts
export async function userOwnsComic(payload, user, comicId): Promise<boolean> {
  if (!user) return false
  if (['admin', 'editor'].includes(user.role)) return true
  const comic = await payload.findByID({ collection: 'comics', id: comicId, depth: 0 })
  const authorId = typeof comic?.author === 'object' ? comic.author?.id : comic?.author
  return authorId === user.id
}
```

Then:

- `Pages` and `Chapters` `access.create`: resolve `data.comic` and call
  `userOwnsComic`. (Payload passes `data` to `create` access functions.)
- Add a `beforeChange` check on Pages and Chapters: if `data.comic` differs
  from `originalDoc.comic` on update, call `userOwnsComic` on the new comic and
  throw `APIError(403)` if false.
- `Comics.author`: field-level `access.update: admin only`,
  `access.create: admin only`, and in `beforeChange` on create force
  `data.author = req.user.id` when the user is a creator.
- `Media.uploadedBy`: same pattern.

**Verify:** As creator A, `POST /api/pages` with `comic: <B's comic>` returns
403. As creator A, `PATCH /api/pages/<A's page>` with `comic: <B's comic>`
returns 403.

### P0-6 [KNOWN] Cross-tenant reads/writes in custom routes

**What:**

- `src/app/api/pages-with-media/route.ts:64,77,90` — `payload.find` /
  `findByID` called without `user` or `overrideAccess: false`, and no ownership
  check. Any authenticated user reads any comic's drafts, queued pages,
  `authorNotes`, and media. The `sort` param (line 39) is passed through
  unvalidated.
- `src/app/api/bulk-create-pages/route.ts:36-52` — role check only;
  `comicId` and each `pageData.chapterId` are never checked for ownership or
  that the chapter belongs to the comic.

**Fix:** Use `userOwnsComic` from P0-5 in both routes right after
`payload.auth`. In bulk-create, also verify each chapter's `comic === comicId`.
Whitelist `sort` in pages-with-media to a fixed set.

**Reference implementations that already do this correctly:**
`src/app/api/reorder-pages/route.ts:63-89`,
`src/app/api/reorder-chapters/route.ts:62-87`,
`src/app/api/comic-with-chapters/[comicId]/route.ts:54-61`. Copy their pattern,
then refactor all of them to use the shared helper.

### P0-7 [KNOWN] Ungated self-upgrade and open registration

**What:** `src/app/api/request-creator-role/route.ts:45-51` instantly promotes
any reader to creator. `src/app/api/register/route.ts` has no email
verification or rate limit. All custom routes send
`Access-Control-Allow-Origin: *`.

**Fix:** Per `ARCHITECTURE-DECISIONS.md` AD-1, launch is invitation-only. Make
`request-creator-role` create a pending request (a flag on the user or a small
collection) that an admin approves, or delete the route and have admins set
roles directly. Replace CORS `*` with the same origin list used in
`payload.config.ts` `cors:`, extracted to one shared constant.

---

## Priority 1 — Data integrity (the structural fix)

### P1-1 [KNOWN, root cause NEW] One source of truth for page ordering

**Problem statement:** The following are all stored, and all derive from
(chapter `order`, page `chapterPageNumber`):

| Stored value | Where | Implementations of "recompute it" |
|---|---|---|
| `pages.globalPageNumber` | `Pages.ts:742-819`, `reorder-chapters/route.ts:142-209`, `recalculate-comic-pages/route.ts:112-171`, `bulk-create-pages/route.ts:465-516` | 4 |
| `pages.navigation.{previousPage,nextPage,isFirstPage,isLastPage}` | `Pages.ts:1136-1225` (updatePageNavigation), `Pages.ts:1229-1303` (fixAdjacentPagesAfterDelete), `reorder-pages/route.ts:162-215`, `reorder-chapters/route.ts:185-206`, `recalculate-comic-pages/route.ts:265-331` | 5 |
| `chapters.stats.{pageCount,firstPageNumber,lastPageNumber}` | `Pages.ts:962-1021`, `Chapters.ts:515-561`, `bulk-create-pages/route.ts:578-622`, `recalculate-comic-pages/route.ts:177-259` | 4 |
| `comics.stats.totalPages` | `Pages.ts:1052-1132` (counts LIVE pages), `bulk-create-pages/route.ts:533-539` (counts ALL pages) | 2, **different semantics** |

Write paths and whether they renumber downstream pages (CONFIRMED):

| Write path | Renumbers downstream? |
|---|---|
| Page create in chapter N | No — pages in later chapters keep stale globals; guaranteed duplicate |
| Page delete (`Pages.ts:894-930`) | No — only ±1 neighbour navigation patched |
| Chapter delete (`Chapters.ts:341-398`) | No — pages moved to Unassigned with `skipGlobalPageCalculation`; `chapterPageNumber`s collide with existing Unassigned pages; `totalChapters` never decremented (no afterDelete) |
| Chapter `order` edited via REST (field is only `readOnly` in admin UI) | No |
| `reorder-chapters` | Yes |
| `reorder-pages` | Within chapter only (fine) |
| `bulk-create-pages` | Globals yes, **navigation no** (see P1-2) |
| `recalculate-comic-pages` | Yes (manual repair) |

Navigation is located by `globalPageNumber ± 1` arithmetic, so any gap makes
`prevPage` null → `isFirstPage: true`. This is exactly the observed corruption
in comics 1 and 3 (see `docs/known-issues.md` "Page Deletion Corrupts...").

**Recommended fix (option 3 in known-issues, plus consolidation):**

1. **Create one function** `src/lib/renumberComic.ts`:
   `renumberComic(payload, comicId, req?)`. It loads all chapters for the comic
   sorted by `order`, all pages per chapter sorted by `chapterPageNumber`,
   assigns `chapterPageNumber = 1..N` within each chapter (closing gaps) and
   `globalPageNumber` sequentially across chapters, then recomputes chapter
   stats and comic stats. Write only rows that changed. Pass every guard flag so
   nested hooks do nothing. Base it on `recalculate-comic-pages/route.ts`,
   which is the most complete existing implementation.
2. **Call it from every write path:** Pages `afterChange` (create, or update
   where `chapter` or `chapterPageNumber` changed), Pages `afterDelete`,
   Chapters `afterChange` (where `order` changed), Chapters `afterDelete`,
   end of `bulk-create-pages`, end of `reorder-pages`, end of
   `reorder-chapters`. Make `recalculate-comic-pages` a thin wrapper around it.
3. **Delete** the four other global-number implementations, the two chapter-stat
   helpers outside the shared function, and `fixAdjacentPagesAfterDelete`.
4. **Stop storing navigation.** Remove the `navigation` group from Pages (or
   keep the columns but stop writing them, as a first step). Derive prev/next at
   read time: in `generate-manifests` from the sorted page array (it already
   does positional work at `route.ts:427`), and in any API consumer by
   `globalPageNumber ± 1` on now-guaranteed-contiguous numbering. This removes
   the doubly-linked-list class of bug entirely. **This is a schema + manifest
   + reader change** — check `docs/roadmap/manifest-contract.md` and the
   reader before removing fields the manifest exposes.
5. **Pick one meaning for `comics.stats.totalPages`.** The Pages hook's LIVE
   definition is the deliberate one (see the comment at `Pages.ts:1054-1057`).
   Make bulk-create use the shared function so it inherits that.
6. **Add database constraints** in a migration: unique index on
   `(comic_id, slug)` for pages and chapters; unique on
   `(chapter_id, chapter_page_number)`; unique on `(comic_id, order)` for
   chapters. Run `renumberComic` on every comic *before* applying the unique
   indexes, or the migration will fail on the currently-corrupt comics 1 and 3.
7. **Fix the chapter order query** at `Chapters.ts:241-248`: add
   `where: { comic: { equals: comicId } }` — it currently takes the max across
   all comics.

**Cost note:** `renumberComic` is O(pages in comic) per write. For a webcomic
(hundreds of pages) this is fine. Do not optimise it prematurely.

**Verify:** Write a script (or test, see P2-1) that creates a comic with 3
chapters × 5 pages, then: deletes page 2 of chapter 1; deletes chapter 2;
creates a page in chapter 1; moves a page from chapter 3 to chapter 1. After
each step assert `globalPageNumber` is exactly `1..N` with no gaps or
duplicates and each chapter's `chapterPageNumber` is `1..M`. Then run
`recalculate-comic-pages` and assert it changes nothing.

### P1-2 [NEW] bulk-create-pages corrupts chapter-1 navigation

**What:** `src/app/api/bulk-create-pages/route.ts:286-291` passes
`skipGlobalPageCalculation` but not `skipNavigationCalculation`. In
`Pages.ts:816-819` the skipped branch falls back to
`globalPageNumber = chapterPageNumber` (1, 2, 3...). `afterChange` then runs
`updatePageNavigation` with that wrong number and rewrites the *real* pages
with globals 0-4's links. The end-of-batch recalculation fixes globals but has
no navigation pass, and the write-if-changed guard means the clobbered chapter-1
links stay clobbered.

**Fix:** Subsumed by P1-1 step 4. Interim: add `skipNavigationCalculation:
true` at line 291 and add a navigation pass at the end of the batch.

### P1-3 [NEW] Hook guard flags

**What:** Four booleans (`skipGlobalPageCalculation`,
`skipComicStatsCalculation`, `skipChapterStatsCalculation`,
`skipNavigationCalculation`) are set at ~25 call sites in 6 files, each
choosing a different subset. They are set directly on `req` (cast `as any`),
not on `req.context`, which is Payload's intended channel. Many are passed to
`find()` calls where they have no effect. `req.originalChapterId`
(`Pages.ts:702`) is per-request mutable state that can leak between documents
in a bulk `PATCH ?where=`.

**Fix:** After P1-1, most of these disappear because there is one recompute
function. For what remains, use a single `req.context.skipDerived = true` flag
and check `req.context?.skipDerived` in hooks. Replace `req.originalChapterId`
with the `originalDoc` argument that Payload already passes to `afterChange`.

### P1-4 [NEW] Foreign key / NOT NULL contradiction, cascade behaviour

**What (CONFIRMED in schema):** `pages.comic_id` and `chapters.comic_id` are
`NOT NULL` with `ON DELETE SET NULL` (`src/migrations/20251015_031439_complete_schema.ts:101,113,136,160`).
Deleting a comic that has any chapter or page will fail with a NOT NULL
constraint error (LIKELY at runtime; D1 enforces FKs). No Comics hooks exist to
cascade at the app level.

Page delete does not touch media or R2. Media has no `afterDelete`. The R2
storage plugin is disabled. The local DB has 131 `comic_page` media rows
referenced by no page. Media delete sets `pages.page_image_id` to NULL, which
can silently strip the image from a *public* page; the publish gate only runs
on save.

**Fix:**

1. Decide the intended cascade. Recommended: comic delete is admin-only and
   cascades (delete pages, then chapters, then media rows and R2 objects, then
   the comic) via a Comics `beforeDelete` hook, since D1 table recreation to
   change the FK action is risky (see known-issues).
2. Add a Media `afterDelete` that removes the R2 object(s) for `filename` and
   every `imageSizes[].url`.
3. Add a Media `beforeDelete` that refuses if any *public* page references it,
   or a Pages `afterChange` that flips visibility to private if the image is
   gone.
4. Write a one-off script to list and optionally delete orphaned media rows
   and R2 objects.

### P1-5 [KNOWN] Comic slug is globally unique

`src/collections/Comics.ts:194` `unique: true`. Blocks two creators both having
`/my-comic`. Decide per AD-4 whether slugs are per-tenant; if so, drop the
unique constraint and enforce uniqueness per author in a `beforeValidate` hook,
mirroring how Pages/Chapters do it per comic.

### P1-6 [NEW] Concurrency in Chapters.afterChange and reorder-chapters

**What:** `src/collections/Chapters.ts:410-450` does read-modify-write of
`comics.stats` via `payload.update`, which is exactly the array-field
DELETE+INSERT path that the raw-SQL workaround in `Pages.ts:1086-1102` exists to
avoid. `reorder-chapters/route.ts:90-98` fires N chapter updates with
`Promise.all` and no guard flags, so N concurrent comic updates race. Errors
are swallowed (`Chapters.ts:453-456`). It also races the raw-SQL page-stats
writer: last write wins.

**Fix:** Subsumed by P1-1 (one stats writer, called once at the end). Interim:
make `reorder-chapters` sequential (`for ... await`) and pass guard flags.

### P1-7 [NEW] Sibling field hooks run in parallel

**What (CONFIRMED against Payload source):** Payload runs sibling field
`beforeValidate` hooks with `Promise.all`. The `chapter` auto-assign hook
(`Pages.ts:130-145`) and the `chapterPageNumber` hook (`Pages.ts:166-213`) both
read `siblingData.chapter` before either has resolved, so a page created with
no chapter is numbered against "no chapter" (always 1) while simultaneously
being placed in Unassigned. Same for the slug hook (`Pages.ts:281-282`).

**Fix:** Move chapter auto-assignment into the collection-level `beforeValidate`
hook (which runs before field hooks) so `data.chapter` is set by the time field
hooks read it. Or compute `chapterPageNumber` in `beforeChange` after the
chapter is known.

### P1-8 [NEW] Migration quality

- `src/migrations/20251122_165441.ts:17-26` `down()` adds `uuid text NOT NULL`
  with no default; SQLite rejects this on a populated table. Broken.
- `src/migrations/20260111_fix_integer_slugs.ts:79-85` `down()` is a no-op
  (acknowledged).
- No `IF NOT EXISTS` anywhere; a mid-migration failure leaves a half-applied
  schema that cannot be re-run.
- `src/migrations/20260725_visibility_lifecycle_split.ts:118` compares an ISO
  string to `CURRENT_TIMESTAMP` (space-separated) as strings; same-day rows
  compare wrong. Minor, already applied.

**Fix:** Going forward, every migration uses `IF NOT EXISTS` / `IF EXISTS`,
and `down()` either works or throws an explicit "irreversible" error. Fix or
delete the broken `down()` in 20251122.

### P1-9 [KNOWN] Manifest / R2 consistency

No lock or atomicity: two concurrent `generate-manifests` runs interleave.
Nothing regenerates on page save. Corrupt `globalPageNumber`s flow straight
into the public manifest (`generate-manifests/route.ts:427` sorts by it).
`docs/REORDER-PAGES-ENDPOINT.md:212-214` claims atomicity that does not exist;
correct the doc. The cron work is tracked in LAUNCH-BLOCKERS P1.

---

## Priority 2 — Engineering hygiene

### P2-1 [NEW] No tests, lint broken, no CI

- `package.json:24` — `"test": "echo 'No tests configured'"`. Zero test files.
- `package.json:20` — `next lint` was removed in Next 16; the script fails.
  Running `eslint src` directly also crashes because `eslint.config.mjs` wraps
  the already-flat `next/core-web-vitals` in `FlatCompat`, and
  `@eslint/eslintrc` is not a project dependency.
- `tsc --noEmit` passes with 0 errors. `tsconfig.json:12` has
  `strictNullChecks: false`; enabling it produces only 7 errors in 5 files.
- No `.github/` directory.

**Fix:**

1. Replace the lint script with `eslint src` and rewrite `eslint.config.mjs` to
   import `eslint-config-next` flat config directly (no FlatCompat).
2. Enable `strictNullChecks`, fix the 7 errors.
3. Add Vitest. First tests: the `renumberComic` scenario from P1-1, the
   access-control matrix from P0-1/P0-5 (each role × each collection ×
   create/read/update/delete on own vs other's doc). Payload supports
   `getPayload` against a local SQLite file for tests; if D1-specific behaviour
   is needed, use `wrangler`'s miniflare.
4. Add a GitHub Actions workflow running typecheck, lint, and tests on PR.
5. Add `"typecheck": "tsc --noEmit"` to scripts.

### P2-2 [NEW] Shared HTTP helpers

CORS headers are copy-pasted 13 times across `src/app/api/**/route.ts` (7 as a
const, 5 as a function), all `*`. Five routes return `details: error.message`
on 500; two pass through Payload's raw `error.errors`. 401 vs 403 for
"not logged in" varies.

**Fix:** Create `src/lib/http.ts` exporting `corsHeaders(methods)`,
`jsonError(status, message)`, `requireUser(request, payload, roles?)`. Never
send `error.message` or stacks to clients; log them server-side. Use 401 for
unauthenticated, 403 for authenticated-but-forbidden, consistently.

### P2-3 [NEW] Cloudflare binding access is scattered

`getCloudflareContext()` is called ad hoc in 12 files, each with its own
null-guard and fallback. `src/env.d.ts` uses `declare module
'@opennextjs/cloudflare'` in a file with no imports, which is an *ambient*
declaration that **replaces** the package's real types (making
`getCloudflareContext` always return a Promise in the type system). This is
likely why `payload.config.ts:92-93` has to sniff `instanceof Promise` at
runtime. `interface CloudflareEnv` is declared in both `src/env.d.ts` and the
generated `cloudflare-env.d.ts`.

**Fix:** Create `src/lib/bindings.ts` with one `getBindings()` that wraps
`getCloudflareContext({ async: true })` and the script fallback. Replace all 12
call sites. Delete the `declare module` block from `src/env.d.ts`; augment via
`declare global { interface CloudflareEnv {...} }` if needed, or rely solely on
the generated `cloudflare-env.d.ts`. Then re-check whether the Promise sniffing
in `payload.config.ts` is still needed (it may be; keep it if so, but test).

### P2-4 [NEW] Runtime detection for image processing

Three different heuristics decide Sharp vs the image worker:
`payload.config.ts:25,78` (`navigator.userAgent`), `Media.ts:271`
(`typeof process` / `'caches' in globalThis`), `pub/media/.../route.ts:20`
(`caches.default`). `pub/media/route.ts:156-160` re-implements the Sharp resize
inline instead of calling `generateThumbnailsSharp`.
`src/lib/generateThumbnailsPhoton.ts` contains no Photon; it is an HTTP client
to `workers/image-processor`.

**Fix:** One `isWorkersRuntime()` in `src/lib/runtime.ts`. One
`resizeImage(buffer, size)` in `src/lib/images.ts` that dispatches to Sharp or
the worker. Rename `generateThumbnailsPhoton.ts` to
`generateThumbnailsWorker.ts`. Delete `wasm/libImage.wasm` (5.2 MB, zero
references; Photon lives in the separate worker).

### P2-5 [NEW] Logging

~160 `console.*` calls in `src/`, ~126 emoji-prefixed. `Pages.ts` alone has 30,
firing on every save and on every neighbour update. `wrangler.jsonc` has
`head_sampling_rate: 1`, so all of it is persisted.

**Fix:** `src/lib/log.ts` with `debug/info/warn/error` gated on an env var.
Replace `console.log` with `log.debug`. Keep `console.error` for real failures.

### P2-6 [NEW] Docs drift

Accurate: everything under `docs/roadmap/`, `docs/visibility-model.md`, the
page-delete section of `docs/known-issues.md`.

Stale or wrong:

| Location | Claim | Reality |
|---|---|---|
| `CLAUDE.md` Thumbnail Storage | field is `thumbnails` | field is `imageSizes` (`Media.ts:89`) |
| `CLAUDE.md` Dual Thumbnail Runtime | "Photon WASM... both paths in /src/lib/" | Photon runs in `workers/image-processor`; `/src/lib/` has an HTTP client |
| `README.md` | Payload 3.64, Next 16.0.3, Jimp | Payload 3.86, Next 16.2.11, Photon worker |
| `README.md` | 2 custom endpoints | 10 |
| `docs/known-issues.md` | `/api/chapters-by-comic`, `/api/pages-by-comic` | do not exist |
| `docs/known-issues.md` | `docs/archive/MIGRATION_PROGRESS.md` | does not exist |
| `docs/known-issues.md` "hasMany Fields Don't Work" | use `type: 'array'` | `Comics.ts:460-473` uses `hasMany` relationships with a dedupe hook; CLAUDE.md agrees |
| `docs/known-issues.md` Build Config | `wrangler.jsonc` has `remote: true` | it has `remote: false` |
| `docs/REORDER-PAGES-ENDPOINT.md:212` | "Atomic Operation" | `Promise.all`, no rollback |
| `package.json:4` | "A blank template to get started with Payload 3.0" | — |

**Fix:** Correct each row. Delete the two "workaround endpoint" mentions.

### P2-7 [NEW] Repo cruft

Delete or move out of the repo:

- Root SQL dumps (7 files, see P0-2)
- `backups/` (see P0-2)
- `wasm/libImage.wasm` (orphaned)
- `scripts/archived/` (15 one-off scripts, never typechecked; keep in git
  history only)
- `docs/future publishing/` — `ARCHITECTURE-DECISIONS.md` AD-1 says these are
  three tiers to be maintained together, so **keep** them, but move the 14
  `.example` files under a single `docs/publishing-tiers/` and delete the ones
  superseded by actual code (`generate-manifests` supersedes the manifest
  generator sample).
- `test.env` (just `NODE_OPTIONS`; fold into the script that needs it)
- `cloudflare-env.d.ts` — 10,857 lines, generated by `wrangler types`. Either
  gitignore and generate in `postinstall`, or keep but never hand-edit.
- `workers/image-processor` pins wrangler 4.54 vs root 4.113; align.

---

## Suggested execution order for a follow-up model

Each step should be a separate branch off `main` and a separate PR.

1. **P0-1, P0-3** — small, isolated, highest impact. One PR.
2. **P0-2** — operational, not code. Do it in parallel with (1). Make the repo
   private first.
3. **P0-4, P0-5, P0-6** — shared `userOwnsComic` helper plus media
   visibility. One PR.
4. **P2-1 steps 1, 2, 5** — fix lint, enable strictNullChecks, add typecheck
   script. One PR. Do this before the big refactor so the refactor has a net.
5. **P1-1 steps 1-3, 5, 7 + P1-2, P1-3, P1-6** — `renumberComic`, call it
   everywhere, delete duplicates, fix chapter order query. One PR. Run it
   against a copy of the local DB and confirm comics 1 and 3 come out clean.
6. **P1-1 step 6** — unique indexes migration, after (5) has cleaned the data.
7. **P1-1 step 4** — stop storing navigation. Coordinate with the manifest
   contract and reader. Separate PR.
8. **P1-4, P1-7, P1-8** — cascades, hook ordering, migration hygiene.
9. **P2-2 through P2-7** — hygiene, in any order.
10. **P2-1 step 3, 4** — tests and CI, ideally started at step 4 and grown
    with each PR.

## Things this audit did *not* cover

- The separate repos (`chimera-app` admin frontend, `chimera-ssg`,
  `comicviewer`, `chimera-comments`). `LAUNCH-BLOCKERS.md` covers those.
- Performance under load. The per-save hook chain does 5-15 queries per page
  save plus 3 neighbour updates; fine for one author, untested beyond that.
- `workers/image-processor` internals.
- Whether the temp passwords in git have actually been rotated. Assume not.
