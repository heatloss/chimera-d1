# Comments — chimera-comments (Cloudflare Worker + D1)

**Early prototype, not an MVP for hosting others.** A 700-line spec describes a
full moderation/multi-tenant product; the shipped code is ~15–20% of it. Judge
readiness by the code, not the spec. The owner's "barely started" description is
accurate for the multi-tenant goal.

Repo: `/Users/mike/Sites/chimera-comments`

## Inventory (what actually works)
- **Stack:** Cloudflare Worker on Hono v4, TypeScript, D1 (raw SQL, no ORM),
  Arctic v3 for OAuth. Deployed to `chimera-comments.mike-17c.workers.dev`.
  Intentionally separate from the Payload CMS (to dodge D1/adapter issues).
- **Data model (3 tables + reactions):**
  - `commenters` — OAuth identity (provider, provider_id, email, display_name,
    avatar_url). **No `trust_level`** despite spec.
  - `sessions` — id, commenter_id, expires_at.
  - `comments` — page_id, comic_id, commenter_id, body, `parent_id`, `status`
    (default **`'approved'`**), timestamps. Threading FK + status column exist
    but are inert.
  - `reactions` — page_id, comic_id, emoji_id, count; **PK `(page_id, emoji_id)`**.
  - **Missing:** the spec's `comic_commenter_permissions` table (CLAUDE.md lists
    it as "planned").
- **Endpoints:** health, `/embed.js`, Discord OAuth (login/callback/logout/me),
  list comments (paginated), create comment (auth-gated, ≤5000 chars), reaction
  counts, reaction toggle (**no auth**). **No edit/delete/moderation/admin
  routes** despite spec.
- **Works:** Discord login; posting flat comments; page-level emoji reactions
  (7 hardcoded emoji, optimistic UI, client-side `sessionStorage` dedup);
  drop-in embed via one `<script>` + `data-page-id`/`data-comic-id`.
- **Threading:** schema + API only — embed renders a flat list, never sends
  `parent_id` or shows a reply button. Non-functional for readers.
- **Editing / deletion:** absent.
- **Identity:** Discord OAuth only (Google referenced but absent). Separate
  identity store from CMS users. 30-day opaque-token sessions, CSRF via state
  cookie, return-URL validated against `ALLOWED_ORIGINS`.
- **Test harness:** two static manual HTML smoke-test pages. No test runner.

## Gaps (launch-blockers for hosting others)

### P0 — Safety / isolation (verified)
- **[BUG] Reactions not scoped per-comic.** PK `(page_id, emoji_id)`; queries key
  on `page_id` only. Two comics sharing a `page_id` string corrupt each other's
  counts. `comic_id` stored but never used as a key.
- **[ABSENT] No origin↔comic ownership binding.** Any origin in the global
  `ALLOWED_ORIGINS` can read/write comments for any client-supplied `comic_id`.
  No creator auth exists at all.
- **[ABSENT] No moderation — everything auto-approves.** `status='approved'`
  hardcoded. No queue, no per-creator controls, no banning/trust levels, no
  report/flag, no spam filter/blacklist.
- **[ABSENT] No rate limiting anywhere.** Comment POST and OAuth unthrottled.
  Reaction endpoint has **no auth** and only client-side dedup → any script can
  inflate any counter unboundedly.

### P2 — Table stakes
- **[ABSENT] No GDPR / deletion.** Commenters can't delete comments or account;
  emails stored with no erasure path; no consent handling for Discord data/cookies.
- **[PARTIAL] Session cookie flags buggy.** `setSessionCookie` hardcodes
  `SameSite=None; Secure` and **ignores the `isProduction` param**; CLAUDE.md
  claims `SameSite=Lax` — code and docs disagree.
- **[PARTIAL] XSS mostly handled**, but `avatar_url` interpolated unescaped into
  `img src` (low-risk today, server-constructed from Discord CDN). No server-side
  body sanitization — relies entirely on frontend escaping, risky for an embedded
  widget.
- **[PARTIAL] Embed never paginates** — always fetches default page, ignores
  `has_more`; long threads silently truncate at 50.

### P3 — Growth
- **[PARTIAL] Single OAuth provider (Discord).** Severe adoption limit for
  diverse audiences; Google referenced but absent.
- **[ABSENT] Notifications** — no reply/email/push. Threading without
  notifications has little value.
- **[PARTIAL] No account management** — no display-name change/profile.
- **[ABSENT] No admin/creator UI.** Only two static test pages.
- **[ABSENT] No CI/tests/migration tooling.** `package.json` migration scripts
  point only at `0001_auth.sql`; no test script.

## Overall maturity
Working single-tenant proof of concept (Discord login + flat comments + page
reactions + clean embed). Against "multi-tenant CMS hosting independent artists"
it's missing essentially every launch-blocker. Highest-priority before hosting
anyone else: (1) comic-ownership/origin binding + creator auth; (2) fix reaction
keying (data-corruption bug); (3) moderation queue + banning + per-creator
controls; (4) rate limiting/anti-spam; (5) GDPR + self-deletion.

See ARCHITECTURE-DECISIONS AD-3 — for a first hand-held pilot, deferring comments
(ship with `showComments` off) removes several P0 items from the critical path.
