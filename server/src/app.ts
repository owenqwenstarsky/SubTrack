import path from 'node:path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Prisma } from '@prisma/client';
import { prisma as prismaClient } from './prisma.js';
import { createSession, destroySession, getCsrfToken, isAuthenticated, requireAuth, requireCsrf } from './auth.js';
import { addInterval, daysUntil, normalizeNextPaymentDate } from './dateUtils.js';
import { loginSchema, subscriptionCreateSchema, subscriptionUpdateSchema, timelineQuerySchema } from './validation.js';
import { serializeSubscription } from './serializers.js';

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
  const subscriptions = await prisma.subscription.findMany({ orderBy: [{ nextPaymentDate: 'asc' }, { name: 'asc' }] });
  res.json({ subscriptions: subscriptions.map(serializeSubscription) });
});

app.post('/api/subscriptions', requireAuth, async (req, res) => {
  const result = subscriptionCreateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  const data = result.data;
  const firstPaymentDate = new Date(data.firstPaymentDate);
  const nextPaymentDate = normalizeNextPaymentDate(
    firstPaymentDate,
    data.billingInterval,
    data.billingIntervalCount,
    data.nextPaymentDate ? new Date(data.nextPaymentDate) : undefined,
  );

  const subscription = await prisma.subscription.create({
    data: { ...data, website: data.website || null, firstPaymentDate, nextPaymentDate, amount: new Prisma.Decimal(data.amount) },
  });

  res.status(201).json({ subscription: serializeSubscription(subscription) });
});

app.get('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
  res.json({ subscription: serializeSubscription(subscription) });
});

app.get('/api/subscriptions/:id/details', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) return res.status(404).json({ error: 'Subscription not found' });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPayments = [];
  let paymentDate = new Date(subscription.firstPaymentDate);

  while (paymentDate < today && pastPayments.length < maxGeneratedPayments) {
    pastPayments.push({
      paymentDate: new Date(paymentDate),
      amount: subscription.amount.toString(),
      currency: subscription.currency,
    });
    paymentDate = addInterval(paymentDate, subscription.billingInterval, subscription.billingIntervalCount);
  }

  pastPayments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());

  const totalPaid = subscription.amount.mul(pastPayments.length).toString();

  res.json({
    subscription: serializeSubscription(subscription),
    pastPayments,
    stats: {
      paymentsMade: pastPayments.length,
      totalPaid,
      currency: subscription.currency,
      daysUntilNextPayment: daysUntil(subscription.nextPaymentDate),
    },
  });
});

app.put('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Subscription not found' });

  const result = subscriptionUpdateSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });

  const data = result.data;
  if (Object.keys(req.body ?? {}).length === 0) return res.status(400).json({ error: 'At least one field is required' });

  const firstPaymentDate = data.firstPaymentDate ? new Date(data.firstPaymentDate) : existing.firstPaymentDate;
  const billingInterval = data.billingInterval ?? existing.billingInterval;
  const billingIntervalCount = data.billingIntervalCount ?? existing.billingIntervalCount;
  const nextPaymentDate = data.nextPaymentDate
    ? new Date(data.nextPaymentDate)
    : data.firstPaymentDate || data.billingInterval || data.billingIntervalCount
      ? normalizeNextPaymentDate(firstPaymentDate, billingInterval, billingIntervalCount)
      : undefined;

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...data,
      website: data.website === '' ? null : data.website,
      amount: data.amount !== undefined ? new Prisma.Decimal(data.amount) : undefined,
      firstPaymentDate: data.firstPaymentDate ? firstPaymentDate : undefined,
      nextPaymentDate,
    },
  });

  res.json({ subscription: serializeSubscription(subscription) });
});

app.delete('/api/subscriptions/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  try {
    await prisma.subscription.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    throw error;
  }
});

app.get('/api/timeline', requireAuth, async (req, res) => {
  const query = timelineQuerySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ error: query.error.flatten() });

  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + query.data.months);

  const subscriptions = await prisma.subscription.findMany();
  const payments = subscriptions.flatMap((subscription) => {
    const occurrences = [];
    let paymentDate = new Date(subscription.nextPaymentDate);

    while (paymentDate <= horizon && occurrences.length < maxGeneratedPayments) {
      occurrences.push({
        subscription: serializeSubscription(subscription),
        paymentDate,
        daysUntil: daysUntil(paymentDate),
        amount: subscription.amount.toString(),
        currency: subscription.currency,
      });
      paymentDate = addInterval(paymentDate, subscription.billingInterval, subscription.billingIntervalCount);
    }

    return occurrences;
  }).sort((a, b) => a.paymentDate.getTime() - b.paymentDate.getTime());

  res.json({ payments });
});

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
