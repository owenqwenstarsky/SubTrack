import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { SubTrackInstance } from './types';

const STORAGE_KEY = 'subtrack.instances.v1';
const PASSWORD_KEY_PREFIX = 'subtrack.instancePassword.';

type StoredInstance = Omit<SubTrackInstance, 'password'>;

function normalizeBaseUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function passwordKey(id: string) {
  return `${PASSWORD_KEY_PREFIX}${id}`;
}

async function getStoredInstances(): Promise<StoredInstance[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getInstances(): Promise<SubTrackInstance[]> {
  const stored = await getStoredInstances();
  return Promise.all(
    stored.map(async (instance) => ({
      ...instance,
      password: (await SecureStore.getItemAsync(passwordKey(instance.id))) ?? '',
    })),
  );
}

export async function getInstance(id: string): Promise<SubTrackInstance | null> {
  const instances = await getInstances();
  return instances.find((instance) => instance.id === id) ?? null;
}

export async function saveInstance(input: {
  id?: string;
  name?: string;
  baseUrl: string;
  password: string;
}): Promise<SubTrackInstance> {
  const stored = await getStoredInstances();
  const now = new Date().toISOString();
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const existing = input.id ? stored.find((instance) => instance.id === input.id) : undefined;
  const id = existing?.id ?? createId();

  const instance: StoredInstance = {
    id,
    name: input.name?.trim() || existing?.name || new URL(baseUrl).hostname,
    baseUrl,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const next = existing
    ? stored.map((item) => (item.id === existing.id ? instance : item))
    : [instance, ...stored];

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  await SecureStore.setItemAsync(passwordKey(id), input.password);
  return { ...instance, password: input.password };
}

export async function deleteInstance(id: string): Promise<void> {
  const stored = await getStoredInstances();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored.filter((instance) => instance.id !== id)));
  await SecureStore.deleteItemAsync(passwordKey(id));
}

export async function clearInstances(): Promise<void> {
  const stored = await getStoredInstances();
  await Promise.all(stored.map((instance) => SecureStore.deleteItemAsync(passwordKey(instance.id))));
  await AsyncStorage.removeItem(STORAGE_KEY);
}
