import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

// Configuration constants
// With client-side thumbnail generation, we're no longer CPU-bound by Jimp.
// 50 files is a reasonable batch size for network/memory constraints.
const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

// Thumbnail size names must match what the frontend generates
const THUMBNAIL_SIZES = ['thumb', 'thumb_large'] as const;

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })

    // Get authenticated user using Payload's auth method
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || !['creator', 'editor', 'admin'].includes(user.role)) {
      return NextResponse.json(
        {
          error: 'Authentication required - creator, editor, or admin role needed',
        },
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse multipart form data
    const formData = await request.formData();
    const comicIdString = formData.get('comicId') as string;
    const comicId = parseInt(comicIdString, 10);
    const pagesData = JSON.parse(formData.get('pagesData') as string);

    // Validate basic requirements
    if (!comicId || isNaN(comicId)) {
      return NextResponse.json(
        { error: 'Valid comic ID is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!Array.isArray(pagesData) || pagesData.length === 0) {
      return NextResponse.json(
        { error: 'Pages data array is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate limits
    if (pagesData.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed per batch` },
        { status: 400, headers: corsHeaders }
      )
    }

    const startTime = Date.now();
    console.log(
      `📤 Starting bulk page creation: ${pagesData.length} pages for comic ${comicId}`,
    );

    const results = {
      successful: 0,
      failed: 0,
      total: pagesData.length,
    };
    const pageResults = [];
    let fallbackChapter = null;
    const affectedChapterIds = new Set<number>(); // Track chapters that need stats update

    // Process each page
    for (let i = 0; i < pagesData.length; i++) {
      const elapsedMs = Date.now() - startTime;
      console.log(`⏱️ File ${i + 1}/${pagesData.length} - elapsed: ${elapsedMs}ms`);
      const pageData = pagesData[i];
      const fileKey = `file_${i}`;
      const file = formData.get(fileKey) as File;

      try {
        // Validate file exists
        if (!file || file.size === 0) {
          throw new Error('No file provided or file is empty');
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
          );
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(
            `Invalid file type: ${file.type}. Only images are allowed.`,
          );
        }

        console.log(
          `📁 Processing: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
        );

        // Handle chapter assignment
        let chapterId = pageData.chapterId;
        if (!chapterId) {
          // Create or find fallback chapter if not already done
          if (!fallbackChapter) {
            fallbackChapter = await findOrCreateUploadChapter(
              payload,
              comicId,
              user,
            );
          }
          chapterId = fallbackChapter.id;
        }

        // Step 1: Upload image to Media collection
        // Convert File to the format Payload expects
        const fileBuffer = await file.arrayBuffer();

        // Sanitize filename: replace spaces with underscores, remove special chars
        let sanitizedName = file.name
          .replace(/\s+/g, '_')            // Replace spaces with underscores
          .replace(/[^a-zA-Z0-9._-]/g, '') // Remove special chars (keep dots, underscores, hyphens)
          .replace(/_+/g, '_')             // Collapse multiple underscores
          .toLowerCase();                  // Lowercase for consistency

        // Get R2 bucket to manually upload files (R2 plugin doesn't work with programmatic uploads)
        const cloudflare = (globalThis as any).__CLOUDFLARE_CONTEXT__
        const bucket = cloudflare?.env?.R2

        if (!bucket) {
          throw new Error('R2 bucket not configured')
        }

        // Check for filename collision and generate unique name if needed
        let finalFilename = sanitizedName;
        let attempt = 0;
        const maxAttempts = 100;

        while (attempt < maxAttempts) {
          const existing = await payload.find({
            collection: 'media',
            where: { filename: { equals: finalFilename } },
            limit: 1,
          });
          if (existing.docs.length === 0) break;
          attempt++;
          const nameParts = sanitizedName.split('.');
          const extension = nameParts.length > 1 ? nameParts.pop() : '';
          const baseName = nameParts.join('.');
          finalFilename = extension ? `${baseName}-${attempt}.${extension}` : `${baseName}-${attempt}`;
        }

        if (attempt > 0) {
          console.log(`⚠️ Filename collision, using: ${finalFilename}`);
        }

        // Check for client-provided thumbnails
        const thumbFile = formData.get(`file_${i}_thumb`) as File | null;
        const thumbLargeFile = formData.get(`file_${i}_thumb_large`) as File | null;
        const hasClientThumbnails = thumbFile && thumbLargeFile;

        // Upload main image to R2 BEFORE thumbnails to "claim" the filename
        // This ensures Media hook's collision detection finds the same name we're using for thumbnails
        // (Media hook will re-upload, but that's harmless - just overwrites with same content)
        const mainFileKey = `media/${finalFilename}`
        await bucket.put(mainFileKey, new Uint8Array(fileBuffer), {
          httpMetadata: { contentType: file.type },
        })
        console.log(`✅ Main image uploaded: ${mainFileKey}`)

        let mediaDoc;

        if (hasClientThumbnails) {
          // CLIENT-SIDE THUMBNAILS: Upload pre-generated thumbnails, skip Jimp entirely
          console.log(`📦 Using client-generated thumbnails for ${file.name}`);

          const imageSizes: any[] = [];
          const baseName = finalFilename.replace(/\.[^.]+$/, '');
          const extension = finalFilename.split('.').pop() || 'jpg';

          // Upload thumbnail (400px)
          const thumbBuffer = await thumbFile.arrayBuffer();
          const thumbFilename = `${baseName}-400w.${extension}`;
          await bucket.put(`media/${thumbFilename}`, new Uint8Array(thumbBuffer), {
            httpMetadata: { contentType: thumbFile.type },
          });
          imageSizes.push({
            name: 'thumbnail',
            filename: thumbFilename,
            url: `/api/media/file/${thumbFilename}`,
            fileSize: thumbFile.size,
            mimeType: thumbFile.type,
          });
          console.log(`  ✓ thumbnail uploaded`);

          // Upload thumbnail_large (800px)
          const thumbLargeBuffer = await thumbLargeFile.arrayBuffer();
          const thumbLargeFilename = `${baseName}-800w.${extension}`;
          await bucket.put(`media/${thumbLargeFilename}`, new Uint8Array(thumbLargeBuffer), {
            httpMetadata: { contentType: thumbLargeFile.type },
          });
          imageSizes.push({
            name: 'thumbnail_large',
            filename: thumbLargeFilename,
            url: `/api/media/file/${thumbLargeFilename}`,
            fileSize: thumbLargeFile.size,
            mimeType: thumbLargeFile.type,
          });
          console.log(`  ✓ thumbnail_large uploaded`);

          // Create media record - pass file but with pre-populated imageSizes
          // The Media hook will see imageSizes already exists and skip Jimp
          const fileData = {
            data: Buffer.from(fileBuffer),
            mimetype: file.type,
            name: finalFilename,
            size: file.size,
          };

          mediaDoc = await payload.create({
            collection: 'media',
            data: {
              alt: pageData.altText || '',
              mediaType: 'comic_page',
              imageSizes: imageSizes, // Pre-populated - hook should skip generation
            },
            file: fileData,
            user,
          });
        } else {
          // NO CLIENT THUMBNAILS: Use existing Jimp-based flow
          console.log(`🎨 No client thumbnails, using server-side generation for ${file.name}`);

          const fileData = {
            data: Buffer.from(fileBuffer),
            mimetype: file.type,
            name: finalFilename,
            size: file.size,
          };

          mediaDoc = await payload.create({
            collection: 'media',
            data: {
              alt: pageData.altText || '',
              mediaType: 'comic_page',
            },
            file: fileData,
            user,
          });
        }

        // Step 2: Create page with uploaded media
        // BULK MODE: Skip expensive hooks during creation, recalculate at end
        const pageDoc = await payload.create({
          collection: 'pages',
          data: {
            comic: comicId,
            chapter: chapterId,
            title: pageData.title || '',
            pageImage: mediaDoc.id,
            altText: pageData.altText || '',
            authorNotes: pageData.authorNotes || '',
            status: 'draft',
            // Don't set chapterPageNumber - let the hook auto-assign it
          } as any,
          user, // Pass user context for access control and hooks
          req: {
            payload,
            user,
            skipGlobalPageCalculation: true,  // Defer to end-of-batch
            skipComicStatsCalculation: true,  // Defer to end-of-batch
          } as any,
        });

        // Success!
        pageResults.push({
          success: true,
          pageId: pageDoc.id,
          mediaId: mediaDoc.id,
          title: pageDoc.title || `Page ${pageDoc.chapterPageNumber}`,
          filename: file.name,
          chapterPageNumber: pageDoc.chapterPageNumber,
          globalPageNumber: pageDoc.globalPageNumber,
        });
        results.successful++;
        affectedChapterIds.add(chapterId); // Track for end-of-batch stats update

        console.log(`✅ Created page: ${pageDoc.displayTitle}`);
      } catch (error: any) {
        // Individual page failed - log full details including underlying cause
        console.error(`❌ Failed to create page for ${file?.name}:`, error.message);

        // DrizzleQueryError wraps the real D1 error in .cause
        if (error.cause) {
          console.error('🔍 Underlying cause:', error.cause);
          console.error('🔍 Cause message:', error.cause?.message);
          console.error('🔍 Cause name:', error.cause?.name);
        }

        console.error('Error stack:', error.stack);

        pageResults.push({
          success: false,
          error: error.message || String(error),
          cause: error.cause?.message || error.cause?.toString() || null,
          filename: file?.name || `file_${i}`,
          title: pageData.title || '',
        });
        results.failed++;
      }
    }

    console.log(
      `🎉 Bulk creation complete: ${results.successful} successful, ${results.failed} failed`,
    )

    // BULK MODE: Run deferred calculations once at end of batch
    if (results.successful > 0) {
      console.log('📊 Running end-of-batch recalculations...')

      try {
        // Recalculate global page numbers for the entire comic
        await recalculateGlobalPageNumbers(payload, comicId)
        console.log('✅ Global page numbers recalculated')
      } catch (error) {
        console.error('⚠️ Failed to recalculate global page numbers:', error)
        // Don't fail the request - pages were created successfully
      }

      try {
        // Update comic statistics once
        await updateComicStatistics(payload, comicId)
        console.log('✅ Comic statistics updated')
      } catch (error) {
        console.error('⚠️ Failed to update comic statistics:', error)
        // Don't fail the request - pages were created successfully
      }

      // Update chapter statistics for all affected chapters
      for (const chapterId of affectedChapterIds) {
        try {
          await updateChapterStatistics(payload, chapterId)
          console.log(`✅ Chapter ${chapterId} statistics updated`)
        } catch (error) {
          console.error(`⚠️ Failed to update chapter ${chapterId} statistics:`, error)
          // Don't fail the request - pages were created successfully
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Successfully created ${results.successful} of ${results.total} pages`,
        results,
        pages: pageResults,
        fallbackChapterCreated: fallbackChapter
          ? {
              id: fallbackChapter.id,
              title: fallbackChapter.title,
            }
          : null,
      },
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('❌ Error in bulk page creation:', error)
    return NextResponse.json(
      {
        error: 'Failed to create pages',
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Helper function to find or create the "Uploaded Pages" fallback chapter
async function findOrCreateUploadChapter(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  comicId: number,
  user: any, // eslint-disable-line @typescript-eslint/no-explicit-any
) {
  const FALLBACK_CHAPTER_TITLE = 'Uploaded Pages';

  try {
    // Try to find existing "Uploaded Pages" chapter
    const existingChapters = await payload.find({
      collection: 'chapters',
      where: {
        comic: { equals: comicId },
        title: { equals: FALLBACK_CHAPTER_TITLE },
      },
      limit: 1,
    });

    if (existingChapters.docs.length > 0) {
      console.log(
        `📁 Using existing fallback chapter: ${FALLBACK_CHAPTER_TITLE}`,
      );
      return existingChapters.docs[0];
    }

    // Create new fallback chapter
    console.log(`📁 Creating fallback chapter: ${FALLBACK_CHAPTER_TITLE}`);

    // Get current highest chapter order
    const allChapters = await payload.find({
      collection: 'chapters',
      where: {
        comic: { equals: comicId },
      },
      sort: '-order',
      limit: 1,
    });

    const nextOrder =
      allChapters.docs.length > 0 ? allChapters.docs[0].order + 1 : 1;

    const newChapter = await payload.create({
      collection: 'chapters',
      data: {
        comic: comicId,
        title: FALLBACK_CHAPTER_TITLE,
        description:
          'Pages uploaded via bulk uploader without specific chapter assignment',
        order: nextOrder,
      },
    });

    console.log(
      `✅ Created fallback chapter: ${FALLBACK_CHAPTER_TITLE} (Order: ${nextOrder})`,
    );
    return newChapter;
  } catch (error: any) {
    console.error('❌ Error creating fallback chapter:', error);
    throw new Error(`Failed to create fallback chapter: ${error.message}`);
  }
}

/**
 * Recalculate global page numbers for all pages in a comic.
 * This is called once at the end of bulk operations instead of per-page.
 */
async function recalculateGlobalPageNumbers(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  comicId: number
) {
  // Get all chapters for this comic, ordered by chapter order
  const chapters = await payload.find({
    collection: 'chapters',
    where: {
      comic: { equals: comicId },
    },
    sort: 'order',
    limit: 100,
  });

  let globalPageNumber = 1;

  // Process each chapter in order
  for (const chapter of chapters.docs) {
    // Get all pages in this chapter, ordered by chapter page number
    const pages = await payload.find({
      collection: 'pages',
      where: {
        chapter: { equals: chapter.id },
      },
      sort: 'chapterPageNumber',
      limit: 1000,
    });

    // Update global page number for each page
    for (const page of pages.docs) {
      if (page.globalPageNumber !== globalPageNumber) {
        await payload.update({
          collection: 'pages',
          id: page.id,
          data: {
            globalPageNumber: globalPageNumber,
          },
          // Skip hooks to avoid cascading recalculations
          req: {
            payload,
            skipGlobalPageCalculation: true,
            skipComicStatsCalculation: true,
          } as any,
        });
      }
      globalPageNumber++;
    }
  }

  console.log(`📊 Recalculated global page numbers: 1 to ${globalPageNumber - 1}`);
}

/**
 * Update comic statistics (totalPages, lastPagePublished).
 * This is called once at the end of bulk operations instead of per-page.
 */
async function updateComicStatistics(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  comicId: number
) {
  // Get current comic to preserve chapter stats
  const comic = await payload.findByID({
    collection: 'comics',
    id: comicId,
  });

  // Count all pages for this comic
  const allPages = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comicId },
    },
    limit: 1,
  });

  // Count published pages and find last published date
  const publishedPages = await payload.find({
    collection: 'pages',
    where: {
      comic: { equals: comicId },
      status: { equals: 'published' },
    },
    sort: '-publishedDate',
    limit: 1,
  });

  const lastPagePublished = publishedPages.docs.length > 0
    ? publishedPages.docs[0].publishedDate
    : null;

  // Update comic stats
  await payload.update({
    collection: 'comics',
    id: comicId,
    data: {
      stats: {
        totalPages: allPages.totalDocs,
        totalChapters: comic.stats?.totalChapters || 0, // Preserve from Chapters hook
        lastPagePublished: lastPagePublished,
      },
    },
  });

  console.log(`📊 Updated comic stats: ${allPages.totalDocs} total pages`);
}

/**
 * Update chapter statistics (pageCount, firstPageNumber, lastPageNumber).
 * Called once per affected chapter at the end of bulk operations.
 */
async function updateChapterStatistics(
  payload: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  chapterId: number
) {
  // Get all pages in this chapter, sorted by chapterPageNumber
  const pagesInChapter = await payload.find({
    collection: 'pages',
    where: {
      chapter: { equals: chapterId },
    },
    sort: 'chapterPageNumber',
    limit: 1000,
  });

  const pageCount = pagesInChapter.totalDocs;
  let firstPageNumber = null;
  let lastPageNumber = null;

  if (pagesInChapter.docs.length > 0) {
    // Find min and max globalPageNumber
    const sortedByGlobal = pagesInChapter.docs
      .filter((p: any) => p.globalPageNumber !== null && p.globalPageNumber !== undefined)
      .sort((a: any, b: any) => a.globalPageNumber - b.globalPageNumber);

    if (sortedByGlobal.length > 0) {
      firstPageNumber = sortedByGlobal[0].globalPageNumber;
      lastPageNumber = sortedByGlobal[sortedByGlobal.length - 1].globalPageNumber;
    }
  }

  // Update chapter stats
  await payload.update({
    collection: 'chapters',
    id: chapterId,
    data: {
      stats: {
        pageCount,
        firstPageNumber,
        lastPageNumber,
      },
    },
  });

  console.log(`📖 Updated chapter ${chapterId} stats: ${pageCount} pages, global range: ${firstPageNumber || 'n/a'}-${lastPageNumber || 'n/a'}`);
}
