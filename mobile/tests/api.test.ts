import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSubscription,
  deleteSubscription,
  getSubscription,
  getSubscriptionDetails,
  getSubscriptions,
  getTimeline,
  loginToInstance,
  logoutFromInstance,
  testInstanceConnection,
  updateSubscription,
} from '../src/lib/api';
import type { SubTrackInstance, SubscriptionInput } from '../src/lib/types';

const instance = (id = 'inst'): SubTrackInstance => ({
  id,
  name: 'Test',
  baseUrl: 'https://subtrack.test///',
  password: 'pw',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });
}

describe('mobile api helpers', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  it('logs in, stores the session cookie, and sends auth headers on later requests', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }, {
        headers: { 'set-cookie': 'subtrack_session=abc; Path=/; HttpOnly' },
      }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(loginToInstance(instance('login'))).resolves.toEqual({ authenticated: true });
    await expect(testInstanceConnection(instance('login'))).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://subtrack.test/api/auth/login', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'pw' }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/auth/login', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://subtrack.test/api/health', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Subtrack-Password': 'pw',
        Cookie: 'subtrack_session=abc',
      }),
    }));
  });

  it('re-logins once on unauthorized API requests and retries with the new cookie', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ subscriptions: [] }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }, {
        headers: { 'set-cookie': 'subtrack_session=new-cookie; Path=/' },
      }))
      .mockResolvedValueOnce(jsonResponse({ subscriptions: [{ id: 's1' }] }));

    await expect(getSubscriptions(instance('retry'))).resolves.toEqual({ subscriptions: [{ id: 's1' }] });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/auth/login', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://subtrack.test/api/subscriptions', expect.objectContaining({
      headers: expect.objectContaining({ Cookie: 'subtrack_session=new-cookie' }),
    }));
  });

  it('does not relogin for logout requests and clears the local cookie first', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }, {
        headers: { 'set-cookie': 'subtrack_session=old-cookie; Path=/' },
      }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }));

    await loginToInstance(instance('logout'));
    await expect(logoutFromInstance(instance('logout'))).resolves.toEqual({ authenticated: false });

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/auth/logout', expect.objectContaining({
      method: 'POST',
      headers: expect.not.objectContaining({ Cookie: expect.any(String) }),
    }));
  });

  it('uses the expected subscription endpoints and request bodies', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ subscription: { id: 's1' } }))
      .mockResolvedValueOnce(jsonResponse({ subscription: { id: 's1', details: true } }))
      .mockResolvedValueOnce(jsonResponse({ payments: [] }))
      .mockResolvedValueOnce(jsonResponse({ subscription: { id: 'new' } }))
      .mockResolvedValueOnce(jsonResponse({ subscription: { id: 's1', name: 'Updated' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const input: SubscriptionInput = {
      name: 'Netflix',
      amount: 12.99,
      billingInterval: 'MONTHLY',
      firstPaymentDate: '2026-01-01',
    };

    await expect(getSubscription(instance('crud'), 's1')).resolves.toEqual({ subscription: { id: 's1' } });
    await expect(getSubscriptionDetails(instance('crud'), 's1')).resolves.toEqual({ subscription: { id: 's1', details: true } });
    await expect(getTimeline(instance('crud'), 6)).resolves.toEqual({ payments: [] });
    await expect(createSubscription(instance('crud'), input)).resolves.toEqual({ subscription: { id: 'new' } });
    await expect(updateSubscription(instance('crud'), 's1', { name: 'Updated' })).resolves.toEqual({ subscription: { id: 's1', name: 'Updated' } });
    await expect(deleteSubscription(instance('crud'), 's1')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://subtrack.test/api/subscriptions/s1', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/subscriptions/s1/details', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://subtrack.test/api/timeline?months=6', expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(4, 'https://subtrack.test/api/subscriptions', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, 'https://subtrack.test/api/subscriptions/s1', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Updated' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(6, 'https://subtrack.test/api/subscriptions/s1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('throws readable errors for failed API responses', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'Bad input' } }, { status: 422 }))
      .mockResolvedValueOnce(jsonResponse({ message: 'No error field' }, { status: 400 }));
    await expect(getSubscriptions(instance('error-json'))).rejects.toThrow('{"message":"Bad input"}');
    await expect(getSubscriptions(instance('error-json-fallback'))).rejects.toThrow('Request failed with status 400');
  });

  it('throws status errors for non-json failures and invalid login passwords', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(jsonResponse({ authenticated: false }, { status: 401 }));

    await expect(getSubscriptions(instance('error-text'))).rejects.toThrow('Request failed with status 500');
    await expect(loginToInstance(instance('bad-pw'))).rejects.toThrow('Invalid password');
  });

  it('throws status errors for non-401 login failures', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'down' }, { status: 503 }));
    await expect(loginToInstance(instance('login-fail'))).rejects.toThrow('Login failed with status 503');
  });

  it('reports timeout aborts for login and API requests', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValue(abortError);

    await expect(loginToInstance(instance('abort-login'))).rejects.toThrow('Timed out connecting to https://subtrack.test///');
    await expect(getSubscriptions(instance('abort-api'))).rejects.toThrow('Timed out connecting to https://subtrack.test///');
  });

  it('aborts login and API requests when their timers expire', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    }));

    const loginPromise = expect(loginToInstance(instance('timer-login'))).rejects.toThrow('Timed out connecting');
    await vi.advanceTimersByTimeAsync(15000);
    await loginPromise;

    const apiPromise = expect(getSubscriptions(instance('timer-api'))).rejects.toThrow('Timed out connecting');
    await vi.advanceTimersByTimeAsync(15000);
    await apiPromise;
  });

  it('ignores unrelated set-cookie headers', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }, {
        headers: { 'set-cookie': 'other=value; Path=/' },
      }))
      .mockResolvedValueOnce(jsonResponse({ subscriptions: [] }));

    await loginToInstance(instance('other-cookie'));
    await getSubscriptions(instance('other-cookie'));

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/subscriptions', expect.objectContaining({
      headers: expect.not.objectContaining({ Cookie: expect.any(String) }),
    }));
  });

  it('extracts the SubTrack cookie from multi-cookie headers', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ authenticated: true }, {
        headers: { 'set-cookie': 'other=value; Path=/, subtrack_session=multi-cookie; Path=/' },
      }))
      .mockResolvedValueOnce(jsonResponse({ subscriptions: [] }));

    await loginToInstance(instance('multi-cookie'));
    await getSubscriptions(instance('multi-cookie'));

    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://subtrack.test/api/subscriptions', expect.objectContaining({
      headers: expect.objectContaining({ Cookie: 'subtrack_session=multi-cookie' }),
    }));
  });

  it('uses the default timeline window', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ payments: [] }));
    await expect(getTimeline(instance('timeline-default'))).resolves.toEqual({ payments: [] });
    expect(fetch).toHaveBeenCalledWith('https://subtrack.test/api/timeline?months=12', expect.any(Object));
  });

  it('passes through non-abort fetch errors', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('login network down'));
    await expect(getSubscriptions(instance('network'))).rejects.toThrow('network down');
    await expect(loginToInstance(instance('login-network'))).rejects.toThrow('login network down');
  });
});
