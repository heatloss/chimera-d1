# Chimera Platform Roadmap — Launch-Readiness for Hosting Others

**Created:** 2026-07-22
**Purpose:** Track what exists and what's missing across the Chimera webcomics
ecosystem, framed against one goal: **could a non-Chimera artist host their
comic on this platform?**

## Why this exists

Chimera D1 began as an internal experiment in an in-house publishing system.
With the broader webcomics ecosystem showing signs of strain (ComicsFury
struggling, Comix Cleric delayed over finances), the project may need to serve
as a genuine functional CMS for at least a few of Chimera's artists — and
possibly others. This roadmap is the feature/gap tracker that didn't exist
before.

Framing decision (2026-07-22): optimize the audit for **launch-readiness for
hosting others**, not a neutral inventory. Every gap below is tagged by how much
it blocks that goal.

## The ecosystem (6 repos)

| Repo | Role | Maturity for hosting others |
|------|------|------------------------------|
| **chimera-d1** (this repo) | Payload CMS v3 backend — D1/R2, collections, API, admin | Solid single-tenant core; multi-tenant isolation leaks |
| **chimera-app** | Admin front end (Alpine.js SPA) | Functional single-owner tool; no signup/comic-creation UI |
| **chimera-ssg** | 11ty static site generator → PHP shared host | Proven for one comic; no multi-comic orchestration/theming |
| **comicviewer** | Vanilla-JS SPA comic reader | Working prototype; a11y near-zero; carries legacy scraper code |
| **chimera-comments** | Cloudflare Worker + D1 comments | Early prototype (~15–20% of its own spec); isolation bugs |
| **chimera** | Eleventy "Collective Webring" | Tangential to launch (not audited in depth) |

## How to read this

- **[LAUNCH-BLOCKERS.md](LAUNCH-BLOCKERS.md)** — the prioritized cross-cutting
  list. Start here. Answers "what must be true before we onboard someone else."
- **[ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md)** — unresolved forks
  that gate real work (which publishing model; how the SSG and SPA reconcile).
- **surfaces/** — per-repo inventory + gaps. Detail behind the blocker list.
  - [backend.md](surfaces/backend.md) — chimera-d1
  - [admin-frontend.md](surfaces/admin-frontend.md) — chimera-app
  - [ssg.md](surfaces/ssg.md) — chimera-ssg
  - [reader.md](surfaces/reader.md) — comicviewer
  - [comments.md](surfaces/comments.md) — chimera-comments

## Gap tags

- **[ABSENT]** — not built at all
- **[PARTIAL]** — half-built, stubbed, or works in one case but not generally
- **[BUG]** — actively wrong / data-corrupting / security hole (verified)

## Prior art already in the repo

Before this roadmap, `docs/future publishing/` held three competing publishing
architecture plans (PHP shared-host SSG, Cloudflare R2+Worker SSG, hybrid
SPA+JSON manifests). Those remain the design source for the SSG/reader work;
see [ARCHITECTURE-DECISIONS.md](ARCHITECTURE-DECISIONS.md) for how they relate
and what still has to be chosen.

## Status legend (for tracking over time)

Each item is one of: `not-started` · `in-progress` · `done` · `wontfix`.
Update inline as work proceeds. This is plain Markdown by design — open the
folder as an Obsidian vault for backlinks/graph, or promote individual blockers
to GitHub Issues when they become active work.
