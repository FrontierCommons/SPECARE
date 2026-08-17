import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import type { CareCardDTO, SperEntryDTO, TouchpointType } from '@sper/shared-types';
import {
  keys,
  useSper,
  useCareCards,
  useShareCards,
  useToggleLike,
  useLogTouchpoint,
  useTouchpoints,
  useVoiceNotes,
  useSendVoiceNote,
  useMarkVoiceNoteReceived,
  useMessages,
  useSendMessage,
  useMarkMessageReceived,
} from '../api/hooks';
import { api } from '../api/client';
import { useSession } from '../state/session';
import { SperWidget } from '../components/SperWidget';
import { CareCard } from '../components/CareCard';
import { ShareCard } from '../components/ShareCard';
import { SelfCareTree } from '../components/SelfCareTree';
import { NextCheckInCountdown } from '../components/NextCheckInCountdown';
import { MemberDetailSheet } from '../components/MemberDetailSheet';
import { VoiceNoteBanner } from '../components/VoiceNoteBanner';
import { MessageBanner } from '../components/MessageBanner';
import { Touchable } from '../components/Touchable';
import { Toast } from '../components/Toast';
import { useNewPrayerAlert } from '../lib/useNewPrayerAlert';
import { useNewGratitudeAlert } from '../lib/useNewGratitudeAlert';
import { reachedNames } from '../lib/touchpoints';
import { fromCareCard, fromShareCard, hasShareableContent, type ShareableNote } from '../lib/shareable';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

