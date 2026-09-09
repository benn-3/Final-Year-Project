const { Router } = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const onboardingService = require('../services/onboarding.service');

const router = Router();

const profileSchema = z.object({
  goal: z.string().min(5, 'Describe your goal in at least 5 characters'),
  interests: z.array(z.string().min(1)).min(1, 'Select at least one interest'),
  preparedness: z.enum(['just_starting', 'some_exposure', 'comfortable']),
  selfRatedKnowledge: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

const submitSchema = z.object({
  jobId: z.string().min(1),
  answers: z.array(z.number().int().min(0).max(3)),
});

// POST /onboarding/profile — create profile, enqueue diagnostic
router.post('/onboarding/profile', auth, validate(profileSchema), async (req, res) => {
  const result = await onboardingService.createProfile(req.user.sub, req.body);
  res.status(201).json(result);
});

// GET /onboarding/diagnostic/:jobId/status
router.get('/onboarding/diagnostic/:jobId/status', auth, async (req, res) => {
  const result = await onboardingService.getDiagnosticStatus(req.params.jobId);
  res.json(result);
});

// GET /onboarding/diagnostic/:jobId — return questions (strip correct answers)
router.get('/onboarding/diagnostic/:jobId', auth, async (req, res) => {
  const questions = await onboardingService.getDiagnosticQuestions(req.params.jobId);
  res.json({ questions });
});

// POST /onboarding/diagnostic/submit — grade answers, set diagnostic_score
router.post('/onboarding/diagnostic/submit', auth, validate(submitSchema), async (req, res) => {
  const result = await onboardingService.submitDiagnostic(req.user.sub, req.body);
  res.json(result);
});

module.exports = router;
