const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const authService = require('../services/auth.service');

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const tokens = await authService.register(req.body);
  res.status(201).json(tokens);
});

router.post('/login', validate(loginSchema), async (req, res) => {
  const tokens = await authService.login(req.body);
  res.json(tokens);
});

router.post('/refresh', validate(refreshSchema), async (req, res) => {
  const tokens = await authService.refresh(req.body);
  res.json(tokens);
});

module.exports = router;
