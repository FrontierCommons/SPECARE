'use client';

import { useState } from 'react';
import type { CheckInDimension, StateLevel } from '@sper/shared-types';
import { Avatar } from './Avatar';
import { ChatBubble } from './ChatBubble';
import { StateBadge } from './StateBadge';
import { Tree } from './Tree';
import { DIMENSIONS } from '../lib/checkinState';
import { color, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

interface Props {
  /** Called when the user taps Skip, at any step. */
  onSkip: () => void;
  /** Called after the last step's primary button. */
  onFinish: () => void;
}

const STEPS = strings.tutorial.steps;

const progressTextStyle = { ...type.caption, fontSize: 15, color: color.textMuted };
const skipTextStyle = { ...type.label, fontSize: 18, color: color.textMuted };
const titleStyle = { ...type.title, fontSize: 32, color: color.textPrimary };
const bodyStyle = { ...type.body, fontSize: 21, lineHeight: '32px', color: color.textSecondary };
const primaryTextStyle = { ...type.label, fontSize: 19, color: color.bg, fontWeight: 600 as const };
const backTextStyle = { ...type.label, fontSize: 19, color: color.sage };
const legendLabelStyle = { ...type.caption, fontSize: 14, color: color.textMuted };
const orbNameStyle = { ...type.caption, fontSize: 15, color: color.textSecondary };

/**
 * Four-step first-run walkthrough: the circle's dimension rings, the daily
 * check-in, the Care Card's states, and taking action to keep a tree green.
 * Each step pairs its explanation with a small non-interactive mockup built
 * from the real building blocks (Avatar, ChatBubble, StateBadge) so it shows
 * what the feature actually looks like, not just a description of it.
 * Reused as-is from Settings ("Tutorial" row) and from the pre-timezone
 * onboarding step — only what happens on skip/finish differs, and that's
 * left to the caller.
 */
export function TutorialModal({ onSkip, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const isLast = step === total - 1;
  const current = STEPS[step]!;

  const next = () => (isLast ? onFinish() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="flex items-center justify-between p-lg">
        <span style={progressTextStyle}>{strings.tutorial.progress(step + 1, total)}</span>
        <button onClick={onSkip} className={PRESSABLE}>
          <span style={skipTextStyle}>{strings.tutorial.skip}</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-lg overflow-y-auto px-xl text-center">
        <h2 style={titleStyle}>{current.title}</h2>
        {step === 0 ? <CircleExample /> : null}
        {step === 1 ? <CheckInExample /> : null}
        {step === 2 ? <CareCardExample /> : null}
        {step === 3 ? <Tree healthy width={260} /> : null}
        <p style={bodyStyle}>{current.body}</p>
      </div>

      <div className="flex flex-col gap-md p-lg">
        <div className="flex justify-center gap-sm">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-pill"
              style={{ backgroundColor: i === step ? color.sage : color.border }}
            />
          ))}
        </div>
        <div className="flex justify-center gap-md">
          {step > 0 ? (
            <button
              onClick={back}
              className={`rounded-md border border-border px-xl py-md text-center ${PRESSABLE}`}
              style={{ minWidth: 120 }}
            >
              <span style={backTextStyle}>{strings.tutorial.back}</span>
            </button>
          ) : null}
          <button
            onClick={next}
            className={`rounded-md bg-sage px-xl py-md text-center shadow-sm ${PRESSABLE}`}
            style={{ minWidth: 120 }}
          >
            <span style={primaryTextStyle}>{isLast ? strings.tutorial.done : strings.tutorial.next}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** A believable "after check-in" example: two rings, each split into the
 * five dimensions, colored with a mixed set of example states — exactly
 * what the real dashboard renders, just with made-up data. */
function CircleExample() {
  const mine: Record<CheckInDimension, StateLevel> = {
    spiritual: 'Thriving',
    physical: 'Steady',
    emotional: 'Thriving',
    vocational: 'Steady',
    relational: 'Thriving',
  };
  const friend: Record<CheckInDimension, StateLevel> = {
    spiritual: 'Steady',
    physical: 'Heavy',
    emotional: 'Heavy',
    vocational: 'Steady',
    relational: 'In the Pit',
  };
  return (
    <div className="flex flex-col items-center gap-md">
      <div className="flex gap-xl">
        <ExampleOrb name="You" states={mine} />
        <ExampleOrb name="Alex" states={friend} />
      </div>
      <div className="flex gap-md">
        {Object.values(stateVisual).map((v) => (
          <span key={v.label} className="flex flex-col items-center gap-xs">
            <span className="h-8 w-8 rounded-pill" style={{ backgroundColor: v.color }} />
            <span style={legendLabelStyle}>{v.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const ORB_SIZE = 120;
const ORB_STROKE = 12;
const ORB_GAP_DEG = 8;
const ORB_RADIUS = (ORB_SIZE - ORB_STROKE) / 2;
const ORB_CIRCUMFERENCE = 2 * Math.PI * ORB_RADIUS;
const ORB_SEGMENT_DEG = 360 / DIMENSIONS.length;
const ORB_ARC_DEG = ORB_SEGMENT_DEG - ORB_GAP_DEG;
const ORB_ARC_LEN = (ORB_ARC_DEG / 360) * ORB_CIRCUMFERENCE;
const ORB_DASH = `${ORB_ARC_LEN} ${ORB_CIRCUMFERENCE - ORB_ARC_LEN}`;
const ORB_AVATAR_SIZE = ORB_SIZE - ORB_STROKE * 2 - 8;

/** Standalone stand-in for MemberOrb — that component needs a real
 * SperEntryDTO; this one just needs example colors to teach the shape. */
function ExampleOrb({ name, states }: { name: string; states: Record<CheckInDimension, StateLevel> }) {
  return (
    <div className="flex flex-col items-center gap-xs" style={{ width: ORB_SIZE }}>
      <div className="relative flex items-center justify-center" style={{ width: ORB_SIZE, height: ORB_SIZE }}>
        <svg width={ORB_SIZE} height={ORB_SIZE} className="absolute left-0 top-0">
          {DIMENSIONS.map((dim, i) => {
            const rotation = -90 + i * ORB_SEGMENT_DEG + ORB_GAP_DEG / 2;
            return (
              <circle
                key={dim}
                cx={ORB_SIZE / 2}
                cy={ORB_SIZE / 2}
                r={ORB_RADIUS}
                stroke={stateVisual[states[dim]].color}
                strokeWidth={ORB_STROKE}
                strokeDasharray={ORB_DASH}
                strokeLinecap="round"
                fill="none"
                transform={`rotate(${rotation} ${ORB_SIZE / 2} ${ORB_SIZE / 2})`}
              />
            );
          })}
        </svg>
        <Avatar name={name} size={ORB_AVATAR_SIZE} />
      </div>
      <span style={orbNameStyle}>{name}</span>
    </div>
  );
}

/** A mock of the check-in chat: the bot's question plus the four tappable
 * state options, with one shown mid-pick so it reads as an in-progress
 * answer rather than a static legend. */
function CheckInExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-sm">
      <ChatBubble from="bot" text={strings.checkIn.botQuestion('emotional')} />
      <div className="flex flex-wrap justify-center gap-sm">
        {(['Thriving', 'Steady', 'Heavy', 'In the Pit'] as StateLevel[]).map((state) => (
          <StateBadge key={state} state={state} selected={state === 'Steady'} compact />
        ))}
      </div>
    </div>
  );
}

const cardTitleStyle = { ...type.label, fontSize: 19, color: color.textPrimary };
const cardChipStyle = { ...type.caption, fontSize: 14, color: color.amber };
const cardActionTextStyle = { ...type.label, fontSize: 17, color: color.textPrimary };
const cardActionPrimaryTextStyle = { ...type.label, fontSize: 17, color: color.bg, fontWeight: 600 as const };

/** A static mock of the Care Card someone sees for a friend who's Heavy or
 * In the Pit — same layout and copy as the real component, just with
 * example data and non-functional buttons. */
function CareCardExample() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-sm rounded-lg border border-border bg-surface p-lg text-left shadow-sm">
      <p style={cardTitleStyle}>{strings.care.cardTitle('Alex')}</p>
      <span className="w-fit rounded-pill bg-surfaceRaised px-md py-xs">
        <span style={cardChipStyle}>Emotional</span>
      </span>
      <div className="flex flex-col gap-xs">
        <span className="rounded-md border border-sage bg-sage py-sm text-center">
          <span style={cardActionPrimaryTextStyle}>{strings.care.sendVoiceNote}</span>
        </span>
        <span className="rounded-md border border-border py-sm text-center">
          <span style={cardActionTextStyle}>{strings.care.sendMessage}</span>
        </span>
        <span className="rounded-md border border-border py-sm text-center">
          <span style={cardActionTextStyle}>{strings.care.pray}</span>
        </span>
      </div>
    </div>
  );
}

export default TutorialModal;
