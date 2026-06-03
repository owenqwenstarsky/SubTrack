import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AppPrisma } from '../app.js';
import { subscriptionCreateSchema, subscriptionUpdateSchema, timelineQuerySchema } from '../validation.js';
import { createSubscription, deleteSubscription, getSubscription, getSubscriptionDetails, getTimeline, listSubscriptions, NotFoundError, updateSubscription } from '../subscriptionService.js';

export function createSubtrackMcpServer(options: { prisma: AppPrisma; maxGeneratedPayments: number }) {
  const server = new McpServer({ name: 'subtrack', version: '0.1.0' });
  const { prisma, maxGeneratedPayments } = options;

  const text = (_message: string, data: unknown) => {
    const json = enrichMcpData(toJson(data)) as Record<string, unknown>;
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(json, null, 2) }],
      structuredContent: json,
    };
  };

  const jsonResource = (uri: URL, data: unknown) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(toJson(data), null, 2) }],
  });

  async function safe<T>(operation: () => Promise<T>, summarize: (data: T) => string) {
    try {
      const data = await operation();
      return text(summarize(data), toJson(data));
    } catch (error) {
      return toolError(error);
    }
  }

  server.registerTool('list_subscriptions', {
    title: 'List subscriptions',
    description: 'Read all subscriptions ordered by next payment date. This is the simplest tool for seeing every subscription and returns full API-style subscription records, including notes by default.',
    inputSchema: { includeNotes: z.boolean().default(true).optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ includeNotes = true }) => safe(async () => {
    const data = await listSubscriptions(prisma);
    return includeNotes ? data : { subscriptions: data.subscriptions.map(({ notes, ...subscription }) => subscription) };
  }, (data) => summarizeSubscriptions(data.subscriptions)));

  server.registerTool('search_subscriptions', {
    title: 'Search subscriptions',
    description: 'Find subscriptions by service name, category, billing interval (monthly/yearly), currency, amount, website, description, or notes. Returns full API-style subscription records. For all subscriptions, use list_subscriptions; generic queries like "all subscriptions" or "active subscriptions" return the bounded list for client compatibility.',
    inputSchema: { query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(50).default(10).optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ query, limit = 10 }) => safe(async () => {
    const all = await listSubscriptions(prisma);
    return { subscriptions: searchSubscriptionRows(all.subscriptions, query, limit) };
  }, (data) => summarizeSubscriptions(data.subscriptions, 'matching subscriptions')));

  server.registerTool('get_subscription', {
    title: 'Get subscription',
    description: 'Read one subscription by its SubTrack ID. Returns the full API-style subscription record shown in SubTrack.',
    inputSchema: { id: z.string().min(1).max(200) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id }) => safe(() => getSubscription(prisma, id), (data) => `Found subscription ${data.subscription.name}.`));

  server.registerTool('get_subscription_details', {
    title: 'Get subscription details',
    description: 'Read one subscription plus generated past payment history and deterministic stats, matching the detail information shown by SubTrack.',
    inputSchema: { id: z.string().min(1).max(200) },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ id }) => safe(() => getSubscriptionDetails(prisma, id, { maxGeneratedPayments }), (data) => `Found ${data.pastPayments.length} past payments for ${data.subscription.name}.`));

  server.registerTool('create_subscription', {
    title: 'Create subscription',
    description: 'Create a new subscription. firstPaymentDate should be the first known charge date. nextPaymentDate is optional and will be normalized when omitted. Ask the user before creating if required fields are missing.',
    inputSchema: subscriptionCreateSchema,
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (input) => safe(() => createSubscription(prisma, input), (data) => `Created subscription ${data.subscription.name}.`));

  server.registerTool('update_subscription', {
    title: 'Update subscription',
    description: 'Update an existing subscription. Provide at least one field in patch. Billing cadence changes use the same next-payment recalculation behavior as the REST API.',
    inputSchema: { id: z.string().min(1).max(200), patch: subscriptionUpdateSchema },
    annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ id, patch }) => safe(() => updateSubscription(prisma, id, patch), (data) => `Updated subscription ${data.subscription.name}.`));

  server.registerTool('delete_subscription', {
    title: 'Delete subscription',
    description: 'Permanently deletes one subscription from SubTrack. This destructive action cannot be undone; clients should confirm with the user before calling.',
    inputSchema: { id: z.string().min(1).max(200) },
    annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  }, async ({ id }) => safe(() => deleteSubscription(prisma, id), () => `Deleted subscription ${id}.`));

  server.registerTool('get_payment_timeline', {
    title: 'Get payment timeline',
    description: 'Generate upcoming payments for the requested number of months. Each payment includes the full subscription record, payment date, days until payment, amount, and currency.',
    inputSchema: timelineQuerySchema,
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async (input) => safe(() => getTimeline(prisma, input, { maxGeneratedPayments }), (data) => {
    const names = [...new Set(data.payments.map((payment) => payment.subscription.name))];
    const suffix = names.length ? ` for ${names.slice(0, 5).join(', ')}${names.length > 5 ? ', and more' : ''}` : '';
    return `Generated ${data.payments.length} upcoming payments from ${names.length} subscriptions${suffix}.`;
  }));

  server.registerTool('summarize_spending', {
    title: 'Summarize spending',
    description: 'Return deterministic upcoming payment totals grouped by currency or category. Does not generate prose analysis.',
    inputSchema: { months: z.number().int().min(1).max(36).default(12).optional(), groupBy: z.enum(['currency', 'category']).default('currency').optional() },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ months = 12, groupBy = 'currency' }) => safe(async () => {
    const timeline = await getTimeline(prisma, { months }, { maxGeneratedPayments });
    const totals = new Map<string, { key: string; currency: string; amount: number; paymentCount: number }>();
    for (const payment of timeline.payments) {
      const category = payment.subscription.category || 'Uncategorized';
      const key = groupBy === 'category' ? `${category}:${payment.currency}` : payment.currency;
      const label = groupBy === 'category' ? category : payment.currency;
      const current = totals.get(key) ?? { key: label, currency: payment.currency, amount: 0, paymentCount: 0 };
      current.amount += Number(payment.amount);
      current.paymentCount += 1;
      totals.set(key, current);
    }
    return { range: { months }, totals: [...totals.values()].map((item) => ({ ...item, amount: String(item.amount) })) };
  }, (data) => `Computed ${data.totals.length} spending totals.`));

  server.registerResource('subscriptions', 'subtrack://subscriptions', {
    title: 'Subscriptions',
    description: 'Current subscription list.',
    mimeType: 'application/json',
  }, async (uri) => jsonResource(uri, await listSubscriptions(prisma)));

  server.registerResource('subscription', new ResourceTemplate('subtrack://subscriptions/{id}', { list: undefined }), {
    title: 'Subscription by ID',
    description: 'One subscription by ID.',
    mimeType: 'application/json',
  }, async (uri, variables) => jsonResource(uri, await getSubscription(prisma, String(variables.id))));

  server.registerResource('upcoming_timeline', new ResourceTemplate('subtrack://timeline/upcoming{?months}', { list: undefined }), {
    title: 'Upcoming payment timeline',
    description: 'Generated upcoming payments. Optional months query parameter: 1-36.',
    mimeType: 'application/json',
  }, async (uri) => {
    const months = timelineQuerySchema.parse({ months: uri.searchParams.get('months') ?? undefined }).months;
    return jsonResource(uri, await getTimeline(prisma, { months }, { maxGeneratedPayments }));
  });

  server.registerPrompt('subscription_audit', {
    title: 'Subscription audit',
    description: 'Review subscriptions for missing metadata, high costs, duplicates, and upcoming renewals.',
    argsSchema: { months: z.string().optional() },
  }, ({ months }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Audit my subscriptions over ${months ?? '12'} months. First call list_subscriptions, get_payment_timeline, and summarize_spending, then identify missing metadata, unusually high costs, duplicate services, and upcoming renewals.` } }] }));

  server.registerPrompt('add_subscription_from_receipt', {
    title: 'Add subscription from receipt',
    description: 'Extract subscription fields from pasted receipt or email text.',
    argsSchema: { receiptText: z.string().min(1).max(20000) },
  }, ({ receiptText }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Extract a SubTrack subscription from this receipt/email text. Identify missing required fields and ask me before calling create_subscription.\n\n${receiptText}` } }] }));

  return server;
}

