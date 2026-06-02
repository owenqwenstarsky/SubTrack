import { describe, expect, it } from 'vitest';
import { cn } from '../src/lib/cn';
import { formatBillingInterval, formatDate, formatDaysUntil, formatMoney } from '../src/lib/format';
import {
  emptyValues,
  subscriptionFormToInput,
  subscriptionToFormValues,
  validateSubscriptionForm,
} from '../src/components/SubscriptionForm';
import { hostnameOf, monthlyEquivalent } from '../src/pages/SubscriptionsPage';
import { groupByMonth } from '../src/pages/TimelinePage';
import type { Subscription, TimelinePayment } from '../src/lib/api';

const baseSub: Subscription = {
  id: 'sub_1',
  name: 'Example',
  description: null,
  amount: '12',
  currency: 'USD',
  billingInterval: 'MONTHLY',
  billingIntervalCount: 1,
  firstPaymentDate: '2026-01-01T00:00:00.000Z',
  nextPaymentDate: '2026-02-01T00:00:00.000Z',
  category: null,
  website: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('frontend helper functions', () => {
  it('builds class names from strings, numbers, arrays, objects, and falsey values', () => {
    expect(cn('a', 0, 2, null, false, undefined, ['b', ['c']], { d: true, e: false, f: null })).toBe('a 2 b c d');
  });

  it('formats money, dates, billing intervals, and relative day labels', () => {
    expect(formatMoney(12.5, 'USD')).toMatch(/12\.50/);
    expect(formatDate('2026-01-02T00:00:00.000Z')).toMatch(/2026|Jan|1\/2|2/);
    expect(formatBillingInterval('DAILY')).toBe('Daily');
    expect(formatBillingInterval('WEEKLY')).toBe('Weekly');
    expect(formatBillingInterval('MONTHLY')).toBe('Monthly');
    expect(formatBillingInterval('YEARLY')).toBe('Yearly');
    expect(formatBillingInterval('DAILY', 3)).toBe('Every 3 days');
    expect(formatBillingInterval('WEEKLY', 2)).toBe('Every 2 weeks');
    expect(formatBillingInterval('MONTHLY', 4)).toBe('Every 4 months');
    expect(formatBillingInterval('YEARLY', 5)).toBe('Every 5 years');
    expect(formatDaysUntil(0)).toBe('Today');
    expect(formatDaysUntil(1)).toBe('Tomorrow');
    expect(formatDaysUntil(-2)).toBe('2 days overdue');
    expect(formatDaysUntil(12)).toBe('In 12 days');
  });

  it('validates and converts subscription form values', () => {
    expect(validateSubscriptionForm(emptyValues)).toMatchObject({ name: 'Name is required', amount: 'Amount is required' });
    expect(validateSubscriptionForm({ ...emptyValues, name: 'x', amount: '-1', currency: 'US', billingIntervalCount: '0', firstPaymentDate: '', website: 'bad' })).toMatchObject({
      amount: 'Must be a positive number',
      currency: 'Use a 3-letter code, e.g. USD',
      billingIntervalCount: 'Must be a whole number ≥ 1',
      firstPaymentDate: 'Required',
      website: 'Enter a valid URL (include https://)',
    });
    const valid = { ...emptyValues, name: '  Netflix  ', amount: '9.99', currency: 'usd', category: ' TV ', website: ' https://netflix.com ', description: ' Stream ', notes: ' Note ' };
    expect(validateSubscriptionForm(valid)).toEqual({});
    expect(subscriptionFormToInput(valid)).toEqual({
      name: 'Netflix',
      description: 'Stream',
      amount: 9.99,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      billingIntervalCount: 1,
      firstPaymentDate: valid.firstPaymentDate,
      nextPaymentDate: null,
      category: 'TV',
      website: 'https://netflix.com',
      notes: 'Note',
    });
  });

  it('converts subscriptions to form values', () => {
    expect(subscriptionToFormValues({ ...baseSub, description: 'desc', category: 'cat', website: 'https://www.example.com', notes: 'notes', amount: '14.00', billingIntervalCount: 2 })).toEqual({
      name: 'Example',
      description: 'desc',
      amount: '14.00',
      currency: 'USD',
      billingInterval: 'MONTHLY',
      billingIntervalCount: '2',
      firstPaymentDate: '2026-01-01',
      nextPaymentDate: '2026-02-01',
      category: 'cat',
      website: 'https://www.example.com',
      notes: 'notes',
    });
  });

  it('extracts hostnames and calculates monthly equivalents', () => {
    expect(hostnameOf('https://www.example.com/path')).toBe('example.com');
    expect(hostnameOf('not a url')).toBe('not a url');
    expect(monthlyEquivalent({ ...baseSub, amount: '2', billingInterval: 'DAILY', billingIntervalCount: 2 })).toBe(30);
    expect(monthlyEquivalent({ ...baseSub, amount: '12', billingInterval: 'WEEKLY', billingIntervalCount: 1 })).toBe(52);
    expect(monthlyEquivalent({ ...baseSub, amount: '20', billingInterval: 'MONTHLY', billingIntervalCount: 2 })).toBe(10);
    expect(monthlyEquivalent({ ...baseSub, amount: '120', billingInterval: 'YEARLY', billingIntervalCount: 1 })).toBe(10);
    expect(monthlyEquivalent({ ...baseSub, amount: 'bad', billingInterval: 'MONTHLY', billingIntervalCount: 0 })).toBe(0);
  });

  it('groups timeline payments by month in sorted order', () => {
    const payment = (id: string, paymentDate: string): TimelinePayment => ({ subscription: { ...baseSub, id }, paymentDate, daysUntil: 1, amount: '1', currency: 'USD' });
    const groups = groupByMonth([
      payment('b', '2026-02-01T12:00:00.000Z'),
      payment('a', '2026-01-15T12:00:00.000Z'),
      payment('c', '2026-01-20T12:00:00.000Z'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-01', '2026-02']);
    expect(groups[0].items.map((p) => p.subscription.id)).toEqual(['a', 'c']);
    expect(groups[0].label).toMatch(/January|2026/);
  });
});
