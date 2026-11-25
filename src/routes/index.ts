import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import meetingRoutes from './meetingRoutes';
import minutesRoutes from './minutesRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/meetings', meetingRoutes);
router.use('/minutes', minutesRoutes);

export default router;
