import express from 'express';
import { syncGameData, getGameData } from '../controllers/equationRunnerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.post('/sync', syncGameData);
router.get('/', getGameData);

export default router;
