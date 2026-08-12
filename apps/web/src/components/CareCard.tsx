'use client';

import { useState } from 'react';
import type { CareCardDTO, CheckInDimension, SperEntryDTO, TouchpointType } from '@sper/shared-types';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { parseCheckInNote } from '../lib/checkinNote';
import { ResponderGuidanceBox } from './ResponderGuidanceBox';
import { VoiceRecorderSheet } from './VoiceRecorderSheet';
import { MessageComposerSheet } from './MessageComposerSheet';
import { PRESSABLE } from '../design/interaction';

interface Props {
  card: CareCardDTO;
  /** The flagged member's own check-in entry — lets each dimension pill show
   * what they actually answered, not just which part of life it was. */
  entry?: SperEntryDTO | null;
  onLogCare: (type: TouchpointType) => void;
  onSendVoiceNote: (input: { audioBase64: string; mimeType: string; durationMs: number }) => Promise<void>;
  onSendMessage: (body: string) => Promise<void>;
  alreadyReached?: string[]; // responder names
}

const titleStyle = { ...type.title, color: color.textPrimary };
const dimTextStyle = { ...type.caption, color: color.amber };
const neutralAnswerStyle = { ...type.caption, color: color.textSecondary };
const noteStyle = { ...type.caption,color: color.amber };
const verseStyle = { ...type.body, fontSize: 16, lineHeight: '22px', color: color.sage };
const actionTextStyle = { ...type.label, color: color.textPrimary, fontWeight: 600 as const };
const toggleTextStyle = { ...type.label, color: color.sage };
const reachedStyle = { ...type.caption, color: color.textMuted };
const reachedSelfStyle = { ...type.caption, color: color.sage, fontWeight: 600 as const };
const gratitudeStyle = { ...type.body, color: color.textPrimary, fontWeight: 600 as const };

/**
 * The responder's view when a friend has flagged distress. Leads with the
 * person, not the data; every action is off-app or a quiet log.
 *
 * Once the viewer has cared for the flagged part, the caller (today/page.tsx)
 * stops rendering this card at all and promotes its non-distress notes into
 * a ShareCard instead — so everything here assumes the viewer hasn't acted
 * yet, and stays purely informational + collapsed for anything not flagged.
 */
export function CareCard({ card, entry, onLogCare, onSendVoiceNote, onSendMessage, alreadyReached }: Props) {
  const selfReached = alreadyReached?.includes('You') ?? false;
  const [recorderVisible, setRecorderVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  // Collapsed by default — these aren't part of what needs a response, so
  // they shouldn't compete for attention with the actions below.
  const [showOtherNotes, setShowOtherNotes] = useState(false);
  // Per-dimension "I'd rather explain" text was tagged by dimension name when
  // it was saved, so it can be shown as that dimension's own answer instead
  // of a separate note; whatever's left over is genuinely untagged context.
  const { perDimension, general } = parseCheckInNote(card.optional_note);
  // An explained dimension that isn't Heavy/In the Pit never made it into
  // flagged_dimensions (the server only flags distress) — it still deserves
  // to be shown, just without implying it needs any of the actions below.
  const flaggedSet = new Set(card.flagged_dimensions);
  const explainedButNotFlagged = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));
  const hasOtherNotes = explainedButNotFlagged.length > 0 || !!general;

  const sendMessage = async (body: string) => {
    await onSendMessage(body);
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

      <div className="flex flex-col gap-sm">
        {card.flagged_dimensions.map((d) => {
          const dim = d as CheckInDimension;
          const level = entry ? dimState(entry, dim) : null;
          const answer = perDimension[dim] ?? (level ? strings.checkIn.answerOption(dim, level).label : null);
          return (
            <span key={d} className="rounded-pill bg-surfaceRaised px-md py-xs">
              <span style={dimTextStyle}>
                {strings.checkIn.dimensions[dim]}
                {answer ? `: ${answer}` : ''}
              </span>
            </span>
          );
        })}
      </div>

      {hasOtherNotes ? (
        <div className="flex flex-col gap-sm">
          <button
            onClick={() => setShowOtherNotes((v) => !v)}
            className={`flex items-center gap-xs self-start ${PRESSABLE}`}
          >
            <span style={toggleTextStyle}>{strings.care.otherNotes}</span>
            <span style={toggleTextStyle}>{showOtherNotes ? '︿' : '﹀'}</span>
          </button>
          {showOtherNotes ? (
            <div className="flex flex-col gap-sm">
              {explainedButNotFlagged.map((dim) => (
                <p key={dim} style={neutralAnswerStyle}>
                  {strings.checkIn.dimensions[dim]}: {perDimension[dim]}
                </p>
              ))}
              {general ? <p style={noteStyle}>{general}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!selfReached ? (
        <>
          {card.verse ? <p style={verseStyle}>{card.verse}</p> : null}
          <ResponderGuidanceBox />
          <div className="flex flex-col gap-sm">
            <Action label={strings.care.sendVoiceNote} onClick={() => setRecorderVisible(true)} />
            <Action label={strings.care.sendMessage} onClick={() => setComposerVisible(true)} />
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

      <VoiceRecorderSheet
        visible={recorderVisible}
        onClose={() => setRecorderVisible(false)}
        onSend={onSendVoiceNote}
      />
      <MessageComposerSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        onSend={sendMessage}
      />
    </div>
  );
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`rounded-md border border-sage bg-surface py-md text-center ${PRESSABLE}`}
    >
      <span style={actionTextStyle}>{label}</span>
    </button>
  );
}

export default CareCard;
