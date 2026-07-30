import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import {
  STATE_LEVELS,
  type StateLevel,
  type CheckInDimension,
  type SperEntryDTO,
} from '@sper/shared-types';
import { useSper, useSubmitCheckIn } from '../api/hooks';
import { useSession } from '../state/session';
import { Touchable } from '../components/Touchable';
import { ChatBubble } from '../components/ChatBubble';
import { StateBadge } from '../components/StateBadge';
import { DIMENSIONS, dimState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import { enqueueCheckIn } from '../lib/offlineQueue';
import { color, elevation, radius, space, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';

type Selections = Partial<Record<CheckInDimension, StateLevel>>;

// Steps: 0..4 = one per dimension question, 5 = optional note, 6 = sent.
const NOTE_STEP = DIMENSIONS.length;
const DONE_STEP = DIMENSIONS.length + 1;

/**
 * Defaults to showing today's result, not re-prompting a fresh check-in every
 * time the tab opens — the chat flow only runs the first time (nothing to
 * show yet) or when the member explicitly asks to update.
 */
export function CheckInSheetScreen({
  onDone,
  onOpenSettings,
  onComplete,
}: {
  onDone: () => void;
  onOpenSettings: () => void;
  /** Called once the member acknowledges a finished check-in (taps Done) — sends them to the dashboard. */
  onComplete: () => void;
}) {
  const { activeCircleId, user } = useSession();
  const circleId = activeCircleId!;
  const sper = useSper(circleId);
  const submit = useSubmitCheckIn(circleId);
  const [sel, setSel] = useState<Selections>({});
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const myEntry = useMemo(
    () => sper.data?.find((e) => e.user_id === user?.id) ?? null,
    [sper.data, user],
  );
  const hasResult = !!myEntry?.checkin_id;

  if (sper.isLoading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={color.sage} />
      </View>
    );
  }

  if (hasResult && !updating) {
    return (
      <ResultView
        entry={myEntry!}
        onUpdate={() => {
          setSel({});
          setStep(0);
          setNote('');
          setUpdating(true);
        }}
        onOpenSettings={onOpenSettings}
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
  const cancel = () => (hasResult ? setUpdating(false) : onDone());

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.checkIn.title}</Text>
        <Touchable
          onPress={cancel}
          accessibilityRole="button"
          accessibilityLabel={strings.common.cancel}
          hitSlop={8}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Touchable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        <ChatBubble from="bot" text={strings.checkIn.botIntro} />

        {DIMENSIONS.slice(0, step).map((dim) => (
          <React.Fragment key={dim}>
            <ChatBubble from="bot" text={strings.checkIn.botQuestions[dim]} />
            <ChatBubble from="user" text={sel[dim]!} />
          </React.Fragment>
        ))}

        {step < NOTE_STEP ? (
          <>
            <ChatBubble from="bot" text={strings.checkIn.botQuestions[DIMENSIONS[step]!]} />
            <View style={styles.options}>
              {(STATE_LEVELS as readonly StateLevel[]).map((level) => {
                const v = stateVisual[level];
                return (
                  <Touchable
                    key={level}
                    onPress={() => answer(DIMENSIONS[step]!, level)}
                    style={styles.option}
                    accessibilityRole="button"
                    accessibilityLabel={v.label}
                  >
                    <View style={[styles.optionIconWrap, { borderColor: v.color }]}>
                      <Text style={[styles.optionIcon, { color: v.color }]}>{v.icon}</Text>
                    </View>
                    <Text
                      style={styles.optionLabel}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {v.label}
                    </Text>
                  </Touchable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === NOTE_STEP ? <ChatBubble from="bot" text={strings.checkIn.botNotePrompt} /> : null}
        {step === DONE_STEP ? (
          <>
            {note.trim() ? <ChatBubble from="user" text={note.trim()} /> : null}
            <ChatBubble from="bot" text={strings.checkIn.botOutro} />
          </>
        ) : null}
      </ScrollView>

      {step === NOTE_STEP ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder={strings.checkIn.notePlaceholderShort}
            placeholderTextColor={color.textMuted}
            value={note}
            onChangeText={setNote}
            maxLength={140}
          />
          <Touchable
            style={styles.composerBtn}
            onPress={() => {
              setNote('');
              void finish('');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.composerSkip}>{strings.checkIn.skip}</Text>
          </Touchable>
          <Touchable
            style={[styles.composerBtn, styles.composerSend]}
            onPress={() => void finish(note)}
            disabled={submit.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.composerSendText}>{strings.checkIn.send}</Text>
          </Touchable>
        </View>
      ) : null}

      {step === DONE_STEP ? (
        <Touchable style={styles.primary} onPress={onComplete} accessibilityRole="button">
          <Text style={styles.primaryText}>{strings.checkIn.done}</Text>
        </Touchable>
      ) : null}
    </View>
  );
}

/** The default landing view: today's answers, explicitly shown, no re-prompt. */
function ResultView({
  entry,
  onUpdate,
  onOpenSettings,
}: {
  entry: SperEntryDTO;
  onUpdate: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.resultContent}>
        <Text style={styles.title}>{strings.checkIn.resultTitle}</Text>
        {entry.created_at ? (
          <Text style={styles.resultSubtitle}>
            {strings.checkIn.resultSubtitle(relativeTime(entry.created_at))}
          </Text>
        ) : null}

        <View style={styles.dims}>
          {DIMENSIONS.map((dim) => {
            const st = dimState(entry, dim);
            return (
              <View key={dim} style={styles.dimRow}>
                <Text style={styles.dimLabel}>{strings.checkIn.dimensions[dim]}</Text>
                {st ? <StateBadge state={st} compact /> : <Text style={styles.dimEmpty}>—</Text>}
              </View>
            );
          })}
        </View>

        <Touchable style={styles.primary} onPress={onUpdate} accessibilityRole="button">
          <Text style={styles.primaryText}>{strings.checkIn.update}</Text>
        </Touchable>

        <Touchable onPress={onOpenSettings} accessibilityRole="button">
          <Text style={styles.link}>{strings.checkIn.changeFrequency}</Text>
        </Touchable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg, padding: space.lg, gap: space.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.title, color: color.textPrimary },
  closeGlyph: { ...type.heading, color: color.textMuted, padding: space.xs },
  transcript: { flex: 1 },
  transcriptContent: { gap: space.sm, paddingVertical: space.sm },
  options: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
  option: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: space.sm,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  optionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIcon: { fontSize: 15 },
  optionLabel: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 13,
    color: color.textPrimary,
    textAlign: 'center',
  },
  composer: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  composerInput: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    color: color.textPrimary,
    ...type.body,
    fontSize: 15,
    borderWidth: 1,
    borderColor: color.border,
  },
  composerBtn: { paddingVertical: space.sm, paddingHorizontal: space.md },
  composerSkip: { ...type.label, color: color.textMuted },
  composerSend: { backgroundColor: color.sage, borderRadius: radius.pill },
  composerSendText: { ...type.label, color: color.bg, fontWeight: '600' },
  primary: { backgroundColor: color.sage, borderRadius: radius.md, padding: space.md, alignItems: 'center', ...elevation.sm },
  primaryText: { ...type.label, color: color.bg, fontWeight: '600' },
  resultContent: { gap: space.md },
  resultSubtitle: { ...type.caption, color: color.textMuted, marginTop: -space.sm },
  dims: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    ...elevation.sm,
  },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dimLabel: { ...type.body, color: color.textSecondary },
  dimEmpty: { ...type.body, color: color.textMuted },
  link: { ...type.label, color: color.sage, textAlign: 'center', paddingVertical: space.sm },
});

export default CheckInSheetScreen;
