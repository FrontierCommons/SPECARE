import type { CheckInDimension } from '@sper/shared-types';
import { DIMENSIONS } from './checkinState';
import { strings } from '../design/strings';

// The server's optional_note column is a hard 140 chars — narrower than what
// the explain boxes individually allow, so a check-in with several long
// explanations gets fit down to this rather than rejected outright.
const NOTE_MAX_LENGTH = 140;

function truncateNote(text: string): string {
  if (text.length <= NOTE_MAX_LENGTH) return text;
  return `${text.slice(0, NOTE_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Combines per-dimension "I'd rather explain" answers with the general
 * end-of-flow note into the single free-text field the server stores, each
 * dimension tagged by its display name so `parseCheckInNote` can pull it
 * back out later — there's no separate per-dimension column.
 */
export function buildCheckInNote(explanations: Partial<Record<CheckInDimension, string>>, generalNote: string): string {
  const explainedNote = DIMENSIONS.filter((dim) => explanations[dim])
    .map((dim) => `${strings.checkIn.dimensions[dim]}: ${explanations[dim]}`)
    .join('\n');
  return truncateNote([explainedNote, generalNote.trim()].filter(Boolean).join('\n'));
}

export interface ParsedCheckInNote {
  perDimension: Partial<Record<CheckInDimension, string>>;
  /** Whatever's left that wasn't tagged to a dimension — the general note. */
  general: string;
}

/**
 * Reverses `buildCheckInNote`'s tagging, best-effort — the combined note may
 * have been truncated, so a cut-off last line just reads as a shorter
 * explanation rather than getting recovered exactly.
 */
export function parseCheckInNote(note: string | null | undefined): ParsedCheckInNote {
  const perDimension: Partial<Record<CheckInDimension, string>> = {};
  const generalLines: string[] = [];
  if (!note) return { perDimension, general: '' };

  const prefixes = DIMENSIONS.map((dim) => ({ dim, prefix: `${strings.checkIn.dimensions[dim]}: ` }));

  for (const line of note.split('\n')) {
    const match = prefixes.find(({ prefix }) => line.startsWith(prefix));
    if (match) {
      perDimension[match.dim] = line.slice(match.prefix.length);
    } else if (line) {
      generalLines.push(line);
    }
  }
  return { perDimension, general: generalLines.join('\n') };
}
