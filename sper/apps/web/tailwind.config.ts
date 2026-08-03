import type { Config } from 'tailwindcss';
import { color, space, radius, elevation } from './src/design/tokens';

// Tailwind wants CSS length strings, but tokens.ts keeps `space`/`radius` as
// plain numbers (shared shape with the mobile RN StyleSheet values) — convert
// to px here rather than baking units into the shared token source.
function toPx<T extends Record<string, number>>(values: T): Record<keyof T, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `${value}px`]),
  ) as Record<keyof T, string>;
}

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: color,
      spacing: toPx(space),
      borderRadius: toPx(radius),
      boxShadow: elevation,
    },
  },
  plugins: [],
};

export default config;
