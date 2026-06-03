import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.APP_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.MAX_GENERATED_PAYMENTS = '5';
delete process.env.MCP_ENABLED;

const { createApp } = await import('../src/app.js');
type AppPrisma = import('../src/app.js').AppPrisma;

type SubscriptionRow = {
  id: string;
  name: string;
  description: string | null;
  amount: Prisma.Decimal;
  currency: string;
  billingInterval: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  billingIntervalCount: number;
  firstPaymentDate: Date;
  nextPaymentDate: Date;
  category: string | null;
  website: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function makePrisma() {
  let seq = 0;
  const rows: SubscriptionRow[] = [];

  const sortRows = (values: SubscriptionRow[], orderBy?: unknown) => {
    if (!Array.isArray(orderBy)) return [...values];
    return [...values].sort((a, b) => {
      for (const order of orderBy as Array<Record<string, 'asc' | 'desc'>>) {
        const [field, direction] = Object.entries(order)[0] as [keyof SubscriptionRow, 'asc' | 'desc'];
        const av = a[field] instanceof Date ? (a[field] as Date).getTime() : a[field];
        const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : b[field];
        if (av === bv) continue;
        const result = av! < bv! ? -1 : 1;
        return direction === 'desc' ? -result : result;
      }
      return 0;
    });
  };

  const prisma = {
    subscription: {
      findMany: async (args?: { orderBy?: unknown }) => sortRows(rows, args?.orderBy),
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null,
      create: async ({ data }: { data: any }) => {
        const now = new Date('2026-01-01T00:00:00.000Z');
        const row: SubscriptionRow = {
          id: `sub_${++seq}`,
          name: data.name,
          description: data.description ?? null,
          amount: data.amount,
          currency: data.currency ?? 'USD',
          billingInterval: data.billingInterval,
          billingIntervalCount: data.billingIntervalCount ?? 1,
          firstPaymentDate: data.firstPaymentDate,
          nextPaymentDate: data.nextPaymentDate,
          category: data.category ?? null,
          website: data.website ?? null,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((value) => value.id === where.id);
        if (!row) throw new Error('not found');
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) (row as Record<string, unknown>)[key] = value;
        }
        row.updatedAt = new Date('2026-01-02T00:00:00.000Z');
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index === -1) throw new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' });
        return rows.splice(index, 1)[0];
      },
    },
  } as unknown as AppPrisma;

  return { prisma, rows };
}

async function start(prisma = makePrisma().prisma) {
  const app = createApp({ prisma });
  const server: Server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  return { baseUrl, server };
}

