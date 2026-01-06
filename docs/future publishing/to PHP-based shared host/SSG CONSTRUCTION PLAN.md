# Webcomic Static Site Generator: Construction Plan

**Objective:** Build an 11ty-based static site generator that creates complete, customizable webcomic websites from Chimera CMS manifest data.

**Output:** A GitHub repository containing 11ty templates that GitHub Actions uses to build and deploy creator sites.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chimera CMS (Cloudflare)                     │
│                                                                 │
│  manifest.json contains:                                        │
│  - Comic metadata (title, description, credits, genres, tags)   │
│  - Chapter structure                                            │
│  - Page data (images, alt text, author notes, dates)            │
│  - Theme/customization settings                                 │
│  - Optional content (about text, cast, links)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   11ty Static Site Generator                    │
│                                                                 │
│  1. Fetches manifest.json from CMS API                          │
│  2. Generates HTML pages from templates                         │
│  3. Injects theme variables into CSS                            │
│  4. Outputs complete static site                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Generated Static Site                      │
│                                                                 │
│  /index.html              - Home (latest page or landing)       │
│  /read/index.html         - Start reading (first page)          │
│  /page/1/index.html       - Individual comic pages              │
│  /page/2/index.html                                             │
│  /archive/index.html      - Full archive, grouped by chapter    │
│  /about/index.html        - Optional about page                 │
│  /css/styles.css          - Themed styles                       │
│  /js/reader.js            - Optional JS enhancements            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Flow: Manifest to Templates

The manifest provides all data needed to generate the site. No additional API calls required during build.

### Manifest Structure (Current)

```json
{
  "version": "1.0",
  "generatedAt": "2025-01-05T...",
  "comic": {
    "id": 1,
    "slug": "automans-daughter",
    "title": "The Automan's Daughter",
    "tagline": "An adventure story...",
    "description": "Full description...",
    "thumbnail": "/api/media/file/cover.jpg",
    "credits": [
      { "role": "artist", "name": "Mike Stamm", "url": "https://..." }
    ],
    "genres": ["Action-Adventure", "Steampunk"],
    "tags": ["Mecha", "Violence"]
  },
  "chapters": [
    {
      "id": 1,
      "title": "Chapter 1",
      "order": 1,
      "pages": [
        {
          "globalPageNumber": 1,
          "chapterPageNumber": 1,
          "image": {
            "original": "/api/media/file/page1.jpg",
            "mobile": "/api/pub/media/mobile/page1.webp",
            "desktop": "/api/pub/media/desktop/page1.webp"
          },
          "thumbnail": "/api/media/file/page1.jpg",
          "width": 1600,
          "height": 2464,
          "title": "Page title",
          "altText": "Description for screen readers",
          "authorNote": "Behind the scenes commentary",
          "publishedDate": "2025-01-01T..."
        }
      ]
    }
  ],
  "navigation": {
    "firstPage": 1,
    "lastPage": 50,
    "totalPages": 50
  }
}
```

### Future Additions to Manifest

These fields would be added to support site generation:

```json
{
  "comic": {
    "...existing fields...",

    "siteSettings": {
      "homeStyle": "latest-page | landing | splash",
      "archiveStyle": "grid | list | chapter-accordion",
      "showAuthorNotes": true,
      "showTranscripts": false,
      "enableKeyboardNav": true,
      "enableSwipeNav": true
    },

    "theme": {
      "colorBackground": "#ffffff",
      "colorText": "#333333",
      "colorAccent": "#0066cc",
      "colorSecondary": "#666666",
      "fontHeading": "Georgia, serif",
      "fontBody": "system-ui, sans-serif",
      "navPosition": "top | bottom | both",
      "maxPageWidth": "900px",
      "borderRadius": "4px"
    },

    "content": {
      "aboutHtml": "<p>Rich text about the comic...</p>",
      "castMembers": [
        { "name": "Aisha", "image": "...", "description": "..." }
      ],
      "externalLinks": [
        { "label": "Patreon", "url": "https://...", "icon": "patreon" }
      ],
      "footerHtml": "<p>Copyright 2025...</p>",
      "customCss": "/* creator's custom overrides */"
    }
  }
}
```

