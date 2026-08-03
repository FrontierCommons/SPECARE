import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { SperEntryDTO } from '@sper/shared-types';
import { MemberOrb } from './MemberOrb';
import { space } from '../design/tokens';

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
    <View style={styles.wrap}>
      {ordered.map((e) => (
        <MemberOrb key={e.user_id} entry={e} isSelf={e.user_id === currentUserId} onPress={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'flex-start' },
});

export default SperWidget;
