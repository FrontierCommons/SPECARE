import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import type { RadarEntryDTO, TouchpointType } from '@sper/shared-types';
import { useRadar, useCareCards, useLogTouchpoint, useTouchpoints } from '../api/hooks';
import { useSession } from '../state/session';
import { RadarWidget } from '../components/RadarWidget';
import { CareCard } from '../components/CareCard';
import { SelfCareTree } from '../components/SelfCareTree';
import { MemberDetailSheet } from '../components/MemberDetailSheet';
import { Touchable } from '../components/Touchable';
import { Toast } from '../components/Toast';
import { useNewPrayerAlert } from '../lib/useNewPrayerAlert';
import { reachedNames } from '../lib/touchpoints';
import { color, elevation, space, type } from '../design/tokens';
import { strings } from '../design/strings';

export function RadarDashboardScreen({ onCheckIn }: { onCheckIn: () => void }) {
  const { activeCircleId, user, circles } = useSession();
  const circleId = activeCircleId!;
  const circleName = circles.find((c) => c.circle_id === circleId)?.name;
  const radar = useRadar(circleId);
  const care = useCareCards(circleId);
  const [selected, setSelected] = useState<RadarEntryDTO | null>(null);

  const [prayerToastVisible, setPrayerToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPrayerToast = useCallback(() => {
    setPrayerToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setPrayerToastVisible(false), 4000);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const refreshing = radar.isFetching || care.isFetching;
  const onRefresh = () => {
    radar.refetch();
    care.refetch();
  };

  const myEntry = useMemo(
    () => radar.data?.find((e) => e.user_id === user?.id) ?? null,
    [radar.data, user],
  );

  const selectedCard = useMemo(
    () => care.data?.find((c) => c.target_user_id === selected?.user_id),
    [care.data, selected],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.sage} />}
    >
      <Toast message={strings.care.prayerToast} visible={prayerToastVisible} />

      {/* The one-time "they're grateful for your care" message leads the
          screen — it's the warmest thing here and shouldn't get buried
          below the radar and everyone else's cards. */}
      {care.data
        ?.filter((card) => card.target_user_id !== user?.id && card.gratitude_shown)
        .map((card) => (
          <CareCardWithLog key={card.checkin_id} circleId={circleId} card={card} />
        ))}

      <Text style={styles.title}>{strings.radar.title}</Text>
      {circleName ? <Text style={styles.circleName}>{circleName}</Text> : null}

      {myEntry?.checkin_id ? (
        <MyTree entry={myEntry} onPrayed={flashPrayerToast} />
      ) : null}

      {radar.data && radar.data.length > 0 ? (
        <RadarWidget entries={radar.data} onSelect={setSelected} />
      ) : (
        <Text style={styles.empty}>{strings.radar.empty}</Text>
      )}

      {care.data
        ?.filter((card) => card.target_user_id !== user?.id)
        // The one-time gratitude flash now renders above, up top; a card
        // that already received (but isn't currently flashing) gratitude
        // has nothing left to show here at all.
        .filter((card) => !card.gratitude_received && !card.gratitude_shown)
        .map((card) => (
          <CareCardWithLog key={card.checkin_id} circleId={circleId} card={card} />
        ))}

      <Touchable style={styles.cta} onPress={onCheckIn} accessibilityRole="button">
        <Text style={styles.ctaText}>{strings.radar.checkInCta}</Text>
      </Touchable>

      <MemberDetailSheetWithLog
        circleId={circleId}
        entry={selected}
        careCard={selectedCard}
        isSelf={!!selected && selected.user_id === user?.id}
        onPrayed={flashPrayerToast}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

function MyTree({ entry, onPrayed }: { entry: RadarEntryDTO; onPrayed: () => void }) {
  const touchpoints = useTouchpoints(entry.checkin_id!);
  useNewPrayerAlert(touchpoints.data, onPrayed);
  return <SelfCareTree entry={entry} count={touchpoints.data?.length ?? 0} />;
}

function CareCardWithLog({ circleId, card }: { circleId: string; card: import('@sper/shared-types').CareCardDTO }) {
  const { user } = useSession();
  const logCare = useLogTouchpoint(circleId, card.checkin_id);
  const touchpoints = useTouchpoints(card.checkin_id);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  return (
    <CareCard
      card={card}
      onLogCare={(t: TouchpointType) => logCare.mutate({ type: t })}
      alreadyReached={alreadyReached}
    />
  );
}

function MemberDetailSheetWithLog({
  circleId,
  entry,
  careCard,
  isSelf,
  onPrayed,
  onClose,
}: {
  circleId: string;
  entry: RadarEntryDTO | null;
  careCard?: import('@sper/shared-types').CareCardDTO;
  isSelf: boolean;
  onPrayed: () => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const checkinId = entry?.checkin_id ?? '';
  const logCare = useLogTouchpoint(circleId, checkinId);
  const touchpoints = useTouchpoints(checkinId);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  useNewPrayerAlert(isSelf ? touchpoints.data : undefined, onPrayed);
  return (
    <MemberDetailSheet
      entry={entry}
      careCard={careCard}
      isSelf={isSelf}
      alreadyReached={alreadyReached}
      onLogCare={(t: TouchpointType) => logCare.mutate({ type: t })}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg },
  title: { ...type.display, color: color.textPrimary },
  circleName: { ...type.label, color: color.textSecondary, marginTop: -space.sm },
  empty: { ...type.body, color: color.textMuted, textAlign: 'center', paddingVertical: space.xl },
  cta: {
    backgroundColor: color.sage,
    borderRadius: 14,
    padding: space.md,
    alignItems: 'center',
    marginTop: space.sm,
    ...elevation.sm,
  },
  ctaText: { ...type.label, color: color.bg, fontWeight: '600' },
});

export default RadarDashboardScreen;
