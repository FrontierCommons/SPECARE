'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CareCardDTO, SperEntryDTO, TouchpointType } from '@sper/shared-types';
import {
  useSper,
  useCareCards,
  useLogTouchpoint,
  useTouchpoints,
  useVoiceNotes,
  useSendVoiceNote,
  useMarkVoiceNoteReceived,
} from '../../../api/hooks';
import { useSession } from '../../../state/session';
import { SperWidget } from '../../../components/SperWidget';
import { CareCard } from '../../../components/CareCard';
import { SelfCareTree } from '../../../components/SelfCareTree';
import { MemberDetailSheet } from '../../../components/MemberDetailSheet';
import { NextCheckInCountdown } from '../../../components/NextCheckInCountdown';
import { VoiceNoteBanner } from '../../../components/VoiceNoteBanner';
import { Toast } from '../../../components/Toast';
import { useNewPrayerAlert } from '../../../lib/useNewPrayerAlert';
import { reachedNames } from '../../../lib/touchpoints';
import { color, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

const titleStyle = { ...type.display, color: color.textPrimary };
const circleNameStyle = { ...type.heading, color: color.sage, fontWeight: "bold" };
const emptyStyle = { ...type.body, color: color.textPrimary };
const ctaTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };

export default function TodayPage() {
  const router = useRouter();
  const { activeCircleId, user, circles } = useSession();
  const circleId = activeCircleId!;
  const circleName = circles.find((c) => c.circle_id === circleId)?.name;
  const sper = useSper(circleId);
  const care = useCareCards(circleId);
  const [selected, setSelected] = useState<SperEntryDTO | null>(null);

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
          .map((card) => <CareCardWithLog key={card.checkin_id} circleId={circleId} card={card} />)}

        {myEntry?.checkin_id ? (
          <>
            <MyVoiceNotes checkinId={myEntry.checkin_id} />
            <MyTree entry={myEntry} onPrayed={flashPrayerToast} />
          </>
        ) : null}

        {care.data
          ?.filter((card) => card.target_user_id !== user?.id)
          // The one-time gratitude flash now renders above, up top; a card
          // that already received (but isn't currently flashing) gratitude
          // has nothing left to show here at all.
          .filter((card) => !card.gratitude_received && !card.gratitude_shown)
          .map((card) => <CareCardWithLog key={card.checkin_id} circleId={circleId} card={card} />)}

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

function CareCardWithLog({ circleId, card }: { circleId: string; card: CareCardDTO }) {
  const { user } = useSession();
  const logCare = useLogTouchpoint(circleId, card.checkin_id);
  const sendVoiceNote = useSendVoiceNote(circleId, card.checkin_id);
  const touchpoints = useTouchpoints(card.checkin_id);
  const alreadyReached = reachedNames(touchpoints.data, user?.id);
  return (
    <CareCard
      card={card}
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
