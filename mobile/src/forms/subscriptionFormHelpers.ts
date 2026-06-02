import type { BillingInterval, Subscription, SubscriptionInput } from '@/lib/types';

export type SubscriptionFormValues = {
  name: string;
  amount: string;
  currency: string;
  billingInterval: BillingInterval;
  billingIntervalCount: string;
  firstPaymentDate: string;
  nextPaymentDate: string;
  category: string;
  website: string;
  description: string;
  notes: string;
};

export type FormErrors = Partial<Record<keyof SubscriptionFormValues, string>>;

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export function subscriptionToFormValues(subscription: Subscription | null): SubscriptionFormValues {
  return {
    name: subscription?.name ?? '',
    amount: subscription ? String(subscription.amount) : '',
    currency: subscription?.currency ?? 'USD',
    billingInterval: subscription?.billingInterval ?? 'MONTHLY',
    billingIntervalCount: subscription ? String(subscription.billingIntervalCount) : '1',
    firstPaymentDate: subscription ? toDateInput(subscription.firstPaymentDate) : toDateInput(new Date().toISOString()),
    nextPaymentDate: subscription ? toDateInput(subscription.nextPaymentDate) : '',
    category: subscription?.category ?? '',
    website: subscription?.website ?? '',
    description: subscription?.description ?? '',
    notes: subscription?.notes ?? '',
  };
}

export function toDateInput(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function validateSubscriptionFormValues(values: SubscriptionFormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'Enter a name';
  if (!values.amount.trim()) {
    errors.amount = 'Enter an amount';
  } else {
    const amount = Number(values.amount);
    if (!Number.isFinite(amount) || amount < 0) errors.amount = 'Enter a valid amount';
  }
  if (!values.currency.trim() || values.currency.trim().length !== 3) {
    errors.currency = 'Use a 3-letter currency code';
  }
  const count = Number(values.billingIntervalCount);
  if (!Number.isInteger(count) || count < 1) {
    errors.billingIntervalCount = 'Must be a whole number of 1 or more';
  }
  if (!values.firstPaymentDate.trim()) {
    errors.firstPaymentDate = 'Enter the first payment date';
  } else if (!dateRegex.test(values.firstPaymentDate.trim())) {
    errors.firstPaymentDate = 'Use the format YYYY-MM-DD';
  } else if (Number.isNaN(new Date(values.firstPaymentDate).getTime())) {
    errors.firstPaymentDate = 'Enter a valid date';
  }
  if (values.nextPaymentDate.trim()) {
    if (!dateRegex.test(values.nextPaymentDate.trim())) {
      errors.nextPaymentDate = 'Use the format YYYY-MM-DD';
    } else if (Number.isNaN(new Date(values.nextPaymentDate).getTime())) {
      errors.nextPaymentDate = 'Enter a valid date';
    }
  }
  if (values.website.trim()) {
    const candidate = /^https?:\/\//i.test(values.website.trim())
      ? values.website.trim()
      : `https://${values.website.trim()}`;
    try {
      new URL(candidate);
    } catch {
      errors.website = 'Enter a valid URL';
    }
  }
  return errors;
}

export function formValuesToInput(values: SubscriptionFormValues): SubscriptionInput {
  return {
    name: values.name.trim(),
    amount: Number(values.amount),
    currency: values.currency.trim().toUpperCase(),
    billingInterval: values.billingInterval,
    billingIntervalCount: Number(values.billingIntervalCount) || 1,
    firstPaymentDate: values.firstPaymentDate.trim(),
    nextPaymentDate: values.nextPaymentDate.trim() || null,
    category: values.category.trim() || null,
    website: values.website.trim() || null,
    description: values.description.trim() || null,
    notes: values.notes.trim() || null,
  };
}
