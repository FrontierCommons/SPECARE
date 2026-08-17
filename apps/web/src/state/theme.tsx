'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import * as storage from '../lib/storage';

export type Theme = 'dark' | 'light';

const THEME_KEY = 'sper.theme';
const DEFAULT_THEME: Theme = 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Dark is the app's original, still-default look; light is the newer warm
 * "Appearance" option in Settings. A blocking inline script in
 * app/layout.tsx sets `data-theme` on <html> from localStorage before
 * React hydrates (see there for why) — reading that same attribute back
 * here as this provider's initial state keeps the two in sync instead of
 * this component briefly reverting to the default on mount.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return DEFAULT_THEME;
    return document.documentElement.dataset.theme === 'light' ? 'light' : DEFAULT_THEME;
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    void storage.setItem(THEME_KEY, next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
