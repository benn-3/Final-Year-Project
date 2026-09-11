const { Router } = require('express');
const { Prismafrontend } = require('@prisma/frontend');
const auth = require('../middleware/auth');

const router = Router();
const prisma = new Prismafrontend();

// GET /chapters/:id — chapter detail + objectives + status
router.get('/chapters/:id', auth, async (req, res) => {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: req.params.id,
      milestone: { roadmap: { userId: req.user.sub } },
    },
    include: {
      milestone: { select: { id: true, title: true, order: true, status: true } },
      assessments: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { id: true, difficulty: true, generatedAt: true },
      },
    },
  });

  if (!chapter) {
    return res.status(404).json({ error: 'Chapter not found' });
  }

  // Auto-transition: not_started → in_progress on first visit
  if (chapter.status === 'not_started') {
    await prisma.chapter.update({ where: { id: chapter.id }, data: { status: 'in_progress' } });
    chapter.status = 'in_progress';
  }

  res.json(chapter);
});

module.exports = router;
