import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import * as minutesService from '../services/minutesService';

export async function getNotesByMeeting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const notes = await minutesService.getNotesByMeeting(req.params['meetingId'] as string);
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

export async function getNoteById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const note = await minutesService.getNoteById(req.params['id'] as string);
    if (!note) {
      res.status(404).json({ message: '회의록을 찾을 수 없습니다.' });
      return;
    }
    res.json(note);
  } catch (err) {
    next(err);
  }
}

export async function createNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { content, score } = req.body;
    if (!content) {
      res.status(400).json({ message: '회의록 내용을 입력해주세요.' });
      return;
    }
    const note = await minutesService.createNote(
      req.params['meetingId'] as string,
      content,
      score ?? 0
    );
    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}

export async function updateNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { content, score } = req.body;
    const note = await minutesService.updateNote(req.params['id'] as string, { content, score });
    res.json(note);
  } catch (err) {
    if ((err as Error).message.includes('찾을 수')) {
      res.status(404).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}

export async function deleteNote(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await minutesService.deleteNote(req.params['id'] as string);
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message.includes('찾을 수')) {
      res.status(404).json({ message: (err as Error).message });
    } else {
      next(err);
    }
  }
}
