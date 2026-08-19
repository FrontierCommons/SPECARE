/**
 * Encouraging verses attached to a distress notification — tone is
 * comfort-and-presence, never corrective. Static for now; a future phase
 * may make it configurable per-circle.
 */

const VERSES: readonly string[] = [
  'Cast all your anxiety on him because he cares for you. — 1 Peter 5:7',
  'The Lord is close to the brokenhearted. — Psalm 34:18',
  'Come to me, all who are weary, and I will give you rest. — Matthew 11:28',
  'He heals the brokenhearted and binds up their wounds. — Psalm 147:3',
  'I am with you always. — Matthew 28:20',
  'Weeping may stay for the night, but joy comes in the morning. — Psalm 30:5',
  'Be strong and courageous. Do not be afraid; the Lord your God goes with you. — Deuteronomy 31:6',
  'When you pass through the waters, I will be with you. — Isaiah 43:2',
  'Carry each other’s burdens. — Galatians 6:2',
  'My grace is sufficient for you, for my power is made perfect in weakness. — 2 Corinthians 12:9',
] as const;

/**
 * Pick a verse. Optionally seed by a stable key (e.g. checkin id) so the
 * same distress event always shows the same verse across recipients.
 */
export function pickVerse(seed?: string): string {
  if (VERSES.length === 0) return '';
  if (!seed) {
    return VERSES[Math.floor(Math.random() * VERSES.length)]!;
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % VERSES.length;
  return VERSES[idx]!;
}

export { VERSES };
