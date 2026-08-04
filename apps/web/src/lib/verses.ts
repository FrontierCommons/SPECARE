/**
 * Encouraging verses shown on a member's own tree while it's waiting to be
 * watered — comfort-and-presence in place of a bare "no one yet" message.
 * Tone matches the API's distress-notification verses; kept as a separate
 * client-side pool since this is a purely local presentation concern.
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

/** Deterministic by seed (e.g. a checkin id) so a given day's verse doesn't change on every re-render. */
export function pickVerse(seed?: string): string {
  if (!seed) return VERSES[Math.floor(Math.random() * VERSES.length)]!;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return VERSES[Math.abs(hash) % VERSES.length]!;
}

export default pickVerse;
