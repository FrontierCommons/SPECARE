import type { SperEntryDTO } from '@sper/shared-types';
import { MemberOrb } from './MemberOrb';

/**
 * The home surface: literally a circle of people. Each member is an avatar
 * ringed by their five check-in dimensions — no history scroll, no numbers,
 * just presence and weather. Tap anyone for the full picture. The viewer's
 * own entry always leads, labeled "You", so people don't have to hunt for
 * themselves in the row before checking on everyone else.
 */
export function SperWidget({
  entries,
  currentUserId,
  onSelect,
}: {
  entries: SperEntryDTO[];
  currentUserId?: string;
  onSelect: (entry: SperEntryDTO) => void;
}) {
  const ordered = [...entries].sort((a, b) =>
    a.user_id === currentUserId ? -1 : b.user_id === currentUserId ? 1 : 0,
  );
  return (
    <div className="flex flex-wrap justify-start gap-md">
      {ordered.map((e) => (
        <MemberOrb key={e.user_id} entry={e} isSelf={e.user_id === currentUserId} onPress={onSelect} />
      ))}
    </div>
  );
}

export default SperWidget;
