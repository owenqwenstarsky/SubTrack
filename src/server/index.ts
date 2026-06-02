import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { createSession, destroySession, isAuthenticated, requireAuth } from './auth.js';
import { addInterval, daysUntil, normalizeNextPaymentDate } from './dateUtils.js';
import { loginSchema, subscriptionCreateSchema, subscriptionUpdateSchema, timelineQuerySchema } from './validation.js';
import { serializeSubscription } from './serializers.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistPath = path.resolve(__dirname, '../../dist');
const appPassword = process.env.APP_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET ?? 'development-secret-change-me';

if (!appPassword) {
  console.warn('APP_PASSWORD is not set. Login will be disabled until it is configured.');
}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser(sessionSecret));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: result.error.flatten() });
  if (!appPassword || result.data.password !== appPassword) return res.status(401).json({ error: 'Invalid password' });

  createSession(res);
  res.json({ authenticated: true });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req, res);
  res.json({ authenticated: false });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
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

  while (paymentDate < today) {
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

    while (paymentDate <= horizon) {
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
  app.get('*', (_req, res) => res.sendFile(path.join(clientDistPath, 'index.html')));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Subtrack API listening on http://localhost:${port}`);
});
