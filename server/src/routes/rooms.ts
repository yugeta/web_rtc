import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as roomStore from '../roomStore';

const router = Router();

// POST /api/rooms - Room 作成（authMiddleware 必須）
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };

  if (!name || name.trim() === '') {
    res.status(400).json({ error: 'Room name is required' });
    return;
  }

  const room = roomStore.create({
    name: name.trim(),
    ownerId: req.user!.sub,
    ownerName: req.user!.name,
    settings: {},
  });

  res.status(201).json(room);
});

// GET /api/rooms - 自分の Room 一覧取得（authMiddleware 必須）
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const rooms = roomStore.findByOwner(req.user!.sub);
  res.json(rooms);
});

// DELETE /api/rooms/:id - Room 削除（authMiddleware 必須、所有者チェック）
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const room = roomStore.findById(id);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.ownerId !== req.user!.sub) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  roomStore.remove(id);
  res.status(204).send();
});

// GET /api/rooms/:id/exists - Room 存在チェック（認証不要）
router.get('/:id/exists', (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const room = roomStore.findById(id);
  res.json({ exists: !!room, name: room?.name ?? null });
});

export default router;
