import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { CareCardDTO, CheckInDimension, SperEntryDTO, TouchpointType } from '@sper/shared-types';
import { color, elevation, radius, space, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { parseCheckInNote } from '../lib/checkinNote';
import { pickEncourageVerse } from '../lib/encourageVerses';
import { ResponderGuidanceBox } from './ResponderGuidanceBox';
import { Touchable } from './Touchable';
import { VoiceRecorderSheet } from './VoiceRecorderSheet';
import { MessageComposerSheet } from './MessageComposerSheet';

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

/**
 * The responder's view when a friend has flagged distress — leads with the
 * person, not the data. Once the viewer acts, the dashboard stops rendering
 * this card and promotes it into a ShareCard instead, so everything here can
 * assume the viewer hasn't acted yet.
 */
export function CareCard({ card, entry, onLogCare, onSendVoiceNote, onSendMessage, alreadyReached }: Props) {
  const selfReached = alreadyReached?.includes('You') ?? false;
  const [recorderVisible, setRecorderVisible] = useState(false);
  const [composerVisible, setComposerVisible] = useState(false);
  // Collapsed by default — these aren't part of what needs a response, so
  // they shouldn't compete for attention with the actions below.
  const [showOtherNotes, setShowOtherNotes] = useState(false);
  // Per-dimension explain text was tagged by dimension name on save, so it
  // can render as that dimension's own answer; anything left over is
  // untagged context.
  const { perDimension, general } = parseCheckInNote(card.optional_note);
  // An explained dimension that isn't Heavy/In the Pit never made it into
  // flagged_dimensions (the server only flags distress) — it still deserves
  // to be shown, just without implying it needs any of the actions below.
  const flaggedSet = new Set(card.flagged_dimensions);
  const explainedButNotFlagged = DIMENSIONS.filter((dim) => perDimension[dim] && !flaggedSet.has(dim));
  const hasOtherNotes = explainedButNotFlagged.length > 0 || !!general;

  if (card.gratitude_shown) {
    return (
      <View style={[styles.card, styles.gratitudeCard]}>
        <Text style={styles.gratitude}>{strings.care.gratitudeReceived(card.target_name)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{strings.care.cardTitle(card.target_name)}</Text>

      <View style={styles.dims}>
        {card.flagged_dimensions.map((d) => {
          const dim = d as CheckInDimension;
          const level = entry ? dimState(entry, dim) : null;
          const answer = perDimension[dim] ?? (level ? strings.checkIn.answerOption(dim, level).label : null);
          const stateColor = level ? stateVisual[level].color : null;
          return (
            <View
              key={d}
              style={[
                styles.dimChip,
                { backgroundColor: stateColor ?? color.surfaceRaised, borderColor: stateColor ?? color.amber },
              ]}
            >
              <Text style={styles.dimText}>
                {strings.checkIn.dimensions[dim]}
                {answer ? `: ${answer}` : ''}
              </Text>
            </View>
          );
        })}
      </View>

      {hasOtherNotes ? (
        <View style={styles.otherNotes}>
          <Touchable
            onPress={() => setShowOtherNotes((v) => !v)}
            accessibilityRole="button"
            style={styles.otherNotesToggle}
          >
            <Text style={styles.toggleText}>{strings.care.otherNotes}</Text>
            <Text style={styles.toggleText}>{showOtherNotes ? '︿' : '﹀'}</Text>
          </Touchable>
          {showOtherNotes ? (
            <View style={{ gap: space.sm }}>
              {explainedButNotFlagged.map((dim) => (
                <Text key={dim} style={styles.neutralAnswer}>
                  {strings.checkIn.dimensions[dim]}: {perDimension[dim]}
                </Text>
              ))}
              {general ? <Text style={styles.note}>{general}</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {!selfReached ? (
        <>
          <ResponderGuidanceBox />
          <View style={styles.actions}>
            <Action label={strings.care.sendVoiceNote} onPress={() => setRecorderVisible(true)} primary />
            <Action label={strings.care.sendMessage} onPress={() => setComposerVisible(true)} />
            <Action label={strings.care.call} onPress={() => onLogCare('CallMade')} />
            <Action label={strings.care.pray} onPress={() => onLogCare('PrayedFor')} />
          </View>
        </>
      ) : null}

      {!selfReached ? <Text style={styles.verse}>{pickEncourageVerse(card.checkin_id)}</Text> : null}

      {alreadyReached && alreadyReached.length > 0 ? (
        <Text style={[styles.reached, selfReached && styles.reachedSelf]}>
          {selfReached ? '✓ ' : ''}
          {strings.care.alreadyReached(alreadyReached.join(', '))}
        </Text>
      ) : null}

      <VoiceRecorderSheet
        visible={recorderVisible}
        onClose={() => setRecorderVisible(false)}
        onSend={onSendVoiceNote}
      />
      <MessageComposerSheet
        visible={composerVisible}
        onClose={() => setComposerVisible(false)}
        onSend={onSendMessage}
      />
    </View>
  );
}

function Action({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.action, primary && styles.actionPrimary]}
    >
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: color.border,
    ...elevation.sm,
  },
  title: { ...type.title, color: color.textPrimary },
  dims: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dimChip: {
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 1,
  },
  dimText: { ...type.caption, color: color.bg, fontWeight: '600' },
  otherNotes: { gap: space.sm },
  otherNotesToggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  toggleText: { ...type.label, color: color.sage },
  neutralAnswer: { ...type.caption, color: color.textSecondary },
  note: { ...type.caption, color: color.amber },
  verse: { ...type.body, fontSize: 15, color: color.sage },
  actions: { gap: space.sm },
  action: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.border,
  },
  actionPrimary: { backgroundColor: color.sage, borderColor: color.sage },
  actionText: { ...type.label, color: color.textPrimary },
  actionTextPrimary: { color: color.bg, fontWeight: '600' },
  reached: { ...type.caption, color: color.textMuted, textAlign: 'center' },
  reachedSelf: { color: color.sage, fontWeight: '600' },
  gratitudeCard: { backgroundColor: color.bloomSoft, borderColor: color.bloom },
  gratitude: { ...type.body, color: color.textPrimary, fontWeight: '600', textAlign: 'center' },
});

export default CareCard;
