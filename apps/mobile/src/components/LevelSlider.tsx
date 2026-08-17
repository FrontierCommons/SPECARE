import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { color, motion, space, stateVisual, type } from '../design/tokens';
import { levelForScore, SCORE_MIN, SCORE_MAX } from '../lib/checkinState';

interface Props {
  /** Null until the member has actually dragged the thumb once. */
  value: number | null;
  onChange: (value: number) => void;
}

const TRACK_HEIGHT = 12;
const THUMB_SIZE = 28;

const pct = (v: number) => (v - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);

/** Solid at the center of each band, fading through the gap between one
 * band's edge and the next (e.g. 3 → 4) — the transition itself reads as
 * the metaphor, weather easing from one condition into another. */
const GRADIENT_STOPS: readonly [number, string][] = [
  [pct(1), stateVisual['In the Pit'].color],
  [pct(3), stateVisual['In the Pit'].color],
  [pct(4), stateVisual.Heavy.color],
  [pct(5), stateVisual.Heavy.color],
  [pct(6), stateVisual.Steady.color],
  [pct(8), stateVisual.Steady.color],
  [pct(9), stateVisual.Thriving.color],
  [pct(10), stateVisual.Thriving.color],
];

/** A 1–10 drag slider standing in for the four-button picker in the
 * check-in's "explain in your own words" flow, so a score can land between
 * two states instead of snapping to one. Built on PanResponder + Animated +
 * react-native-svg (all already in use elsewhere in the app) rather than a
 * native slider dependency, so it ships without an EAS rebuild. */
export function LevelSlider({ value, onChange }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const shown = value ?? Math.round((SCORE_MIN + SCORE_MAX) / 2);
  const level = levelForScore(shown);
  const levelColor = stateVisual[level].color;

  const scoreFromX = (x: number): number => {
    if (trackWidth <= 0) return shown;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    return Math.round(SCORE_MIN + ratio * (SCORE_MAX - SCORE_MIN));
  };

  const animateThumb = (toValue: number) => {
    Animated.spring(thumbScale, { toValue, ...motion.spring.snappy, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        setDragging(true);
        animateThumb(1.2);
        onChange(scoreFromX(evt.nativeEvent.locationX));
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        onChange(scoreFromX(evt.nativeEvent.locationX));
      },
      onPanResponderRelease: () => {
        setDragging(false);
        animateThumb(1);
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        animateThumb(1);
      },
    }),
  ).current;

  const thumbLeft = trackWidth > 0 ? pct(shown) * trackWidth - THUMB_SIZE / 2 : 0;

  return (
    <View style={styles.wrap}>
      {value !== null ? (
        <Text style={[styles.feedback, { color: levelColor }]}>{`${value}/10 — ${stateVisual[level].label}`}</Text>
      ) : (
        <Text style={styles.placeholder}>Slide to show us</Text>
      )}

      <View
        style={styles.trackTouchArea}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        {trackWidth > 0 ? (
          <Svg width={trackWidth} height={TRACK_HEIGHT} style={styles.track}>
            <Defs>
              <LinearGradient id="levelGradient" x1="0" y1="0" x2="1" y2="0">
                {GRADIENT_STOPS.map(([offset, c], i) => (
                  <Stop key={i} offset={offset} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={trackWidth}
              height={TRACK_HEIGHT}
              rx={TRACK_HEIGHT / 2}
              fill="url(#levelGradient)"
            />
          </Svg>
        ) : null}
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: thumbLeft,
                borderColor: dragging ? levelColor : '#FFFFFF',
                backgroundColor: levelColor,
                transform: [{ scale: thumbScale }],
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.endLabels}>
        <Text style={styles.endLabel}>Not well</Text>
        <Text style={styles.endLabel}>Very well</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, width: '100%' },
  feedback: { ...type.label, fontWeight: '600' },
  placeholder: { ...type.caption, color: color.textMuted },
  trackTouchArea: {
    width: '100%',
    height: THUMB_SIZE + 8,
    justifyContent: 'center',
  },
  track: { position: 'absolute', left: 0 },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    borderWidth: 2,
    top: 4,
  },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  endLabel: { ...type.caption, fontSize: 13, fontWeight: '600', color: color.textPrimary },
});

export default LevelSlider;