---

## 3. Template Structure

### Directory Layout

```
webcomic-ssg/
├── .github/
│   └── workflows/
│       └── build-and-deploy.yml    # GitHub Actions workflow
│
├── src/
│   ├── _data/
│   │   └── comic.js                # Fetches manifest from API
│   │
│   ├── _includes/
│   │   ├── layouts/
│   │   │   └── base.njk            # Base HTML structure
│   │   │
│   │   └── partials/
│   │       ├── nav.njk             # Site navigation
│   │       ├── page-nav.njk        # Prev/next comic navigation
│   │       ├── chapter-select.njk  # Chapter dropdown
│   │       ├── footer.njk          # Site footer
│   │       └── seo.njk             # Meta tags, OG tags
│   │
│   ├── pages/
│   │   └── page.njk                # Template for /page/N/
│   │
│   ├── index.njk                   # Home page
│   ├── archive.njk                 # Archive page
│   ├── about.njk                   # About page (conditional)
│   ├── cast.njk                    # Cast page (conditional)
│   │
│   ├── css/
│   │   ├── reset.css               # CSS reset
│   │   ├── variables.njk           # CSS custom properties (templated)
│   │   ├── layout.css              # Page structure
│   │   ├── components.css          # UI components
│   │   └── reader.css              # Comic reader styles
│   │
│   └── js/
│       ├── keyboard-nav.js         # Arrow key navigation
│       └── swipe-nav.js            # Touch swipe navigation
│
├── .eleventy.js                    # 11ty configuration
├── package.json
└── README.md
```

### Core Templates

#### `_data/comic.js` — Data Fetcher

```javascript
const EleventyFetch = require("@11ty/eleventy-fetch");

module.exports = async function() {
  const apiBase = process.env.CMS_API_URL || 'https://api.chimeracomics.org';
  const comicSlug = process.env.COMIC_SLUG;

  const manifestUrl = `${apiBase}/api/pub/v1/comics/${comicSlug}/manifest.json`;

  const manifest = await EleventyFetch(manifestUrl, {
    duration: "0s",  // Always fetch fresh during build
    type: "json"
  });

  // Flatten pages for easier iteration
  const allPages = manifest.chapters.flatMap(ch =>
    ch.pages.map(p => ({ ...p, chapter: ch }))
  );

  return {
    ...manifest,
    allPages,
    apiBase  // For constructing image URLs
  };
};
```

#### `_includes/layouts/base.njk` — Base Layout

```njk
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }} | {{ comic.comic.title }}</title>

  {% include "partials/seo.njk" %}

  <link rel="stylesheet" href="/css/styles.css">

  <style>
    {% include "css/variables.njk" %}
  </style>

  {% if comic.comic.content.customCss %}
  <style>{{ comic.comic.content.customCss | safe }}</style>
  {% endif %}
</head>
<body>
  {% include "partials/nav.njk" %}

  <main>
    {{ content | safe }}
  </main>

  {% include "partials/footer.njk" %}

  {% if comic.comic.siteSettings.enableKeyboardNav %}
  <script src="/js/keyboard-nav.js"></script>
  {% endif %}
</body>
</html>
```

#### `pages/page.njk` — Comic Page Template

