import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import type { CareCardDTO, RadarEntryDTO, TouchpointType } from '@sper/shared-types';
import { Avatar } from './Avatar';
import { CareCard } from './CareCard';
import { SelfCareTree } from './SelfCareTree';
import { StateBadge } from './StateBadge';
import { Touchable } from './Touchable';
import { DIMENSIONS, dimState, aggregateState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import { color, elevation, motion, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  entry: RadarEntryDTO | null;
  careCard?: CareCardDTO;
  /** True when the viewer is looking at their own check-in. */
  isSelf?: boolean;
  alreadyReached?: string[];
  onLogCare: (type: TouchpointType) => void;
  onClose: () => void;
}

/**
 * The detail view behind every avatar. Always shows the five-dimension
 * breakdown; when the person is Heavy or In the Pit it folds in either the
 * Care Card (viewing a friend — "I prayed" is one tap away) or, for your own
 * check-in, the anonymous tree — you can't act on your own distress here.
 */
export function MemberDetailSheet({ entry, careCard, isSelf, alreadyReached, onLogCare, onClose }: Props) {
  const agg = entry ? aggregateState(entry) : null;
  const isOpen = !!entry;
  const translateY = useRef(new Animated.Value(24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isOpen) return;
    translateY.setValue(24);
    opacity.setValue(0);
    Animated.timing(translateY, {
      toValue: 0,
      duration: motion.duration.base,
      easing: motion.easing.decelerate,
      useNativeDriver: true,
    }).start();
    Animated.timing(opacity, {
      toValue: 1,
      duration: motion.duration.base,
      easing: motion.easing.decelerate,
      useNativeDriver: true,
    }).start();
  }, [isOpen, translateY, opacity]);

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.member.close} />
      {entry ? (
        <Animated.View style={[styles.sheet, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Avatar name={entry.name} avatarUrl={entry.avatar_url} size={64} />
            <View style={styles.headerText}>
              <Text style={styles.name}>{entry.name}</Text>
              <Text style={styles.sub}>
                {entry.created_at ? strings.member.lastCheckIn(relativeTime(entry.created_at)) : strings.member.noCheckIn}
              </Text>
            </View>
            <Touchable onPress={onClose} accessibilityRole="button" accessibilityLabel={strings.member.close} hitSlop={8}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Touchable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.dims}>
              {DIMENSIONS.map((dim) => {
                const st = dimState(entry, dim);
                return (
                  <View key={dim} style={styles.dimRow}>
                    <Text style={styles.dimLabel}>{strings.checkIn.dimensions[dim]}</Text>
                    {st ? <StateBadge state={st} compact /> : <Text style={styles.dimEmpty}>—</Text>}
                  </View>
                );
              })}
            </View>

            {isSelf ? (
              <View style={styles.careWrap}>
                <SelfCareTree entry={entry} count={alreadyReached?.length ?? 0} />
              </View>
            ) : careCard && (agg === 'Heavy' || agg === 'In the Pit') ? (
              <View style={styles.careWrap}>
                <CareCard card={careCard} onLogCare={onLogCare} alreadyReached={alreadyReached} />
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,12,14,0.6)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: color.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: color.border,
    ...elevation.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    marginBottom: space.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  name: { ...type.title, color: color.textPrimary },
  sub: { ...type.caption, color: color.textMuted },
  closeGlyph: { ...type.heading, color: color.textMuted, padding: space.xs },
  scrollContent: { gap: space.md, paddingBottom: space.lg },
  dims: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    ...elevation.sm,
  },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dimLabel: { ...type.body, color: color.textSecondary },
  dimEmpty: { ...type.body, color: color.textMuted },
  careWrap: { gap: space.sm },
});

export default MemberDetailSheet;
