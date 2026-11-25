import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as userService from '../services/userService';

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.userId!);
    if (!user) {
      res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nickname, password } = req.body;
    const updated = await userService.updateProfile(req.userId!, { nickname, password });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}
