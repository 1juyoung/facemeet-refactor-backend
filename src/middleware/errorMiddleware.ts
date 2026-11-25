import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);
  res.status(500).json({ message: '서버 오류가 발생했습니다.', error: err.message });
}
