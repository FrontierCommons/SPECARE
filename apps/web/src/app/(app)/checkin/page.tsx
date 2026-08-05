'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  STATE_LEVELS,
  type StateLevel,
  type CheckInDimension,
  type CheckInFrequency,
  type SperEntryDTO,
} from '@sper/shared-types';
import { useSper, useSubmitCheckIn } from '../../../api/hooks';
import { useSession } from '../../../state/session';
import { ChatBubble } from '../../../components/ChatBubble';
import { StateBadge } from '../../../components/StateBadge';
import { NextCheckInCountdown } from '../../../components/NextCheckInCountdown';
import { DIMENSIONS, dimState } from '../../../lib/checkinState';
import { relativeTime } from '../../../lib/time';
import { enqueueCheckIn } from '../../../lib/offlineQueue';
import { color, stateVisual, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';

type Selections = Partial<Record<CheckInDimension, StateLevel>>;

// Steps: 0..4 = one per dimension question, 5 = optional note, 6 = sent.
const NOTE_STEP = DIMENSIONS.length;
const DONE_STEP = DIMENSIONS.length + 1;

const titleStyle = { ...type.title, color: color.textPrimary };
const closeGlyphStyle = { ...type.heading, color: color.textMuted };
const optionLabelStyle = { ...type.label, fontSize: type.label.fontSize + 2, fontWeight: 700 as const, color: color.bg };
const composerSkipStyle = { ...type.label, color: color.textMuted };
const composerSendTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const resultSubtitleStyle = { ...type.caption, color: color.textMuted };
const dimLabelStyle = { ...type.body, color: color.textSecondary };
const dimEmptyStyle = { ...type.body, color: color.textMuted };
const linkStyle = { ...type.label, color: color.sage };

/**
 * Defaults to showing today's result, not re-prompting a fresh check-in every
 * time the tab opens — the chat flow only runs the first time (nothing to
 * show yet) or when the member explicitly asks to update.
 */
export default function CheckInPage() {
  const router = useRouter();
  const { activeCircleId, user } = useSession();
  const circleId = activeCircleId!;
  const sper = useSper(circleId);
  const submit = useSubmitCheckIn(circleId);
  const [sel, setSel] = useState<Selections>({});
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const myEntry = useMemo(() => sper.data?.find((e) => e.user_id === user?.id) ?? null, [sper.data, user]);
  const hasResult = !!myEntry?.checkin_id;

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [step]);

  // Automatic, not just available — the member's already seen the "sent"
  // confirmation bubble by the time this fires; the Done button below stays
  // as an immediate-exit option for anyone who doesn't want to wait it out.
  useEffect(() => {
    if (step !== DONE_STEP) return;
    const id = setTimeout(() => router.push('/today'), 1500);
    return () => clearTimeout(id);
  }, [step, router]);

  if (sper.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: color.sage, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (hasResult && !updating) {
    return (
      <ResultView
        entry={myEntry!}
        frequency={user!.checkin_frequency}
        onUpdate={() => {
          setSel({});
          setStep(0);
          setNote('');
          setUpdating(true);
        }}
        onOpenSettings={() => router.push('/settings')}
      />
    );
  }

  const answer = (dim: CheckInDimension, level: StateLevel) => {
    setSel((s) => ({ ...s, [dim]: level }));
    setStep((s) => s + 1);
  };

  const finish = async (finalNote: string) => {
    const payload = {
      circle_id: circleId,
      spiritual_state: sel.spiritual!,
      physical_state: sel.physical!,
      emotional_state: sel.emotional!,
      vocational_state: sel.vocational!,
      relational_state: sel.relational!,
      ...(finalNote.trim() ? { optional_note: finalNote.trim() } : {}),
    };
    try {
      await submit.mutateAsync(payload);
    } catch {
      // Spotty data: queue locally and let the user move on.
      await enqueueCheckIn(payload);
    }
    setStep(DONE_STEP);
  };

  // Cancelling falls back to the result view if there is one to fall back
  // to; only a genuinely first-time check-in exits the tab entirely.
  const cancel = () => (hasResult ? setUpdating(false) : router.push('/today'));

  return (
    <div className="flex min-h-full flex-col gap-md bg-bg p-lg">
      <div className="flex items-center justify-between">
        <h1 style={titleStyle}>{strings.checkIn.title}</h1>
        <button onClick={cancel} aria-label={strings.common.cancel} className="p-xs">
          <span style={closeGlyphStyle}>✕</span>
        </button>
      </div>

      <div ref={transcriptRef} className="flex flex-1 flex-col gap-sm overflow-y-auto py-sm">
        <ChatBubble from="bot" text={strings.checkIn.botIntro} />

        {DIMENSIONS.slice(0, step).map((dim) => (
          <Fragment key={dim}>
            <ChatBubble from="bot" text={strings.checkIn.botQuestions[dim]} />
            <ChatBubble from="user" text={sel[dim]!} />
          </Fragment>
        ))}

        {step < NOTE_STEP ? (
          <>
            <ChatBubble from="bot" text={strings.checkIn.botQuestions[DIMENSIONS[step]!]} />
            <div className="mt-xs flex gap-xs">
              {(STATE_LEVELS as readonly StateLevel[]).map((level) => {
                const v = stateVisual[level];
                return (
                  <button
                    key={level}
                    onClick={() => answer(DIMENSIONS[step]!, level)}
                    aria-label={v.label}
                    className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-md"
                    style={{ backgroundColor: v.color }}
                  >
                    <span style={{ fontSize: 22, color: color.bg }}>{v.icon}</span>
                    <span style={optionLabelStyle} className="text-center">
                      {v.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {step === NOTE_STEP ? <ChatBubble from="bot" text={strings.checkIn.botNotePrompt} /> : null}
        {step === DONE_STEP ? (
          <>
            {note.trim() ? <ChatBubble from="user" text={note.trim()} /> : null}
            <ChatBubble from="bot" text={strings.checkIn.botOutro} />
          </>
        ) : null}
      </div>

      {step === NOTE_STEP ? (
        <div className="flex items-center gap-sm">
          <input
            placeholder={strings.checkIn.notePlaceholderShort}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            style={{ ...type.body, fontSize: 17, color: color.textPrimary }}
            className="flex-1 rounded-pill border border-border bg-surface px-md py-sm placeholder:text-textMuted"
          />
          {note.trim() ? (
            <button
              onClick={() => void finish(note)}
              disabled={submit.isPending}
              className="rounded-pill bg-sage px-md py-sm"
            >
              <span style={composerSendTextStyle}>{strings.checkIn.send}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setNote('');
                void finish('');
              }}
              className="px-md py-sm"
            >
              <span style={composerSkipStyle}>{strings.checkIn.skip}</span>
            </button>
          )}
        </div>
      ) : null}

      {step === DONE_STEP ? (
        <button onClick={() => router.push('/today')} className="rounded-md bg-sage p-md text-center shadow-sm">
          <span style={primaryTextStyle}>{strings.checkIn.done}</span>
        </button>
      ) : null}
    </div>
  );
}

/** The default landing view: today's answers, explicitly shown, no re-prompt. */
function ResultView({
  entry,
  frequency,
  onUpdate,
  onOpenSettings,
}: {
  entry: SperEntryDTO;
  frequency: CheckInFrequency;
  onUpdate: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="min-h-full bg-bg p-lg">
      <div className="flex flex-col gap-md">
        <h1 style={titleStyle}>{strings.checkIn.resultTitle}</h1>
        {entry.created_at ? (
          <p style={resultSubtitleStyle}>{strings.checkIn.resultSubtitle(relativeTime(entry.created_at))}</p>
        ) : null}

        <div className="flex flex-col gap-sm rounded-md bg-surface p-md shadow-sm">
          {DIMENSIONS.map((dim) => {
            const st = dimState(entry, dim);
            return (
              <div key={dim} className="flex items-center justify-between">
                <span style={dimLabelStyle}>{strings.checkIn.dimensions[dim]}</span>
                {st ? <StateBadge state={st} compact /> : <span style={dimEmptyStyle}>—</span>}
              </div>
            );
          })}
        </div>

        {entry.created_at ? <NextCheckInCountdown lastCheckInAt={entry.created_at} frequency={frequency} /> : null}

        <button onClick={onUpdate} className="rounded-md bg-sage p-md text-center shadow-sm">
          <span style={primaryTextStyle}>{strings.checkIn.update}</span>
        </button>

        <button onClick={onOpenSettings} className="py-sm text-center">
          <span style={linkStyle}>{strings.checkIn.changeFrequency}</span>
        </button>
      </div>
    </div>
  );
}
