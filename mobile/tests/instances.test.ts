import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStore = new Map<string, string>();
const secureStore = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(asyncStore.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      asyncStore.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      asyncStore.delete(key);
      return Promise.resolve();
    }),
  },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(secureStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    secureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    secureStore.delete(key);
    return Promise.resolve();
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { clearInstances, deleteInstance, getInstance, getInstances, saveInstance } from '../src/lib/instances';

const storageKey = 'subtrack.instances.v1';
const passwordKey = (id: string) => `subtrack.instancePassword.${id}`;

describe('instance storage helpers', () => {
  beforeEach(() => {
    asyncStore.clear();
    secureStore.clear();
    vi.clearAllMocks();
  });

  it('returns no instances for empty or malformed storage', async () => {
    expect(await getInstances()).toEqual([]);
    asyncStore.set(storageKey, 'not-json');
    expect(await getInstances()).toEqual([]);
    asyncStore.set(storageKey, JSON.stringify({ nope: true }));
    expect(await getInstances()).toEqual([]);
  });

  it('saves a new instance with normalized URL, generated name, and secure password', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const instance = await saveInstance({ baseUrl: ' example.com/// ', password: 'secret' });

    expect(instance).toMatchObject({
      id: 'loyw3v28-4fzzzxjy',
      name: 'example.com',
      baseUrl: 'https://example.com',
      password: 'secret',
    });
    expect(JSON.parse(asyncStore.get(storageKey)!)).toEqual([
      expect.objectContaining({ id: instance.id, name: 'example.com', baseUrl: 'https://example.com' }),
    ]);
    expect(secureStore.get(passwordKey(instance.id))).toBe('secret');
  });

  it('preserves explicit protocol and trims explicit names', async () => {
    const instance = await saveInstance({ name: '  Home NAS  ', baseUrl: 'http://local.test/', password: 'pw' });
    expect(instance.name).toBe('Home NAS');
    expect(instance.baseUrl).toBe('http://local.test');
  });

  it('loads instances with passwords and resolves a single instance by id', async () => {
    asyncStore.set(storageKey, JSON.stringify([
      { id: 'one', name: 'One', baseUrl: 'https://one.test', createdAt: 'a', updatedAt: 'b' },
      { id: 'two', name: 'Two', baseUrl: 'https://two.test', createdAt: 'c', updatedAt: 'd' },
    ]));
    secureStore.set(passwordKey('one'), 'pw1');

    expect(await getInstances()).toEqual([
      { id: 'one', name: 'One', baseUrl: 'https://one.test', createdAt: 'a', updatedAt: 'b', password: 'pw1' },
      { id: 'two', name: 'Two', baseUrl: 'https://two.test', createdAt: 'c', updatedAt: 'd', password: '' },
    ]);
    expect(await getInstance('one')).toMatchObject({ id: 'one', password: 'pw1' });
    expect(await getInstance('missing')).toBeNull();
  });

  it('updates an existing instance without changing its id or createdAt', async () => {
    asyncStore.set(storageKey, JSON.stringify([
      { id: 'one', name: 'Old', baseUrl: 'https://old.test', createdAt: 'created', updatedAt: 'old-date' },
      { id: 'two', name: 'Keep', baseUrl: 'https://keep.test', createdAt: 'created-2', updatedAt: 'old-date-2' },
    ]));

    const updated = await saveInstance({ id: 'one', name: '  New Name  ', baseUrl: 'new.test', password: 'new-pw' });

    expect(updated).toMatchObject({
      id: 'one',
      name: 'New Name',
      baseUrl: 'https://new.test',
      createdAt: 'created',
      password: 'new-pw',
    });
    expect(JSON.parse(asyncStore.get(storageKey)!)).toEqual([
      expect.objectContaining({ id: 'one', name: 'New Name' }),
      { id: 'two', name: 'Keep', baseUrl: 'https://keep.test', createdAt: 'created-2', updatedAt: 'old-date-2' },
    ]);
    expect(secureStore.get(passwordKey('one'))).toBe('new-pw');
  });

  it('deletes one instance and its password', async () => {
    asyncStore.set(storageKey, JSON.stringify([
      { id: 'one', name: 'One', baseUrl: 'https://one.test', createdAt: 'a', updatedAt: 'b' },
      { id: 'two', name: 'Two', baseUrl: 'https://two.test', createdAt: 'c', updatedAt: 'd' },
    ]));
    secureStore.set(passwordKey('one'), 'pw1');
    secureStore.set(passwordKey('two'), 'pw2');

    await deleteInstance('one');

    expect(JSON.parse(asyncStore.get(storageKey)!)).toEqual([
      { id: 'two', name: 'Two', baseUrl: 'https://two.test', createdAt: 'c', updatedAt: 'd' },
    ]);
    expect(secureStore.has(passwordKey('one'))).toBe(false);
    expect(secureStore.get(passwordKey('two'))).toBe('pw2');
  });

  it('clears all stored instances and passwords', async () => {
    asyncStore.set(storageKey, JSON.stringify([
      { id: 'one', name: 'One', baseUrl: 'https://one.test', createdAt: 'a', updatedAt: 'b' },
      { id: 'two', name: 'Two', baseUrl: 'https://two.test', createdAt: 'c', updatedAt: 'd' },
    ]));
    secureStore.set(passwordKey('one'), 'pw1');
    secureStore.set(passwordKey('two'), 'pw2');

    await clearInstances();

    expect(asyncStore.has(storageKey)).toBe(false);
    expect(secureStore.size).toBe(0);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(storageKey);
  });
});
