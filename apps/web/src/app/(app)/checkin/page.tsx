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
import { DIMENSIONS, dimState, levelForScore } from '../../../lib/checkinState';
import { LevelSlider } from '../../../components/LevelSlider';
import { buildCheckInNote } from '../../../lib/checkinNote';
import { relativeTime } from '../../../lib/time';
import { enqueueCheckIn } from '../../../lib/offlineQueue';
import { color, stateVisual, type } from '../../../design/tokens';
import { strings } from '../../../design/strings';
import { PRESSABLE } from '../../../design/interaction';

type Selections = Partial<Record<CheckInDimension, StateLevel>>;
type Explanations = Partial<Record<CheckInDimension, string>>;

// Steps: 0..4 = one per dimension question, 5 = optional note, 6 = sent.
const NOTE_STEP = DIMENSIONS.length;
const DONE_STEP = DIMENSIONS.length + 1;
const EXPLAIN_MAX_LENGTH = 300;

const titleStyle = { ...type.title, color: color.textPrimary };
const closeGlyphStyle = { ...type.heading, color: color.textMuted };
const optionLabelStyle = { ...type.label, fontSize: type.label.fontSize + 1, fontWeight: 500 as const, color: color.textOption };
const explainOptionTextStyle = { ...type.label, fontWeight: 600 as const, color: color.textPrimary };
const explainPromptStyle = { ...type.caption, color: color.textMuted };
const composerSkipStyle = { ...type.label, color: color.textMuted };
const composerSendTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const primaryTextStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const resultSubtitleStyle = { ...type.caption, color: color.textMuted };
const dimLabelStyle = { ...type.body, color: color.textPrimary, fontWeight: 600 as const };
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
  // Empty when circle-less — useSper/useSubmitCheckIn below both no-op on an
  // empty id, and the early return further down (after all hooks, per Rules
  // of Hooks) shows the no-circle message instead of the check-in flow.
  const circleId = activeCircleId ?? '';
  const sper = useSper(circleId);
  const submit = useSubmitCheckIn(circleId);
  const [sel, setSel] = useState<Selections>({});
  const [explanations, setExplanations] = useState<Explanations>({});
  const [explaining, setExplaining] = useState(false);
  const [explainText, setExplainText] = useState('');
  const [explainScore, setExplainScore] = useState<number | null>(null);
  const explainLevel = explainScore !== null ? levelForScore(explainScore) : null;
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

  if (!activeCircleId) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg p-lg text-center">
        <p style={dimLabelStyle}>{strings.checkIn.noCircle}</p>
      </div>
    );
  }

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
          setExplanations({});
          setExplaining(false);
          setExplainText('');
          setExplainScore(null);
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

  const beginExplain = () => {
    setExplainText('');
    setExplainScore(null);
    setExplaining(true);
  };

  const cancelExplain = () => {
    setExplaining(false);
    setExplainText('');
    setExplainScore(null);
  };

  const sendExplain = () => {
    if (!explainLevel) return;
    const dim = DIMENSIONS[step]!;
    const trimmed = explainText.trim();
    setSel((s) => ({ ...s, [dim]: explainLevel }));
    if (trimmed) setExplanations((e) => ({ ...e, [dim]: trimmed }));
    setExplaining(false);
    setExplainText('');
    setExplainScore(null);
    setStep((s) => s + 1);
  };

  const finish = async (finalNote: string) => {
    // Per-dimension explanations ride along in the same free-text note the
    // circle already sees — no separate field, so each is tagged with which
    // part of life it was about (CareCard parses the tags back out to show
    // each explanation as that dimension's own answer).
    const combinedNote = buildCheckInNote(explanations, finalNote);

    const payload = {
      circle_id: circleId,
      spiritual_state: sel.spiritual!,
      physical_state: sel.physical!,
      emotional_state: sel.emotional!,
      vocational_state: sel.vocational!,
      relational_state: sel.relational!,
      ...(combinedNote ? { optional_note: combinedNote } : {}),
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
        <button onClick={cancel} aria-label={strings.common.cancel} className={`p-xs ${PRESSABLE}`}>
          <span style={closeGlyphStyle}>✕</span>
        </button>
      </div>

      <div ref={transcriptRef} className="flex flex-1 flex-col gap-sm overflow-y-auto py-sm">
        <ChatBubble from="bot" text={strings.checkIn.botIntro} />

        {DIMENSIONS.slice(0, step).map((dim) => (
          <Fragment key={dim}>
            <ChatBubble from="bot" text={strings.checkIn.botQuestion(dim)} />
            <ChatBubble
              from="user"
              nowrap={!explanations[dim]}
              text={explanations[dim] ?? strings.checkIn.answerOption(dim, sel[dim]!).label}
              bubbleColor={stateVisual[sel[dim]!].color}
            />
          </Fragment>
        ))}

        {step < NOTE_STEP ? (
          <>
            <ChatBubble from="bot" text={strings.checkIn.botQuestion(DIMENSIONS[step]!)} />
            {!explaining ? (
              <div className="mt-xs flex flex-col gap-xs">
                {(STATE_LEVELS as readonly StateLevel[]).map((level) => {
                  const opt = strings.checkIn.answerOption(DIMENSIONS[step]!, level);
                  return (
                    <button
                      key={level}
                      onClick={() => answer(DIMENSIONS[step]!, level)}
                      aria-label={opt.label}
                      className={`flex items-center gap-sm rounded-md px-md py-sm ${PRESSABLE}`}
                      style={{ backgroundColor: stateVisual[level].color }}
                    >
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span style={optionLabelStyle} className="whitespace-nowrap">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
                <button
                  onClick={beginExplain}
                  aria-label={strings.checkIn.explainOption.label}
                  className={`flex items-center gap-sm rounded-md border border-border px-md py-sm ${PRESSABLE}`}
                  style={{ backgroundColor: color.surfaceRaised }}
                >
                  <span style={{ fontSize: 20 }}>{strings.checkIn.explainOption.icon}</span>
                  <span style={explainOptionTextStyle} className="whitespace-nowrap">
                    {strings.checkIn.explainOption.label}
                  </span>
                </button>
              </div>
            ) : (
              <div className="mt-xs flex flex-col gap-sm">
                <p style={explainPromptStyle}>{strings.checkIn.explainIntro}</p>
                <textarea
                  autoFocus
                  value={explainText}
                  onChange={(e) => setExplainText(e.target.value.slice(0, EXPLAIN_MAX_LENGTH))}
                  placeholder={strings.checkIn.explainPlaceholder}
                  rows={3}
                  style={{ ...type.body, fontSize: 17, color: color.textPrimary }}
                  className="resize-none rounded-md border border-border bg-surface p-md placeholder:text-textMuted"
                />
                <p style={explainPromptStyle}>{strings.checkIn.explainLevelPrompt}</p>
                <LevelSlider value={explainScore} onChange={setExplainScore} />
                <div className="flex gap-sm">
                  <button
                    onClick={cancelExplain}
                    className={`flex-1 rounded-md border border-border py-sm text-center ${PRESSABLE}`}
                  >
                    <span style={composerSkipStyle}>{strings.checkIn.explainCancel}</span>
                  </button>
                  <button
                    onClick={sendExplain}
                    disabled={!explainLevel}
                    className={`flex-1 rounded-md bg-sage py-sm text-center disabled:opacity-50 ${PRESSABLE}`}
                  >
                    <span style={composerSendTextStyle}>{strings.checkIn.send}</span>
                  </button>
                </div>
              </div>
            )}
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
              className={`rounded-pill bg-sage px-md py-sm ${PRESSABLE}`}
            >
              <span style={composerSendTextStyle}>{strings.checkIn.send}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setNote('');
                void finish('');
              }}
              className={`px-md py-sm ${PRESSABLE}`}
            >
              <span style={composerSkipStyle}>{strings.checkIn.skip}</span>
            </button>
          )}
        </div>
      ) : null}

      {step === DONE_STEP ? (
        <button
          onClick={() => router.push('/today')}
          className={`rounded-md bg-sage p-md text-center shadow-sm ${PRESSABLE}`}
        >
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

        <button onClick={onUpdate} className={`rounded-md bg-sage p-md text-center shadow-sm ${PRESSABLE}`}>
          <span style={primaryTextStyle}>{strings.checkIn.update}</span>
        </button>

        <button onClick={onOpenSettings} className={`py-sm text-center ${PRESSABLE}`}>
          <span style={linkStyle}>{strings.checkIn.changeFrequency}</span>
        </button>
      </div>
    </div>
  );
}
