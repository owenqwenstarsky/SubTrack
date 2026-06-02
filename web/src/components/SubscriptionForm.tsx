import { FormEvent, useState } from 'react';
import { Field, Input, Select, Textarea } from './ui/Field';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { Alert } from './Alert';
import type { BillingInterval, SubscriptionInput } from '../lib/api';

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

export const emptyValues: SubscriptionFormValues = {
  name: '',
  amount: '',
  currency: 'USD',
  billingInterval: 'MONTHLY',
  billingIntervalCount: '1',
  firstPaymentDate: new Date().toISOString().slice(0, 10),
  nextPaymentDate: '',
  category: '',
  website: '',
  description: '',
  notes: '',
};

type FieldErrors = Partial<Record<keyof SubscriptionFormValues, string>>;

export function validateSubscriptionForm(values: SubscriptionFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.name.trim()) errors.name = 'Name is required';

  const amount = Number(values.amount);
  if (!values.amount.trim()) errors.amount = 'Amount is required';
  else if (!Number.isFinite(amount) || amount <= 0)
    errors.amount = 'Must be a positive number';

  if (!/^[A-Za-z]{3}$/.test(values.currency.trim()))
    errors.currency = 'Use a 3-letter code, e.g. USD';

  const count = Number(values.billingIntervalCount);
  if (!Number.isInteger(count) || count < 1)
    errors.billingIntervalCount = 'Must be a whole number ≥ 1';

  if (!values.firstPaymentDate) errors.firstPaymentDate = 'Required';

  if (values.website && values.website.trim()) {
    try {
      new URL(values.website.trim());
    } catch {
      errors.website = 'Enter a valid URL (include https://)';
    }
  }

  return errors;
}

export function subscriptionFormToInput(values: SubscriptionFormValues): SubscriptionInput {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    amount: Number(values.amount),
    currency: values.currency.trim().toUpperCase(),
    billingInterval: values.billingInterval,
    billingIntervalCount: Number(values.billingIntervalCount),
    firstPaymentDate: values.firstPaymentDate,
    nextPaymentDate: values.nextPaymentDate || null,
    category: values.category.trim() || null,
    website: values.website.trim() || null,
    notes: values.notes.trim() || null,
  };
}

type Props = {
  initialValues?: SubscriptionFormValues;
  submitLabel: string;
  onSubmit: (input: SubscriptionInput) => Promise<void> | void;
  onCancel?: () => void;
  extraActions?: React.ReactNode;
};

export function SubscriptionForm({
  initialValues = emptyValues,
  submitLabel,
  onSubmit,
  onCancel,
  extraActions,
}: Props) {
  const [values, setValues] = useState<SubscriptionFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const setField = <K extends keyof SubscriptionFormValues>(
    key: K,
    value: SubscriptionFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateSubscriptionForm(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await onSubmit(subscriptionFormToInput(values));
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : 'Something went wrong',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {serverError && <Alert tone="error">{serverError}</Alert>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Basic info
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            required
            error={errors.name}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={values.name}
                placeholder="Netflix"
                onChange={(e) => setField('name', e.target.value)}
                autoFocus
                required
              />
            )}
          </Field>

          <Field label="Category" error={errors.category}>
            {(props) => (
              <Input
                {...props}
                value={values.category}
                placeholder="Entertainment"
                onChange={(e) => setField('category', e.target.value)}
              />
            )}
          </Field>

          <Field label="Website" error={errors.website}>
            {(props) => (
              <Input
                {...props}
                type="url"
                inputMode="url"
                value={values.website}
                placeholder="https://netflix.com"
                onChange={(e) => setField('website', e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Billing
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field
            label="Amount"
            required
            error={errors.amount}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={values.amount}
                placeholder="9.99"
                onChange={(e) => setField('amount', e.target.value)}
                required
              />
            )}
          </Field>

          <Field
            label="Currency"
            required
            error={errors.currency}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                value={values.currency}
                placeholder="USD"
                maxLength={3}
                onChange={(e) =>
                  setField('currency', e.target.value.toUpperCase())
                }
                required
              />
            )}
          </Field>

          <Field
            label="Every"
            required
            error={errors.billingIntervalCount}
            className="sm:col-span-2"
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={values.billingIntervalCount}
                onChange={(e) =>
                  setField('billingIntervalCount', e.target.value)
                }
                required
              />
            )}
          </Field>

          <Field
            label="Interval"
            required
            error={errors.billingInterval}
            className="sm:col-span-3"
          >
            {(props) => (
              <Select
                {...props}
                value={values.billingInterval}
                onChange={(e) =>
                  setField(
                    'billingInterval',
                    e.target.value as BillingInterval,
                  )
                }
              >
                <option value="DAILY">Day(s)</option>
                <option value="WEEKLY">Week(s)</option>
                <option value="MONTHLY">Month(s)</option>
                <option value="YEARLY">Year(s)</option>
              </Select>
            )}
          </Field>

          <Field
            label="First payment date"
            required
            error={errors.firstPaymentDate}
            className="sm:col-span-3"
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={values.firstPaymentDate}
                onChange={(e) => setField('firstPaymentDate', e.target.value)}
                required
              />
            )}
          </Field>

          <Field
            label="Next payment date"
            hint="Leave empty to calculate from the first payment date."
            error={errors.nextPaymentDate}
            className="sm:col-span-3"
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                value={values.nextPaymentDate}
                onChange={(e) => setField('nextPaymentDate', e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Details
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <Field label="Description" error={errors.description}>
            {(props) => (
              <Textarea
                {...props}
                value={values.description}
                placeholder="Family streaming plan"
                onChange={(e) => setField('description', e.target.value)}
              />
            )}
          </Field>
          <Field label="Notes" error={errors.notes}>
            {(props) => (
              <Textarea
                {...props}
                value={values.notes}
                placeholder="Shared with family. Card ending 4242."
                onChange={(e) => setField('notes', e.target.value)}
              />
            )}
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {extraActions}
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function subscriptionToFormValues(sub: {
  name: string;
  description: string | null;
  amount: string;
  currency: string;
  billingInterval: BillingInterval;
  billingIntervalCount: number;
  firstPaymentDate: string;
  nextPaymentDate: string;
  category: string | null;
  website: string | null;
  notes: string | null;
}): SubscriptionFormValues {
  return {
    name: sub.name,
    description: sub.description ?? '',
    amount: sub.amount,
    currency: sub.currency,
    billingInterval: sub.billingInterval,
    billingIntervalCount: String(sub.billingIntervalCount ?? 1),
    firstPaymentDate: sub.firstPaymentDate.slice(0, 10),
    nextPaymentDate: sub.nextPaymentDate ? sub.nextPaymentDate.slice(0, 10) : '',
    category: sub.category ?? '',
    website: sub.website ?? '',
    notes: sub.notes ?? '',
  };
}
