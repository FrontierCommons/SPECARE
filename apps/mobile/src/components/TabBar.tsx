import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Touchable } from './Touchable';
import { color, elevation, space, type } from '../design/tokens';
import { strings } from '../design/strings';

export type TabKey = 'today' | 'checkin' | 'circle' | 'settings';

const TABS: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'today', label: strings.nav.today, glyph: '◔' },
  { key: 'checkin', label: strings.nav.checkIn, glyph: '✎' },
  { key: 'circle', label: strings.nav.circle, glyph: '◎' },
  { key: 'settings', label: strings.nav.settings, glyph: '⚙' },
];

/**
 * The only way to move between the app's destinations. Flat by design — four
 * peers, no nesting — so moving around never feels like leaving "the" app.
 */
export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Touchable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <Text style={[styles.glyph, selected && styles.glyphActive]}>{tab.glyph}</Text>
            <Text style={[styles.label, selected && styles.labelActive]}>{tab.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    ...elevation.md,
    shadowOffset: { width: 0, height: -2 },
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.xs },
  glyph: { fontSize: 20, color: color.textMuted },
  glyphActive: { color: color.sage },
  label: { ...type.caption, fontSize: 11, color: color.textMuted },
  labelActive: { color: color.sage, fontWeight: '600' },
});

export default TabBar;
