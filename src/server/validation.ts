import { z } from 'zod';

const minDate = Date.parse('2000-01-01T00:00:00.000Z');
const maxDate = Date.parse('2100-01-01T00:00:00.000Z');

const dateString = z.string()
  .refine(
    (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
    'Expected an ISO date or YYYY-MM-DD date',
  )
  .refine((value) => {
    const time = Date.parse(value);
    return !Number.isNaN(time) && time >= minDate && time <= maxDate;
  }, 'Date must be between 2000-01-01 and 2100-01-01');

export const loginSchema = z.object({
  password: z.string().min(1),
});

const subscriptionBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(3),
  billingInterval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  billingIntervalCount: z.coerce.number().int().positive(),
  firstPaymentDate: dateString,
  nextPaymentDate: dateString.optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const subscriptionCreateSchema = subscriptionBaseSchema.extend({
  currency: subscriptionBaseSchema.shape.currency.default('USD'),
  billingIntervalCount: subscriptionBaseSchema.shape.billingIntervalCount.default(1),
});

export const subscriptionUpdateSchema = subscriptionBaseSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required',
);

export const timelineQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});
