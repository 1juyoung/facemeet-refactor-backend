import { Router } from 'express';
import * as meetingController from '../controllers/meetingController';
import * as minutesController from '../controllers/minutesController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware as any);

router.get('/', meetingController.getMeetings as any);
router.post('/', meetingController.createMeeting as any);
router.get('/:id', meetingController.getMeeting as any);
router.delete('/:id', meetingController.deleteMeeting as any);
router.put('/:id/join', meetingController.joinMeeting as any);

// 회의별 회의록
router.get('/:meetingId/minutes', minutesController.getNotesByMeeting as any);
router.post('/:meetingId/minutes', minutesController.createNote as any);

export default router;
