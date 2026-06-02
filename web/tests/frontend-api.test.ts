import { beforeEach, describe, expect, it, vi } from 'vitest';

type FetchCall = { path: string; init?: RequestInit };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

async function loadApi() {
  vi.resetModules();
  return import('../src/lib/api');
}

describe('frontend API client', () => {
  let calls: FetchCall[];

  beforeEach(() => {
    calls = [];
    vi.restoreAllMocks();
  });

  it('logs in without fetching CSRF and stores token for unsafe requests', async () => {
    const api = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/api/auth/login') return jsonResponse({ authenticated: true, csrfToken: 'token-1' });
      if (path === '/api/auth/logout') return jsonResponse({ authenticated: false });
      return jsonResponse({});
    }));

    expect(await api.login('secret')).toEqual({ authenticated: true, csrfToken: 'token-1' });
    expect(calls[0].path).toBe('/api/auth/login');
    expect(new Headers(calls[0].init?.headers).get('X-CSRF-Token')).toBeNull();
    expect(calls[0].init).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ password: 'secret' }) });

    expect(await api.logout()).toEqual({ authenticated: false });
    expect(new Headers(calls[1].init?.headers).get('X-CSRF-Token')).toBe('token-1');
  });

  it('fetches and caches CSRF tokens for unsafe subscription requests', async () => {
    const api = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/api/auth/csrf') return jsonResponse({ csrfToken: 'csrf' });
      if (path === '/api/subscriptions') return jsonResponse({ subscription: { id: 'created' } }, 201);
      if (path === '/api/subscriptions/sub_1') return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : jsonResponse({ subscription: { id: 'sub_1' } });
      return jsonResponse({});
    }));

    expect(await api.createSubscription({ name: 'A', amount: 1, billingInterval: 'MONTHLY', firstPaymentDate: '2026-01-01' })).toEqual({ subscription: { id: 'created' } });
    expect(calls.map((c) => c.path)).toEqual(['/api/auth/csrf', '/api/subscriptions']);
    expect(new Headers(calls[1].init?.headers).get('X-CSRF-Token')).toBe('csrf');

    expect(await api.updateSubscription('sub_1', { name: 'B' })).toEqual({ subscription: { id: 'sub_1' } });
    expect(calls.map((c) => c.path)).toEqual(['/api/auth/csrf', '/api/subscriptions', '/api/subscriptions/sub_1']);
    expect(new Headers(calls[2].init?.headers).get('X-CSRF-Token')).toBe('csrf');

    expect(await api.deleteSubscription('sub_1')).toBeUndefined();
    expect(new Headers(calls[3].init?.headers).get('X-CSRF-Token')).toBe('csrf');
  });

  it('calls all safe read endpoints without CSRF', async () => {
    const api = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/api/auth/me') return jsonResponse({ authenticated: true });
      if (path === '/api/subscriptions') return jsonResponse({ subscriptions: [] });
      if (path === '/api/subscriptions/sub_1') return jsonResponse({ subscription: { id: 'sub_1' } });
      if (path === '/api/subscriptions/sub_1/details') return jsonResponse({ subscription: { id: 'sub_1' }, pastPayments: [], stats: { paymentsMade: 0, totalPaid: '0', currency: 'USD', daysUntilNextPayment: 0 } });
      if (path === '/api/timeline?months=3') return jsonResponse({ payments: [] });
      throw new Error(`unexpected ${path}`);
    }));

    expect(await api.getAuthStatus()).toEqual({ authenticated: true });
    expect(await api.getSubscriptions()).toEqual({ subscriptions: [] });
    expect(await api.getSubscription('sub_1')).toEqual({ subscription: { id: 'sub_1' } });
    expect(await api.getSubscriptionDetails('sub_1')).toMatchObject({ pastPayments: [] });
    expect(await api.getTimeline(3)).toEqual({ payments: [] });
    expect(calls.every((c) => !new Headers(c.init?.headers).has('X-CSRF-Token'))).toBe(true);
    expect(calls.every((c) => c.init?.credentials === 'include')).toBe(true);
  });

  it('throws useful errors for CSRF failures and failed API responses', async () => {
    const api = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      calls.push({ path });
      if (path === '/api/auth/csrf') return jsonResponse({ error: 'nope' }, 403);
      return jsonResponse({});
    }));
    await expect(api.createSubscription({ name: 'A', amount: 1, billingInterval: 'MONTHLY', firstPaymentDate: '2026-01-01' })).rejects.toThrow('Failed to get CSRF token with status 403');

    const api2 = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path === '/api/auth/me') return jsonResponse({ error: { fieldErrors: { password: ['bad'] } } }, 400);
      return jsonResponse({});
    }));
    await expect(api2.getAuthStatus()).rejects.toThrow('fieldErrors');

    const api3 = await loadApi();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 500 })));
    await expect(api3.getAuthStatus()).rejects.toThrow('Request failed with status 500');
  });
});