function cookieFrom(response: Response) {
  return response.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function json(response: Response) {
  return response.status === 204 ? undefined : response.json() as Promise<any>;
}

describe('Subtrack API', () => {
  let baseUrl: string;
  let server: Server;
  let store: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    store = makePrisma();
    ({ baseUrl, server } = await start(store.prisma));
  });

  afterEach(() => server?.close());

  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, init);
  }

  it('serves public health and anonymous auth state, and protects private routes', async () => {
    assert.deepEqual(await json(await request('/api/health')), { ok: true });
    assert.deepEqual(await json(await request('/api/auth/me')), { authenticated: false });

    const protectedResponse = await request('/api/subscriptions');
    assert.equal(protectedResponse.status, 401);
    assert.deepEqual(await json(protectedResponse), { error: 'Unauthorized' });
  });

  it('validates login, rate limits failures, creates cookie sessions, returns CSRF tokens, and logs out', async () => {
    assert.equal((await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
    for (let i = 0; i < 4; i++) {
      assert.equal((await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) })).status, 401);
    }
    const limited = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' }) });
    assert.equal(limited.status, 429);
    assert.match(limited.headers.get('retry-after') ?? '', /^\d+$/);

    server.close();
    ({ baseUrl, server } = await start(store.prisma));
    const login = await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) });
    assert.equal(login.status, 200);
    const body = await json(login);
    assert.equal(body.authenticated, true);
    assert.equal(typeof body.csrfToken, 'string');
    const cookie = cookieFrom(login);
    assert.ok(cookie.startsWith('subtrack_session='));

    assert.deepEqual(await json(await request('/api/auth/me', { headers: { cookie } })), { authenticated: true });
    assert.deepEqual(await json(await request('/api/auth/csrf', { headers: { cookie } })), { csrfToken: body.csrfToken });

    const forbidden = await request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(forbidden.status, 403);

    const logout = await request('/api/auth/logout', { method: 'POST', headers: { cookie, 'x-csrf-token': body.csrfToken } });
    assert.equal(logout.status, 200);
    assert.deepEqual(await json(logout), { authenticated: false });
  });

  it('allows password-header authentication without CSRF for subscription CRUD', async () => {
    const headers = { 'content-type': 'application/json', 'x-subtrack-password': 'test-password' };

    assert.deepEqual(await json(await request('/api/subscriptions', { headers })), { subscriptions: [] });
    assert.equal((await request('/api/subscriptions', { method: 'POST', headers, body: JSON.stringify({ name: '', amount: -1 }) })).status, 400);

    const create = await request('/api/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Netflix', amount: '12.50', currency: 'USD', billingInterval: 'MONTHLY', billingIntervalCount: 1, firstPaymentDate: '2025-01-01', website: '' }),
    });
    assert.equal(create.status, 201);
    const created = (await json(create)).subscription;
    assert.equal(created.id, 'sub_1');
    assert.equal(created.amount, '12.5');
    assert.equal(created.website, null);

    const read = await request('/api/subscriptions/sub_1', { headers });
    assert.equal(read.status, 200);
    assert.equal((await json(read)).subscription.name, 'Netflix');

    const updateEmpty = await request('/api/subscriptions/sub_1', { method: 'PUT', headers, body: '{}' });
    assert.equal(updateEmpty.status, 400);
    assert.equal((await request('/api/subscriptions/missing', { method: 'PUT', headers, body: JSON.stringify({ name: 'Nope' }) })).status, 404);

    const update = await request('/api/subscriptions/sub_1', { method: 'PUT', headers, body: JSON.stringify({ amount: '15.00', website: '', firstPaymentDate: '2025-02-01', nextPaymentDate: '2025-03-01' }) });
    assert.equal(update.status, 200);
    const updated = (await json(update)).subscription;
    assert.equal(updated.amount, '15');
    assert.equal(updated.website, null);
    assert.match(updated.nextPaymentDate, /^2025-03-01T/);

    assert.equal((await request('/api/subscriptions/missing', { headers })).status, 404);
    assert.equal((await request('/api/subscriptions/sub_1', { method: 'DELETE', headers })).status, 204);
    assert.equal((await request('/api/subscriptions/sub_1', { method: 'DELETE', headers })).status, 404);
  });

  it('covers API edge branches for CORS, disabled login, CSRF, validation, update recalculation, and errors', async () => {
    const headers = { 'content-type': 'application/json', 'x-subtrack-password': 'test-password' };
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = () => {};
    console.warn = () => {};

    const corsError = await request('/api/health', { headers: { origin: 'https://evil.example' } });
    assert.equal(corsError.status, 500);

    assert.equal((await request('/api/auth/csrf', { headers })).status, 400);

    const oldNodeEnv = process.env.NODE_ENV;
    const oldSecret = process.env.SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SECRET;
    assert.throws(() => createApp({ prisma: store.prisma }), /SESSION_SECRET/);
    process.env.NODE_ENV = oldNodeEnv;
    process.env.SESSION_SECRET = oldSecret;

    const oldPassword = process.env.APP_PASSWORD;
    delete process.env.APP_PASSWORD;
    server.close();
    ({ baseUrl, server } = await start(store.prisma));
    assert.equal((await request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'test-password' }) })).status, 401);
    process.env.APP_PASSWORD = oldPassword;

    const create = await request('/api/subscriptions', { method: 'POST', headers, body: JSON.stringify({ name: 'Annual', amount: '99.00', currency: 'EUR', billingInterval: 'YEARLY', billingIntervalCount: 2, firstPaymentDate: '2024-01-01', nextPaymentDate: '2027-01-01' }) });
    assert.equal(create.status, 201);

    const invalidUpdate = await request('/api/subscriptions/sub_1', { method: 'PUT', headers, body: JSON.stringify({ amount: -5 }) });
    assert.equal(invalidUpdate.status, 400);

    const updateName = await request('/api/subscriptions/sub_1', { method: 'PUT', headers, body: JSON.stringify({ name: 'Annual plan' }) });
    assert.equal(updateName.status, 200);
    const renamed = (await json(updateName)).subscription;
    assert.equal(renamed.currency, 'EUR');
    assert.equal(renamed.billingIntervalCount, 2);
    assert.match(renamed.nextPaymentDate, /^2027-01-01T/);

    const recalculate = await request('/api/subscriptions/sub_1', { method: 'PUT', headers, body: JSON.stringify({ billingInterval: 'WEEKLY', billingIntervalCount: 3 }) });
    assert.equal(recalculate.status, 200);
    assert.notEqual((await json(recalculate)).subscription.nextPaymentDate, renamed.nextPaymentDate);

    (store.prisma.subscription.delete as any) = async () => { throw new Error('database exploded'); };
    const internalError = await request('/api/subscriptions/sub_1', { method: 'DELETE', headers });
    assert.equal(internalError.status, 500);

    console.error = originalError;
    console.warn = originalWarn;
  });

  it('returns generated payment details and timeline results with validation', async () => {
    const headers = { 'content-type': 'application/json', 'x-subtrack-password': 'test-password' };
    await request('/api/subscriptions', { method: 'POST', headers, body: JSON.stringify({ name: 'Gym', amount: '20.00', currency: 'USD', billingInterval: 'DAILY', firstPaymentDate: '2025-01-01', nextPaymentDate: new Date().toISOString().slice(0, 10) }) });

    const details = await request('/api/subscriptions/sub_1/details', { headers });
    assert.equal(details.status, 200);
    const detailsBody = await json(details);
    assert.equal(detailsBody.subscription.name, 'Gym');
    assert.equal(detailsBody.stats.paymentsMade, 5);
    assert.equal(detailsBody.stats.totalPaid, '100');
    assert.equal(detailsBody.pastPayments.length, 5);
    assert.ok(detailsBody.pastPayments[0].paymentDate >= detailsBody.pastPayments[1].paymentDate);
    assert.equal((await request('/api/subscriptions/missing/details', { headers })).status, 404);

    assert.equal((await request('/api/timeline?months=0', { headers })).status, 400);
    const timeline = await request('/api/timeline?months=1', { headers });
    assert.equal(timeline.status, 200);
    const timelineBody = await json(timeline);
    assert.equal(timelineBody.payments.length, 5);
    assert.equal(timelineBody.payments[0].subscription.name, 'Gym');
    assert.equal(timelineBody.payments[0].amount, '20');
  });
});
