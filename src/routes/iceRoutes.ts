import { Router } from 'express';
import { getClientIceServers } from '../config/ice';

const router = Router();

// GET /api/ice-servers — 클라이언트용 STUN/TURN 설정 (TURN은 임시 자격 증명)
router.get('/', (_req, res) => {
  res.json({ iceServers: getClientIceServers() });
});

export default router;