```njk
---
pagination:
  data: comic.allPages
  size: 1
  alias: page
permalink: "page/{{ page.globalPageNumber }}/index.html"
---

{% extends "layouts/base.njk" %}

{% set prevPage = comic.allPages | getPrevPage(page.globalPageNumber) %}
{% set nextPage = comic.allPages | getNextPage(page.globalPageNumber) %}

{% block content %}
<article class="comic-page">
  <header class="page-header">
    <h1>{{ page.chapter.title }} — Page {{ page.chapterPageNumber }}</h1>
    {% if page.title %}
    <h2>{{ page.title }}</h2>
    {% endif %}
  </header>

  <figure class="comic-image">
    <img
      src="{{ comic.apiBase }}{{ page.image.mobile }}"
      srcset="{{ comic.apiBase }}{{ page.image.mobile }} 960w,
              {{ comic.apiBase }}{{ page.image.desktop }} 1440w"
      sizes="(max-width: 768px) 100vw, min(900px, 80vw)"
      width="{{ page.width }}"
      height="{{ page.height }}"
      alt="{{ page.altText | default('Comic page ' + page.globalPageNumber) }}"
      loading="eager"
    >
  </figure>

  {% include "partials/page-nav.njk" %}

  {% if page.authorNote and comic.comic.siteSettings.showAuthorNotes %}
  <aside class="author-note">
    <h3>Author's Note</h3>
    {{ page.authorNote | safe }}
  </aside>
  {% endif %}
</article>
{% endblock %}
```

#### `archive.njk` — Archive Page

```njk
---
layout: layouts/base.njk
title: Archive
permalink: /archive/index.html
---

<h1>Archive</h1>

<div class="archive archive--{{ comic.comic.siteSettings.archiveStyle | default('grid') }}">
  {% for chapter in comic.chapters %}
  <section class="archive-chapter">
    <h2>{{ chapter.title }}</h2>

    <ul class="archive-pages">
      {% for page in chapter.pages %}
      <li>
        <a href="/page/{{ page.globalPageNumber }}/">
          <img
            src="{{ comic.apiBase }}{{ page.thumbnail }}"
            alt="{{ page.title | default('Page ' + page.chapterPageNumber) }}"
            loading="lazy"
          >
          <span>Page {{ page.chapterPageNumber }}</span>
        </a>
      </li>
      {% endfor %}
    </ul>
  </section>
  {% endfor %}
</div>
```

---

## 4. Theme System

### CSS Custom Properties Approach

Instead of multiple theme files, use CSS custom properties populated from manifest data:

#### `css/variables.njk`

```css
:root {
  /* Colors */
  --color-bg: {{ comic.comic.theme.colorBackground | default('#ffffff') }};
  --color-text: {{ comic.comic.theme.colorText | default('#333333') }};
  --color-accent: {{ comic.comic.theme.colorAccent | default('#0066cc') }};
  --color-secondary: {{ comic.comic.theme.colorSecondary | default('#666666') }};

  /* Typography */
  --font-heading: {{ comic.comic.theme.fontHeading | default('Georgia, serif') }};
  --font-body: {{ comic.comic.theme.fontBody | default('system-ui, sans-serif') }};

  /* Layout */
  --max-page-width: {{ comic.comic.theme.maxPageWidth | default('900px') }};
  --border-radius: {{ comic.comic.theme.borderRadius | default('4px') }};
  --spacing-unit: 1rem;
}
```

#### `css/layout.css`

```css
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

h1, h2, h3 {
  font-family: var(--font-heading);
}

a {
  color: var(--color-accent);
}

.comic-image img {
  max-width: var(--max-page-width);
  border-radius: var(--border-radius);
}
```

### Preset Themes (Optional Enhancement)

Offer named presets that map to variable sets:

```javascript
// In CMS: theme.preset dropdown
const presets = {
  'light-minimal': {
    colorBackground: '#ffffff',
    colorText: '#333333',
    colorAccent: '#0066cc'
  },
  'dark-minimal': {
    colorBackground: '#1a1a1a',
    colorText: '#e0e0e0',
    colorAccent: '#66b3ff'
  },
  'sepia-classic': {
    colorBackground: '#f5f0e6',
    colorText: '#3d3d3d',
    colorAccent: '#8b4513'
  },
  'custom': null  // Use custom values
};
```

---

## 5. Build Pipeline

### GitHub Actions Workflow

