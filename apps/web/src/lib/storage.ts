/**
 * SSR-safe localStorage wrapper — replaces AsyncStorage/expo-secure-store on
 * web. Async signatures are kept even though `localStorage` itself is
 * synchronous, so call sites ported from mobile (`await storage.getItem(...)`)
 * don't need to change.
 */

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export async function getItem(key: string): Promise<string | null> {
  if (!hasWindow()) return null;
  return window.localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (!hasWindow()) return;
  window.localStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (!hasWindow()) return;
  window.localStorage.removeItem(key);
}
