import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

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

    const user = {
      sub: payload.sub,
      name: payload.name ?? '',
      email: payload.email ?? '',
      picture: payload.picture ?? '',
    };

    const token = jwt.sign(user, process.env['JWT_SECRET']!, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });

    res.json({ token, user });
  } catch {
    res.status(401).json({ error: 'Invalid ID token' });
  }
});

export default router;
