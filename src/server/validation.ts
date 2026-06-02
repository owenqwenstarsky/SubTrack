import { z } from 'zod';

const dateString = z.string().refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
  'Expected an ISO date or YYYY-MM-DD date',
);

export const loginSchema = z.object({
  password: z.string().min(1),
});

export const subscriptionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().min(3).max(3).default('USD'),
  billingInterval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  billingIntervalCount: z.coerce.number().int().positive().default(1),
  firstPaymentDate: dateString,
  nextPaymentDate: dateString.optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  website: z.string().trim().url().optional().nullable().or(z.literal('')),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const subscriptionUpdateSchema = subscriptionCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required',
);

export const timelineQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(36).default(12),
});
