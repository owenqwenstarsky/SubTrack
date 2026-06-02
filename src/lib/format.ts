export function formatMoney(amount: string | number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(Number(amount));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatBillingInterval(interval: string, count = 1) {
  const unit = interval.toLowerCase().replace('ly', '').replace('dai', 'day').replace('week', 'week').replace('month', 'month').replace('year', 'year');
  if (count === 1) return interval === 'DAILY' ? 'Daily' : interval === 'WEEKLY' ? 'Weekly' : interval === 'MONTHLY' ? 'Monthly' : 'Yearly';
  return `Every ${count} ${unit}s`;
}

export function formatDaysUntil(daysUntil: number) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
  return `In ${daysUntil} days`;
}
