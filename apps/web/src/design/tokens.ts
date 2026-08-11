/**
 * SPER design tokens (web port). Palette is warm and quiet by intent: nothing
 * here should feel like a dashboard or a game. State colors read as weather
 * (clear → storm) to fit the Sper metaphor, deliberately NOT a green-to-red
 * performance ramp. Kept in sync by hand with apps/mobile/src/design/tokens.ts
 * — see that file for the source of truth on values.
 */

import type { StateLevel } from '@sper/shared-types';

export const color = {
  // Warm slate base — calmer than pure grey, not the AI-default cream.
  bg: '#1C2024', // deep warm slate (dark, restful)
  surface: '#252A2F',
  surfaceRaised: '#3c4b59',
  border: '#3A424A',

  textPrimary: '#ECE7DF', // warm off-white
  textSecondary: '#A7A399',
  textMuted: '#e4e0d8',
  textOption: '#f7f6f4',

  // Accents
  sage: '#8FA98C', // soft green — quiet, living
  sageDeep: '#5F7A5C',
  amber: '#c7a923', // muted amber — warmth, not alarm

  // State colors — weather, not a scoreboard.
  stateThriving: '#368c2a', // clear sky (sage)
  stateSteady: '#369ece', // calm blue
  stateHeavy: '#d2a477', // overcast amber
  statePit: '#bba6af', // muted storm plum (never a harsh red)

  // Warmth accent — reserved for encouragement: the one place the app should
  // feel like a hug, not a status readout.
  bloom: '#E0984A', // warm orange glow
  bloomSoft: 'rgba(224,152,74,0.22)',

  // A real, harsh red — deliberately outside the state-color philosophy
  // above. Reserved exclusively for irreversible account actions (delete my
  // account), never for a feelings/state display.
  destructive: '#E5484D',
  destructiveSoft: 'rgba(229,72,77,0.16)',

  // The tree card's own backdrop — brighter and warm when the tree is
  // healthy, dimmer and duller when it's withering. A mood, not a chart.
  treeCardHealthy: '#166b44',
  treeCardHealthyBorder: '#0c5b39',
  treeCardWithered: '#1D1F1C',
  treeCardWitheredBorder: '#33362F',
} as const;

export const stateVisual: Record<
  StateLevel,
  { color: string; icon: string; label: string }
> = {
  Thriving: { color: color.stateThriving, icon: '🌳', label: 'Thriving' },
  Steady: { color: color.stateSteady, icon: '🌿', label: 'Steady' },
  Heavy: { color: color.stateHeavy, icon: '🍂', label: 'Heavy' },
  'In the Pit': { color: color.statePit, icon: '🌱', label: 'In the Pit' },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// Elevation: CSS box-shadow presets so raised surfaces (sheets, floating
// toasts, cards) read as physically separate from the flat background
// instead of relying on a border alone. Scale runs subtle → floating.
// Mirrors mobile's RN shadow+elevation pairs, expressed for the web.
export const elevation = {
  sm: '0 1px 3px rgba(0,0,0,0.16)',
  md: '0 2px 6px rgba(0,0,0,0.2)',
  lg: '0 6px 14px rgba(0,0,0,0.24)',
  floating: '0 4px 8px rgba(0,0,0,0.25)',
} as const;

// Motion: named durations/easings/spring presets so every animated component
// moves with the same feel instead of each picking its own numbers that
// quietly drift apart over time. Easings are the CSS cubic-bezier
// equivalents of mobile's RN `Easing.cubic` curves.
export const motion = {
  duration: {
    fast: 120,
    base: 200,
    slow: 320,
  },
  easing: {
    decelerate: 'cubic-bezier(0.215, 0.61, 0.355, 1)', // entrances — settle in
    accelerate: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)', // exits — leave with intent
    standard: 'cubic-bezier(0.645, 0.045, 0.355, 1)', // in-place transitions
  },
  spring: {
    gentle: { speed: 14, bounciness: 8 }, // toasts, banners settling into place
    snappy: { speed: 40, bounciness: 6 }, // press feedback
  },
} as const;

// Deterministic palette for initials avatars and the bot's own avatar — pulled
// from the existing accent/state colors so a person's "color" never clashes
// with the weather-state meaning of stateVisual.
export const avatarPalette = [
  color.sage,
  color.stateSteady,
  color.amber,
  color.sageDeep,
  color.statePit,
  color.stateHeavy,
] as const;

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return avatarPalette[hash % avatarPalette.length]!;
}

export const type = {
  // Display face carries warmth; body stays highly legible. In a real build
  // these map to loaded fonts (e.g. Fraunces + Inter); we name the roles here.
  // Sized up from mobile's RN point values — read at web/desktop viewing
  // distance inside wide containers, these need to be larger to read right.
  display: { fontSize: 40, fontWeight: '600' as const, letterSpacing: 0.2 },
  title: { fontSize: 28, fontWeight: '600' as const },
  heading: { fontSize: 22, fontWeight: '600' as const },
  body: { fontSize: 18, fontWeight: '400' as const, lineHeight: '28px' },
  label: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 14, fontWeight: '400' as const },
} as const;

export const tokens = { color, stateVisual, space, radius, elevation, motion, type };
export default tokens;