```yaml
name: Build and Deploy Comic Site

on:
  repository_dispatch:
    types: [build-comic]

concurrency:
  group: build-${{ github.event.client_payload.comic_slug }}
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    env:
      COMIC_SLUG: ${{ github.event.client_payload.comic_slug }}
      COMIC_ID: ${{ github.event.client_payload.comic_id }}
      CMS_API_URL: ${{ github.event.client_payload.api_url }}
      DEPLOY_URL: ${{ github.event.client_payload.deploy_url }}
      DEPLOY_SECRET: ${{ github.event.client_payload.deploy_secret }}

    steps:
      - name: Checkout templates
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build static site
        run: npm run build

      - name: Create deployment bundle
        run: |
          cd _site
          zip -r ../deploy-bundle.zip .

      - name: Deploy to shared host
        run: |
          curl -X POST "$DEPLOY_URL" \
            -F "secret=$DEPLOY_SECRET" \
            -F "bundle=@deploy-bundle.zip" \
            --fail \
            --show-error
```

### Local Development

```bash
# Set environment variables
export COMIC_SLUG="automans-daughter"
export CMS_API_URL="https://api.chimeracomics.org"

# Run 11ty dev server
npm run dev

# Build for production
npm run build
```

---

## 6. Implementation Phases

### Phase 1: Static Prototype (No 11ty)

**Goal:** Design the reading experience with plain HTML/CSS.

**Deliverables:**
- [ ] Hand-coded home page
- [ ] Hand-coded comic page with prev/next navigation
- [ ] Hand-coded archive page
- [ ] Responsive CSS (mobile-first)
- [ ] Basic navigation component

**Time estimate:** 2-3 days

### Phase 2: 11ty Conversion

**Goal:** Convert static prototype to 11ty templates with hardcoded data.

**Deliverables:**
- [ ] Project scaffolding (package.json, .eleventy.js)
- [ ] Base layout template
- [ ] Comic page template with pagination
- [ ] Archive template
- [ ] Home page template
- [ ] Partials (nav, footer, page-nav)

**Time estimate:** 1-2 days

### Phase 3: Manifest Integration

**Goal:** Replace hardcoded data with API fetch.

**Deliverables:**
- [ ] `_data/comic.js` data fetcher
- [ ] Environment variable handling
- [ ] Image URL construction (with API base)
- [ ] Chapter/page iteration
- [ ] Navigation helpers (prev/next page filters)

**Time estimate:** 1 day

### Phase 4: Theme System

**Goal:** Enable visual customization via manifest data.

**Deliverables:**
- [ ] CSS custom properties template
- [ ] Theme fields added to CMS (Comics collection)
- [ ] Theme data included in manifest
- [ ] Custom CSS injection

**Time estimate:** 1-2 days

### Phase 5: Optional Content

**Goal:** Support about page, cast page, external links.

**Deliverables:**
- [ ] Content fields added to CMS
- [ ] Conditional template rendering
- [ ] About page template
- [ ] Cast page template
- [ ] Links section in nav/footer

**Time estimate:** 1 day per section

### Phase 6: Polish & Enhancements

**Goal:** Production-ready quality.

**Deliverables:**
- [ ] Keyboard navigation (arrow keys)
- [ ] Touch swipe navigation
- [ ] Preloading next page image
- [ ] SEO meta tags and OG images
- [ ] RSS feed generation
- [ ] 404 page
- [ ] Favicon handling

**Time estimate:** 2-3 days

### Phase 7: GitHub Actions Integration

**Goal:** Automated builds triggered by CMS.

**Deliverables:**
- [ ] Workflow file
- [ ] Deploy script
- [ ] Webhook trigger from CMS cron worker
- [ ] Webhook trigger from CMS afterChange hook
- [ ] Error handling and notifications

**Time estimate:** 1-2 days

---

## 7. CMS Changes Required

### New Fields on Comics Collection

