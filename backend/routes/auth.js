import express from 'express';
import { body } from 'express-validator';
import { register, login, getMe, getLeaderboard } from '../controllers/authController.js';
import { protect, optional } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], register);

router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.get('/me', protect, getMe);

router.get('/leaderboard', optional, getLeaderboard);

export default router;
