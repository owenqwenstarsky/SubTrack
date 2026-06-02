import type {
  SubTrackInstance,
  Subscription,
  SubscriptionDetails,
  SubscriptionInput,
  TimelinePayment,
} from './types';

const sessionCookies = new Map<string, string>();

type ApiOptions = RequestInit & { skipRelogin?: boolean; timeoutMs?: number };

function apiUrl(instance: SubTrackInstance, path: string) {
  return `${instance.baseUrl.replace(/\/+$/, '')}${path}`;
}

function extractCookie(headers: Headers): string | null {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith('subtrack_session='))
    ?.split(';')[0] ?? null;
}

async function apiRequest<T>(instance: SubTrackInstance, path: string, options: ApiOptions = {}): Promise<T> {
  const cookie = sessionCookies.get(instance.id);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  let response: Response;

  try {
    response = await fetch(apiUrl(instance, path), {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Subtrack-Password': instance.password,
        ...(cookie ? { Cookie: cookie } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out connecting to ${instance.baseUrl}. Check that the URL is reachable from this device.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const nextCookie = extractCookie(response.headers);
  if (nextCookie) sessionCookies.set(instance.id, nextCookie);

  if (response.status === 401 && !options.skipRelogin) {
    await loginToInstance(instance);
    return apiRequest<T>(instance, path, { ...options, skipRelogin: true });
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.error ? JSON.stringify(body.error) : message;
    } catch {
      // Ignore non-JSON errors.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function loginToInstance(instance: SubTrackInstance) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;

  try {
    response = await fetch(apiUrl(instance, '/api/auth/login'), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: instance.password }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Timed out connecting to ${instance.baseUrl}. Check that the URL is reachable from this device.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const cookie = extractCookie(response.headers);
  if (cookie) sessionCookies.set(instance.id, cookie);

  if (!response.ok) {
    throw new Error(response.status === 401 ? 'Invalid password' : `Login failed with status ${response.status}`);
  }

  return response.json() as Promise<{ authenticated: true }>;
}

export function logoutFromInstance(instance: SubTrackInstance) {
  sessionCookies.delete(instance.id);
  return apiRequest<{ authenticated: false }>(instance, '/api/auth/logout', { method: 'POST', skipRelogin: true });
}

export async function testInstanceConnection(instance: SubTrackInstance) {
  await loginToInstance(instance);
  return apiRequest<{ ok: true }>(instance, '/api/health');
}

export function getSubscriptions(instance: SubTrackInstance) {
  return apiRequest<{ subscriptions: Subscription[] }>(instance, '/api/subscriptions');
}

export function getSubscription(instance: SubTrackInstance, id: string) {
  return apiRequest<{ subscription: Subscription }>(instance, `/api/subscriptions/${id}`);
}

export function getSubscriptionDetails(instance: SubTrackInstance, id: string) {
  return apiRequest<SubscriptionDetails>(instance, `/api/subscriptions/${id}/details`);
}

export function createSubscription(instance: SubTrackInstance, input: SubscriptionInput) {
  return apiRequest<{ subscription: Subscription }>(instance, '/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSubscription(instance: SubTrackInstance, id: string, input: Partial<SubscriptionInput>) {
  return apiRequest<{ subscription: Subscription }>(instance, `/api/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteSubscription(instance: SubTrackInstance, id: string) {
  return apiRequest<void>(instance, `/api/subscriptions/${id}`, { method: 'DELETE' });
}

export function getTimeline(instance: SubTrackInstance, months = 12) {
  return apiRequest<{ payments: TimelinePayment[] }>(instance, `/api/timeline?months=${months}`);
}
