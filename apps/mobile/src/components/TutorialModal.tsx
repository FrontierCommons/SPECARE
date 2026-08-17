import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { CheckInDimension, StateLevel } from '@sper/shared-types';
import { Avatar } from './Avatar';
import { ChatBubble } from './ChatBubble';
import { StateBadge } from './StateBadge';
import { Tree } from './Tree';
import { Touchable } from './Touchable';
import { DIMENSIONS } from '../lib/checkinState';
import { color, radius, space, stateVisual, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  /** Called when the user taps Skip, at any step. */
  onSkip: () => void;
  /** Called after the last step's primary button. */
  onFinish: () => void;
}

const STEPS = strings.tutorial.steps;

/**
 * Four-step first-run walkthrough: the circle's dimension rings, the daily
 * check-in, the Care Card's states, and taking action to keep a tree green.
 * Each step pairs its explanation with a small non-interactive mockup built
 * from real building blocks (Avatar, ChatBubble, StateBadge) so it shows
 * what the feature actually looks like, not just a description of it.
 * Reused as-is from Settings ("View tutorial again") and from first sign-in
 * — only what happens on skip/finish differs, and that's left to the caller.
 */
export function TutorialModal({ onSkip, onFinish }: Props) {
  const [step, setStep] = useState(0);
  const total = STEPS.length;
  const isLast = step === total - 1;
  const current = STEPS[step]!;

  const next = () => (isLast ? onFinish() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <Modal visible animationType="slide" onRequestClose={onSkip}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.progress}>{strings.tutorial.progress(step + 1, total)}</Text>
          <Touchable onPress={onSkip} accessibilityRole="button">
            <Text style={styles.skip}>{strings.tutorial.skip}</Text>
          </Touchable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{current.title}</Text>
          {step === 0 ? <CircleExample /> : null}
          {step === 1 ? <CheckInExample /> : null}
          {step === 2 ? <CareCardExample /> : null}
          {step === 3 ? <Tree healthy width={220} /> : null}
          <Text style={styles.stepBody}>{current.body}</Text>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === step ? color.sage : color.border }]} />
            ))}
          </View>
          <View style={styles.buttons}>
            {step > 0 ? (
              <Touchable style={styles.backBtn} onPress={back} accessibilityRole="button">
                <Text style={styles.backText}>{strings.tutorial.back}</Text>
              </Touchable>
            ) : null}
            <Touchable style={styles.nextBtn} onPress={next} accessibilityRole="button">
              <Text style={styles.nextText}>{isLast ? strings.tutorial.done : strings.tutorial.next}</Text>
            </Touchable>
          </View>
        </View>
      </View>
    </Modal>
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
    <View style={styles.exampleWrap}>
      <View style={styles.orbRow}>
        <ExampleOrb name="You" states={mine} />
        <ExampleOrb name="Alex" states={friend} />
      </View>
      <ColorLegend />
    </View>
  );
}

/** What each of the four state colors means — shared by the circle-ring step
 * and the check-in step, since the check-in's "add your own words" picker
 * shows these same colors with no label attached. */
function ColorLegend() {
  return (
    <View style={styles.legend}>
      {(Object.entries(stateVisual) as [StateLevel, { color: string; icon: string; label: string }][]).map(
        ([level, v]) => (
          <View key={level} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: v.color }]} />
            <View>
              <Text style={styles.legendLabel}>{v.label}</Text>
              <Text style={styles.legendDesc}>{strings.tutorial.colorMeaning[level]}</Text>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const ORB_SIZE = 100;
const ORB_STROKE = 10;
const ORB_GAP_DEG = 10; // matches MemberOrb's gap
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
    <View style={styles.exampleOrbWrap}>
      <View style={styles.exampleOrbBox}>
        <Svg width={ORB_SIZE} height={ORB_SIZE} style={styles.exampleOrbSvg}>
          {DIMENSIONS.map((dim, i) => {
            const rotation = -90 + i * ORB_SEGMENT_DEG + ORB_GAP_DEG / 2;
            return (
              <Circle
                key={dim}
                cx={ORB_SIZE / 2}
                cy={ORB_SIZE / 2}
                r={ORB_RADIUS}
                stroke={stateVisual[states[dim]].color}
                strokeWidth={ORB_STROKE}
                strokeDasharray={ORB_DASH}
                strokeLinecap="butt"
                fill="none"
                rotation={rotation}
                origin={`${ORB_SIZE / 2}, ${ORB_SIZE / 2}`}
              />
            );
          })}
        </Svg>
        <Avatar name={name} size={ORB_AVATAR_SIZE} />
      </View>
      <Text style={styles.orbName}>{name}</Text>
    </View>
  );
}

