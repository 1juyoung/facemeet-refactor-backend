import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware as any);
router.get('/profile', userController.getProfile as any);
router.put('/profile', userController.updateProfile as any);

export default router;
