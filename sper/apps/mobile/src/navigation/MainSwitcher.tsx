import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { RadarDashboardScreen } from '../screens/RadarDashboardScreen';
import { CheckInSheetScreen } from '../screens/CheckInSheetScreen';
import { MyCircleScreen } from '../screens/MyCircleScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TabBar, type TabKey } from '../components/TabBar';
import { color } from '../design/tokens';

/**
 * Four flat destinations reached from a persistent tab bar — Today, Check in,
 * Circle, Settings. No nested stacks: every screen is one tap from any other.
 */
export function MainSwitcher() {
  const [dest, setDest] = useState<TabKey>('today');

  return (
    <View style={styles.flex}>
      <View style={styles.body}>
        {dest === 'checkin' && (
          <CheckInSheetScreen
            onDone={() => setDest('today')}
            onOpenSettings={() => setDest('settings')}
            onComplete={() => setDest('today')}
          />
        )}
        {dest === 'circle' && (
          <MyCircleScreen onBack={() => setDest('today')} onLeft={() => setDest('today')} />
        )}
        {dest === 'settings' && <SettingsScreen />}
        {dest === 'today' && <RadarDashboardScreen onCheckIn={() => setDest('checkin')} />}
      </View>
      <TabBar active={dest} onChange={setDest} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },
});

export default MainSwitcher;
