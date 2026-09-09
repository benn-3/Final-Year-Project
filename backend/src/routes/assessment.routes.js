const { Router } = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const assessmentService = require('../services/assessment.service');

const router = Router();

const attemptSchema = z.object({
  answers: z.array(z.number().int().min(0).max(3)).min(1),
});

// GET /chapters/:id/assessment — get existing or trigger generation
router.get('/chapters/:id/assessment', auth, async (req, res) => {
  const result = await assessmentService.getOrCreateAssessment(req.params.id, req.user.sub);
  res.json(result);
});

// GET /assessments/:id/status — poll generation status (by assessmentId)
router.get('/assessments/:id/status', auth, async (req, res) => {
  const result = await assessmentService.getAssessmentStatus(req.params.id, req.user.sub);
  res.json(result);
});

// GET /assessments/:id — get assessment with questions (no correct answers)
router.get('/assessments/:id', auth, async (req, res) => {
  const result = await assessmentService.getAssessmentWithQuestions(req.params.id, req.user.sub);
  res.json(result);
});

// POST /assessments/:id/regenerate — force a fresh MCQ set
router.post('/assessments/:id/regenerate', auth, async (req, res) => {
  const result = await assessmentService.regenerateAssessment(req.params.id, req.user.sub);
  res.status(202).json(result);
});

// POST /assessments/:id/attempt — submit answers, grade server-side
router.post('/assessments/:id/attempt', auth, validate(attemptSchema), async (req, res) => {
  const result = await assessmentService.submitAttempt(req.params.id, req.user.sub, req.body.answers);
  res.json(result);
});

module.exports = router;
