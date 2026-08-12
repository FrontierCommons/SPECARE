'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from '../../../api/hooks';
import { api } from '../../../api/client';
import { useSession } from '../../../state/session';
import { SperWidget } from '../../../components/SperWidget';
import { CareCard } from '../../../components/CareCard';
import { ShareCard } from '../../../components/ShareCard';
import { SelfCareTree } from '../../../components/SelfCareTree';
import { MemberDetailSheet } from '../../../components/MemberDetailSheet';
import { NextCheckInCountdown } from '../../../components/NextCheckInCountdown';
import { VoiceNoteBanner } from '../../../components/VoiceNoteBanner';
import { MessageBanner } from '../../../components/MessageBanner';
import { Toast } from '../../../components/Toast';
import { useNewPrayerAlert } from '../../../lib/useNewPrayerAlert';
import { useNewGratitudeAlert } from '../../../lib/useNewGratitudeAlert';
import { reachedNames } from '../../../lib/touchpoints';
import { fromCareCard, fromShareCard, hasShareableContent, type ShareableNote } from '../../../lib/shareable';
import { PRESSABLE } from '../../../design/interaction';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const titleStyle = { ...type.display, color: color.textPrimary };
const circleNameStyle = { ...type.heading, color: color.sage, fontWeight: "bold" };
const circleChevronStyle = { ...type.heading, color: color.sage };
const circleMenuItemStyle = { ...type.label, color: color.textSecondary };
const circleMenuItemActiveStyle = { ...type.label, color: color.sage, fontWeight: 600 as const };
const emptyStyle = { ...type.body, color: color.textSecondary, fontWeight: "italic",  };
const ctaTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const tabTextStyle = { ...type.caption, color: color.textPrimary };
const tabTextActiveStyle = { ...type.caption, color: color.sage, fontWeight: 600 as const };
const thankedTextStyle = { ...type.label, fontWeight: 600 as const, color: color.textPrimary };