function toolError(error: unknown) {
  const message = error instanceof NotFoundError ? error.message : 'Operation failed';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { error: message },
  };
}

function toJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, toJson(child)]));
  }
  return value;
}

type SubscriptionRow = Awaited<ReturnType<typeof listSubscriptions>>['subscriptions'][number];

function summarizeSubscriptions(subscriptions: Array<Pick<SubscriptionRow, 'name'>>, label = 'subscriptions'): string {
  if (subscriptions.length === 0) return `Found 0 ${label}.`;
  const names = subscriptions.slice(0, 5).map((subscription) => subscription.name).join(', ');
  return `Found ${subscriptions.length} ${label}: ${names}${subscriptions.length > 5 ? ', and more' : ''}.`;
}

function searchSubscriptionRows(subscriptions: SubscriptionRow[], query: string, limit: number): SubscriptionRow[] {
  const normalized = normalizeSearch(query);
  if (!normalized.tokens.length || normalized.returnAll) return subscriptions.slice(0, limit);

  return subscriptions.filter((subscription) => {
    const haystack = searchableText(subscription);
    return normalized.tokens.every((token) => haystack.includes(token));
  }).slice(0, limit);
}

function normalizeSearch(query: string): { tokens: string[]; returnAll: boolean } {
  const rawTokens = query.toLowerCase().match(/[a-z0-9.]+/g) ?? [];
  const genericWords = new Set(['all', 'active', 'current', 'existing', 'my', 'subscriptions', 'subscription', 'services', 'service', 'plans', 'plan']);
  const tokens = rawTokens.filter((token) => !genericWords.has(token));
  return {
    tokens,
    returnAll: rawTokens.length > 0 && tokens.length === 0,
  };
}

