import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE_NAME = 'subtrack_session';
const sessions = new Set<string>();

export function createSession(res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.add(token);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function destroySession(req: Request, res: Response) {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME);
}

export function isAuthenticated(req: Request): boolean {
  const token = req.signedCookies?.[COOKIE_NAME];
  return typeof token === 'string' && sessions.has(token);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
