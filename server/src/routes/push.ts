import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as subscriptionStore from '../subscriptionStore';
import * as roomStore from '../roomStore';
import * as pushService from '../pushService';
import * as userStore from '../userStore';

const router = Router();

// GET /api/push/vapid-public-key - VAPID 公開鍵を返す（認証不要）
router.get('/vapid-public-key', (_req: Request, res: Response) => {
  const publicKey = process.env['VAPID_PUBLIC_KEY'];
  if (!publicKey) {
    res.status(404).json({ error: 'VAPID public key not configured' });
    return;
  }
  res.json({ publicKey });
});

// POST /api/push/subscribe - Subscription 登録（認証必須）
router.post('/subscribe', authMiddleware, (req: Request, res: Response) => {
  const { subscription } = req.body as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };

  if (
    !subscription ||
    !subscription.endpoint ||
    !subscription.keys ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    res.status(400).json({ error: 'Invalid subscription data' });
    return;
  }

  const deviceId = subscriptionStore.hashEndpoint(subscription.endpoint);

  try {
    subscriptionStore.save({
      userSub: req.user!.sub,
      deviceId,
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ message: 'Subscription saved' });
  } catch {
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/push/subscribe - Subscription 削除（認証必須）
router.delete('/subscribe', authMiddleware, (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };

  if (!endpoint) {
    res.status(400).json({ error: 'Endpoint is required' });
    return;
  }

  const deviceId = subscriptionStore.hashEndpoint(endpoint);
  const removed = subscriptionStore.remove(req.user!.sub, deviceId);

  if (removed) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Subscription not found' });
  }
});

// POST /api/push/invite - ルーム招待通知を送信（認証必須）
router.post('/invite', authMiddleware, async (req: Request, res: Response) => {
  const { roomId, targetUserSubs } = req.body as {
    roomId?: string;
    targetUserSubs?: string[];
  };

  if (!roomId || !targetUserSubs || !Array.isArray(targetUserSubs) || targetUserSubs.length === 0) {
    res.status(400).json({ error: 'roomId and targetUserSubs are required' });
    return;
  }

  const room = roomStore.findById(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const inviterName = req.user!.name;
  const payload = pushService.buildInvitePayload(roomId, room.name, inviterName);

  let sent = 0;
  let failed = 0;

  for (const userSub of targetUserSubs) {
    try {
      await pushService.sendNotification(userSub, payload);
      sent++;
    } catch {
      failed++;
    }
  }

  res.json({ sent, failed });
});

// GET /api/push/users - 招待送信先ユーザー一覧（認証必須、自分を除外）
router.get('/users', authMiddleware, (req: Request, res: Response) => {
  const users = userStore.load();
  const filtered = users
    .filter((u) => u.sub !== req.user!.sub)
    .map((u) => ({ sub: u.sub, name: u.name, picture: u.picture }));
  res.json(filtered);
});

export default router;
