'use client';

import { useState } from 'react';
import type { CareCardDTO, TouchpointType } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { ResponderGuidanceBox } from './ResponderGuidanceBox';
import { VoiceRecorderSheet } from './VoiceRecorderSheet';
import { openMessage, outreachPrefill } from '../lib/deeplink';

interface Props {
  card: CareCardDTO;
  onLogCare: (type: TouchpointType) => void;
  onSendVoiceNote: (input: { audioBase64: string; mimeType: string; durationMs: number }) => Promise<void>;
  alreadyReached?: string[]; // responder names
}

const titleStyle = { ...type.title, color: color.textPrimary };
const dimTextStyle = { ...type.caption, color: color.amber };
const noteStyle = { ...type.body, color: color.textPrimary, fontStyle: 'italic' as const };
const verseStyle = { ...type.body, fontSize: 16, lineHeight: '22px', color: color.sage };
const actionTextStyle = { ...type.label, color: color.textPrimary };
const actionTextPrimaryStyle = { ...type.label, color: color.bg, fontWeight: 600 as const };
const reachedStyle = { ...type.caption, color: color.textMuted };
const reachedSelfStyle = { ...type.caption, color: color.sage, fontWeight: 600 as const };
const gratitudeStyle = { ...type.body, color: color.textPrimary, fontWeight: 600 as const };

/**
 * The responder's view when a friend has flagged distress. Leads with the
 * person, not the data; every action is off-app or a quiet log.
 */
export function CareCard({ card, onLogCare, onSendVoiceNote, alreadyReached }: Props) {
  const prefill = outreachPrefill(card.target_name);
  const selfReached = alreadyReached?.includes('You') ?? false;
  const [recorderVisible, setRecorderVisible] = useState(false);
  const [showCopiedNotice, setShowCopiedNotice] = useState(false);

  const sendMsg = async () => {
    const outcome = await openMessage(prefill);
    if (outcome === 'cancelled') return;
    onLogCare('TextSent');
    if (outcome === 'copied') {
      setShowCopiedNotice(true);
      setTimeout(() => setShowCopiedNotice(false), 4000);
    }
  };

  if (card.gratitude_shown) {
    return (
      <div
        className="self-center rounded-lg border px-lg py-md shadow-sm"
        style={{ backgroundColor: color.bloomSoft, borderColor: color.bloom, maxWidth: 420 }}
      >
        <p style={gratitudeStyle} className="text-center">
          {strings.care.gratitudeReceived(card.target_name)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-lg shadow-sm">
      <p style={titleStyle}>{strings.care.cardTitle(card.target_name)}</p>

      <div className="flex flex-wrap gap-sm">
        {card.flagged_dimensions.map((d) => (
          <span key={d} className="rounded-pill bg-surfaceRaised px-md py-xs">
            <span style={dimTextStyle}>{labelFor(d)}</span>
          </span>
        ))}
      </div>

      {card.optional_note ? <p style={noteStyle}>&ldquo;{card.optional_note}&rdquo;</p> : null}

      {!selfReached ? (
        <>
          {card.verse ? <p style={verseStyle}>{card.verse}</p> : null}
          <ResponderGuidanceBox />
          <div className="flex flex-col gap-sm">
            <Action label={strings.care.sendVoiceNote} onClick={() => setRecorderVisible(true)} primary />
            <Action label={strings.care.sendMessage} onClick={sendMsg} />
            <Action label={strings.care.pray} onClick={() => onLogCare('PrayedFor')} />
          </div>
        </>
      ) : null}

      {alreadyReached && alreadyReached.length > 0 ? (
        <p style={selfReached ? reachedSelfStyle : reachedStyle} className="text-center">
          {selfReached ? '✓ ' : ''}
          {strings.care.alreadyReached(alreadyReached.join(', '))}
        </p>
      ) : null}

      {showCopiedNotice ? (
        <p style={reachedSelfStyle} className="text-center">
          {strings.care.messageCopied}
        </p>
      ) : null}

      <VoiceRecorderSheet
        visible={recorderVisible}
        onClose={() => setRecorderVisible(false)}
        onSend={onSendVoiceNote}
      />
    </div>
  );
}

function Action({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`rounded-md border py-md text-center ${
        primary ? 'border-sage bg-sage' : 'border-border'
      }`}
    >
      <span style={primary ? actionTextPrimaryStyle : actionTextStyle}>{label}</span>
    </button>
  );
}

function labelFor(dim: string): string {
  const map: Record<string, string> = {
    spiritual: 'Spiritual',
    physical: 'Physical',
    emotional: 'Emotional',
    vocational: 'Career / Life',
    relational: 'Relational',
  };
  return map[dim] ?? dim;
}

export default CareCard;
