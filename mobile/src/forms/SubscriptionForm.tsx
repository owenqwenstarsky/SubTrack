import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BillingInterval, Subscription, SubscriptionInput } from '@/lib/types';
import { Button, Field, Segmented } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

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

type FormErrors = Partial<Record<keyof SubscriptionFormValues, string>>;

const intervalOptions: { value: BillingInterval; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

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

function toDateInput(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validate(values: SubscriptionFormValues): FormErrors {
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

export type SubscriptionFormProps = {
  initialValues: SubscriptionFormValues;
  submitting: boolean;
  submitLabel: string;
  errorMessage?: string | null;
  onSubmit: (input: SubscriptionInput) => void;
  onCancel?: () => void;
  secondaryAction?: React.ReactNode;
};

export function SubscriptionForm({
  initialValues,
  submitting,
  submitLabel,
  errorMessage,
  onSubmit,
  onCancel,
  secondaryAction,
}: SubscriptionFormProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const intervalLabel = useMemo(() => {
    const count = Number(values.billingIntervalCount) || 1;
    const unit = values.billingInterval === 'DAILY'
      ? 'day'
      : values.billingInterval === 'WEEKLY'
        ? 'week'
        : values.billingInterval === 'MONTHLY'
          ? 'month'
          : 'year';
    return count === 1 ? `Once per ${unit}` : `Every ${count} ${unit}s`;
  }, [values.billingInterval, values.billingIntervalCount]);

  function update<K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit() {
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(formValuesToInput(values));
  }

  return (
    <View>
      <Field
        label="Name"
        required
        value={values.name}
        onChangeText={(value) => update('name', value)}
        autoCapitalize="words"
        errorText={errors.name}
        editable={!submitting}
        returnKeyType="next"
      />

      <View style={styles.row}>
        <View style={[styles.rowItem, styles.rowItemAmount]}>
          <Field
            label="Amount"
            required
            value={values.amount}
            onChangeText={(value) => update('amount', value)}
            keyboardType="decimal-pad"
            errorText={errors.amount}
            editable={!submitting}
            returnKeyType="next"
          />
        </View>
        <View style={[styles.rowItem, styles.rowItemCurrency]}>
          <Field
            label="Currency"
            required
            value={values.currency}
            onChangeText={(value) => update('currency', value.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            errorText={errors.currency}
            editable={!submitting}
          />
        </View>
      </View>

      <Segmented<BillingInterval>
        label="Billing interval"
        value={values.billingInterval}
        options={intervalOptions}
        onChange={(value) => update('billingInterval', value)}
      />

      <Field
        label="Repeat every"
        value={values.billingIntervalCount}
        onChangeText={(value) => update('billingIntervalCount', value.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        helperText={intervalLabel}
        errorText={errors.billingIntervalCount}
        editable={!submitting}
      />

      <Field
        label="First payment date"
        required
        value={values.firstPaymentDate}
        onChangeText={(value) => update('firstPaymentDate', value)}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        helperText="Format: YYYY-MM-DD"
        errorText={errors.firstPaymentDate}
        editable={!submitting}
        maxLength={10}
      />

      <Field
        label="Next payment date"
        value={values.nextPaymentDate}
        onChangeText={(value) => update('nextPaymentDate', value)}
        keyboardType="numbers-and-punctuation"
        autoCapitalize="none"
        autoCorrect={false}
        helperText="Optional override. Leave blank to compute from the first payment date."
        errorText={errors.nextPaymentDate}
        editable={!submitting}
        maxLength={10}
      />

      <Field
        label="Category"
        value={values.category}
        onChangeText={(value) => update('category', value)}
        autoCapitalize="words"
        editable={!submitting}
      />

      <Field
        label="Website"
        value={values.website}
        onChangeText={(value) => update('website', value)}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        errorText={errors.website}
        editable={!submitting}
      />

      <Field
        label="Description"
        value={values.description}
        onChangeText={(value) => update('description', value)}
        multiline
        editable={!submitting}
      />

      <Field
        label="Notes"
        value={values.notes}
        onChangeText={(value) => update('notes', value)}
        multiline
        editable={!submitting}
      />

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerTitle}>Couldn't save</Text>
          <Text style={styles.errorBannerMessage}>{errorMessage}</Text>
        </View>
      ) : null}

      <Button
        label={submitting ? 'Saving…' : submitLabel}
        loading={submitting}
        onPress={handleSubmit}
        size="lg"
        fullWidth
        style={{ marginTop: spacing.md }}
      />
      {secondaryAction}
      {onCancel ? (
        <Button
          label="Cancel"
          variant="ghost"
          onPress={onCancel}
          disabled={submitting}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: {},
  rowItemAmount: { flex: 2 },
  rowItemCurrency: { flex: 1 },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerTitle: { color: colors.danger, fontWeight: '600', marginBottom: 2 },
  errorBannerMessage: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
