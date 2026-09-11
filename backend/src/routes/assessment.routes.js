const { Router } = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const assessmentService = require('../services/assessment.service');
const { getConceptMasteryWithUncertainty, getWeakConceptsWithContext, getMasteryOverview } = require('../services/tracekt.service');

const router = Router();

// ── TRACE-KT extended answer schema ──────────────────────────────────────────
// Supports both legacy format (array of ints) and new format (array of objects)
const traceKTAnswerSchema = z.object({
  answerIndex: z.number().int().min(0).max(3),
  responseTimeMs: z.number().int().min(0).optional(),
  hintCount: z.number().int().min(0).max(3).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const attemptSchema = z.object({
  // Accept either legacy format (array of ints) or TRACE-KT format (array of objects)
  answers: z.union([
    z.array(z.number().int().min(0).max(3)).min(1),       // Legacy
    z.array(traceKTAnswerSchema).min(1),                   // TRACE-KT
  ]),
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

// POST /assessments/:id/attempt — submit answers with TRACE-KT behavioral data
router.post('/assessments/:id/attempt', auth, validate(attemptSchema), async (req, res) => {
  const result = await assessmentService.submitAttempt(req.params.id, req.user.sub, req.body.answers);
  res.json(result);
});

// ── TRACE-KT mastery endpoints ───────────────────────────────────────────────

// GET /mastery/concepts — get all concept mastery + uncertainty for current user
router.get('/mastery/concepts', auth, async (req, res) => {
  const concepts = await getConceptMasteryWithUncertainty(req.user.sub);
  res.json({ concepts });
});

// GET /mastery/weak — get weak concepts with uncertainty context
router.get('/mastery/weak', auth, async (req, res) => {
  const weakConcepts = await getWeakConceptsWithContext(req.user.sub);
  res.json({ weakConcepts });
});

// GET /mastery/overview — comprehensive TRACE-KT dashboard data
router.get('/mastery/overview', auth, async (req, res) => {
  const overview = await getMasteryOverview(req.user.sub);
  res.json(overview);
});

module.exports = router;
