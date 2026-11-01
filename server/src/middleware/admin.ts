import { Request, Response, NextFunction } from 'express';

const ADMIN_USER_IDS = (process.env['ADMIN_USER_IDS'] || '').split(',').map(s => s.trim()).filter(Boolean);

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !ADMIN_USER_IDS.includes(req.user.sub)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}
