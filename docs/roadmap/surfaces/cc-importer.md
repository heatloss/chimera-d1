# CC Importer — ComicControl → Chimera (one-way migration)

**Status:** `not-started` — planned, not scheduled.
**Created:** 2026-10-21

Not a repo surface like the others: a cross-cutting feature spanning chimera-d1
(import job, new fields) and chimera-ssg (URL compatibility, Disqus).

## Why this exists

Chimera is, in effect, a Node-based successor to Hiveworks'
[ComicControl](https://github.com/erintheunready/ComicControl) (PHP/MySQL).
Upstream CC has been abandoned since Dec 2022, has no license (upstream issue
#18, unanswered since 2021), runs poorly on PHP 8, and since May 2026 has a
public critical disclosure (upstream issue #41): the installer is not gated
after setup, so an anonymous request can create an admin account, overwrite
`dbconfig.php`, rewrite site settings, and create modules. The original author
has not responded.

Of the forks, only two are substantive:

| Fork | Ahead | Last push | Notes |
|------|-------|-----------|-------|
| **TuxedoDemon** | 43 | 2026-05 | PHP 8.5 port + fixes for #41 (author of the disclosure) |
| **Daiges** | 108 | 2026-02 | PHP 8 + features (scheduling defaults, WebP, unified RSS, code editor); no evidence of #41 fixes; README says public copy may not match what's run live |

Stabilizing CC ourselves was considered and rejected (2026-10-21): ~16k lines
of untested PHP, md5 password hashing, no CSRF, ~no output escaping, an
unresolvable license question, and an open-ended maintenance burden on a second
stack. Instead, offer CC users a way off.

**Gating question (open as of 2026-10-21):** the CC community is still judging
whether the TuxedoDemon fork is sufficient. If it is, demand for this is lower
and it stays a "nice to have" for new clients; if not, it gets pulled forward.

## Scope and framing

- **One-way trip.** No export back to CC. Import, verify, cut over.
- **Lands on tier 1** (ARCHITECTURE-DECISIONS AD-1). CC users self-host on PHP
  shared hosts with no Node, so they get a Chimera account and publish back to
  their own host via chimera-ssg + `deployer.php`. The importer is therefore
  only useful once tier-1 publishing is real — it is a cutover tool, not a
  standalone feature.

## 1. Extraction

Users have PHP + MySQL, rarely shell, never Node.

- **[ABSENT] Primary: `cc-export.php`.** One-shot script uploaded beside the CC
  install (ship it in the same bundle as `deployer.php`). Reads `dbconfig.php`,
  dumps the needed tables as JSON plus an image manifest; Chimera then pulls
  images over HTTP. Requirements, given #41: authenticated by the deploy
  secret, strictly read-only, refuses to run again (or deletes itself) after
  one successful export.
- **[ABSENT] Fallback: SQL dump + image zip.** phpMyAdmin export plus a zip of
  `comics/`, `comicshighres/`, `comicsthumbs/`. Covers installs too broken to
  execute PHP (common on PHP 8). Costs a MySQL-dump parser.
- **Last resort (not planned): scrape the public site.** Loses drafts, queued
  posts, transcripts.

## 2. Field mapping

Each `cc_modules` row with `moduletype = comic` becomes one Comic.

| ComicControl | Chimera | Notes |
|---|---|---|
| `comics_storyline` `name`/`sorder`/`caption` | Chapters `title`/`order`/`description` | **[GAP]** CC storylines nest (`parent`/`level`); Chimera chapters are flat. Flatten, or map top level only. |
| `comics` `title`/`slug`/`publishtime` | Pages `title`/`slug`/`publishedDate` | `publishtime` is a Unix timestamp |
| `comichighres` (else `imgname`) | `pageImage` | Ingest the high-res; let Chimera regenerate thumbnails |
| `newstitle` + `newscontent` | `authorNotes` | HTML → rich text conversion needed |
| `contentwarning` | `contentWarning` | Direct |
| `hovertext` | **[ABSENT]** `hoverText` | Distinct from `altText`; culturally important in webcomics |
| `transcript` | **[ABSENT]** `transcript` | Also an accessibility win |
| `commentid` | **[ABSENT]** `legacyCommentId` | Thread identifier, always `{moduleSlug}-{postId}` (`parts/comic-post-add.php`). Dropping it can orphan comment history — see §5 |
| `comics_tags` | Tags | Direct |
| `altnext` | — | Custom next-link override; rare. Drop, list in report. |
| blog / gallery / text modules | — | No Chimera equivalent. List in report. |
| `users` | — | Do not import. md5+salt hashes aren't safe to carry over. |

New Pages fields: `hoverText`, `transcript`, `legacyCommentId` (one migration).

## 3. Import job

- **[ABSENT] Resumable background job, not one request.** Large archives
  (thousands of pages) exceed Worker CPU/time limits and D1's 100-parameter
  cap. `bulk-create-pages` already batches at 50 files — follow that shape.
- **Insert first, renumber once.** Insert all pages, then a single
  `recalculate-comic-pages`. Per-insert renumbering would exercise the ordering
  and stats paths behind the concurrent-array-update workaround and the
  page-delete navigation corruption — an import must not be what triggers them.
- **Dry-run report before anything is visible:** imported / skipped / needs
  attention, per module.

## 4. Cutover

- **[GAP] URL compatibility.** CC serves pages at `{root}/{moduleSlug}/{comicSlug}`
  (`comiccontrol/includes/classes.php`, Disqus link builder). chimera-ssg emits
  `comic/{slug}/`. Either make the SSG prefix per-comic configurable, or have
  the importer generate `.htaccess` 301s. Without one, inbound links and
  search rankings break.
- **[GAP] The atomic symlink swap removes the CC site.** `deployer.php`
  repoints `public_html` at a new release, so CC's image directories, blog, and
  `/comiccontrol/` admin vanish at once. Retiring the vulnerable admin is good;
  old image URLs need redirects, and cutover must be an explicit, confirmed
  step.
- **[ABSENT] Comment embeds in chimera-ssg** (Disqus, Hyvor) that reproduce
  each site's existing thread identifiers. AD-1 already expects tier-1 artists
  to keep their existing commenting. Details in §5.

## 5. Comment continuity

Researched 2026-10-21. Don't assume "comments = Disqus."

**What CC supports.** Upstream, TuxedoDemon, and Daiges all support exactly
two services, `commento` and `disqus`, chosen by the `comments` option in
`includes/classes.php`. None mention Hyvor.

**Commento is dead.** `commento.io` and `cdn.commento.io/js/commento.js` both
return 404, so any CC site still set to Commento already has broken comments.
No continuity to keep; import pages without them.

**Hyvor Talk is in real use** via hand-patched installs. From creator
discussion: at least one creator won't move to a fork because it lacks Hyvor,
and assumes adding it is "just a field on the site settings page." It's
somewhat more: a dropdown option + language string, a `case "hyvor":` in
*both* comment switch blocks (count link and embed), and storage for the
website ID (`commentname` could be reused). Roughly 20–30 lines; a natural PR
to TuxedoDemon's fork.

**How Hyvor identifies threads** ([docs](https://hyvor.com/talk/docs/comments)):
- `<hyvor-talk-comments website-id=… page-id=…>`. If `page-id` is empty, the
  page's **canonical URL** is used. Each distinct `page-id` is a separate thread.
- Hyvor's own copy-paste snippet ships with `page-id=""`. CC emits **no**
  `<link rel="canonical">`. So a hand-patched install most likely keys threads
  on URL — exactly what breaks if cutover changes URLs. (Exact normalization
  Hyvor applies without a canonical tag is not documented.)
- A creator who migrated Disqus → Hyvor may instead key on `commentid`:
  Hyvor's Disqus import asks for an identifier type (post ID, relative path,
  or absolute URL).

**Recovery if identifiers change:**
- Console → Pages → Move Data (manual, per page), or the Console API
  `POST /page/{id}/move` with `to_page_id` — scriptable, so a URL change can
  be repaired in bulk. `GET /pages` lists existing threads. Requires the
  creator's Console API key; plan requirements undocumented.
- Page identifiers cannot be edited in place (`PATCH /page/{id}` doesn't
  accept one) — only moved.
- Hyvor imports Disqus/WordPress natively; anything else is a paid custom
  import (€100/migration outside business/enterprise plans).

**So the importer should:**
1. Ask which service the site uses (or detect it from the live page's HTML),
   and for Hyvor, whether the embed sets `page-id` — one view-source answers it.
2. Store `legacyCommentId` regardless; it's free and stable.
3. Emit the same identifier the old site used: `commentid` for Disqus and
   for Hyvor sites that set it; the **old URL** for Hyvor sites that didn't.
   Keeping old URLs (§4) is what makes the last case work at all.
4. If URLs must change anyway, offer a one-time Hyvor remap via the move API
   using the creator's API key, rather than leaving threads orphaned.

## Dependencies (the real blockers)

The importer's own work is modest; tier 1 not being finished is what blocks it.

1. **Scheduled publishing cron (deferred).** CC users queue pages; imports will
   carry future `publishtime`s that would never go live. Likely the biggest
   blocker for this audience.
2. **Per-comic theming + data-driven About page** in chimera-ssg (see
   [ssg.md](ssg.md) P1). Today every comic would ship another comic's About
   page and images.
3. **Automated build triggers** (CMS → `repository_dispatch`). Publishing is
   currently manual.
4. **Backend P0s** in [LAUNCH-BLOCKERS.md](../LAUNCH-BLOCKERS.md) — live the
   moment a second artist has a login.

## Rough sizing

| Piece | Estimate |
|---|---|
| Export script + import job + mapping | ~1–1.5 weeks |
| New fields, SSG Disqus option, URL prefix / redirects | ~3–5 days |
| Testing against real, messy CC databases | unknown — the dominant cost |

Getting one or two real CC exports from willing creators early is worth more
than any of the above.
