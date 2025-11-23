import { getPayload } from 'payload'
import config from '@/payload.config'
import { NextRequest, NextResponse } from 'next/server'

// Configuration constants
const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
// const MAX_TOTAL_SIZE = 200 * 1024 * 1024; // 200MB total batch

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:8888',
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

    // Process each page
    for (let i = 0; i < pagesData.length; i++) {
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
        const fileData = {
          data: Buffer.from(fileBuffer),
          mimetype: file.type,
          name: file.name,
          size: file.size,
        };

        const mediaDoc = await payload.create({
          collection: 'media',
          data: {
            alt: pageData.altText || '',
            mediaType: 'comic_page',
          },
          file: fileData,
        });

        // Step 2: Create page with uploaded media
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
            chapterPageNumber: 0, // Temporary value, hooks will recalculate
          },
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

        console.log(`✅ Created page: ${pageDoc.displayTitle}`);
      } catch (error: any) {
        // Individual page failed
        pageResults.push({
          success: false,
          error: error.message,
          filename: file?.name || `file_${i}`,
          title: pageData.title || '',
        });
        results.failed++;

        console.error(
          `❌ Failed to create page for ${file?.name}: ${error.message}`,
        );
      }
    }

    console.log(
      `🎉 Bulk creation complete: ${results.successful} successful, ${results.failed} failed`,
    )

    // Note: Global page numbers will be recalculated automatically by hooks
    // when pages are created without skipGlobalPageCalculation flag

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
