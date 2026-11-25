import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as meetingService from '../services/meetingService';

export async function getMeetings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const meetings = await meetingService.getMeetingsByUser(req.userId!);
    res.json(meetings);
  } catch (err) {
    next(err);
  }
}

export async function getMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const meeting = await meetingService.getMeetingById(req.params['id'] as string);
    if (!meeting) {
      res.status(404).json({ message: '회의를 찾을 수 없습니다.' });
      return;
    }
    res.json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function createMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ message: '회의 제목을 입력해주세요.' });
      return;
    }
    const meeting = await meetingService.createMeeting(title, req.userId!);
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function deleteMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await meetingService.deleteMeeting(req.params['id'] as string, req.userId!);
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message.includes('권한')) {
      res.status(403).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}

export async function joinMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const participant = await meetingService.joinMeeting(req.params['id'] as string, req.userId!);
    res.json(participant);
  } catch (err) {
    if ((err as Error).message.includes('찾을 수')) {
      res.status(404).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}
