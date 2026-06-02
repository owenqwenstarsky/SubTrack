export type BillingInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export type SubTrackInstance = {
  id: string;
  name: string;
  baseUrl: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};

export type Subscription = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionInput = {
  name: string;
  description?: string | null;
  amount: number | string;
  currency?: string;
  billingInterval: BillingInterval;
  billingIntervalCount?: number;
  firstPaymentDate: string;
  nextPaymentDate?: string | null;
  category?: string | null;
  website?: string | null;
  notes?: string | null;
};

export type TimelinePayment = {
  subscription: Subscription;
  paymentDate: string;
  daysUntil: number;
  amount: string;
  currency: string;
};

export type PastPayment = {
  paymentDate: string;
  amount: string;
  currency: string;
};

export type SubscriptionDetails = {
  subscription: Subscription;
  pastPayments: PastPayment[];
  stats: {
    paymentsMade: number;
    totalPaid: string;
    currency: string;
    daysUntilNextPayment: number;
  };
};
