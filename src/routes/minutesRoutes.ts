import { Router } from 'express';
import * as minutesController from '../controllers/minutesController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware as any);

router.get('/:id', minutesController.getNoteById as any);
router.put('/:id', minutesController.updateNote as any);
router.delete('/:id', minutesController.deleteNote as any);

export default router;
