import { vi } from 'vitest';

/**
 * The mobile libs import react-native and expo-* which have no Node
 * implementation. We stub the pieces our logic actually touches so the
 * business logic (deep links, offline queue, api client) is testable headless.
 */

// --- react-native: Linking, Platform, Share ---
export const linking = {
  canOpenURL: vi.fn(async () => true),
  openURL: vi.fn(async () => undefined),
};
vi.mock('react-native', () => ({
  Linking: linking,
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios },
  Share: { share: vi.fn(async () => ({ action: 'sharedAction' })) },
}));

// --- expo-secure-store: in-memory token store ---
const secureMem = new Map<string, string>();
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void secureMem.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => secureMem.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void secureMem.delete(k)),
}));

// --- async-storage: in-memory ---
const asyncMem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    setItem: vi.fn(async (k: string, v: string) => void asyncMem.set(k, v)),
    getItem: vi.fn(async (k: string) => asyncMem.get(k) ?? null),
    removeItem: vi.fn(async (k: string) => void asyncMem.delete(k)),
  },
}));

export const stores = { secureMem, asyncMem };
