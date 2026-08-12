'use client';

import { useEffect, useState } from 'react';
import type { CareCardDTO, SperEntryDTO, TouchpointDTO, TouchpointType } from '@sper/shared-types';
import { Avatar } from './Avatar';
import { CareCard } from './CareCard';
import { ShareCard } from './ShareCard';
import { SelfCareTree } from './SelfCareTree';
import { StateBadge } from './StateBadge';
import { DIMENSIONS, dimState, aggregateState } from '../lib/checkinState';
import { relativeTime } from '../lib/time';
import { fromCareCard } from '../lib/shareable';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';

interface Props {
  entry: SperEntryDTO | null;
  careCard?: CareCardDTO;
  /** True when the viewer is looking at their own check-in. */
  isSelf?: boolean;
  /** Names of people who've reached out (any touchpoint type) for this
   * check-in — feeds the Care Card's "already reached out" line. */
  alreadyReached?: string[];
  /** Touchpoints of any kind, for the self-view tree's care count. */
  touchpointCount?: number;
  /** Same touchpoints `touchpointCount` was derived from — feeds the
   * promoted ShareCard's "N people have reached out" relative timestamp. */
  touchpoints?: TouchpointDTO[];
  /** The viewer's own touchpoint type(s) already logged for this check-in —
   * drives the promoted ShareCard's "You [action] X!" title. */
  actionTypes?: TouchpointType[];
  /** When the viewer's most recent action above was logged — shown as a
   * small "X ago" under the promoted ShareCard's title. */
  actionAt?: string | null;
  onLogCare: (type: TouchpointType) => void;
  onSendVoiceNote: (input: { audioBase64: string; mimeType: string; durationMs: number }) => Promise<void>;
  onSendMessage: (body: string) => Promise<void>;
  onToggleLike?: () => void;
  likePending?: boolean;
  onClose: () => void;
}

const nameStyle = { ...type.title, color: color.textPrimary };
const subStyle = { ...type.caption, color: color.textMuted };
const closeGlyphStyle = { ...type.heading, color: color.textMuted };
const dimLabelStyle = { ...type.body, color: color.textSecondary };
const dimEmptyStyle = { ...type.body, color: color.textMuted };

/**
 * The detail view behind every avatar. Always shows the five-dimension
 * breakdown; when the person is Heavy or In the Pit it folds in either the
 * Care Card (viewing a friend — "I prayed" is one tap away) or, for your own
 * check-in, the anonymous tree — you can't act on your own distress here.
 *
 * Web port of apps/mobile/src/components/MemberDetailSheet.tsx: RN's Modal +
 * Animated bottom sheet becomes a fixed-position panel with a CSS transition
 * for the slide-up entrance — no animation library needed for a first
 * tester pass.
 */
export function MemberDetailSheet({
  entry,
  careCard,
  isSelf,
  alreadyReached,
  touchpointCount,
  touchpoints,
  actionTypes,
  actionAt,
  onLogCare,
  onSendVoiceNote,
  onSendMessage,
  onToggleLike,
  likePending,
  onClose,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!entry) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [entry]);

  if (!entry) return null;
  const agg = aggregateState(entry);
  const reached = alreadyReached?.includes('You') ?? false;
  const reachedAt = (touchpoints ?? []).reduce<string | null>(
    (latest, t) => (!latest || t.created_at > latest ? t.created_at : latest),
    null,
  );

  return (
    <div className="fixed inset-0 z-30">
      <button
        aria-label={strings.member.close}
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(10,12,14,0.6)]"
      />
      <div
        className={`absolute bottom-0 left-0 right-0 flex max-h-[82%] flex-col gap-md overflow-y-auto rounded-t-lg border border-border bg-bg p-lg shadow-lg transition-all duration-200 ease-out ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <div className="mb-xs h-1 w-10 self-center rounded-full bg-border" />
        <div className="flex items-center gap-md">
          <Avatar name={entry.name} avatarUrl={entry.avatar_url} size={64} />
          <div className="flex flex-1 flex-col gap-0.5">
            <p style={nameStyle}>{entry.name}</p>
            <p style={subStyle}>
              {entry.created_at ? strings.member.lastCheckIn(relativeTime(entry.created_at)) : strings.member.noCheckIn}
            </p>
          </div>
          <button onClick={onClose} aria-label={strings.member.close} className="p-xs">
            <span style={closeGlyphStyle}>✕</span>
          </button>
        </div>

        <div className="flex flex-col gap-md pb-lg">
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

          {isSelf ? (
            <SelfCareTree entry={entry} count={touchpointCount ?? 0} />
          ) : careCard && (agg === 'Heavy' || agg === 'In the Pit') ? (
            reached ? (
              <ShareCard
                card={fromCareCard(careCard, { actionTypes, actionAt, reachedNames: alreadyReached, reachedAt })}
                isSelf={false}
                entry={entry}
                onToggleLike={onToggleLike}
                likePending={likePending}
              />
            ) : (
              <CareCard
                card={careCard}
                entry={entry}
                onLogCare={onLogCare}
                onSendVoiceNote={onSendVoiceNote}
                onSendMessage={onSendMessage}
                alreadyReached={alreadyReached}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default MemberDetailSheet;
