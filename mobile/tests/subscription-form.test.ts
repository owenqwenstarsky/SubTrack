import { describe, expect, it, vi } from 'vitest';
import {
  formValuesToInput,
  subscriptionToFormValues,
  toDateInput,
  validateSubscriptionFormValues,
  type SubscriptionFormValues,
} from '../src/forms/subscriptionFormHelpers';
import type { Subscription } from '../src/lib/types';

const validValues: SubscriptionFormValues = {
  name: '  Netflix  ',
  amount: '12.99',
  currency: ' usd ',
  billingInterval: 'MONTHLY',
  billingIntervalCount: '1',
  firstPaymentDate: '2026-01-01',
  nextPaymentDate: '',
  category: ' Streaming ',
  website: ' netflix.com ',
  description: ' Movies ',
  notes: ' Shared ',
};

const subscription: Subscription = {
  id: 'sub_1',
  name: 'Spotify',
  description: null,
  amount: '9.99',
  currency: 'EUR',
  billingInterval: 'YEARLY',
  billingIntervalCount: 2,
  firstPaymentDate: '2025-02-03T10:30:00.000Z',
  nextPaymentDate: '2027-02-03T10:30:00.000Z',
  category: null,
  website: null,
  notes: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

describe('subscription form helpers', () => {
  it('creates default form values for new subscriptions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T12:00:00.000Z'));
    expect(subscriptionToFormValues(null)).toEqual({
      name: '',
      amount: '',
      currency: 'USD',
      billingInterval: 'MONTHLY',
      billingIntervalCount: '1',
      firstPaymentDate: '2026-05-06',
      nextPaymentDate: '',
      category: '',
      website: '',
      description: '',
      notes: '',
    });
    vi.useRealTimers();
  });

  it('maps an existing subscription into form values', () => {
    expect(subscriptionToFormValues(subscription)).toEqual({
      name: 'Spotify',
      amount: '9.99',
      currency: 'EUR',
      billingInterval: 'YEARLY',
      billingIntervalCount: '2',
      firstPaymentDate: '2025-02-03',
      nextPaymentDate: '2027-02-03',
      category: '',
      website: '',
      description: '',
      notes: '',
    });
  });

  it('formats date input values and ignores invalid dates', () => {
    expect(toDateInput('2024-09-08T00:00:00.000Z')).toBe('2024-09-08');
    expect(toDateInput(new Date('2024-09-08T00:00:00.000Z'))).toBe('2024-09-08');
    expect(toDateInput('not-a-date')).toBe('');
  });

  it('validates good values', () => {
    expect(validateSubscriptionFormValues(validValues)).toEqual({});
    expect(validateSubscriptionFormValues({ ...validValues, nextPaymentDate: '2026-02-01' })).toEqual({});
  });

  it('returns field-specific validation errors', () => {
    expect(validateSubscriptionFormValues({
      ...validValues,
      name: ' ',
      amount: 'abc',
      currency: 'US',
      billingIntervalCount: '0',
      firstPaymentDate: '20260101',
      nextPaymentDate: 'bad-date',
      website: 'http://[bad',
    })).toEqual({
      name: 'Enter a name',
      amount: 'Enter a valid amount',
      currency: 'Use a 3-letter currency code',
      billingIntervalCount: 'Must be a whole number of 1 or more',
      firstPaymentDate: 'Use the format YYYY-MM-DD',
      nextPaymentDate: 'Use the format YYYY-MM-DD',
      website: 'Enter a valid URL',
    });
  });

  it('validates missing required values and invalid dates', () => {
    expect(validateSubscriptionFormValues({
      ...validValues,
      amount: '',
      firstPaymentDate: '2026-99-99',
      nextPaymentDate: '2026-99-99',
      website: '',
    })).toEqual({
      amount: 'Enter an amount',
      firstPaymentDate: 'Enter a valid date',
      nextPaymentDate: 'Enter a valid date',
    });

    expect(validateSubscriptionFormValues({
      ...validValues,
      firstPaymentDate: ' ',
    })).toEqual({ firstPaymentDate: 'Enter the first payment date' });
  });

  it('normalizes values for API input', () => {
    expect(formValuesToInput(validValues)).toEqual({
      name: 'Netflix',
      amount: 12.99,
      currency: 'USD',
      billingInterval: 'MONTHLY',
      billingIntervalCount: 1,
      firstPaymentDate: '2026-01-01',
      nextPaymentDate: null,
      category: 'Streaming',
      website: 'netflix.com',
      description: 'Movies',
      notes: 'Shared',
    });
  });

  it('uses fallback interval count and null optional fields when normalizing', () => {
    expect(formValuesToInput({
      ...validValues,
      billingIntervalCount: '',
      category: ' ',
      website: ' ',
      description: ' ',
      notes: ' ',
    })).toMatchObject({
      billingIntervalCount: 1,
      category: null,
      website: null,
      description: null,
      notes: null,
    });
  });
});
