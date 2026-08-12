/**
 * A separate pool from lib/verses.ts — those comfort the person who's
 * struggling ("God is with you"); these speak to the responder, about the
 * act of encouraging someone else. Shown on the Care Card's guidance box,
 * addressed to whoever's about to reach out, not to the flagged member.
 */
const ENCOURAGE_VERSES: readonly string[] = [
  'Therefore encourage one another and build each other up, just as in fact you are doing. — 1 Thessalonians 5:11',
  'And let us consider how we may spur one another on toward love and good deeds. — Hebrews 10:24',
  'Praise be to the God of all comfort, who comforts us in all our troubles, so that we can comfort those in any trouble with the comfort we ourselves receive from God. — 2 Corinthians 1:3-4',
  'Rejoice with those who rejoice; mourn with those who mourn. — Romans 12:15',
  'Be kind and compassionate to one another, forgiving each other, just as in Christ God forgave you. — Ephesians 4:32',
  'A friend loves at all times, and a brother is born for a time of adversity. — Proverbs 17:17',
  'Two are better than one... if either of them falls down, one can help the other up. — Ecclesiastes 4:9-10',
  'Do to others as you would have them do to you. — Luke 6:31',
  'Above all, love each other deeply, because love covers over a multitude of sins. — 1 Peter 4:8',
  'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up. — Galatians 6:9',
] as const;

/** Deterministic by seed (e.g. a checkin id) so a given Care Card's verse
 * doesn't change on every re-render or refetch. */
export function pickEncourageVerse(seed?: string): string {
  if (!seed) return ENCOURAGE_VERSES[Math.floor(Math.random() * ENCOURAGE_VERSES.length)]!;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ENCOURAGE_VERSES[Math.abs(hash) % ENCOURAGE_VERSES.length]!;
}

export default pickEncourageVerse;