export default function TodayPage() {
  const router = useRouter();
  const { activeCircleId, setActiveCircle, user, circles } = useSession();
  const circleId = activeCircleId!;
  const circleName = circles.find((c) => c.circle_id === circleId)?.name;
  const agreedCircles = circles.filter((c) => c.covenant_agreed);
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);
  const sper = useSper(circleId);
  const care = useCareCards(circleId);
  const share = useShareCards(circleId);
  const toggleLike = useToggleLike(circleId);
  const [selected, setSelected] = useState<SperEntryDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'responded'>('new');

  // One shared slot for both toasts below — a prayer and a thank-you landing
  // in the same poll tick is rare enough that letting the second reset the
  // first's timer is a better tradeoff than two toasts visually overlapping
  // at the same fixed position.
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
  // of how many cards there are (the useQueries contract, not a loop of
  // individual useTouchpoints calls).
  const touchpointQueries = useQueries({
    queries: otherCareCards.map((card) => ({
      queryKey: keys.touchpoints(card.checkin_id),
      queryFn: () => api.touchpoints(card.checkin_id),
      enabled: !!card.checkin_id,
      refetchInterval: 15_000,
    })),
  });

  const pendingCareCards: CareCardDTO[] = [];
  const caredForEntries: Array<{ card: CareCardDTO; actionTypes: TouchpointType[]; actionAt: string | null }> = [];
  otherCareCards.forEach((card, i) => {
    const tpData = touchpointQueries[i]?.data;
    const reached = reachedNames(tpData, user?.id);
    if (reached.includes('You')) {
      const mine = (tpData ?? []).filter((t) => t.responder_id === user?.id);
      const myTypes = mine.map((t) => t.type);
      const myLatestAt = mine.reduce<string | null>(
        (latest, t) => (!latest || t.created_at > latest ? t.created_at : latest),
        null,
      );
      caredForEntries.push({ card, actionTypes: myTypes, actionAt: myLatestAt });
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
    ...caredForEntries.map(({ card, actionTypes, actionAt }) => fromCareCard(card, actionTypes, actionAt)),
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
  // (the viewer already prayed/called/sent something) belongs in "Already
  // responded" the moment it's sent, regardless of like status — liking is
  // for reacting to someone else's share, not a precondition for the
  // viewer's own action to count as done.
  const newShares = othersShare.filter((item) => !item.actionTypes?.length && !item.liked_by_me);
  const respondedShares = othersShare.filter((item) => !!item.actionTypes?.length || item.liked_by_me);
  const showNewSection =
    pendingCareCards.length > 0 || newShares.length > 0 || pendingVoiceNotes.length > 0 || pendingMessages.length > 0;
  const showRespondedSection =
    respondedShares.length > 0 || respondedVoiceNotes.length > 0 || respondedMessages.length > 0;

  return (
    <div className="min-h-full bg-bg">
      <Toast message={toastMessage ?? ''} visible={!!toastMessage} />

      <div className="flex flex-col gap-lg p-lg">
        <div className="relative mb-4">
          <h1 style={titleStyle}>{strings.sper.title}</h1>
          {circleName ? (
            agreedCircles.length > 1 ? (
              <button
                onClick={() => setCircleMenuOpen((o) => !o)}
                aria-expanded={circleMenuOpen}
                className={`flex items-center gap-xs ${PRESSABLE}`}
              >
                <span style={circleNameStyle}>{circleName}</span>
                <span style={circleChevronStyle}>{circleMenuOpen ? '▴' : '▾'}</span>
              </button>
            ) : (
              <p style={circleNameStyle}>{circleName}</p>
            )
          ) : null}

          {circleMenuOpen ? (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setCircleMenuOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-xs flex flex-col gap-xs rounded-md border border-border bg-surface p-xs shadow-sm">
                {agreedCircles.map((c) => {
                  const active = c.circle_id === circleId;
                  return (
                    <button
                      key={c.circle_id}
                      onClick={() => {
                        setActiveCircle(c.circle_id);
                        setCircleMenuOpen(false);
                      }}
                      aria-pressed={active}
                      className={`whitespace-nowrap rounded-sm px-sm py-xs text-left ${PRESSABLE} ${
                        active ? 'bg-surfaceRaised' : ''
                      }`}
                    >
                      <span style={active ? circleMenuItemActiveStyle : circleMenuItemStyle}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {sper.data && sper.data.length > 0 ? (
          <SperWidget entries={sper.data} currentUserId={user?.id} onSelect={setSelected} />
        ) : (
          <p style={emptyStyle} className="py-xl text-center">
            {strings.sper.empty}
          </p>
        )}

        {/* The one-time "they're grateful for your care" message leads the
            care-card stack — it's the warmest thing here and shouldn't get
            buried below everyone else's cards. */}
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

        {myEntry?.checkin_id ? <MyTree entry={myEntry} onPrayed={flashPrayerToast} /> : null}

        {/* The viewer's own share — nothing to act on, just theirs to watch
            reactions land on, so it sits outside either tab below. */}
        {myShare ? <ShareCard card={myShare} isSelf entry={myEntry} /> : null}

        {showNewSection || showRespondedSection ? (
          <div className="flex flex-col gap-md">
            <div className="flex gap-sm">
              <button
                onClick={() => setActiveTab('new')}
                aria-pressed={activeTab === 'new'}
                className={`flex-1 rounded-md border py-sm text-center ${PRESSABLE} ${
                  activeTab === 'new' ? 'border-sage bg-surfaceRaised' : 'border-border'
                }`}
              >
                <span style={activeTab === 'new' ? tabTextActiveStyle : tabTextStyle}>
                  {strings.sper.newSection} (
                  {pendingCareCards.length + newShares.length + pendingVoiceNotes.length + pendingMessages.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('responded')}
                aria-pressed={activeTab === 'responded'}
                className={`flex-1 rounded-md border py-sm text-center ${PRESSABLE} ${
                  activeTab === 'responded' ? 'border-sage bg-surfaceRaised' : 'border-border'
                }`}
              >
                <span style={activeTab === 'responded' ? tabTextActiveStyle : tabTextStyle}>
                  {strings.sper.respondedSection} (
                  {respondedShares.length + respondedVoiceNotes.length + respondedMessages.length})
                </span>
              </button>
            </div>

            {activeTab === 'new' ? (
              showNewSection ? (
                <>
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
                </>
              ) : (
                <p style={emptyStyle} className="py-lg text-center">
                  {strings.sper.newEmpty}
                </p>
              )
            ) : showRespondedSection ? (
              <>
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
              </>
            ) : (
              <p style={emptyStyle} className="py-lg text-center">
                {strings.sper.respondedEmpty}
              </p>
            )}
          </div>
        ) : null}

        {myEntry?.checkin_id && myEntry.created_at && user ? (
          <NextCheckInCountdown lastCheckInAt={myEntry.created_at} frequency={user.checkin_frequency} />
        ) : null}

        <button
          onClick={() => router.push('/checkin')}
          className={`mt-sm rounded-md bg-sage p-md text-center shadow-sm ${PRESSABLE}`}
        >
          <span style={ctaTextStyle}>
            {myEntry?.checkin_id ? strings.sper.checkInCta : strings.sper.checkInCtaFirst}
          </span>
        </button>
      </div>

      <MemberDetailSheetWithLog
        circleId={circleId}
        entry={selected}
        careCard={selectedCard}
        isSelf={!!selected && selected.user_id === user?.id}
        onPrayed={flashPrayerToast}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

/** A plain confirmation line for "Already responded" — a thanked voice
 * note/message doesn't have notes or likes of its own, just this. */
function ThankedConfirmation({ text }: { text: string }) {
  return (
    <div className="rounded-lg border p-lg shadow-sm" style={{ backgroundColor: color.bg, borderColor: color.sage }}>
      <p style={thankedTextStyle} className="text-center">
        {text}
      </p>
    </div>
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
      touchpoints={touchpoints.data}
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
