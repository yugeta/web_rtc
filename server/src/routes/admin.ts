import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import * as userStore from '../userStore';
import * as roomStore from '../roomStore';
import fs from 'fs';
import path from 'path';

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const LOG_FILE = path.join(__dirname, '..', '..', 'data', 'login.log');

// GET /api/admin/users
router.get('/users', (_req: Request, res: Response) => {
  res.json(userStore.load());
});

// DELETE /api/admin/users/:sub
router.delete('/users/:sub', (req: Request, res: Response) => {
  const sub = req.params['sub'] as string;
  const users = userStore.load();
  const filtered = users.filter(u => u.sub !== sub);
  if (filtered.length === users.length) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  userStore.save(filtered);
  res.status(204).send();
});

// GET /api/admin/logs?page=1&limit=50
router.get('/logs', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query['limit'] as string) || 50));

  if (!fs.existsSync(LOG_FILE)) {
    res.json({ logs: [], total: 0, page, limit });
    return;
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(Boolean);
  const total = lines.length;
  // 新しい順
  const reversed = lines.reverse();
  const start = (page - 1) * limit;
  const slice = reversed.slice(start, start + limit);

  const logs = slice.map(line => {
    const [timestamp, sub, name, email] = line.split('\t');
    return { timestamp, sub, name, email };
  });

  res.json({ logs, total, page, limit });
});

// GET /api/admin/rooms
router.get('/rooms', (_req: Request, res: Response) => {
  res.json(roomStore.load());
});

// DELETE /api/admin/rooms/:id
router.delete('/rooms/:id', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  if (!roomStore.findById(id)) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  roomStore.remove(id);
  res.status(204).send();
});

// GET /api/admin/me — admin判定用
router.get('/me', (req: Request, res: Response) => {
  res.json({ isAdmin: true, sub: req.user!.sub });
});

export default router;
