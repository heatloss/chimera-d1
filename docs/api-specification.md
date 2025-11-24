# Chimera D1 - API Specification

## Overview

A webcomic content management system built on Payload CMS v3, deployed on Cloudflare Workers with D1 database and R2 storage. This API provides complete backend functionality for managing webcomic series, chapters, pages, users, and media assets with role-based access control.

**Current Version**: November 2024 (Integer ID Implementation)

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
  "status": "draft|published|hiatus|completed",
  "publishSchedule": "daily|weekly|twice-weekly|monthly|irregular|completed|hiatus",
  "genres": ["adventure", "comedy", "fantasy"],
  "tags": ["custom", "tags", "here"],
  "isNSFW": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Pages (`/pages`)

Individual comic page management.

#### Endpoints

- `GET /api/pages` - List pages (with filtering by comic, chapter, status)
- `POST /api/pages` - Create new page
- `GET /api/pages/:id` - Get specific page
- `PATCH /api/pages/:id` - Update page
- `DELETE /api/pages/:id` - Delete page (admin only)
- `GET /api/pages-by-comic/:comicId` - **Workaround endpoint** (see Known Issues)

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
  "comic": 1, // Integer ID
  "chapter": 2, // Integer ID
  "chapterPageNumber": 0, // Page number within chapter (0 = chapter cover, 1+ = regular pages)
  "globalPageNumber": 15, // Auto-calculated sequential number across entire comic (1-based)
  "title": "Optional page title",
  "displayTitle": "Chapter Title - Page 0: Optional Title", // Auto-generated
  "pageImage": 20, // Integer ID of media
  "pageExtraImages": [
    {
      "image": 21, // Integer ID of media
      "altText": "Description of this specific image"
    }
  ],
  "altText": "Description of what happens in this page",
  "authorNotes": "Author commentary and notes",
  "status": "draft|scheduled|published",
  "publishedDate": "2024-01-15T10:30:00Z",
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
- `GET /api/chapters-by-comic/:comicId` - **Workaround endpoint** (see Known Issues)

#### Data Structure

```json
{
  "id": 2,
  "comic": 1, // Integer ID
  "title": "The Beginning",
  "order": 1, // Display order (auto-assigned, reorderable via API)
  "description": "Optional chapter summary",
  "coverImage": 5, // Integer ID of media
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

These endpoints extend Payload's built-in functionality with custom business logic.

### Comic Data Aggregation

#### Get Comic with Chapters and Pages (`GET /api/comic-with-chapters/:id`)

Retrieve a complete comic with all its chapters and each chapter's pages in a single request. Optimal for frontend applications that need to render a complete comic reader interface.

```json
// Request
GET /api/comic-with-chapters/1
Authorization: Bearer jwt_token (optional - affects access to unpublished content)

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
          "chapterPageNumber": 0, // Chapter cover page
          "globalPageNumber": 1,
          "title": null,
          "pageImage": 20,
          "altText": "Chapter 1 cover showing...",
          "status": "published",
          // ... all other page fields ...
        },
        {
          "id": 11,
          "chapterPageNumber": 1, // First regular page
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
- Respects user permissions (unpublished content filtered for non-creators)

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
      "chapterPageNumber": 0,
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
- **Individual Error Handling**: Failed uploads don't stop the batch
- **Automatic Chapter Creation**: Creates "Uploaded Pages" chapter for orphaned images
- **Draft Status**: All pages created as drafts for review
- **Automatic Numbering**: Chapter page numbers assigned automatically
- **Size Limits**: 10MB per file, 50 files max per batch

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

1. **Chapter Page Numbers**: Start at 0 for each chapter (0 = cover, 1+ = regular pages)
2. **Global Page Numbers**: Sequential numbering across the entire comic (1-based)

### Automatic Assignment

- **Chapter pages**: Auto-assigned based on existing pages in the chapter
- **Global pages**: Auto-calculated based on chapter order and chapter page position
- Hooks maintain numbering automatically on create/update/delete operations

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
- Currently set to allow `http://localhost:8888` for frontend development
- CORS configuration will need to be updated when frontend is deployed to production domain

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

## Known Issues

### Payload REST API `where` Clause - RESOLVED (November 2024)

**Previous Issue**: Payload CMS v3.64.0's REST API handler had a bug where `where` clause queries on relationship fields would hang indefinitely.

**Status**: ✅ **RESOLVED** - The standard Payload endpoints with where clauses are now working correctly for browser/frontend requests:
- `GET /api/chapters?where[comic][equals]=1` - ✅ Works in browsers
- `GET /api/pages?where[comic][equals]=1` - ✅ Works in browsers

**Verified Working Example**:
```javascript
// This works correctly in browsers and frontend applications
GET /api/pages?where[comic][equals]=1&populate=pageImage&sort=-globalPageNumber&limit=5

// Response includes properly filtered and populated data
{
  "docs": [ /* filtered pages for comic ID 1 */ ],
  "totalDocs": 29,
  "limit": 5,
  // ... standard Payload pagination response
}
```

**Note**: The issue appears to have been resolved after a fresh `node_modules` installation. The endpoints work correctly when accessed from browsers and frontend applications with proper headers (including Authorization tokens where needed).

**Backup Endpoints Available**:

Two custom endpoints are maintained as backups and alternatives:

#### Get Chapters by Comic ID
```javascript
GET /api/chapters-by-comic/:comicId

// Example
GET /api/chapters-by-comic/1
```

#### Get Pages by Comic ID
```javascript
GET /api/pages-by-comic/:comicId?limit=20&page=1

// Example
GET /api/pages-by-comic/1?limit=10&page=2
```

These backup endpoints provide the same functionality and can be used if any where clause issues resurface in future Payload updates.

## Migration Notes

This API specification reflects the November 2024 update where:
- UUID fields were removed from all collections
- Integer IDs restored as primary identifiers
- Two thumbnail sizes (400px, 800px) instead of seven
- Simplified authentication and endpoint structure
- Workaround endpoints added for Payload REST API bug

For historical context, see `MIGRATION_PROGRESS.md`.
