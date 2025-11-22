# Chimera D1 - Webcomic CMS

A modern webcomic management system built with Payload CMS, Next.js 16, and Cloudflare infrastructure (D1 + R2).

## Overview

Chimera D1 is a headless CMS designed specifically for managing webcomics. It provides:

- **Content Management**: Comics, chapters, and pages with full metadata
- **Media Handling**: Image upload, storage, and thumbnail generation
- **User Management**: Authentication, authorization, and role-based access
- **API Endpoints**: RESTful APIs for frontend consumption

## Tech Stack

- **Framework**: [Payload CMS](https://payloadcms.com/) v3.64.0
- **Frontend**: [Next.js](https://nextjs.org/) 16.0.3 with Turbopack
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **Storage**: [Cloudflare R2](https://developers.cloudflare.com/r2/)
- **Hosting**: [Cloudflare Workers](https://workers.cloudflare.com/)

## Features

### Collections

- **Comics**: Series-level information with cover images, genres, credits, and metadata
- **Chapters**: Organizational units within comics with ordering and SEO fields
- **Pages**: Individual comic pages with images, navigation, and reader statistics
- **Media**: Upload system with automatic thumbnail generation (2 sizes: 400px and 800px)
- **Users**: Role-based access (Admin, Editor, Creator, Reader)

### Custom API Endpoints

- `/api/comic-with-chapters/:id` - Fetch a comic with all chapters and pages in a single request
- `/api/reorder-chapters` - Reorder chapters with authorization checks

### Built-in Features

- Automatic thumbnail generation (Jimp for Workers, Sharp for dev)
- R2 storage for all media files
- Global page numbering across chapters
- Chapter ordering system
- SEO metadata for all content

## Quick Start

### Prerequisites

- Node.js 18.20.2+ or 20.9.0+
- pnpm 9 or 10
- Cloudflare account (for deployment)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd chimera-d1

# Install dependencies
pnpm install

# Login to Cloudflare (if deploying)
pnpm wrangler login
```

### Development

```bash
# Start the development server
pnpm run dev

# Access the admin panel
open http://localhost:3333/admin
```

The dev server uses local Miniflare instances of D1 and R2.

### Building for Production

```bash
# Build the application
pnpm run build

# Deploy to Cloudflare Workers
pnpm run deploy
```

## Database Migrations

```bash
# Create a new migration
pnpm payload migrate:create

# Apply migrations locally
pnpm payload migrate

# Apply migrations to production
pnpm run deploy:database
```

## Project Structure

```
chimera-d1/
├── src/
│   ├── app/              # Next.js app router
│   │   └── api/          # Custom API routes
│   ├── collections/      # Payload collections (Comics, Chapters, Pages, etc.)
│   ├── lib/              # Utilities (thumbnail generation, etc.)
│   ├── migrations/       # Database migrations
│   └── payload.config.ts # Payload configuration
├── scripts/              # Utility scripts (migration, backup, etc.)
├── docs/                 # Documentation
└── wrangler.jsonc        # Cloudflare configuration
```

## Configuration

### Environment Variables

Create a `.env` file:

```env
PAYLOAD_SECRET=your-secret-key
CLOUDFLARE_ACCOUNT_ID=your-account-id
```

### Cloudflare Bindings

Edit `wrangler.jsonc` to configure D1 database and R2 bucket bindings:

```jsonc
{
  "d1_databases": [{
    "binding": "D1",
    "database_name": "chimera-d1",
    "database_id": "your-database-id"
  }],
  "r2_buckets": [{
    "binding": "R2",
    "bucket_name": "chimera-d1"
  }]
}
```

## Scripts

- `backup-database.sh` - Backup local D1 database
- `batch-generate-thumbnails.ts` - Batch thumbnail generation
- `regenerate-thumbnails.ts` - Regenerate thumbnails for existing media
- `copy-r2-media.sh` - Copy media between R2 buckets
- `upload-media-to-r2.sh` - Upload local media to R2

See [scripts/README.md](scripts/README.md) for detailed documentation.

## API Usage

### Native Payload Endpoints

```bash
# Get all comics
GET /api/comics

# Get a specific comic
GET /api/comics/:id

# Get chapters for a comic
GET /api/chapters?where[comic][equals]=:comicId&sort=order

# Get pages in a chapter
GET /api/pages?where[chapter][equals]=:chapterId&sort=chapterPageNumber
```

### Custom Endpoints

```bash
# Get comic with all chapters and pages
GET /api/comic-with-chapters/:id

# Reorder chapters (requires auth)
POST /api/reorder-chapters
Body: { "comicId": 1, "chapterIds": [1, 2, 3] }
```

## Deployment

### First-Time Deployment

1. Create D1 database: `pnpm wrangler d1 create chimera-d1`
2. Create R2 bucket: `pnpm wrangler r2 bucket create chimera-d1`
3. Update `wrangler.jsonc` with database ID
4. Run migrations: `pnpm run deploy:database`
5. Deploy: `pnpm run deploy`

### Subsequent Deployments

```bash
# Deploy with migrations
pnpm run deploy

# Or deploy without migrations
pnpm wrangler deploy
```

## Troubleshooting

### Build Issues

If you encounter build errors, try:

```bash
pnpm rebuild better-sqlite3
pnpm run build
```

### Migration Issues

Ensure the dev server is running when executing scripts:

```bash
# Terminal 1
pnpm run dev

# Terminal 2
pnpm payload migrate
```

## Documentation

- [Migration Progress](MIGRATION_PROGRESS.md) - Full migration history and status
- [Scripts README](scripts/README.md) - Detailed script documentation
- [Payload CMS Docs](https://payloadcms.com/docs)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

## Production URLs

- **API**: https://chimera-d1.mike-17c.workers.dev
- **Admin Panel**: https://chimera-d1.mike-17c.workers.dev/admin

## License

Private project - All rights reserved
