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
import { Toast } from '../../../components/Toast';
import { useNewPrayerAlert } from '../../../lib/useNewPrayerAlert';
import { reachedNames } from '../../../lib/touchpoints';
import { fromCareCard, fromShareCard, hasShareableContent, type ShareableNote } from '../../../lib/shareable';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const titleStyle = { ...type.display, color: color.textPrimary };
const circleNameStyle = { ...type.heading, color: color.sage, fontWeight: "bold" };
const emptyStyle = { ...type.body, color: color.textSecondary, fontWeight: "italic",  };
const ctaTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const tabTextStyle = { ...type.caption, color: color.textPrimary };
const tabTextActiveStyle = { ...type.caption, color: color.sage, fontWeight: 600 as const };

export default function TodayPage() {
  const router = useRouter();
  const { activeCircleId, user, circles } = useSession();
  const circleId = activeCircleId!;
  const circleName = circles.find((c) => c.circle_id === circleId)?.name;
  const sper = useSper(circleId);
  const care = useCareCards(circleId);
  const share = useShareCards(circleId);
  const toggleLike = useToggleLike(circleId);
  const [selected, setSelected] = useState<SperEntryDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'new' | 'responded'>('new');

  const [prayerToastVisible, setPrayerToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashPrayerToast = useCallback(() => {
    setPrayerToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setPrayerToastVisible(false), 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const myEntry = useMemo(() => sper.data?.find((e) => e.user_id === user?.id) ?? null, [sper.data, user]);

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
  const caredForCareCards: CareCardDTO[] = [];
  otherCareCards.forEach((card, i) => {
    const reached = reachedNames(touchpointQueries[i]?.data, user?.id);
    (reached.includes('You') ? caredForCareCards : pendingCareCards).push(card);
  });

  // What the viewer sees as "something special": their own share (whichever
  // kind their latest check-in produced), then everyone else's — either a
  // genuinely all-positive check-in, or the leftover notes on one they've
  // already cared for.
  const myShare: ShareableNote | null = myCareCard
    ? fromCareCard(myCareCard)
    : share.data?.find((c) => c.target_user_id === user?.id)
      ? fromShareCard(share.data.find((c) => c.target_user_id === user?.id)!)
      : null;
  const othersShare: ShareableNote[] = [
    ...caredForCareCards.map(fromCareCard),
    ...(share.data ?? []).filter((c) => c.target_user_id !== user?.id).map(fromShareCard),
  ].filter(hasShareableContent);

  // "New" groups everything that still wants something from the viewer —
  // an action on a Care Card, or just a first reaction to a share they
  // haven't liked yet. "Already responded" is the once-liked shares, kept
  // around instead of vanishing so the viewer can see they followed through.
  const newShares = othersShare.filter((item) => !item.liked_by_me);
  const respondedShares = othersShare.filter((item) => item.liked_by_me);
  const showNewSection = pendingCareCards.length > 0 || newShares.length > 0;
  const showRespondedSection = respondedShares.length > 0;

  return (
    <div className="min-h-full bg-bg">
      <Toast message={strings.care.prayerToast} visible={prayerToastVisible} />

      <div className="flex flex-col gap-lg p-lg">
        <div className="mb-4">
          <h1 style={titleStyle}>{strings.sper.title}</h1>
          {circleName ? <p style={circleNameStyle}>{circleName}</p> : null}
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

        {myEntry?.checkin_id ? (
          <>
            <MyVoiceNotes checkinId={myEntry.checkin_id} />
            <MyTree entry={myEntry} onPrayed={flashPrayerToast} />
          </>
        ) : null}

        {/* The viewer's own share — nothing to act on, just theirs to watch
            reactions land on, so it sits outside either tab below. */}
        {myShare ? <ShareCard card={myShare} isSelf /> : null}

        {showNewSection || showRespondedSection ? (
          <div className="flex flex-col gap-md">
            <div className="flex gap-sm">
              <button
                onClick={() => setActiveTab('new')}
                aria-pressed={activeTab === 'new'}
                className={`flex-1 rounded-md border py-sm text-center ${
                  activeTab === 'new' ? 'border-sage bg-surfaceRaised' : 'border-border'
                }`}
              >
                <span style={activeTab === 'new' ? tabTextActiveStyle : tabTextStyle}>
                  {strings.sper.newSection} ({pendingCareCards.length + newShares.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('responded')}
                aria-pressed={activeTab === 'responded'}
                className={`flex-1 rounded-md border py-sm text-center ${
                  activeTab === 'responded' ? 'border-sage bg-surfaceRaised' : 'border-border'
                }`}
              >
                <span style={activeTab === 'responded' ? tabTextActiveStyle : tabTextStyle}>
                  {strings.sper.respondedSection} ({respondedShares.length})
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
                      onToggleLike={() => toggleLike.mutate(item.checkin_id)}
                      likePending={toggleLike.isPending}
                    />
                  ))}
                </>
              ) : (
                <p style={emptyStyle} className="py-lg text-center">
                  {strings.sper.newEmpty}
                </p>
              )
            ) : showRespondedSection ? (
              respondedShares.map((item) => (
                <ShareCard
                  key={item.checkin_id}
                  card={item}
                  isSelf={false}
                  onToggleLike={() => toggleLike.mutate(item.checkin_id)}
                  likePending={toggleLike.isPending}
                />
              ))
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
          className="mt-sm rounded-md bg-sage p-md text-center shadow-sm"
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

function MyTree({ entry, onPrayed }: { entry: SperEntryDTO; onPrayed: () => void }) {
  const touchpoints = useTouchpoints(entry.checkin_id!);
  useNewPrayerAlert(touchpoints.data, onPrayed);
  return <SelfCareTree entry={entry} count={touchpoints.data?.length ?? 0} />;
}

/** Any voice notes waiting on the viewer's own check-in — the recording
 * disappears from here for good once they click Received. */
function MyVoiceNotes({ checkinId }: { checkinId: string }) {
  const voiceNotes = useVoiceNotes(checkinId);
  const markReceived = useMarkVoiceNoteReceived(checkinId);
  if (!voiceNotes.data || voiceNotes.data.length === 0) return null;
  return (
    <>
      {voiceNotes.data.map((note) => (
        <VoiceNoteBanner
          key={note.id}
          note={note}
          receiving={markReceived.isPending}
          onReceived={(noteId) => markReceived.mutate(noteId)}
        />
      ))}
    </>
  );
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
  const toggleLike = useToggleLike(circleId);
  const touchpoints = useTouchpoints(checkinId);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  useNewPrayerAlert(isSelf ? touchpoints.data : undefined, onPrayed);
  return (
    <MemberDetailSheet
      entry={entry}
      careCard={careCard}
      isSelf={isSelf}
      alreadyReached={alreadyReached}
      touchpointCount={touchpoints.data?.length ?? 0}
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
      onClose={onClose}
    />
  );
}
