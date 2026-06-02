export function formatMoney(amount: string | number, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(date));
}

export function formatBillingInterval(interval: string, count = 1) {
  if (count === 1) {
    if (interval === 'DAILY') return 'Daily';
    if (interval === 'WEEKLY') return 'Weekly';
    if (interval === 'MONTHLY') return 'Monthly';
    return 'Yearly';
  }
  const unit = interval === 'DAILY' ? 'day' : interval === 'WEEKLY' ? 'week' : interval === 'MONTHLY' ? 'month' : 'year';
  return `Every ${count} ${unit}s`;
}

export function formatDaysUntil(daysUntil: number) {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
  return `In ${daysUntil} days`;
}
