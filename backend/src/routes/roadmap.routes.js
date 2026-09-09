const { Router } = require('express');
const { z } = require('zod');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const roadmapService = require('../services/roadmap.service');

const router = Router();

const modifySchema = z.object({
  prompt: z.string().min(3, 'Describe your modification request'),
});

// POST /roadmaps — kick off async roadmap generation
router.post('/roadmaps', auth, async (req, res) => {
  const result = await roadmapService.createRoadmap(req.user.sub);
  res.status(202).json(result);
});

// GET /roadmaps/active — get user's active roadmap (convenience)
router.get('/roadmaps/active', auth, async (req, res) => {
  const roadmap = await roadmapService.getActiveRoadmap(req.user.sub);
  res.json(roadmap);
});

// GET /roadmaps/:id/status — poll job status (jobId used as id)
router.get('/roadmaps/:id/status', auth, async (req, res) => {
  const result = await roadmapService.getRoadmapJobStatus(req.params.id);
  res.json(result);
});

// GET /roadmaps/:id — full roadmap tree + progress
router.get('/roadmaps/:id', auth, async (req, res) => {
  const roadmap = await roadmapService.getRoadmap(req.params.id, req.user.sub);
  res.json(roadmap);
});

// POST /roadmaps/:id/modify — propose AI diff (synchronous)
router.post('/roadmaps/:id/modify', auth, validate(modifySchema), async (req, res) => {
  const result = await roadmapService.proposeModification(req.params.id, req.user.sub, req.body.prompt);
  res.json(result);
});

// POST /roadmaps/:id/modify/:changeId/confirm — apply confirmed diff
router.post('/roadmaps/:id/modify/:changeId/confirm', auth, async (req, res) => {
  const result = await roadmapService.confirmModification(req.params.id, req.user.sub, req.params.changeId);
  res.json(result);
});

// POST /roadmaps/:id/modify/:changeId/reject — discard pending change
router.post('/roadmaps/:id/modify/:changeId/reject', auth, async (req, res) => {
  const result = await roadmapService.rejectModification(req.params.id, req.user.sub, req.params.changeId);
  res.json(result);
});

module.exports = router;
