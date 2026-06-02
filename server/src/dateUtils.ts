import { BillingInterval } from '@prisma/client';

export function addInterval(date: Date, interval: BillingInterval, count: number): Date {
  const next = new Date(date);

  switch (interval) {
    case 'DAILY':
      next.setDate(next.getDate() + count);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + count * 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + count);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + count);
      break;
  }

  return next;
}

export function normalizeNextPaymentDate(
  firstPaymentDate: Date,
  interval: BillingInterval,
  count: number,
  providedNextPaymentDate?: Date,
): Date {
  if (providedNextPaymentDate) return providedNextPaymentDate;

  const now = startOfDay(new Date());
  let next = new Date(firstPaymentDate);

  while (startOfDay(next) < now) {
    next = addInterval(next, interval, count);
  }

  return next;
}

export function daysUntil(date: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const target = startOfDay(date).getTime();
  const today = startOfDay(new Date()).getTime();
  return Math.ceil((target - today) / msPerDay);
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}
