import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Prisma } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.APP_PASSWORD = 'test-password';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.MAX_GENERATED_PAYMENTS = '5';
process.env.MCP_ENABLED = 'true';

const { createApp } = await import('../src/app.js');
type AppPrisma = import('../src/app.js').AppPrisma;

type Row = {
  id: string; name: string; description: string | null; amount: Prisma.Decimal; currency: string;
  billingInterval: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'; billingIntervalCount: number;
  firstPaymentDate: Date; nextPaymentDate: Date; category: string | null; website: string | null; notes: string | null;
  createdAt: Date; updatedAt: Date;
};

function makePrisma() {
  let seq = 0;
  const rows: Row[] = [];
  const sortRows = (values: Row[], orderBy?: unknown) => !Array.isArray(orderBy) ? [...values] : [...values].sort((a, b) => {
    for (const order of orderBy as Array<Record<string, 'asc' | 'desc'>>) {
      const [field, direction] = Object.entries(order)[0] as [keyof Row, 'asc' | 'desc'];
      const av = a[field] instanceof Date ? (a[field] as Date).getTime() : a[field];
      const bv = b[field] instanceof Date ? (b[field] as Date).getTime() : b[field];
      if (av === bv) continue;
      const result = av! < bv! ? -1 : 1;
      return direction === 'desc' ? -result : result;
    }
    return 0;
  });
  const prisma = { subscription: {
    findMany: async (args?: { orderBy?: unknown }) => sortRows(rows, args?.orderBy),
    findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id) ?? null,
    create: async ({ data }: { data: any }) => {
      const now = new Date('2026-01-01T00:00:00.000Z');
      const row: Row = { id: `sub_${++seq}`, name: data.name, description: data.description ?? null, amount: data.amount, currency: data.currency ?? 'USD', billingInterval: data.billingInterval, billingIntervalCount: data.billingIntervalCount ?? 1, firstPaymentDate: data.firstPaymentDate, nextPaymentDate: data.nextPaymentDate, category: data.category ?? null, website: data.website ?? null, notes: data.notes ?? null, createdAt: now, updatedAt: now };
      rows.push(row); return row;
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = rows.find((value) => value.id === where.id); if (!row) throw new Error('not found');
      for (const [key, value] of Object.entries(data)) if (value !== undefined) (row as Record<string, unknown>)[key] = value;
      row.updatedAt = new Date('2026-01-02T00:00:00.000Z'); return row;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const index = rows.findIndex((row) => row.id === where.id);
      if (index === -1) throw new Prisma.PrismaClientKnownRequestError('not found', { code: 'P2025', clientVersion: 'test' });
      return rows.splice(index, 1)[0];
    },
  } } as unknown as AppPrisma;
  return { prisma, rows };
}

async function start(prisma = makePrisma().prisma) {
  const app = createApp({ prisma });
  const server: Server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const address = server.address(); assert.equal(typeof address, 'object');
  return { baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`, server };
}

function parseSse(text: string) {
  const line = text.split('\n').find((value) => value.startsWith('data: '));
  assert.ok(line, text);
  return JSON.parse(line.slice(6));
}

describe('Subtrack MCP', () => {
  let baseUrl: string;
  let server: Server;

  beforeEach(async () => ({ baseUrl, server } = await start(makePrisma().prisma)));
  afterEach(() => server?.close());

  async function mcp(body: unknown, headers: Record<string, string> = { 'x-subtrack-password': 'test-password' }) {
    const response = await fetch(`${baseUrl}/api/mcp`, { method: 'POST', headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const text = await response.text();
    return { response, body: response.status === 200 ? parseSse(text) : JSON.parse(text) };
  }

  it('requires password or bearer auth and lists tools', async () => {
    assert.equal((await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, {})).response.status, 401);
    assert.equal((await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { authorization: 'Bearer wrong' })).response.status, 401);

    const listed = await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, { authorization: 'Bearer test-password' });
    assert.equal(listed.response.status, 200);
    const names = listed.body.result.tools.map((tool: { name: string }) => tool.name);
    assert.ok(names.includes('create_subscription'));
    assert.ok(names.includes('summarize_spending'));
  });

  it('creates, reads, updates, summarizes, and deletes subscriptions through tools', async () => {
    const create = await mcp({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_subscription', arguments: { name: 'Netflix', amount: '12.50', currency: 'USD', billingInterval: 'MONTHLY', firstPaymentDate: '2025-01-01', category: 'TV' } } });
    assert.equal(create.body.result.structuredContent.subscription.id, 'sub_1');

    const list = await mcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'list_subscriptions', arguments: {} } });
    assert.equal(list.body.result.structuredContent.subscriptions[0].name, 'Netflix');
    assert.equal(list.body.result.structuredContent.subscriptions[0].display.amount, '$12.50');
    assert.deepEqual(JSON.parse(list.body.result.content[0].text).subscriptions[0].name, 'Netflix');

    const genericSearch = await mcp({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'search_subscriptions', arguments: { query: 'all subscriptions' } } });
    assert.equal(genericSearch.body.result.structuredContent.subscriptions[0].name, 'Netflix');

    const intervalSearch = await mcp({ jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'search_subscriptions', arguments: { query: 'monthly subscription' } } });
    assert.equal(intervalSearch.body.result.structuredContent.subscriptions[0].name, 'Netflix');

    const invalid = await mcp({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_payment_timeline', arguments: { months: 0 } } });
    assert.equal(invalid.body.result.isError, true);

    const update = await mcp({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'update_subscription', arguments: { id: 'sub_1', patch: { billingInterval: 'WEEKLY', billingIntervalCount: 2 } } } });
    assert.equal(update.body.result.structuredContent.subscription.billingInterval, 'WEEKLY');

    const summary = await mcp({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'summarize_spending', arguments: { months: 1, groupBy: 'category' } } });
    assert.equal(summary.body.result.structuredContent.totals[0].key, 'TV');

    const deleted = await mcp({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'delete_subscription', arguments: { id: 'sub_1' } } });
    assert.deepEqual(deleted.body.result.structuredContent, { deleted: true, id: 'sub_1' });
  });
});
