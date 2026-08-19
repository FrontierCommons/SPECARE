/**
 * SPER design tokens (web port), kept in sync by hand with
 * apps/mobile/src/design/tokens.ts — that file is the source of truth on
 * values (mobile is dark-only; the light theme here is a web-only addition,
 * see the Appearance setting). State colors read as weather (clear → storm),
 * deliberately not a green-to-red performance ramp.
 *
 * Theme-dependent tokens resolve through CSS custom properties defined in
 * globals.css under `:root`/`[data-theme]`, so one `data-theme` attribute on
 * <html> (see state/theme.tsx) repaints all of them at once, including plain
 * inline `style={}` usage. Everything else (accent fills, state colors, the
 * tree card's mood-colored backdrop) is a self-contained fill that stays the
 * same in both themes.
 */

import type { StateLevel } from '@sper/shared-types';

export const color = {
  // Theme-dependent — see globals.css for the light/dark values.
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  surfaceRaised: 'var(--color-surface-raised)',
  border: 'var(--color-border)',
  option: "#111827",

  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  // Stable near-white regardless of theme — for text/icons that sit on a
  // vivid, always-saturated fill (a selected state pill, the tree card's own
  // dark mood-backdrop), which needs light text whether the page around it
  // is dark or bright.
  textOption: '#f7f6f4',
  // Stable dark tone regardless of theme — the inverse of textOption, for
  // text/icons on a light-to-medium accent fill (a sage/bloom button, a
  // colored avatar). Reuses the old dark-theme bg value, since that's
  // exactly the contrast these fills were already tuned against.
  ink: '#1C2024',

  // Accents — fills stay identical in both themes (they're self-contained
  // colored surfaces, not page background).
  sage: '#8FA98C', // soft green — quiet, living
  sageDeep: '#5F7A5C',
  amber: '#c7a923', // muted amber — warmth, not alarm

  // The same three accents used AS TEXT (a link, a verse, a heading) need a
  // deeper shade to stay legible once the page itself is bright — the
  // original values were tuned for light-on-dark, which washes out as
  // light-on-light. Dark theme keeps the original (already-legible) value.
  sageText: 'var(--color-sage-text)',
  amberText: 'var(--color-amber-text)',
  bloomText: 'var(--color-bloom-text)',

  // State colors — weather, not a scoreboard. Tuned for even saturation
  // across all four (the old set ranged from 54% down to a nearly-grey 13%
  // on statePit, which read as "dull" next to the richer green/blue) while
  // keeping lightness in the same band so contrast against dark fill-text
  // (color.ink, used when one of these is a filled background) doesn't shift.
  stateThriving: '#349B27', // clear sky (sage)
  stateSteady: '#2D9ED2', // calm blue
  stateHeavy: '#D89446', // overcast amber
  statePit: '#9456B3', // muted storm plum (never a harsh red)

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
  // healthy, dimmer and duller when it's withering. A mood, not a chart —
  // same in both themes, like the other accent fills above.
  treeCardHealthy: '#166b44',
  treeCardHealthyBorder: '#0c5b39',
  treeCardWithered: '#1D1F1C',
  treeCardWitheredBorder: '#33362F',
} as const;

export const stateVisual: Record<
  StateLevel,
  {
    color: string;
    icon: string;
    label: string;
    /** Same hue family as `color`, just lighter→darker within it — used for
     * the check-in flow's own option buttons, where a bit of depth reads as
     * more inviting than a flat fill. Everywhere else (rings, badges, pills)
     * keeps the plain `color` fill, so this stays scoped to that one moment. */
    gradient: string;
  }
> = {
  Thriving: {
    color: color.stateThriving,
    gradient: 'linear-gradient(135deg, #5CC244 0%, #2C7F22 100%)',
    icon: '🌳',
    label: 'Thriving',
  },
  Steady: {
    color: color.stateSteady,
    gradient: 'linear-gradient(135deg, #57BBEA 0%, #1F7FAE 100%)',
    icon: '🌿',
    label: 'Steady',
  },
  Heavy: {
    color: color.stateHeavy,
    gradient: 'linear-gradient(135deg, #E7B06C 0%, #BD7830 100%)',
    icon: '🍂',
    label: 'Heavy',
  },
  'In the Pit': {
    color: color.statePit,
    gradient: 'linear-gradient(135deg, #B172CE 0%, #7A3D93 100%)',
    icon: '🌱',
    label: 'In the Pit',
  },
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

// Font roles, loaded via next/font/google in app/layout.tsx as CSS
// variables — Fraunces for warmth on display copy, Inter for legibility
// everywhere else. Referencing the variables here (rather than each call
// site importing a font module) keeps every `style={type.x}` usage in sync.
const displayFace = 'var(--font-display), Georgia, serif';
const bodyFace = 'var(--font-body), system-ui, sans-serif';

export const type = {
  // Display face carries warmth; body stays highly legible.
  // Sized up from mobile's RN point values — read at web/desktop viewing
  // distance inside wide containers, these need to be larger to read right.
  display: { fontSize: 40, fontWeight: '600' as const, letterSpacing: 0.2, fontFamily: displayFace },
  title: { fontSize: 28, fontWeight: '600' as const, fontFamily: displayFace },
  heading: { fontSize: 22, fontWeight: '600' as const, fontFamily: displayFace },
  body: { fontSize: 18, fontWeight: '400' as const, lineHeight: '28px', fontFamily: bodyFace },
  label: { fontSize: 16, fontWeight: '500' as const, fontFamily: bodyFace },
  caption: { fontSize: 14, fontWeight: '400' as const, fontFamily: bodyFace },
} as const;

export const tokens = { color, stateVisual, space, radius, elevation, motion, type };
export default tokens;
