import express from 'express';
import { body } from 'express-validator';
import {
  getSandboxSaves,
  getSandboxSave,
  getAutoSave,
  createSandboxSave,
  updateSandboxSave,
  deleteSandboxSave,
  quickSave
} from '../controllers/sandboxController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getSandboxSaves);

router.get('/autosave', getAutoSave);

router.post('/quicksave', [
  body('components').isArray().withMessage('Components must be an array')
], quickSave);

router.get('/:id', getSandboxSave);

router.post('/', [
  body('name').optional().isString(),
  body('components').isArray().withMessage('Components must be an array'),
  body('isAutoSave').optional().isBoolean()
], createSandboxSave);

router.put('/:id', [
  body('name').optional().isString(),
  body('components').optional().isArray()
], updateSandboxSave);

router.delete('/:id', deleteSandboxSave);

export default router;
