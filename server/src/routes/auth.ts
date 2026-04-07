import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { upsert } from '../userStore';
import { appendLoginLog } from '../loginLogger';

const router = Router();

const client = new OAuth2Client(process.env['GOOGLE_CLIENT_ID']);

router.post('/google', async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken) {
    res.status(401).json({ error: 'ID token is required' });
    return;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env['GOOGLE_CLIENT_ID']!,
    });

    if (!ticket) {
      res.status(401).json({ error: 'Invalid ID token' });
      return;
    }

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: 'Invalid ID token' });
      return;
    }

    const ADMIN_IDS = (process.env['ADMIN_USER_IDS'] || '').split(',').map(s => s.trim()).filter(Boolean);

    const user = {
      sub: payload.sub,
      name: payload.name ?? '',
      email: payload.email ?? '',
      picture: payload.picture ?? '',
      isAdmin: ADMIN_IDS.includes(payload.sub),
    };

    const token = jwt.sign(user, process.env['JWT_SECRET']!, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });

    // ユーザー登録/更新 + ログインログ記録
    upsert(user);
    appendLoginLog(user);

    res.json({ token, user });
  } catch {
    res.status(401).json({ error: 'Invalid ID token' });
  }
});

export default router;
