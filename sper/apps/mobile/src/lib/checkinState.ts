import {
  CHECKIN_DIMENSIONS,
  type CheckInDimension,
  type SperEntryDTO,
  type StateLevel,
} from '@sper/shared-types';

export { CHECKIN_DIMENSIONS as DIMENSIONS };

const FIELD: Record<CheckInDimension, keyof SperEntryDTO> = {
  spiritual: 'spiritual_state',
  physical: 'physical_state',
  emotional: 'emotional_state',
  vocational: 'vocational_state',
  relational: 'relational_state',
};

export function dimState(entry: SperEntryDTO, dim: CheckInDimension): StateLevel | null {
  return (entry[FIELD[dim]] as StateLevel | null) ?? null;
}

/** Surface the heaviest dimension — that's what the circle needs to notice. */
export function aggregateState(entry: SperEntryDTO): StateLevel | null {
  const order: StateLevel[] = ['In the Pit', 'Heavy', 'Steady', 'Thriving'];
  const states = CHECKIN_DIMENSIONS.map((d) => dimState(entry, d)).filter(Boolean) as StateLevel[];
  for (const level of order) if (states.includes(level)) return level;
  return null;
}