/** A mock of the check-in chat: the bot's question plus the four tappable
 * state options, with one shown mid-pick so it reads as an in-progress
 * answer rather than a static legend. */
function CheckInExample() {
  return (
    <View style={styles.checkInExample}>
      <ChatBubble from="bot" text={strings.checkIn.botQuestion('emotional')} />
      <View style={styles.checkInOptions}>
        {(['Thriving', 'Steady', 'Heavy', 'In the Pit'] as StateLevel[]).map((state) => (
          <StateBadge key={state} state={state} selected={state === 'Steady'} compact />
        ))}
      </View>
      <ColorLegend />
    </View>
  );
}

/** A static mock of the Care Card someone sees for a friend who's Heavy or
 * In the Pit — same layout and copy as the real component, just with
 * example data and non-functional buttons. */
function CareCardExample() {
  return (
    <View style={styles.cardExample}>
      <Text style={styles.cardTitle}>{strings.care.cardTitle('Alex')}</Text>
      <View style={styles.cardChip}>
        <Text style={styles.cardChipText}>Emotional</Text>
      </View>
      <View style={{ gap: space.xs }}>
        <View style={[styles.cardAction, styles.cardActionPrimary]}>
          <Text style={styles.cardActionPrimaryText}>{strings.care.sendVoiceNote}</Text>
        </View>
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>{strings.care.sendMessage}</Text>
        </View>
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>{strings.care.pray}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg },
  progress: { ...type.caption, color: color.textMuted },
  skip: { ...type.label, color: color.textMuted },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  title: { ...type.title, fontSize: 26, color: color.textPrimary, textAlign: 'center' },
  stepBody: { ...type.body, fontSize: 16, color: color.textSecondary, textAlign: 'center' },
  footer: { gap: space.md, padding: space.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  backBtn: {
    minWidth: 110,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  backText: { ...type.label, fontSize: 16, color: color.sage },
  nextBtn: {
    minWidth: 110,
    borderRadius: radius.md,
    backgroundColor: color.sage,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  nextText: { ...type.label, fontSize: 16, color: color.bg, fontWeight: '600' },
  exampleWrap: { alignItems: 'center', gap: space.md },
  orbRow: { flexDirection: 'row', gap: space.xl },
  exampleOrbWrap: { width: ORB_SIZE, alignItems: 'center', gap: space.xs },
  exampleOrbBox: { width: ORB_SIZE, height: ORB_SIZE, alignItems: 'center', justifyContent: 'center' },
  exampleOrbSvg: { position: 'absolute', left: 0, top: 0 },
  orbName: { ...type.caption, color: color.textSecondary },
  legend: { width: '100%', maxWidth: 320, gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendDot: { width: 32, height: 32, borderRadius: 16 },
  legendLabel: { ...type.label, fontWeight: '600', color: color.textPrimary },
  legendDesc: { ...type.caption, color: color.textMuted },
  checkInExample: { width: '100%', maxWidth: 340, gap: space.sm },
  checkInOptions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  cardExample: {
    width: '100%',
    maxWidth: 340,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    padding: space.lg,
    gap: space.sm,
  },
  cardTitle: { ...type.label, fontSize: 17, color: color.textPrimary },
  cardChip: {
    alignSelf: 'flex-start',
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.pill,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
  },
  cardChipText: { ...type.caption, color: color.amber },
  cardAction: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.sm,
    alignItems: 'center',
  },
  cardActionPrimary: { backgroundColor: color.sage, borderColor: color.sage },
  cardActionText: { ...type.label, color: color.textPrimary },
  cardActionPrimaryText: { ...type.label, color: color.bg, fontWeight: '600' },
});

export default TutorialModal;
