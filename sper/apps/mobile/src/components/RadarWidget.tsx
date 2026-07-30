import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { RadarEntryDTO } from '@sper/shared-types';
import { MemberOrb } from './MemberOrb';
import { space } from '../design/tokens';

/**
 * The home surface: literally a circle of people. Each member is an avatar
 * ringed by their five check-in dimensions — no history scroll, no numbers,
 * just presence and weather. Tap anyone for the full picture.
 */
export function RadarWidget({
  entries,
  onSelect,
}: {
  entries: RadarEntryDTO[];
  onSelect: (entry: RadarEntryDTO) => void;
}) {
  return (
    <View style={styles.wrap}>
      {entries.map((e) => (
        <MemberOrb key={e.user_id} entry={e} onPress={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'flex-start' },
});

export default RadarWidget;
