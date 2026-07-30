import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isDistress, type RadarEntryDTO } from '@sper/shared-types';
import { Tree } from './Tree';
import { Touchable } from './Touchable';
import { useSendGratitude } from '../api/hooks';
import { useSession } from '../state/session';
import { aggregateState } from '../lib/checkinState';
import { pickVerse } from '../lib/verses';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

const THANKED_KEY_PREFIX = 'sper.thankedCount.';

/**
 * Your own tree, always visible when you've checked in today — not just on
 * hard days. Healthy whenever you're not distressed, OR when you are but
 * someone has already prayed for you; withering only when you're distressed
 * and no one has yet. No names, no action buttons — you can't water your own
 * tree, only your circle can. Once someone has reached out, "Thank you!" lets
 * you send gratitude their way; repeatable, since more people may respond later.
 */
export function SelfCareTree({ entry, count }: { entry: RadarEntryDTO; count: number }) {
  const { activeCircleId } = useSession();
  const agg = aggregateState(entry);
  const distressed = agg ? isDistress(agg) : false;
  const healthy = !distressed || count > 0;
  const verse = useMemo(() => pickVerse(entry.checkin_id ?? undefined), [entry.checkin_id]);

  const gratitude = useSendGratitude(activeCircleId ?? '', entry.checkin_id ?? '');
  const [justSent, setJustSent] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  // How many touchpoints existed the last time this member said thanks —
  // persisted so a already-thanked batch of care stays quiet across app
  // restarts and pull-to-refresh, not just for the current mount. Only a
  // touchpoint count higher than this (someone new reaching out) reopens
  // the "someone cares" prompt.
  const storageKey = `${THANKED_KEY_PREFIX}${entry.checkin_id ?? ''}`;
  const [thankedCount, setThankedCount] = useState(0);
  useEffect(() => {
    if (!entry.checkin_id) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey).then((stored) => {
      if (!cancelled && stored) setThankedCount(Number(stored));
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, entry.checkin_id]);

  const hasNewCare = count > thankedCount;

  const sayThanks = () => {
    gratitude.mutate(undefined, {
      onSuccess: () => {
        setJustSent(true);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setJustSent(false);
          setThankedCount(count);
          void AsyncStorage.setItem(storageKey, String(count));
        }, 3000);
      },
    });
  };

  return (
    <View style={[styles.card, healthy ? styles.cardHealthy : styles.cardWithered]}>
      <Text style={styles.title}>{distressed ? strings.care.selfTitle : strings.care.treeTitle}</Text>
      <Tree healthy={healthy} width={320} />
      {distressed ? (
        count > 0 && (hasNewCare || justSent) ? (
          <>
            <Text style={styles.count}>{strings.care.responseCount(count)}</Text>
            <View style={styles.encourageBox}>
              <Text style={styles.encourageText}>{strings.care.encouragement}</Text>
            </View>
            <Touchable
              style={styles.thankBtn}
              onPress={sayThanks}
              disabled={gratitude.isPending}
              accessibilityRole="button"
              accessibilityLabel={strings.care.thankYou}
            >
              <Text style={styles.thankBtnText}>
                {justSent ? strings.care.gratitudeSent : strings.care.thankYou}
              </Text>
            </Touchable>
          </>
        ) : (
          <Text style={styles.verse}>{verse}</Text>
        )
      ) : (
        <Text style={styles.count}>{strings.care.thrivingCaption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    alignItems: 'center',
    borderWidth: 1,
    ...elevation.sm,
  },
  cardHealthy: { backgroundColor: color.treeCardHealthy, borderColor: color.treeCardHealthyBorder },
  cardWithered: { backgroundColor: color.treeCardWithered, borderColor: color.treeCardWitheredBorder },
  title: { ...type.title, color: color.textPrimary, alignSelf: 'flex-start' },
  count: { ...type.caption, color: color.textMuted, marginTop: space.xs, textAlign: 'center' },
  verse: {
    ...type.caption,
    color: color.sage,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: space.xs,
    lineHeight: 18,
  },
  encourageBox: {
    backgroundColor: color.bloomSoft,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: color.bloom,
    marginTop: space.xs,
  },
  encourageText: { ...type.label, color: color.textPrimary, fontWeight: '600' },
  thankBtn: {
    backgroundColor: color.bloom,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    marginTop: space.sm,
  },
  thankBtnText: { ...type.label, color: color.textPrimary, fontWeight: '600' },
});

export default SelfCareTree;
