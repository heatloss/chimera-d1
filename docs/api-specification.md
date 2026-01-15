# Chimera D1 - API Specification

## Overview

A webcomic content management system built on Payload CMS v3, deployed on Cloudflare Workers with D1 database and R2 storage. This API provides complete backend functionality for managing webcomic series, chapters, pages, users, and media assets with role-based access control.

**Current Version**: January 14, 2026 (Payload v3.69.0)

## Base URLs

- **Local Development**: `http://localhost:3333`
- **Production**: `https://api.chimeracomics.org` (custom domain)
- **Production (alternate)**: `https://chimera-d1.mike-17c.workers.dev`

**Note**: All Payload CMS endpoints use the `/api/*` prefix.

## Infrastructure

- **Database**: Cloudflare D1 (SQLite, edge-replicated)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Hosting**: Cloudflare Workers (serverless edge functions)
- **ID Type**: Integer IDs (1, 2, 3...) for all collections

## Authentication

### Endpoints

- `POST /api/users/login` - Login with email/password
- `POST /api/users/logout` - Logout current user
- `GET /api/users/me` - Get current user information
- `POST /api/users/forgot-password` - Request password reset
- `POST /api/users/reset-password` - Reset password with token
- `POST /api/register` - Create new user account (public registration)
- `POST /api/request-creator-role` - Upgrade from reader to creator role

### Request/Response Examples

```json
// Login Request
POST /api/users/login
{
  "email": "creator@example.com",
  "password": "password123"
}

// Login Response
{
  "message": "Logged in successfully",
  "user": {
    "id": 1,
    "email": "creator@example.com",
    "role": "creator"
  },
  "token": "jwt_token_here"
}

// Registration Request
POST /api/register
{
  "email": "newuser@example.com",
  "password": "securepassword123"
}

// Registration Response
{
  "message": "User created successfully",
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "role": "reader",
    "createdAt": "2024-11-22T12:00:00Z",
    "updatedAt": "2024-11-22T12:00:00Z"
  }
}

// Creator Role Upgrade Request (requires authentication)
POST /api/request-creator-role
Authorization: Bearer jwt_token_here

// Creator Role Upgrade Response
{
  "message": "Creator role granted successfully",
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "role": "creator",
    "updatedAt": "2024-11-22T12:05:00Z"
  }
}
```

## User Roles & Permissions

- **Reader**: Can view published content only
- **Creator**: Can create/edit their own comics, pages, and media
- **Editor**: Can edit all content, assist creators
- **Admin**: Full system access, user management

## Collections & Endpoints

### Comics (`/comics`)

Webcomic series management.

#### Endpoints

- `GET /api/comics` - List comics (filtered by permissions)
- `POST /api/comics` - Create new comic series
- `GET /api/comics/:id` - Get specific comic details
- `PATCH /api/comics/:id` - Update comic
- `DELETE /api/comics/:id` - Delete comic (admin only)

#### Data Structure

