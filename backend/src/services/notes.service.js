const { PrismaClient } = require('@prisma/client');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const prisma = new PrismaClient();

// Initialize S3 client (works for both AWS S3 and self-hosted MinIO)
const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT }),
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true, // required for MinIO path-style access
});

const BUCKET = process.env.S3_BUCKET || 'learning-advisor';

// ─── Upload file or inline text note ─────────────────────────────────────────
async function uploadNote(chapterId, userId, file, inlineText) {
  // Verify chapter ownership
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, milestone: { roadmap: { userId } } },
  });
  if (!chapter) {
    const err = new Error('Chapter not found');
    err.status = 404;
    throw err;
  }

  if (inlineText) {
    // Store short text/markdown directly in DB — no object storage needed
    const note = await prisma.chapterNote.create({
      data: { chapterId, userId, contentText: inlineText },
    });
    return note;
  }

  if (file) {
    // Upload to S3/MinIO under users/{userId}/chapters/{chapterId}/timestamp-filename
    const key = `users/${userId}/chapters/${chapterId}/${Date.now()}-${file.originalname}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );
    const note = await prisma.chapterNote.create({
      data: { chapterId, userId, fileUrl: key, fileType: file.mimetype },
    });
    return note;
  }

  const err = new Error('Either a file or text note is required');
  err.status = 400;
  throw err;
}

// ─── List notes with pre-signed S3 URLs ──────────────────────────────────────
async function getNotes(chapterId, userId) {
  // Verify chapter ownership
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, milestone: { roadmap: { userId } } },
  });
  if (!chapter) {
    const err = new Error('Chapter not found');
    err.status = 404;
    throw err;
  }

  const notes = await prisma.chapterNote.findMany({
    where: { chapterId, userId },
    orderBy: { uploadedAt: 'desc' },
  });

  // Generate 1-hour presigned URLs for file-based notes
  const notesWithUrls = await Promise.all(
    notes.map(async (note) => {
      if (note.fileUrl) {
        const signedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: BUCKET, Key: note.fileUrl }),
          { expiresIn: 3600 }
        );
        return { ...note, signedUrl };
      }
      return note;
    })
  );

  return notesWithUrls;
}

module.exports = { uploadNote, getNotes };
