import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { prisma as prismaClient } from './prisma.js';
import { createSession, destroySession, getCsrfToken, isAuthenticated, requireAuth, requireCsrf } from './auth.js';
import { loginSchema, subscriptionCreateSchema, subscriptionUpdateSchema, timelineQuerySchema } from './validation.js';
import { createSubscription, deleteSubscription, getSubscription, getSubscriptionDetails, getTimeline, listSubscriptions, NotFoundError, updateSubscription } from './subscriptionService.js';
import { mountMcpRoutes } from './mcp/http.js';

export type AppPrisma = typeof prismaClient;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ quiet: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export function createApp(options: { prisma?: AppPrisma } = {}) {
const app = express();
const prisma = options.prisma ?? prismaClient;
const clientDistPath = path.resolve(__dirname, '../../web/dist');
const appPassword = process.env.APP_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const maxGeneratedPayments = Number(process.env.MAX_GENERATED_PAYMENTS ?? 1000);

if (process.env.NODE_ENV === 'production' && !sessionSecret) {
  throw new Error('SESSION_SECRET is required in production');
}

if (!appPassword) {
  console.warn('APP_PASSWORD is not set. Login will be disabled until it is configured.');
}

const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins ?? (process.env.NODE_ENV === 'production' ? [] : [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser(sessionSecret ?? 'development-secret-change-me'));
app.use(requireCsrf);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;

function loginRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();
  const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const existing = loginAttempts.get(key);
  const entry = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + loginWindowMs } : existing;

  if (entry.count >= maxLoginAttempts) {
    res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
    res.status(429).json({ error: 'Too many login attempts' });
    return;
  }

  entry.count += 1;
  loginAttempts.set(key, entry);
  next();
}

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });
  if (!appPassword || result.data.password !== appPassword) return res.status(401).json({ error: 'Invalid password' });

  const { csrfToken } = createSession(res);
  loginAttempts.delete(req.ip ?? req.socket.remoteAddress ?? 'unknown');
  res.json({ authenticated: true, csrfToken });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ authenticated: false });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

app.get('/api/auth/csrf', requireAuth, (req, res) => {
  const csrfToken = getCsrfToken(req);
  if (!csrfToken) return res.status(400).json({ error: 'CSRF token is only available for cookie sessions' });
  res.json({ csrfToken });
});

app.get('/api/subscriptions', requireAuth, async (_req, res) => {
  res.json(await listSubscriptions(prisma));
});

app.post('/api/subscriptions', requireAuth, async (req, res) => {
  const result = subscriptionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  res.status(201).json(await createSubscription(prisma, result.data));
});

app.get('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    res.json(await getSubscription(prisma, id));
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    throw error;
  }
});

app.get('/api/subscriptions/:id/details', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    res.json(await getSubscriptionDetails(prisma, id, { maxGeneratedPayments }));
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    throw error;
  }
});

app.put('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    await getSubscription(prisma, id);
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    throw error;
  }

  const result = subscriptionUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  try {
    res.json(await updateSubscription(prisma, id, result.data));
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    throw error;
  }
});

app.delete('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    await deleteSubscription(prisma, id);
    res.status(204).send();
  } catch (error) {
    if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
    throw error;
  }
});

app.get('/api/timeline', requireAuth, async (req, res) => {
  const query = timelineQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: query.error.flatten() });

  res.json(await getTimeline(prisma, query.data, { maxGeneratedPayments }));
});

mountMcpRoutes(app, { prisma, maxGeneratedPayments });

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

return app;
}