```json
{
  "id": 1,
  "title": "My Awesome Comic",
  "slug": "my-awesome-comic",
  "description": "A brief summary of the comic series",
  "author": 2, // Integer ID of user
  "coverImage": 5, // Integer ID of media
  "credits": [
    {
      "role": "writer",
      "customRole": null,
      "name": "Jane Doe",
      "url": "https://janedoe.com"
    },
    {
      "role": "artist",
      "customRole": null,
      "name": "John Smith",
      "url": "https://johnsmith.art"
    }
  ],
  "status": "draft|live|hiatus|completed",
  "publishSchedule": "daily|weekly|twice-weekly|monthly|irregular|completed|inactive",
  "genres": [1, 2, 3], // Integer IDs from genres collection (or full objects if populated)
  "tags": [1, 4], // Integer IDs from tags collection (or full objects if populated)
  "isNSFW": false,
  "seoMeta": {
    "metaTitle": "My Awesome Comic - A Fantasy Adventure",
    "metaDescription": "Follow the journey of...",
    "socialImage": 6 // Integer ID of media (or full object if populated)
  },
  "stats": {
    "totalPages": 45,
    "totalChapters": 3,
    "lastPagePublished": "2024-01-15T10:30:00Z"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Note on Genres and Tags:** These fields are `hasMany` relationships to the `genres` and `tags` collections. By default, the API returns an array of integer IDs. Use `?depth=1` or higher to populate the full genre/tag objects:

```json
// With depth=1 or higher
{
  "genres": [
    { "id": 1, "name": "Action", "slug": "action" },
    { "id": 2, "name": "Adventure", "slug": "adventure" },
    { "id": 3, "name": "Comedy", "slug": "comedy" }
  ],
  "tags": [
    { "id": 1, "name": "LGBTQ+", "slug": "lgbtq" },
    { "id": 4, "name": "Webcomic", "slug": "webcomic" }
  ]
}
```

### Pages (`/pages`)

Individual comic page management.

#### Endpoints

- `GET /api/pages` - List pages (with filtering by comic, chapter, status)
- `POST /api/pages` - Create new page
- `GET /api/pages/:id` - Get specific page
- `PATCH /api/pages/:id` - Update page
- `DELETE /api/pages/:id` - Delete page

#### Query Parameters

- `?where[comic][equals]=1` - Filter by comic ID
- `?where[chapter][equals]=2` - Filter by chapter ID
- `?where[status][equals]=published` - Filter by status
- `?sort=globalPageNumber` - Sort by global page order
- `?sort=chapterPageNumber` - Sort by chapter page order
- `?limit=20` - Limit results

#### Data Structure

```json
{
  "id": 10,
  "comic": 1, // Integer ID (or full object if populated)
  "author": 2, // Integer ID of user (denormalized from comic.author for access control)
  "chapter": 2, // Integer ID (or full object if populated)
  "chapterPageNumber": 1, // Page number within chapter (1-based, auto-assigned)
  "globalPageNumber": 15, // Auto-calculated sequential number across entire comic (1-based)
  "title": "Optional page title",
  "displayTitle": "Chapter Title - Page 1: Optional Title", // Auto-generated
  "pageImage": 20, // Integer ID of media
  "thumbnailImage": 20, // Integer ID of media (auto-populated from pageImage if empty)
  "pageExtraImages": [
    {
      "image": 21, // Integer ID of media
      "altText": "Description of this specific image"
    }
  ],
  "altText": "Description of what happens in this page",
  "contentWarning": "Optional content warning (triggers blur overlay on frontend)",
  "authorNotes": "Author commentary and notes",
  "slug": "optional-page-title", // Top-level, unique within comic, auto-regenerates on chapter/title change
  "status": "draft|scheduled|published",
  "publishedDate": "2024-01-15T10:30:00Z",
  "navigation": {
    "previousPage": 9, // Integer ID of previous page (or null)
    "nextPage": 11, // Integer ID of next page (or null)
    "isFirstPage": false,
    "isLastPage": false
  },
  "seoMeta": {
    "metaTitle": "Page 15 - My Awesome Comic",
    "metaDescription": "Description of what happens in this page"
  },
  "stats": {
    "viewCount": 142,
    "firstViewed": "2024-01-15T12:00:00Z",
    "lastViewed": "2024-01-20T08:30:00Z"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Chapters (`/chapters`)

Organizational containers for comic pages, grouped by story arcs or sections.

#### Endpoints

- `GET /api/chapters` - List chapters (sorted by order)
- `POST /api/chapters` - Create new chapter
- `GET /api/chapters/:id` - Get specific chapter
- `PATCH /api/chapters/:id` - Update chapter
- `DELETE /api/chapters/:id` - Delete chapter (admin only)
- `POST /api/reorder-chapters` - Reorder chapters (see Custom Endpoints)

#### Data Structure

```json
{
  "id": 2,
  "comic": 1, // Integer ID
  "title": "The Beginning",
  "slug": "the-beginning", // Top-level, unique within comic
  "order": 1, // Display order (auto-assigned, reorderable via API)
  "description": "Optional chapter summary",
  "coverImage": 5, // Integer ID of media
  "seoMeta": {
    "metaTitle": "Chapter 1: The Beginning",
    "metaDescription": "Our hero's journey starts here..."
  },
  "stats": {
    "pageCount": 15, // Number of pages in this chapter
    "firstPageNumber": 1, // Global page number of first page
    "lastPageNumber": 15 // Global page number of last page
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Users (`/users`)

User management with role-based profiles.

#### Endpoints

- `GET /api/users/me` - Get current user profile
- `PATCH /api/users/me` - Update own profile
- `GET /api/users/:id` - Get user profile (admins only)
- `PATCH /api/users/:id` - Update user (admins only)

#### Data Structure

```json
{
  "id": 2,
  "email": "creator@example.com",
  "role": "creator|editor|admin|reader",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-20T14:22:00Z"
}
```

### Genres (`/genres`)

Genre taxonomy for categorizing comics. Managed by admins/editors and referenced by comics via relationships.

#### Endpoints

- `GET /api/genres` - List all genres (public, sorted by name)
- `POST /api/genres` - Create new genre (admin/editor only)
- `GET /api/genres/:id` - Get specific genre
- `PATCH /api/genres/:id` - Update genre (admin/editor only)
- `DELETE /api/genres/:id` - Delete genre (admin only)

#### Data Structure

```json
{
  "id": 1,
  "name": "Action",
  "slug": "action",
  "description": "Fast-paced stories with physical conflict and excitement",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Tags (`/tags`)

Tag taxonomy for additional comic categorization and searchability. Managed by admins/editors and referenced by comics via relationships.

#### Endpoints

- `GET /api/tags` - List all tags (public, sorted by name)
- `POST /api/tags` - Create new tag (admin/editor only)
- `GET /api/tags/:id` - Get specific tag
- `PATCH /api/tags/:id` - Update tag (admin/editor only)
- `DELETE /api/tags/:id` - Delete tag (admin only)

#### Data Structure

```json
{
  "id": 1,
  "name": "LGBTQ+",
  "slug": "lgbtq",
  "description": "Stories featuring LGBTQ+ characters or themes",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### Media (`/media`)

File upload and image management with automatic thumbnail generation.

#### Endpoints

- `GET /api/media` - List media files
- `POST /api/media` - Upload new file (automatically generates 2 thumbnail sizes)
- `GET /api/media/:id` - Get specific media details
- `PATCH /api/media/:id` - Update media metadata
- `DELETE /api/media/:id` - Delete file (automatically cleans up all thumbnails)
- `GET /api/media/file/:filename` - Access media file directly

#### Upload Endpoint

```javascript
// Upload file
POST /api/media
Content-Type: multipart/form-data

// Form data:
file: [binary file data]
alt: "Alt text for accessibility"
mediaType: "comic_page|comic_cover|chapter_cover|user_avatar|general"
```

**Automatic Processing on Upload:**

- Original image uploaded to R2 storage
- 2 thumbnail sizes generated using Jimp (Workers) or Sharp (local dev)
- All sizes stored in single JSON field
- Metadata includes dimensions, file sizes, and URLs for each variant

#### Data Structure

```json
{
  "id": 20,
  "filename": "comic-page-001.jpg",
  "alt": "Optional alt text",
  "mediaType": "comic_page|comic_cover|chapter_cover|user_avatar|general",
  "uploadedBy": 2, // Integer ID of user
  "isPublic": true,
  "url": "/api/media/file/comic-page-001.jpg",
  "mimeType": "image/jpeg",
  "imageSizes": {
    "thumbnail": {
      "url": "/api/media/file/comic-page-001-400w.jpg",
      "width": 400,
      "height": 657,
      "mimeType": "image/jpeg",
      "fileSize": 60395,
      "filename": "comic-page-001-400w.jpg"
    },
    "thumbnail_large": {
      "url": "/api/media/file/comic-page-001-800w.jpg",
      "width": 800,
      "height": 1313,
      "mimeType": "image/jpeg",
      "fileSize": 227660,
      "filename": "comic-page-001-800w.jpg"
    }
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Custom API Endpoints

These endpoints extend Payload's built-in functionality with custom business logic or work around D1 adapter limitations.

### Comic Data Aggregation

#### Get Comic with Chapters and Pages (`GET /api/comic-with-chapters/:id`)

Retrieve a complete comic with all its chapters and each chapter's pages in a single request. Optimal for frontend applications that need to render a complete comic reader interface.

**Authentication Required**: Users can only access comics they own. Admins and editors can access all comics.

```json
// Request
GET /api/comic-with-chapters/1
Authorization: Bearer jwt_token

// Response
{
  "id": 1,
  "title": "My Awesome Comic",
  "slug": "my-awesome-comic",
  "description": "A brief summary of the comic series",
  "author": 2,
  "coverImage": 5,
  "status": "published",
  // ... all other comic fields ...

  "chapters": [
    {
      "id": 2,
      "title": "The Beginning",
      "order": 1,
      "description": "Chapter 1 description",
      "coverImage": 5,
      // ... all other chapter fields ...

      "pages": [
        {
          "id": 10,
          "chapterPageNumber": 1, // First page in chapter
          "globalPageNumber": 1,
          "title": null,
          "pageImage": 20,
          "altText": "Chapter 1 cover showing...",
          "status": "published",
          // ... all other page fields ...
        },
        {
          "id": 11,
          "chapterPageNumber": 2, // Second page in chapter
          "globalPageNumber": 2,
          "title": "The Hero Awakens",
          "pageImage": 21,
          "altText": "Our hero wakes up in a mysterious forest...",
          "status": "published",
          // ... all other page fields ...
        }
        // ... more pages
      ]
    },
    {
      "id": 3,
      "title": "The Journey Begins",
      "order": 2,
      // ... chapter data with pages array ...
    }
    // ... more chapters
  ]
}
```

**Features:**
- Returns complete nested structure in one request
- Chapters are sorted by `order` field
- Pages within each chapter are sorted by `chapterPageNumber`
- Returns 401 if not authenticated
- Returns 403 if user doesn't own the comic (unless admin/editor)

### Metadata Options

#### Get Metadata Options (`GET /api/metadata`)

Retrieve all available metadata options for comics and pages. This endpoint returns configuration values used to populate dropdown menus and selectors in the frontend. No authentication required.

**Note:** As of December 2024, genres and tags are now stored in their own collections and return **integer IDs** rather than string values. This allows dynamic management of genres/tags through the admin interface.

```json
// Request
GET /api/metadata

// Response
{
  "creditRoles": [
    { "label": "Writer", "value": "writer" },
    { "label": "Artist", "value": "artist" },
    // ... 8 total role options (static)
  ],
  "publishSchedules": [
    { "label": "Daily", "value": "daily" },
    { "label": "Weekly", "value": "weekly" },
    // ... 7 total schedule options (static)
  ],
  "genres": [
    { "label": "Action", "value": 1 },
    { "label": "Adventure", "value": 2 },
    { "label": "Comedy", "value": 3 },
    // ... dynamic from genres collection (integer IDs)
  ],
  "tags": [
    { "label": "LGBTQ+", "value": 1 },
    { "label": "Webcomic", "value": 2 },
    // ... dynamic from tags collection (integer IDs)
  ],
  "comicStatuses": [
    { "label": "Draft/Hidden", "value": "draft" },
    { "label": "Live", "value": "live" },
    { "label": "On Hiatus", "value": "hiatus" },
    { "label": "Completed", "value": "completed" }
  ],
  "pageStatuses": [
    { "label": "Draft", "value": "draft" },
    { "label": "Scheduled", "value": "scheduled" },
    { "label": "Published", "value": "published" }
  ]
}
```

**Features:**
- No authentication required (public configuration data)
- Returns all available options for credit roles, publishing schedules, genres, tags, and statuses
- **Genres and Tags are dynamic** - fetched from their respective collections (can be managed via admin)
- Credit roles, schedules, and statuses remain static configuration values
- Used to populate dropdown menus and multi-select components

### Chapter Management

#### Bulk Reorder Chapters (`POST /api/reorder-chapters`)

Reorder all chapters for a comic in one atomic operation.

```json
// Request
POST /api/reorder-chapters
Authorization: Bearer jwt_token
{
  "comicId": 1,
  "chapterIds": [3, 2, 4] // New order (integer IDs)
}

// Response
{
  "message": "Chapters reordered successfully",
  "updatedChapters": 3
}
```

### Page Management

#### Bulk Reorder Pages (`POST /api/reorder-pages`)

Reorder pages within a chapter via drag-and-drop or other UI interactions. Updates `chapterPageNumber` for each page and automatically recalculates `globalPageNumber` across the entire comic.

```json
// Request
POST /api/reorder-pages
Authorization: Bearer jwt_token
{
  "chapterId": 2,
  "pageIds": [15, 12, 14, 13] // New order (integer IDs)
}

// Response
{
  "message": "Pages reordered successfully",
  "updatedPages": 4
}
```

**Features:**
- Updates `chapterPageNumber` based on array position (1-indexed: first page = 1, second = 2, etc.)
- Automatically recalculates `globalPageNumber` for all affected pages via hooks
- Atomic operation - all updates succeed or all fail
- Permission checks:
  - Admins and editors can reorder any pages
  - Creators can only reorder pages in their own comics
- Returns 400 if page IDs don't match the chapter
- Returns 403 if user lacks permission
- Returns 404 if chapter not found

### Batch Processing

#### Bulk Create Pages (`POST /api/bulk-create-pages`)

Upload multiple images and create draft pages for each one in a single operation.

```javascript
// Request (multipart/form-data)
POST /api/bulk-create-pages
Authorization: Bearer jwt_token
Content-Type: multipart/form-data

// Form data structure:
comicId: "1"
pagesData: JSON.stringify([
  {
    "chapterId": 2, // Optional - creates fallback chapter if null
    "title": "The Hero's Journey",
    "altText": "Hero begins adventure",
    "authorNotes": "First page of new arc"
  },
  {
    "chapterId": null, // Will use/create "Uploaded Pages" chapter
    "title": "Entering the Forest",
    "altText": "Hero walks into mysterious woods",
    "authorNotes": ""
  }
  // ... more pages
])
file_0: [File object for first page]
file_1: [File object for second page]
// ... more files
```

```json
// Response
{
  "success": true,
  "message": "Successfully created 8 of 10 pages",
  "results": {
    "successful": 8,
    "failed": 2,
    "total": 10
  },
  "pages": [
    {
      "success": true,
      "pageId": 25,
      "mediaId": 40,
      "title": "The Hero's Journey",
      "filename": "hero-page-1.jpg",
      "chapterPageNumber": 1,
      "globalPageNumber": 25
    },
    {
      "success": false,
      "error": "File size 12.5MB exceeds 10MB limit",
      "filename": "huge-image.jpg",
      "title": "Failed Page"
    }
    // ... more results
  ],
  "fallbackChapterCreated": {
    "id": 5,
    "title": "Uploaded Pages"
  }
}
```

**Features:**
- **Batch Processing**: Upload up to 50 images at once
- **Client-Side Thumbnails**: Accepts pre-generated thumbnails to skip server-side Jimp processing
- **Optimized for Workers**: Uses deferred hook processing to minimize subrequests
- **Individual Error Handling**: Failed uploads don't stop the batch
- **Automatic Chapter Creation**: Creates "Uploaded Pages" chapter for orphaned images
- **Draft Status**: All pages created as drafts for review
- **Automatic Numbering**: Chapter and global page numbers assigned automatically (recalculated at end of batch)
- **Size Limits**: 10MB per file, 50 files max per batch

**Client-Side Thumbnail Format:**

For each image `file_N`, the frontend can optionally provide:
- `file_N_thumb` - 400px wide thumbnail
- `file_N_thumb_large` - 800px wide thumbnail

When both thumbnails are provided, server-side Jimp processing is skipped entirely, eliminating the CPU bottleneck. If thumbnails are not provided, the server falls back to Jimp generation (limited to ~20 files due to CPU time limits).

### Page Queries

#### Get Pages with Media (`GET /api/pages-with-media`)

Fetch pages with fully populated media objects (pageImage, thumbnailImage). This endpoint manually populates media relationships, which is useful when standard Payload depth parameter doesn't suffice.

**Authentication Required**: Yes

```javascript
// Request
GET /api/pages-with-media?chapter=2&sort=globalPageNumber&limit=50
Authorization: Bearer jwt_token

// Query Parameters (at least one required):
// - chapter: Filter by chapter ID
// - comic: Filter by comic ID
// - page: Get a specific page by ID
// - limit: Max results (default 500)
// - sort: Sort field (default "globalPageNumber")
```

```json
// Response
{
  "docs": [
    {
      "id": 10,
      "chapterPageNumber": 1,
      "globalPageNumber": 15,
      "pageImage": {
        "id": 20,
        "filename": "page-001.jpg",
        "url": "/api/media/file/page-001.jpg",
        "imageSizes": {
          "thumbnail": { "url": "/api/media/file/page-001-400w.jpg", "width": 400 },
          "thumbnail_large": { "url": "/api/media/file/page-001-800w.jpg", "width": 800 }
        }
      },
      "thumbnailImage": { /* ... populated media object ... */ }
      // ... other page fields
    }
  ],
  "totalDocs": 15,
  "limit": 50,
  "totalPages": 1,
  "page": 1,
  "hasPrevPage": false,
  "hasNextPage": false
}
```

**Features:**
- Returns pages with fully populated media objects
- Supports filtering by chapter, comic, or specific page ID
- Requires authentication
- Returns 400 if no filter parameter provided

### Admin Utilities

#### Recalculate Chapter Stats (`POST /api/recalculate-chapter-stats`)

Admin utility to recalculate chapter statistics (pageCount, firstPageNumber, lastPageNumber) for chapters. Useful after bulk operations or data migrations.

**Authentication Required**: Admin or Editor role

```json
// Request - Recalculate for specific comic
POST /api/recalculate-chapter-stats
Authorization: Bearer jwt_token
{
  "comicId": 4
}

// Request - Recalculate ALL chapters
POST /api/recalculate-chapter-stats
Authorization: Bearer jwt_token
{
  "all": true
}

// Response
{
  "success": true,
  "message": "Recalculated stats for 5 chapters (0 failed)",
  "results": [
    {
      "chapterId": 1,
      "title": "The Beginning",
      "pageCount": 15,
      "firstPageNumber": 1,
      "lastPageNumber": 15,
      "success": true
    },
    {
      "chapterId": 2,
      "title": "The Journey",
      "pageCount": 12,
      "firstPageNumber": 16,
      "lastPageNumber": 27,
      "success": true
    }
    // ... more chapters
  ]
}
```

**Features:**
- Recalculates pageCount, firstPageNumber, and lastPageNumber for each chapter
- Can target a specific comic or all chapters system-wide
- Returns detailed results for each chapter processed
- Admin or Editor role required

#### Recalculate Page Navigation (`POST /api/recalculate-navigation`)

Admin utility to recalculate navigation links (previousPage, nextPage, isFirstPage, isLastPage) for all pages in a comic. Useful after bulk imports, reordering operations, or data migrations.

**Authentication Required**: Admin or Editor role

```json
// Request
POST /api/recalculate-navigation
Authorization: Bearer jwt_token
{
  "comicId": 1
}

// Response
{
  "message": "Navigation recalculated for 45 pages in comic 1"
}
```

**Features:**
- Recalculates previousPage, nextPage, isFirstPage, isLastPage for each page
- Based on globalPageNumber order (seamless chapter transitions)
- Runs sequentially to avoid race conditions
- Admin or Editor role required

#### Backfill Page Authors (`POST /api/backfill-page-authors`)

Admin utility to populate the denormalized `author` field on pages from their comic's author. This is a one-time migration endpoint needed after adding the author field to the Pages collection.

**Authentication Required**: Admin or Editor role

```json
// Request
POST /api/backfill-page-authors
Authorization: Bearer jwt_token

// Response
{
  "message": "Page author backfill complete",
  "updated": 180,
  "errors": 0,
  "total": 180
}
```

**Features:**
- Finds all pages without an author set
- Looks up each page's comic and copies the comic's author to the page
- Skips pages that already have an author or have no comic
- Reports success/error counts

## Common Query Patterns

### Filtering and Sorting

```javascript
// Get all published pages for a specific comic, sorted by global page number
GET /api/pages?where[comic][equals]=1&where[status][equals]=published&sort=globalPageNumber

// Get all comics by current user (creator role)
GET /api/comics?where[author][equals]=2

// Get pages in a specific chapter
GET /api/pages?where[comic][equals]=1&where[chapter][equals]=2&sort=chapterPageNumber
```

### Pagination

```javascript
// Standard pagination
GET /api/pages?page=2&limit=20

// All endpoints support:
// - page: Page number (1-based)
// - limit: Items per page (default 10, max 100)
```

### Population (Include Related Data)

```javascript
// Get comic with author details and cover image populated
GET /api/comics/1?depth=2

// Get page with relationships populated
GET /api/pages/10?depth=2

// Note: PayloadCMS uses 'depth' parameter for relationship population
// depth=0: No relationships populated (IDs only)
// depth=1: Direct relationships populated
// depth=2: Nested relationships populated
```

## Error Responses

All endpoints return consistent error formats:

```json
// 400 Bad Request
{
  "errors": [
    {
      "message": "Title is required",
      "field": "title"
    }
  ]
}

// 401 Unauthorized
{
  "error": "Authentication required"
}

// 403 Forbidden
{
  "error": "Insufficient permissions"
}

// 404 Not Found
{
  "error": "Comic not found"
}

// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

## File Upload & Media URLs

### Image Size Variants

All uploaded images automatically generate 2 size variants optimized for different use cases:

| Size Name         | Dimensions | Fit Type | Use Case                  |
| ----------------- | ---------- | -------- | ------------------------- |
| `thumbnail`       | 400px wide | inside   | List views, archive pages |
| `thumbnail_large` | 800px wide | inside   | Main comic reader view    |

**Fit Type:**
- `inside`: Resizes to fit within dimensions, maintains aspect ratio (no cropping)

### Accessing Images

```javascript
// Original image
GET /api/media/file/filename.jpg

// Specific size variants
GET /api/media/file/filename-400w.jpg
GET /api/media/file/filename-800w.jpg

// Or via imageSizes object in API response
const thumbnailUrl = mediaObject.imageSizes.thumbnail.url
const thumbnailWidth = mediaObject.imageSizes.thumbnail.width
const thumbnailSize = mediaObject.imageSizes.thumbnail.fileSize
```

### Thumbnail Generation Details

**Local Development:**
- Uses Sharp (Node.js native library) for fast, high-quality image processing
- Generates 2 sizes automatically on upload
- Stores metadata in single JSON field

**Production (Cloudflare Workers):**
- Uses Jimp (WASM-based) for image processing in Workers environment
- Same 2 size variants and JSON storage structure

**Automatic Cleanup:**
- Deleting media automatically removes all thumbnail files from R2
- Prevents orphaned files and wasted storage

## Page Numbering System

### Overview

Chimera CMS uses a dual numbering system for comic pages:

1. **Chapter Page Numbers**: Start at 1 for each chapter, increment sequentially (1, 2, 3...)
2. **Global Page Numbers**: Sequential numbering across the entire comic (1-based)

### Automatic Assignment

- **Chapter pages**: Auto-assigned based on existing pages in the chapter (first page = 1, second = 2, etc.)
- **Global pages**: Auto-calculated based on chapter order and chapter page position
- Hooks maintain numbering automatically on create/update/delete operations
- No special handling for "cover pages" - all pages are numbered sequentially

**Note**: Creators can distinguish cover pages, credit pages, etc. using page titles, author notes, or other metadata. The system treats all pages equally for numbering purposes.

## Development Notes

### Local Development

- Payload CMS runs on `http://localhost:3333`
- Admin interface: `http://localhost:3333/admin`
- API base: `http://localhost:3333/api`
- Media files: `http://localhost:3333/api/media/file/`

### Database

- **Database**: Cloudflare D1 (SQLite, edge-replicated)
- Local development uses Wrangler's simulated D1
- Production uses Cloudflare's distributed D1 database
- **All IDs are integers** (1, 2, 3...) instead of UUIDs
- Automatic migrations on startup via Payload

### Authentication

- JWT tokens in Authorization header: `Bearer token_here`
- Tokens expire after 24 hours (configurable in Payload)
- Refresh tokens not implemented (re-login required)

### CORS Configuration

- CORS headers configured for cross-origin requests
- Allowed origins:
  - `http://localhost:8888` - Frontend dev server
  - `http://localhost:3333` - API dev server
  - `http://localhost:3000` - Default Next.js port (fallback)
  - `https://api.chimeracomics.org` - Production API
  - `https://cms.chimeracomics.org` - Production frontend

## Frontend Implementation Tips

1. **Authentication State**: Store JWT token and user info in secure storage
2. **File Uploads**: Use FormData for multipart uploads to `/media`
3. **Image Display**: Always use appropriate size variants for performance
4. **Error Handling**: All endpoints return consistent error formats
5. **Pagination**: Implement infinite scroll or traditional pagination
6. **Real-time Updates**: Consider polling for new content (no WebSocket support)

## Security Considerations

- All creator actions are restricted to own content
- Media uploads are validated for file type and size
- CORS is configured for frontend domains
- Always validate user permissions on frontend
- Integer IDs are used internally (CMS admin only)
- Public-facing sites can use slugs, UUIDs, or other identifiers independently

## Production URLs

- **API**: https://api.chimeracomics.org (primary)
- **API (alternate)**: https://chimera-d1.mike-17c.workers.dev
- **Admin Panel**: https://api.chimeracomics.org/admin

## Known Issues & D1 Adapter Limitations

### ~~DELETE Operations Don't Work~~ ✅ FIXED in v3.65.0

**Previous Issue**: DELETE operations returned 200 success but did not remove records from the database.

**Resolution**: Fixed in Payload v3.65.0 (Drizzle ORM v0.44.7). DELETE operations now work correctly.

**Affected Endpoints** (now working):
- `DELETE /api/pages/:id` - ✅ Works correctly
- `DELETE /api/comics/:id` - ✅ Should work correctly
- `DELETE /api/chapters/:id` - ✅ Should work correctly
- `DELETE /api/media/:id` - ✅ Works correctly with automatic thumbnail cleanup

### R2 Storage Plugin Limitations

**Issue**: The `@payloadcms/storage-r2` plugin does not work with programmatic `payload.create()` calls. Files are only uploaded to R2 when using Payload's admin UI, not when creating media through custom API endpoints.

**Workarounds Implemented**:
- Bulk upload endpoint manually uploads files to R2 using `bucket.put()`
- Filenames are sanitized (spaces → underscores, special chars removed)
- Uses `Uint8Array` instead of `Buffer` for Miniflare compatibility

**Impact**: Any custom upload endpoints must manually handle R2 uploads rather than relying on the R2 storage plugin.

### String ID Normalization Required

**Issue**: The D1 adapter requires integer IDs, but relationship fields sometimes receive string IDs from API requests. This causes validation errors like "invalid relationships: 3 0".

**Workarounds Implemented**:
- Field-level `beforeValidate` hooks on all relationship fields
- `normalizeRelationshipId` helper function converts string IDs to integers
- Applied to all relationship fields across Comics, Chapters, Pages, and Media collections

**Impact**: Developers must remember to add normalization hooks to any new relationship fields.

### Access Control Query Limitations

**Issue**: Nested access control queries like `'comic.author': { equals: user.id }` cause "ambiguous column name: id" errors when combined with Payload's DataLoader batch queries.

**Root Cause**: The Drizzle D1 adapter generates JOINs for nested access control checks, but doesn't qualify the `id` column in batch queries. When both `pages` and `comics` tables have an `id` column, SQLite can't resolve which one to use.

**Workarounds Implemented**:
- **Pages collection**: Added denormalized `author` field that mirrors `comic.author`
  - Auto-populated from comic on page create/update
  - Access control uses direct `author` check instead of `comic.author` (no JOIN needed)
- For other collections: Access control functions manually fetch related records first, then filter using simple `in` or `equals` queries

**Impact**: New relationship fields may require denormalization to avoid JOINs in access control queries.

### Schema Migration Risks

**Issue**: The D1 adapter's automatic schema push (`push: true`) attempts unsafe operations like `DROP TABLE` when detecting schema changes, which fails due to foreign key constraints.

**Workarounds Implemented**:
- Disabled automatic schema push: `push: false`
- Manual migrations only
- Database backups before any schema changes

**Impact**: Schema changes require manual migration scripts and careful testing.

### Cloudflare Workers CPU Time Limits

**Issue**: Cloudflare Workers has a 30-second CPU time limit. Jimp-based thumbnail generation is CPU-intensive (~1.5 seconds per image).

**Solution Implemented**:
- Bulk upload accepts **client-side generated thumbnails** (`file_N_thumb`, `file_N_thumb_large`)
- When thumbnails are provided, Jimp is bypassed entirely - supports up to 50 files per batch
- Falls back to server-side Jimp if thumbnails not provided (limited to ~20 files due to CPU limits)
- Deferred hook processing - expensive calculations run once at end of batch

**Impact**: Frontend should generate thumbnails using Canvas API for optimal bulk upload performance (50 files). Without client thumbnails, batch size is limited to ~20 files.

## Migration Notes

### January 2026 Update (Navigation & Access Control Fix)
- **New field**: Added `contentWarning` textarea to Pages - when populated, frontend can display a blur overlay
- **New field**: Added `author` relationship to Pages (denormalized from comic.author)
  - Auto-populated from comic's author on page create/update
  - Required to fix "ambiguous column name: id" bug in D1 adapter (see Known Issues)
- **New fields**: Added `navigation` group to Pages with `previousPage`, `nextPage`, `isFirstPage`, `isLastPage`
  - Auto-calculated based on `globalPageNumber` for seamless chapter transitions
  - Updated automatically when pages are created, updated, deleted, or reordered
- **New endpoint**: `POST /api/recalculate-navigation` - Recalculate navigation for all pages in a comic
- **New endpoint**: `POST /api/backfill-page-authors` - Backfill author field on existing pages
- **Database migration required**:
  ```sql
  ALTER TABLE pages ADD COLUMN content_warning TEXT;
  ALTER TABLE pages ADD COLUMN author_id INTEGER REFERENCES users(id);
  ```
- **Backfill required**: Run `/api/backfill-page-authors` after migration to populate author field

### January 2026 Update (Slug Refactor)
- **BREAKING CHANGE**: Slugs moved from `seoMeta.slug` to top-level `slug` field for both Chapters and Pages
- **Frontend migration required**: Update references from `chapter.seoMeta?.slug` → `chapter.slug` and `page.seoMeta?.slug` → `page.slug`
- Slugs are now unique within their parent comic (not globally unique)
- Page slugs auto-regenerate when:
  - Chapter assignment changes (if slug appears auto-generated)
  - Title changes from integer-only to meaningful text
- Manually customized slugs (not matching `*-page-N` pattern) are preserved
- Integer-only slugs (like "1", "2") have been migrated to `{chapter-slug}-page-{N}` format
- New database indexes added for efficient slug lookups

### January 2025 Update
- **Documentation update**: API specification now accurately reflects all collection fields
  - Added `seoMeta` and `stats` groups to Comics data structure
  - Added `seoMeta` and `stats` groups to Chapters data structure
  - Added `thumbnailImage`, `navigation`, `seoMeta`, and `stats` groups to Pages data structure
- **New endpoints documented**:
  - `GET /api/pages-with-media` - Fetch pages with fully populated media objects
  - `POST /api/recalculate-chapter-stats` - Admin utility to recalculate chapter statistics
- **Fixed examples**: Updated all page numbering examples to reflect 1-based system (was showing 0-based in some places)
- **Fixed Chapters collection**: Corrected admin description that incorrectly referenced non-existent `/api/move-chapter` endpoint

### Late December 2024 Update (v3.69.0)
- Upgraded to Payload v3.69.0
- **Security Fix**: Added authentication requirement to `/api/comic-with-chapters/:id` endpoint
  - Now returns 401 if not authenticated
  - Returns 403 if user doesn't own the comic (unless admin/editor)
- **Removed obsolete endpoints**: `/api/chapters-by-comic/:comicId` and `/api/pages-by-comic/:comicId`
  - These were workarounds for an OpenNext issue that has been fixed
  - Use standard Payload endpoints instead: `GET /api/chapters?where[comic][equals]=:id`
- **Optimized bulk upload**: Implemented client-side thumbnail support and deferred hook processing
  - Accepts client-generated thumbnails (`file_N_thumb`, `file_N_thumb_large`) - bypasses Jimp entirely
  - Supports up to 50 files per batch with client thumbnails (falls back to ~20 without)
  - Expensive hooks (global page calculation, stats update) now run once at end of batch instead of per-page
- **Fixed CORS**: Updated hardcoded localhost CORS headers to `*` in bulk-create-pages and pages-with-media endpoints

### December 2024 Update (v3.65.0)
- **MAJOR FIX**: Upgraded to Payload v3.65.0 which includes Drizzle ORM v0.44.7
- **DELETE operations now work correctly** - no longer need custom delete endpoints
- Page numbering changed from 0-based to 1-based (all pages start at 1)
- Removed special "cover page" handling (page 0)
- Fixed media image upload issues (filename sanitization, collision detection, manual R2 uploads)
- ~~Added `/delete-page/:id` custom endpoint~~ (removed - no longer needed)
- Implemented manual R2 file uploads for all media operations (R2 storage plugin doesn't work with REST API)
- Added field-level ID normalization hooks to all relationship fields
- Updated comments about `afterOperation` hook (was disabled due to DELETE bug, now fixed)
- Documented all D1 adapter limitations and workarounds

### November 2024 Update
- UUID fields were removed from all collections
- Integer IDs restored as primary identifiers
- Two thumbnail sizes (400px, 800px) instead of seven
- Simplified authentication and endpoint structure
- Workaround endpoints added for Payload REST API bug

For historical context, see `MIGRATION_PROGRESS.md`.