export function SperDashboardScreen({
  onCheckIn,
  onCreateOrJoin,
}: {
  onCheckIn: () => void;
  onCreateOrJoin: () => void;
}) {
  const { activeCircleId, user, circles } = useSession();
  const circleId = activeCircleId ?? '';
  const circleName = circles.find((c) => c.circle_id === circleId)?.name;
  const sper = useSper(circleId);
  const care = useCareCards(circleId);
  const share = useShareCards(circleId);
  const toggleLike = useToggleLike(circleId);
  const [selected, setSelected] = useState<SperEntryDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'responded'>('new');

  // One shared slot for both toasts below — a prayer and a thank-you landing
  // in the same poll tick is rare enough that letting the second reset the
  // first's timer is a better tradeoff than two toasts visually overlapping.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);
  const flashPrayerToast = useCallback(() => flashToast(strings.care.prayerToast), [flashToast]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // Fires once when a friend thanks the viewer for a voice note/message they
  // sent — the counterpart to the prayer toast above, for the other two
  // touchpoint types.
  const flashGratitudeToast = useCallback(
    (name: string) => flashToast(strings.care.gratitudeReceived(name)),
    [flashToast],
  );
  useNewGratitudeAlert(care.data, user?.id, flashGratitudeToast);

  const refreshing = sper.isFetching || care.isFetching || share.isFetching;
  const onRefresh = () => {
    sper.refetch();
    care.refetch();
    share.refetch();
  };

  const myEntry = useMemo(() => sper.data?.find((e) => e.user_id === user?.id) ?? null, [sper.data, user]);
  const myCheckinId = myEntry?.checkin_id ?? '';

  const selectedCard = useMemo(
    () => care.data?.find((c) => c.target_user_id === selected?.user_id),
    [care.data, selected],
  );

  // Every other member's active Care Card, minus the one-time gratitude
  // flash (still rendered separately, unconditionally, up top) — these are
  // the candidates for "does the viewer still need to act, or have they
  // already cared for this and it should read as a share instead."
  const otherCareCards = useMemo(
    () => care.data?.filter((c) => c.target_user_id !== user?.id && !c.gratitude_received && !c.gratitude_shown) ?? [],
    [care.data, user],
  );
  const myCareCard = useMemo(() => care.data?.find((c) => c.target_user_id === user?.id), [care.data, user]);

  // One touchpoints query per other-member Care Card — a fixed-shape array
  // derived from otherCareCards, so this stays a single hook call regardless
  // of how many cards there are.
  const touchpointQueries = useQueries({
    queries: otherCareCards.map((card) => ({
      queryKey: keys.touchpoints(card.checkin_id),
      queryFn: () => api.touchpoints(card.checkin_id),
      enabled: !!card.checkin_id,
      refetchInterval: 15_000,
    })),
  });

  const pendingCareCards: CareCardDTO[] = [];
  const caredForEntries: Array<{
    card: CareCardDTO;
    actionTypes: TouchpointType[];
    actionAt: string | null;
    reachedNames: string[];
    reachedAt: string | null;
  }> = [];
  otherCareCards.forEach((card, i) => {
    const tpData = touchpointQueries[i]?.data;
    const reached = reachedNames(tpData, user?.id);
    if (reached.includes('You')) {
      const mine = (tpData ?? []).filter((t) => t.responder_id === user?.id);
      const myTypes = mine.map((t) => t.type);
      const latestAmong = (list: typeof mine) =>
        list.reduce<string | null>((latest, t) => (!latest || t.created_at > latest ? t.created_at : latest), null);
      caredForEntries.push({
        card,
        actionTypes: myTypes,
        actionAt: latestAmong(mine),
        reachedNames: reached,
        reachedAt: latestAmong(tpData ?? []),
      });
    } else {
      pendingCareCards.push(card);
    }
  });

  // What the viewer sees as "something special": their own share (whichever
  // kind their latest check-in produced), then everyone else's — either a
  // genuinely all-positive check-in, or the leftover notes on one they've
  // already cared for (which always shows, even with nothing positive left,
  // since the action confirmation itself is the content there).
  const myShare: ShareableNote | null = myCareCard
    ? fromCareCard(myCareCard)
    : share.data?.find((c) => c.target_user_id === user?.id)
      ? fromShareCard(share.data.find((c) => c.target_user_id === user?.id)!)
      : null;
  const othersShare: ShareableNote[] = [
    ...caredForEntries.map(({ card, actionTypes, actionAt, reachedNames: names, reachedAt }) =>
      fromCareCard(card, { actionTypes, actionAt, reachedNames: names, reachedAt }),
    ),
    ...(share.data ?? []).filter((c) => c.target_user_id !== user?.id).map(fromShareCard),
  ].filter((item) => hasShareableContent(item) || !!item.actionTypes?.length);

  // The viewer's own pending/thanked voice notes and messages — these used
  // to sit in a fixed spot above the tree; now they're part of the same
  // New/Already-responded split as everything else.
  const myVoiceNotes = useVoiceNotes(myCheckinId);
  const myMessages = useMessages(myCheckinId);
  const markVoiceReceived = useMarkVoiceNoteReceived(myCheckinId);
  const markMessageReceived = useMarkMessageReceived(myCheckinId);
  const pendingVoiceNotes = (myVoiceNotes.data ?? []).filter((n) => !n.received_at);
  const respondedVoiceNotes = (myVoiceNotes.data ?? []).filter((n) => !!n.received_at);
  const pendingMessages = (myMessages.data ?? []).filter((m) => !m.received_at);
  const respondedMessages = (myMessages.data ?? []).filter((m) => !!m.received_at);

  // "New" groups everything that still wants something from the viewer —
  // an action on a Care Card, a first reaction to a share they haven't
  // liked yet, or a voice note/message waiting on a "Thank you." "Already
  // responded" is what they've already followed through on, kept around
  // instead of vanishing so they can see it landed. A promoted action card
  // belongs in "Already responded" the moment it's sent, regardless of like
  // status — liking is for reacting to someone else's share, not a
  // precondition for the viewer's own action to count as done.
  const newShares = othersShare.filter((item) => !item.actionTypes?.length && !item.liked_by_me);
  const respondedShares = othersShare.filter((item) => !!item.actionTypes?.length || item.liked_by_me);
  const showNewSection =
    pendingCareCards.length > 0 || newShares.length > 0 || pendingVoiceNotes.length > 0 || pendingMessages.length > 0;
  const showRespondedSection =
    respondedShares.length > 0 || respondedVoiceNotes.length > 0 || respondedMessages.length > 0;
  const newCount = pendingCareCards.length + newShares.length + pendingVoiceNotes.length + pendingMessages.length;
  const respondedCount = respondedShares.length + respondedVoiceNotes.length + respondedMessages.length;

  if (!activeCircleId) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.title}>{strings.sper.title}</Text>
        <View style={styles.emptyBody}>
          <Text style={styles.emptyMessage}>{strings.sper.noCircleYet}</Text>
          <Touchable style={styles.cta} onPress={onCreateOrJoin} accessibilityRole="button">
            <Text style={styles.ctaText}>{strings.sper.createOrJoinCircle}</Text>
          </Touchable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.sage} />}
    >
      <Toast message={toastMessage ?? ''} visible={!!toastMessage} />

      {/* The one-time "they're grateful for your care" message leads the
          screen — it's the warmest thing here and shouldn't get buried
          below the sper and everyone else's cards. */}
      {care.data
        ?.filter((card) => card.target_user_id !== user?.id && card.gratitude_shown)
        .map((card) => (
          <CareCardWithLog
            key={card.checkin_id}
            circleId={circleId}
            card={card}
            entry={sper.data?.find((e) => e.user_id === card.target_user_id)}
          />
        ))}

      <Text style={styles.title}>{strings.sper.title}</Text>
      {circleName ? <Text style={styles.circleName}>{circleName}</Text> : null}

      {sper.data && sper.data.length > 0 ? (
        <SperWidget entries={sper.data} currentUserId={user?.id} onSelect={setSelected} />
      ) : (
        <Text style={styles.empty}>{strings.sper.empty}</Text>
      )}

      {myEntry?.checkin_id ? <MyTree entry={myEntry} onPrayed={flashPrayerToast} /> : null}

      {/* The viewer's own share — nothing to act on, just theirs to watch
          reactions land on, so it sits outside either tab below. */}
      {myShare ? <ShareCard card={myShare} isSelf entry={myEntry} /> : null}

      {showNewSection || showRespondedSection ? (
        <View style={styles.tabsWrap}>
          <View style={styles.tabs}>
            <Touchable
              onPress={() => setActiveTab('new')}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === 'new' }}
              style={[styles.tab, activeTab === 'new' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
                {strings.sper.newSection} ({newCount})
              </Text>
            </Touchable>
            <Touchable
              onPress={() => setActiveTab('responded')}
              accessibilityRole="button"
              accessibilityState={{ selected: activeTab === 'responded' }}
              style={[styles.tab, activeTab === 'responded' && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === 'responded' && styles.tabTextActive]}>
                {strings.sper.respondedSection} ({respondedCount})
              </Text>
            </Touchable>
          </View>

          {activeTab === 'new' ? (
            showNewSection ? (
              <View style={styles.tabContent}>
                {pendingCareCards.map((card) => (
                  <CareCardWithLog
                    key={card.checkin_id}
                    circleId={circleId}
                    card={card}
                    entry={sper.data?.find((e) => e.user_id === card.target_user_id)}
                  />
                ))}
                {newShares.map((item) => (
                  <ShareCard
                    key={item.checkin_id}
                    card={item}
                    isSelf={false}
                    entry={sper.data?.find((e) => e.user_id === item.target_user_id)}
                    onToggleLike={() => toggleLike.mutate(item.checkin_id)}
                    likePending={toggleLike.isPending}
                  />
                ))}
                {pendingVoiceNotes.map((note) => (
                  <VoiceNoteBanner
                    key={note.id}
                    note={note}
                    receiving={markVoiceReceived.isPending}
                    onReceived={(noteId) => markVoiceReceived.mutate(noteId)}
                  />
                ))}
                {pendingMessages.map((message) => (
                  <MessageBanner
                    key={message.id}
                    message={message}
                    receiving={markMessageReceived.isPending}
                    onReceived={(messageId) => markMessageReceived.mutate(messageId)}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.tabEmpty}>{strings.sper.newEmpty}</Text>
            )
          ) : showRespondedSection ? (
            <View style={styles.tabContent}>
              {respondedShares.map((item) => (
                <ShareCard
                  key={item.checkin_id}
                  card={item}
                  isSelf={false}
                  entry={sper.data?.find((e) => e.user_id === item.target_user_id)}
                  onToggleLike={() => toggleLike.mutate(item.checkin_id)}
                  likePending={toggleLike.isPending}
                />
              ))}
              {respondedVoiceNotes.map((note) => (
                <ThankedConfirmation key={note.id} text={strings.care.thankedVoiceNote(note.sender_name)} />
              ))}
              {respondedMessages.map((message) => (
                <ThankedConfirmation key={message.id} text={strings.care.thankedMessage(message.sender_name)} />
              ))}
            </View>
          ) : (
            <Text style={styles.tabEmpty}>{strings.sper.respondedEmpty}</Text>
          )}
        </View>
      ) : null}

      {myEntry?.checkin_id && myEntry.created_at && user ? (
        <NextCheckInCountdown lastCheckInAt={myEntry.created_at} frequency={user.checkin_frequency} />
      ) : null}

      <Touchable style={styles.cta} onPress={onCheckIn} accessibilityRole="button">
        <Text style={styles.ctaText}>{myEntry?.checkin_id ? strings.sper.checkInCta : strings.sper.checkInCtaFirst}</Text>
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

/** A plain confirmation line for "Already responded" — a thanked voice
 * note/message doesn't have notes or likes of its own, just this. */
function ThankedConfirmation({ text }: { text: string }) {
  return (
    <View style={styles.thankedCard}>
      <Text style={styles.thankedText}>{text}</Text>
    </View>
  );
}

function MyTree({ entry, onPrayed }: { entry: SperEntryDTO; onPrayed: () => void }) {
  const touchpoints = useTouchpoints(entry.checkin_id!);
  useNewPrayerAlert(touchpoints.data, onPrayed);
  return <SelfCareTree entry={entry} count={touchpoints.data?.length ?? 0} />;
}

function CareCardWithLog({
  circleId,
  card,
  entry,
}: {
  circleId: string;
  card: CareCardDTO;
  entry?: SperEntryDTO | null;
}) {
  const { user } = useSession();
  const logCare = useLogTouchpoint(circleId, card.checkin_id);
  const sendVoiceNote = useSendVoiceNote(circleId, card.checkin_id);
  const sendMessage = useSendMessage(circleId, card.checkin_id);
  const touchpoints = useTouchpoints(card.checkin_id);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  return (
    <CareCard
      card={card}
      entry={entry}
      onLogCare={(t: TouchpointType) => logCare.mutate({ type: t })}
      onSendVoiceNote={(input) =>
        sendVoiceNote
          .mutateAsync({
            audio_base64: input.audioBase64,
            mime_type: input.mimeType,
            duration_ms: input.durationMs,
          })
          .then(() => undefined)
      }
      onSendMessage={(body) => sendMessage.mutateAsync({ body }).then(() => undefined)}
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
  entry: SperEntryDTO | null;
  careCard?: CareCardDTO;
  isSelf: boolean;
  onPrayed: () => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const checkinId = entry?.checkin_id ?? '';
  const logCare = useLogTouchpoint(circleId, checkinId);
  const sendVoiceNote = useSendVoiceNote(circleId, checkinId);
  const sendMessage = useSendMessage(circleId, checkinId);
  const toggleLike = useToggleLike(circleId);
  const touchpoints = useTouchpoints(checkinId);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  const myTouchpoints = (touchpoints.data ?? []).filter((t) => t.responder_id === user?.id);
  const actionTypes = myTouchpoints.map((t) => t.type);
  const actionAt = myTouchpoints.reduce<string | null>(
    (latest, t) => (!latest || t.created_at > latest ? t.created_at : latest),
    null,
  );
  useNewPrayerAlert(isSelf ? touchpoints.data : undefined, onPrayed);
  return (
    <MemberDetailSheet
      entry={entry}
      careCard={careCard}
      isSelf={isSelf}
      alreadyReached={alreadyReached}
      touchpointCount={touchpoints.data?.length ?? 0}
      touchpoints={touchpoints.data}
      actionTypes={actionTypes}
      actionAt={actionAt}
      onLogCare={(t: TouchpointType) => logCare.mutate({ type: t })}
      onToggleLike={() => toggleLike.mutate(checkinId)}
      likePending={toggleLike.isPending}
      onSendVoiceNote={(input) =>
        sendVoiceNote
          .mutateAsync({
            audio_base64: input.audioBase64,
            mime_type: input.mimeType,
            duration_ms: input.durationMs,
          })
          .then(() => undefined)
      }
      onSendMessage={(body) => sendMessage.mutateAsync({ body }).then(() => undefined)}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.lg },
  emptyScreen: { flex: 1, backgroundColor: color.bg, padding: space.lg, gap: space.lg },
  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  emptyMessage: { ...type.body, color: color.textPrimary, fontWeight: '600', textAlign: 'center' },
  title: { ...type.display, color: color.textPrimary },
  circleName: { ...type.title, color: color.textPrimary, marginTop: -space.sm },
  empty: { ...type.body, color: color.textMuted, textAlign: 'center', paddingVertical: space.xl },
  tabsWrap: { gap: space.md },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: 'center',
  },
  tabActive: { borderColor: color.sage, backgroundColor: color.surfaceRaised },
  tabText: { ...type.caption, color: color.textPrimary },
  tabTextActive: { color: color.sage, fontWeight: '600' },
  tabContent: { gap: space.md },
  tabEmpty: { ...type.body, color: color.textPrimary, fontWeight: '600', textAlign: 'center', paddingVertical: space.lg },
  thankedCard: {
    backgroundColor: color.bg,
    borderColor: color.sage,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    ...elevation.sm,
  },
  thankedText: { ...type.label, fontWeight: '600', color: color.textPrimary, textAlign: 'center' },
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

export default SperDashboardScreen;
