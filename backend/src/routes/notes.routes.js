const { Router } = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const notesService = require('../services/notes.service');

const router = Router();

// Files stored in memory buffer; 10 MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow common document and image types
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/markdown',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'));
    }
  },
});

// POST /chapters/:id/notes — upload file OR inline text note
router.post('/chapters/:id/notes', auth, upload.single('file'), async (req, res) => {
  const note = await notesService.uploadNote(
    req.params.id,
    req.user.sub,
    req.file || null,
    req.body.text || null
  );
  res.status(201).json(note);
});

// GET /chapters/:id/notes — list user's notes for the chapter
router.get('/chapters/:id/notes', auth, async (req, res) => {
  const notes = await notesService.getNotes(req.params.id, req.user.sub);
  res.json(notes);
});

module.exports = router;
