export type BillingInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

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

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.error ? JSON.stringify(body.error) : message;
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function login(password: string) {
  return apiRequest<{ authenticated: true }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function logout() {
  return apiRequest<{ authenticated: false }>('/api/auth/logout', { method: 'POST' });
}

export function getAuthStatus() {
  return apiRequest<{ authenticated: boolean }>('/api/auth/me');
}

export function getSubscriptions() {
  return apiRequest<{ subscriptions: Subscription[] }>('/api/subscriptions');
}

export function getSubscription(id: string) {
  return apiRequest<{ subscription: Subscription }>(`/api/subscriptions/${id}`);
}

export function getSubscriptionDetails(id: string) {
  return apiRequest<SubscriptionDetails>(`/api/subscriptions/${id}/details`);
}

export function createSubscription(input: SubscriptionInput) {
  return apiRequest<{ subscription: Subscription }>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSubscription(id: string, input: Partial<SubscriptionInput>) {
  return apiRequest<{ subscription: Subscription }>(`/api/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteSubscription(id: string) {
  return apiRequest<void>(`/api/subscriptions/${id}`, { method: 'DELETE' });
}

export function getTimeline(months = 12) {
  return apiRequest<{ payments: TimelinePayment[] }>(`/api/timeline?months=${months}`);
}
