import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share } from 'react-native';
import { useMembers, useCreateInvite } from '../api/hooks';
import { useSession } from '../state/session';
import { api } from '../api/client';
import { Avatar } from '../components/Avatar';
import { Touchable } from '../components/Touchable';
import { JoinOrCreateScreen } from './onboarding/JoinOrCreateScreen';
import { CirclePactScreen } from './onboarding/CirclePactScreen';
import { color, elevation, radius, space, type } from '../design/tokens';
import { strings } from '../design/strings';

type JoinStep = 'closed' | 'join' | 'pact';

export function MyCircleScreen({ onBack, onLeft }: { onBack: () => void; onLeft: () => void }) {
  const { activeCircleId, setActiveCircle, circles, refreshCircles } = useSession();
  const circleId = activeCircleId!;
  const members = useMembers(circleId);
  const invite = useCreateInvite(circleId);
  const [code, setCode] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<JoinStep>('closed');
  const [joiningCircleId, setJoiningCircleId] = useState<string | null>(null);

  const agreedCircles = circles.filter((c) => c.covenant_agreed);

  const makeInvite = async () => {
    const res = await invite.mutateAsync(undefined);
    setCode(res.code);
    try {
      await Share.share({ message: `Join my SPER circle with code: ${res.code}` });
    } catch {
      /* user dismissed share sheet */
    }
  };

  const leave = async () => {
    await api.leaveCircle(circleId);
    // Let the refreshed list pick the next active circle (another one the
    // member already agreed to, or null if that was their last) rather than
    // forcing null and dropping them into onboarding while they still belong
    // to other circles.
    await refreshCircles();
    onLeft();
  };

  if (joinStep === 'join') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Touchable onPress={() => setJoinStep('closed')} accessibilityRole="button">
            <Text style={styles.link}>‹ Back</Text>
          </Touchable>
          <View style={{ width: 44 }} />
        </View>
        <JoinOrCreateScreen
          onJoined={(id) => {
            setJoiningCircleId(id);
            setJoinStep('pact');
          }}
        />
      </View>
    );
  }

  if (joinStep === 'pact' && joiningCircleId) {
    return (
      <CirclePactScreen
        circleId={joiningCircleId}
        onAgreed={async () => {
          await refreshCircles();
          setActiveCircle(joiningCircleId);
          setJoinStep('closed');
          setJoiningCircleId(null);
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Touchable onPress={onBack} accessibilityRole="button">
          <Text style={styles.link}>‹ Back</Text>
        </Touchable>
        <Text style={styles.title}>{strings.circle.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.section}>{strings.circle.yourCircles}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.switcherContent}
      >
        {agreedCircles.map((c) => (
          <Touchable
            key={c.circle_id}
            onPress={() => setActiveCircle(c.circle_id)}
            accessibilityRole="button"
            accessibilityState={{ selected: c.circle_id === circleId }}
          >
            <View style={[styles.chip, c.circle_id === circleId && styles.chipActive]}>
              <Text style={[styles.chipText, c.circle_id === circleId && styles.chipTextActive]}>
                {c.name}
              </Text>
            </View>
          </Touchable>
        ))}
        <Touchable onPress={() => setJoinStep('join')} accessibilityRole="button">
          <View style={styles.chipAdd}>
            <Text style={styles.chipAddText}>{strings.circle.joinAnother}</Text>
          </View>
        </Touchable>
      </ScrollView>

      <Touchable style={styles.inviteBtn} onPress={makeInvite} accessibilityRole="button">
        <Text style={styles.inviteText}>{strings.circle.invite}</Text>
      </Touchable>
      {code ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{strings.circle.inviteBody}</Text>
          <Text style={styles.code}>{code}</Text>
        </View>
      ) : null}

      <Text style={styles.section}>{strings.circle.members}</Text>
      {members.data?.map((m) => (
        <View key={m.user_id} style={styles.member}>
          <View style={styles.memberLeft}>
            <Avatar name={m.name} avatarUrl={m.avatar_url} size={40} />
            <View>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberTz}>{m.timezone}</Text>
            </View>
          </View>
          <Text style={[styles.pact, { color: m.covenant_agreed ? color.sage : color.textMuted }]}>
            {m.covenant_agreed ? strings.circle.pactAgreed : strings.circle.pactPending}
          </Text>
        </View>
      ))}

      <Touchable style={styles.leave} onPress={leave} accessibilityRole="button">
        <Text style={styles.leaveText}>{strings.circle.leave}</Text>
      </Touchable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.title, color: color.textPrimary },
  link: { ...type.label, color: color.sage, width: 44 },
  inviteBtn: { backgroundColor: color.surfaceRaised, borderRadius: radius.md, padding: space.md, alignItems: 'center', borderWidth: 1, borderColor: color.sage, ...elevation.sm },
  inviteText: { ...type.label, color: color.sage },
  codeBox: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, alignItems: 'center', gap: space.xs, ...elevation.sm },
  codeLabel: { ...type.caption, color: color.textSecondary },
  code: { ...type.display, color: color.textPrimary, letterSpacing: 6 },
  section: { ...type.heading, color: color.textPrimary, marginTop: space.md },
  switcherContent: { flexDirection: 'row', gap: space.sm, paddingVertical: space.xs },
  chip: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipActive: { backgroundColor: color.surfaceRaised, borderColor: color.sage },
  chipText: { ...type.label, color: color.textSecondary },
  chipTextActive: { color: color.sage, fontWeight: '600' },
  chipAdd: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.border,
    borderStyle: 'dashed',
  },
  chipAddText: { ...type.label, color: color.textMuted },
  member: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
    ...elevation.sm,
  },
  memberLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  memberName: { ...type.heading, color: color.textPrimary },
  memberTz: { ...type.caption, color: color.textMuted },
  pact: { ...type.caption },
  leave: { padding: space.md, alignItems: 'center', marginTop: space.lg },
  leaveText: { ...type.label, color: color.statePit },
});

export default MyCircleScreen;
