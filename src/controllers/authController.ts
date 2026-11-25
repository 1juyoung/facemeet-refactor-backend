import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, nickname } = req.body;
    if (!email || !password || !nickname) {
      res.status(400).json({ message: '이메일, 비밀번호, 닉네임을 모두 입력해주세요.' });
      return;
    }
    const result = await authService.register(email, password, nickname);
    res.status(201).json(result);
  } catch (err) {
    if ((err as Error).message.includes('이미')) {
      res.status(409).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    if ((err as Error).message.includes('올바르지')) {
      res.status(401).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}
