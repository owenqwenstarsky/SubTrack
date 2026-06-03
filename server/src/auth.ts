import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE_NAME = 'subtrack_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const sessions = new Map<string, { csrfToken: string }>();

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  signed: true,
  maxAge: 1000 * 60 * 60 * 24 * 30,
};

export function createSession(res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  const csrfToken = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { csrfToken });
  res.cookie(COOKIE_NAME, token, cookieOptions);
  return { csrfToken };
}

export function destroySession(req: Request, res: Response) {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export function hasValidSession(req: Request): boolean {
  const token = req.signedCookies?.[COOKIE_NAME];
  return typeof token === 'string' && sessions.has(token);
}

export function getPasswordFromRequest(req: Request): string | null {
  const headerPassword = req.header('x-subtrack-password');
  if (headerPassword) return headerPassword;

  const authorization = req.header('authorization');
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function hasValidPasswordCredential(req: Request): boolean {
  const credential = getPasswordFromRequest(req);
  return !!process.env.APP_PASSWORD && credential === process.env.APP_PASSWORD;
}

export function hasValidPasswordHeader(req: Request): boolean {
  return hasValidPasswordCredential(req);
}

export function getCsrfToken(req: Request): string | null {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (typeof token !== 'string') return null;
  return sessions.get(token)?.csrfToken ?? null;
}

export function isAuthenticated(req: Request): boolean {
  return hasValidSession(req) || hasValidPasswordHeader(req);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method) || req.path === '/api/auth/login' || hasValidPasswordCredential(req)) {
    next();
    return;
  }

  if (!hasValidSession(req)) {
    next();
    return;
  }

  const csrfToken = getCsrfToken(req);
  if (!csrfToken || req.header('x-csrf-token') !== csrfToken) {
    res.status(403).json({ error: 'Invalid CSRF token' });
    return;
  }

  next();
}