function searchableText(subscription: SubscriptionRow): string {
  return [
    subscription.id,
    subscription.name,
    subscription.description,
    subscription.category,
    subscription.website,
    subscription.notes,
    subscription.amount,
    subscription.currency,
    subscription.billingInterval,
    `${subscription.billingInterval.toLowerCase()} subscription`,
    `${subscription.billingInterval.toLowerCase()} service`,
    subscription.billingInterval.replace(/ly$/i, '').toLowerCase(),
    subscription.nextPaymentDate,
    subscription.firstPaymentDate,
  ].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase();
}

function enrichMcpData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(enrichMcpData);
  if (!value || typeof value !== 'object') return value;

  const object = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, enrichMcpData(child)]));
  if (isSubscriptionLike(object)) return { ...object, display: subscriptionDisplay(object) };
  if (isPaymentLike(object)) return { ...object, display: paymentDisplay(object) };
  if (isStatsLike(object)) return { ...object, display: statsDisplay(object) };
  return object;
}

type JsonObject = Record<string, unknown>;

function isSubscriptionLike(value: JsonObject): boolean {
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.amount === 'string'
    && typeof value.currency === 'string'
    && typeof value.billingInterval === 'string'
    && typeof value.billingIntervalCount === 'number'
    && typeof value.firstPaymentDate === 'string'
    && typeof value.nextPaymentDate === 'string';
}

function isPaymentLike(value: JsonObject): boolean {
  return typeof value.paymentDate === 'string' && typeof value.amount === 'string' && typeof value.currency === 'string';
}

function isStatsLike(value: JsonObject): boolean {
  return typeof value.paymentsMade === 'number' && typeof value.totalPaid === 'string' && typeof value.currency === 'string';
}

function subscriptionDisplay(subscription: JsonObject) {
  const amount = String(subscription.amount);
  const currency = String(subscription.currency);
  const billingInterval = String(subscription.billingInterval);
  const billingIntervalCount = Number(subscription.billingIntervalCount);
  const monthly = monthlyEquivalent(Number(amount), billingInterval, billingIntervalCount);
  const days = daysUntilDate(String(subscription.nextPaymentDate));

  return {
    amount: formatMoney(amount, currency),
    billingCadence: formatBillingInterval(billingInterval, billingIntervalCount),
    firstPaymentDate: formatDate(String(subscription.firstPaymentDate)),
    nextPaymentDate: formatDate(String(subscription.nextPaymentDate)),
    daysUntilNextPayment: days,
    daysUntilNextPaymentLabel: formatDaysUntil(days),
    monthlyEquivalent: String(monthly),
    monthlyEquivalentFormatted: formatMoney(monthly, currency),
    category: typeof subscription.category === 'string' && subscription.category ? subscription.category : 'Uncategorized',
    websiteHostname: typeof subscription.website === 'string' ? hostnameOf(subscription.website) : null,
    createdAt: typeof subscription.createdAt === 'string' ? formatDate(subscription.createdAt) : undefined,
    updatedAt: typeof subscription.updatedAt === 'string' ? formatDate(subscription.updatedAt) : undefined,
  };
}

function paymentDisplay(payment: JsonObject) {
  const days = typeof payment.daysUntil === 'number' ? payment.daysUntil : daysUntilDate(String(payment.paymentDate));
  return {
    paymentDate: formatDate(String(payment.paymentDate)),
    amount: formatMoney(String(payment.amount), String(payment.currency)),
    daysUntil: days,
    daysUntilLabel: formatDaysUntil(days),
  };
}

function statsDisplay(stats: JsonObject) {
  return {
    totalPaid: formatMoney(String(stats.totalPaid), String(stats.currency)),
    paymentsMadeLabel: `${stats.paymentsMade} ${stats.paymentsMade === 1 ? 'payment' : 'payments'} so far`,
    daysUntilNextPaymentLabel: typeof stats.daysUntilNextPayment === 'number' ? formatDaysUntil(stats.daysUntilNextPayment) : undefined,
  };
}

function monthlyEquivalent(amount: number, interval: string, count: number): number {
  switch (interval) {
    case 'DAILY':
      return amount * 30 / count;
    case 'WEEKLY':
      return amount * 52 / 12 / count;
    case 'MONTHLY':
      return amount / count;
    case 'YEARLY':
      return amount / 12 / count;
    default:
      return amount;
  }
}

function formatMoney(amount: string | number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date));
}

function formatBillingInterval(interval: string, count = 1) {
  const labels: Record<string, string> = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };
  if (count === 1) return labels[interval] ?? interval;
  const unit = (labels[interval] ?? interval).toLowerCase().replace(/ly$/, '').replace('dai', 'day');
  return `Every ${count} ${unit}s`;
}

function formatDaysUntil(daysUntil: number) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
  return `In ${daysUntil} days`;
}

function daysUntilDate(date: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / msPerDay);
}

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
