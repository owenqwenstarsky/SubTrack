import { describe, expect, it } from 'vitest';
import { formatBillingInterval, formatDate, formatDaysUntil, formatMoney } from '../src/lib/format';

describe('format helpers', () => {
  it('formats currency values', () => {
    expect(formatMoney('12.5', 'USD')).toMatch(/12\.50/);
    expect(formatMoney(10, 'EUR')).toMatch(/10\.00/);
  });

  it('formats dates', () => {
    expect(formatDate('2026-01-15T00:00:00.000Z')).toMatch(/Jan/);
    expect(formatDate(new Date('2026-01-15T00:00:00.000Z'))).toMatch(/15/);
  });

  it('formats singular billing intervals', () => {
    expect(formatBillingInterval('DAILY')).toBe('Daily');
    expect(formatBillingInterval('WEEKLY')).toBe('Weekly');
    expect(formatBillingInterval('MONTHLY')).toBe('Monthly');
    expect(formatBillingInterval('YEARLY')).toBe('Yearly');
    expect(formatBillingInterval('UNKNOWN')).toBe('Yearly');
  });

  it('formats repeated billing intervals', () => {
    expect(formatBillingInterval('DAILY', 2)).toBe('Every 2 days');
    expect(formatBillingInterval('WEEKLY', 3)).toBe('Every 3 weeks');
    expect(formatBillingInterval('MONTHLY', 4)).toBe('Every 4 months');
    expect(formatBillingInterval('YEARLY', 5)).toBe('Every 5 years');
    expect(formatBillingInterval('UNKNOWN', 6)).toBe('Every 6 years');
  });

  it('formats relative payment dates', () => {
    expect(formatDaysUntil(0)).toBe('Today');
    expect(formatDaysUntil(1)).toBe('Tomorrow');
    expect(formatDaysUntil(-3)).toBe('3 days overdue');
    expect(formatDaysUntil(12)).toBe('In 12 days');
  });
});
