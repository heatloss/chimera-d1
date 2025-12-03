# Page Reordering Endpoint

**Date:** 2025-12-02
**Endpoint:** `POST /api/reorder-pages`

## Purpose

Allows frontend drag-and-drop interfaces to reorder pages within a chapter. Updates `chapterPageNumber` for each page based on the new order, and automatically recalculates `globalPageNumber` across the entire comic via hooks.

## API Specification

### Request

```http
POST /api/reorder-pages
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "chapterId": 2,
  "pageIds": [15, 12, 14, 13]
}
```

### Response

**Success (200):**
```json
{
  "message": "Pages reordered successfully",
  "updatedPages": 4
}
```

**Error Responses:**

```json
// 400 - Missing required fields
{
  "error": "Chapter ID and page IDs array required"
}

// 400 - Empty array
{
  "error": "Page IDs array cannot be empty"
}

// 400 - Pages don't match chapter
{
  "error": "Some pages not found or do not belong to this chapter"
}

// 403 - Insufficient permissions
{
  "error": "Creator, editor, or admin permissions required"
}

// 403 - Wrong comic
{
  "error": "You do not have permission to reorder pages for this chapter"
}

// 404 - Chapter not found
{
  "error": "Chapter not found"
}

// 500 - Server error
{
  "error": "Failed to reorder pages",
  "details": "Error message"
}
```

## How It Works

1. **Validates request:** Checks authentication, chapter existence, and permissions
2. **Verifies pages:** Confirms all page IDs exist and belong to the specified chapter
3. **Updates order:** Sets `chapterPageNumber` for each page based on array position (1-indexed)
4. **Auto-recalculates:** The `beforeChange` hook automatically updates `globalPageNumber` for affected pages

### Numbering System

- **chapterPageNumber:** Position within the chapter (starts at 1)
- **globalPageNumber:** Sequential position across entire comic (auto-calculated)

**Example:**
```javascript
// Original order
[
  { id: 10, chapterPageNumber: 1 },
  { id: 11, chapterPageNumber: 2 },
  { id: 12, chapterPageNumber: 3 }
]

// After reordering with pageIds: [12, 10, 11]
[
  { id: 12, chapterPageNumber: 1 },  // Was 3, now 1
  { id: 10, chapterPageNumber: 2 },  // Was 1, now 2
  { id: 11, chapterPageNumber: 3 }   // Was 2, now 3
]
```

## Permissions

| Role    | Can Reorder                  |
|---------|------------------------------|
| Reader  | ❌ No                        |
| Creator | ✅ Own comics only           |
| Editor  | ✅ All comics                |
| Admin   | ✅ All comics                |

## Frontend Integration

### React/TypeScript Example

```typescript
interface ReorderPagesRequest {
  chapterId: number
  pageIds: number[]
}

async function reorderPages(
  chapterId: number,
  pageIds: number[],
  token: string
): Promise<void> {
  const response = await fetch('/api/reorder-pages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      chapterId,
      pageIds
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to reorder pages')
  }

  return await response.json()
}

// Usage with drag-and-drop
function handleDragEnd(result: DragDropResult) {
  if (!result.destination) return

  const reorderedIds = Array.from(pageIds)
  const [removed] = reorderedIds.splice(result.source.index, 1)
  reorderedIds.splice(result.destination.index, 0, removed)

  // Optimistically update UI
  setPageIds(reorderedIds)

  // Save to backend
  reorderPages(chapterId, reorderedIds, authToken)
    .catch(error => {
      // Revert on error
      setPageIds(pageIds)
      console.error('Failed to reorder:', error)
    })
}
```

### Vue Example

```javascript
async function reorderPages(chapterId, pageIds) {
  try {
    const response = await fetch('/api/reorder-pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ chapterId, pageIds })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error)
    }

    return await response.json()
  } catch (error) {
    console.error('Reorder failed:', error)
    throw error
  }
}
```

## Testing

A test script is available at `scripts/test-reorder-pages.ts`:

```bash
pnpm tsx scripts/test-reorder-pages.ts
```

**Test verifies:**
- Finding a chapter with pages
- Reversing page order
- Updating `chapterPageNumber` values
- Confirming new order persists

## Notes

### Atomic Operation

All page updates happen in parallel via `Promise.all()`. Either all succeed or all fail (though individual failures aren't rolled back - consider wrapping in a transaction for production use).

### Global Page Number Recalculation

The `beforeChange` hook in `src/collections/Pages.ts` automatically recalculates `globalPageNumber` based on:
1. Chapter order
2. Total pages in previous chapters
3. New `chapterPageNumber` within current chapter

No manual intervention needed - just update `chapterPageNumber` and the hook handles the rest.

### Performance Considerations

- **Small batches (< 20 pages):** Very fast, processes in parallel
- **Large batches (50+ pages):** May take a few seconds due to global recalculation
- **Very large batches (100+ pages):** Consider splitting into multiple requests

### CORS

The endpoint includes CORS headers allowing cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

Modify in production if you need to restrict origins.

## Related Endpoints

- `POST /api/reorder-chapters` - Similar endpoint for reordering chapters within a comic
- `POST /api/bulk-create-pages` - Batch page creation
- `GET /api/pages?where[chapter][equals]=X&sort=chapterPageNumber` - Get ordered pages

## See Also

- API Specification: `docs/api-specification.md`
- Pages Collection: `src/collections/Pages.ts` (lines 110-165 for numbering logic)
- Implementation: `src/app/api/reorder-pages/route.ts`

---

**Created:** 2025-12-02
**Status:** ✅ Tested and working
