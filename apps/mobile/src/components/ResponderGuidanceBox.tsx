import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

/**
 * Shown on every Care Card, right above the action buttons — a short, warm
 * lead-in rather than a paragraph of instructions on how to comfort someone.
 */
export function ResponderGuidanceBox() {
  return <Text style={styles.text}>{strings.care.guidance}</Text>;
}

const styles = StyleSheet.create({
  text: { ...type.label, color: color.textPrimary, fontWeight: '600' },
});

export default ResponderGuidanceBox;
