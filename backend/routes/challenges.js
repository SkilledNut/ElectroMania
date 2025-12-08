import express from 'express';
import { body } from 'express-validator';
import {
  getChallenges,
  getChallenge,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  completeChallenge
} from '../controllers/challengeController.js';
import { protect, optional } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optional, getChallenges);

router.get('/:id', optional, getChallenge);

router.post('/', protect, [
  body('prompt').notEmpty().withMessage('Prompt is required'),
  body('requiredComponents').isArray({ min: 1 }).withMessage('At least one component required'),
  body('theory').optional().isArray()
], createChallenge);

router.put('/:id', protect, updateChallenge);

router.delete('/:id', protect, deleteChallenge);

router.post('/:id/complete', protect, [
  body('score').optional().isNumeric()
], completeChallenge);

export default router;