```typescript
// Add to src/collections/Comics.ts

{
  name: 'siteSettings',
  type: 'group',
  label: 'Static Site Settings',
  admin: {
    description: 'Configure your generated website',
    condition: (data) => data.deployment?.deployUrl, // Only show if deployment configured
  },
  fields: [
    {
      name: 'homeStyle',
      type: 'select',
      options: [
        { label: 'Latest Page', value: 'latest-page' },
        { label: 'Landing Page', value: 'landing' },
      ],
      defaultValue: 'latest-page',
    },
    {
      name: 'archiveStyle',
      type: 'select',
      options: [
        { label: 'Thumbnail Grid', value: 'grid' },
        { label: 'Chapter List', value: 'list' },
      ],
      defaultValue: 'grid',
    },
    {
      name: 'showAuthorNotes',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'enableKeyboardNav',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
},

{
  name: 'theme',
  type: 'group',
  label: 'Site Theme',
  fields: [
    {
      name: 'preset',
      type: 'select',
      options: [
        { label: 'Light Minimal', value: 'light-minimal' },
        { label: 'Dark Minimal', value: 'dark-minimal' },
        { label: 'Sepia Classic', value: 'sepia-classic' },
        { label: 'Custom', value: 'custom' },
      ],
      defaultValue: 'light-minimal',
    },
    {
      name: 'colorBackground',
      type: 'text',
      admin: {
        condition: (data) => data.theme?.preset === 'custom',
        description: 'Hex color (e.g., #ffffff)',
      },
    },
    {
      name: 'colorText',
      type: 'text',
      admin: { condition: (data) => data.theme?.preset === 'custom' },
    },
    {
      name: 'colorAccent',
      type: 'text',
      admin: { condition: (data) => data.theme?.preset === 'custom' },
    },
    {
      name: 'customCss',
      type: 'code',
      admin: {
        language: 'css',
        description: 'Advanced: Add custom CSS overrides',
      },
    },
  ],
},

{
  name: 'siteContent',
  type: 'group',
  label: 'Site Content',
  fields: [
    {
      name: 'aboutText',
      type: 'richText',
      label: 'About Page Content',
    },
    {
      name: 'footerText',
      type: 'richText',
      label: 'Footer Content',
    },
    {
      name: 'externalLinks',
      type: 'array',
      label: 'External Links',
      fields: [
        { name: 'label', type: 'text', required: true },
        { name: 'url', type: 'text', required: true },
      ],
    },
  ],
},
```

### Manifest Generator Updates

Add the new fields to the comic manifest output in `generate-manifests/route.ts`.

---

## 8. Testing Strategy

### Local Testing

1. Create a test comic in the CMS with all fields populated
2. Run 11ty locally against the live API
3. Verify all pages generate correctly
4. Test responsive layouts
5. Verify image loading from CDN

### Integration Testing

1. Trigger a build via GitHub Actions manually
2. Verify ZIP is created correctly
3. Test deployment to a staging shared host
4. Verify atomic symlink swap works
5. Test rollback by re-deploying previous release

### Creator Testing

1. Set up a real shared host account (DreamHost trial, etc.)
2. Walk through full creator setup flow
3. Document any friction points
4. Refine deployer.php and documentation

---

## 9. Open Questions

1. **RSS Feed:** Include full images or just links? Image hosting implications?

2. **Transcript Support:** Store transcripts in CMS? Display on page or separate?

3. **Comments:** Out of scope for static, but could link to external (Disqus, etc.)?

4. **Analytics:** Recommend a privacy-friendly option? Plausible, Umami?

5. **Custom Domains:** Any special handling needed for HTTPS on shared hosts?

6. **Preview Mode:** How can creators preview scheduled pages before they're live?

---

## 10. Resources

- [11ty Documentation](https://www.11ty.dev/docs/)
- [11ty Fetch Plugin](https://www.11ty.dev/docs/plugins/fetch/)
- [Nunjucks Templating](https://mozilla.github.io/nunjucks/)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [GitHub Actions](https://docs.github.com/en/actions)
