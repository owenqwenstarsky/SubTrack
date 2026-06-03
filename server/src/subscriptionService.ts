import { Prisma } from '@prisma/client';
import type { AppPrisma } from './app.js';
import { addInterval, daysUntil, normalizeNextPaymentDate } from './dateUtils.js';
import { serializeSubscription } from './serializers.js';
import type { subscriptionCreateSchema, subscriptionUpdateSchema, timelineQuerySchema } from './validation.js';
import type { z } from 'zod';

export class NotFoundError extends Error {
  constructor(message = 'Subscription not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export type CreateSubscriptionInput = z.infer<typeof subscriptionCreateSchema>;
export type UpdateSubscriptionInput = z.infer<typeof subscriptionUpdateSchema>;
export type TimelineInput = z.infer<typeof timelineQuerySchema>;

export async function listSubscriptions(prisma: AppPrisma) {
  const subscriptions = await prisma.subscription.findMany({ orderBy: [{ nextPaymentDate: 'asc' }, { name: 'asc' }] });
  return { subscriptions: subscriptions.map(serializeSubscription) };
}

export async function createSubscription(prisma: AppPrisma, input: CreateSubscriptionInput) {
  const firstPaymentDate = new Date(input.firstPaymentDate);
  const nextPaymentDate = normalizeNextPaymentDate(
    firstPaymentDate,
    input.billingInterval,
    input.billingIntervalCount,
    input.nextPaymentDate ? new Date(input.nextPaymentDate) : undefined,
  );

  const subscription = await prisma.subscription.create({
    data: { ...input, website: input.website || null, firstPaymentDate, nextPaymentDate, amount: new Prisma.Decimal(input.amount) },
  });

  return { subscription: serializeSubscription(subscription) };
}

export async function getSubscription(prisma: AppPrisma, id: string) {
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) throw new NotFoundError();
  return { subscription: serializeSubscription(subscription) };
}

export async function getSubscriptionDetails(prisma: AppPrisma, id: string, options: { maxGeneratedPayments: number }) {
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) throw new NotFoundError();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const pastPayments = [];
  let paymentDate = new Date(subscription.firstPaymentDate);

  while (paymentDate < today && pastPayments.length < options.maxGeneratedPayments) {
    pastPayments.push({
      paymentDate: new Date(paymentDate),
      amount: subscription.amount.toString(),
      currency: subscription.currency,
    });
    paymentDate = addInterval(paymentDate, subscription.billingInterval, subscription.billingIntervalCount);
  }

  pastPayments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime());
  const totalPaid = subscription.amount.mul(pastPayments.length).toString();

  return {
    subscription: serializeSubscription(subscription),
    pastPayments,
    stats: {
      paymentsMade: pastPayments.length,
      totalPaid,
      currency: subscription.currency,
      daysUntilNextPayment: daysUntil(subscription.nextPaymentDate),
    },
  };
}

export async function updateSubscription(prisma: AppPrisma, id: string, input: UpdateSubscriptionInput) {
  const existing = await prisma.subscription.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();

  const firstPaymentDate = input.firstPaymentDate ? new Date(input.firstPaymentDate) : existing.firstPaymentDate;
  const billingInterval = input.billingInterval ?? existing.billingInterval;
  const billingIntervalCount = input.billingIntervalCount ?? existing.billingIntervalCount;
  const nextPaymentDate = input.nextPaymentDate
    ? new Date(input.nextPaymentDate)
    : input.firstPaymentDate || input.billingInterval || input.billingIntervalCount
      ? normalizeNextPaymentDate(firstPaymentDate, billingInterval, billingIntervalCount)
      : undefined;

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...input,
      website: input.website === '' ? null : input.website,
      amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : undefined,
      firstPaymentDate: input.firstPaymentDate ? firstPaymentDate : undefined,
      nextPaymentDate,
    },
  });

  return { subscription: serializeSubscription(subscription) };
}

export async function deleteSubscription(prisma: AppPrisma, id: string) {
  try {
    await prisma.subscription.delete({ where: { id } });
    return { deleted: true, id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundError();
    throw error;
  }
}

export async function getTimeline(prisma: AppPrisma, input: TimelineInput, options: { maxGeneratedPayments: number }) {
  const horizon = new Date();
  horizon.setMonth(horizon.getMonth() + input.months);

  const subscriptions = await prisma.subscription.findMany();
  const payments = subscriptions.flatMap((subscription) => {
    const occurrences = [];
    let paymentDate = new Date(subscription.nextPaymentDate);

    while (paymentDate <= horizon && occurrences.length < options.maxGeneratedPayments) {
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

  return { payments };
}
