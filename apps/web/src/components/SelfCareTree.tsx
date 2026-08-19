'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isDistress, type SperEntryDTO } from '@sper/shared-types';
import { Tree } from './Tree';
import * as storage from '../lib/storage';
import { useSendGratitude } from '../api/hooks';
import { useSession } from '../state/session';
import { aggregateState } from '../lib/checkinState';
import { pickVerse } from '../lib/verses';
import { color, type } from '../design/tokens';
import { strings } from '../design/strings';
import { PRESSABLE } from '../design/interaction';

const THANKED_KEY_PREFIX = 'sper.thankedCount.';

// This card's backdrop (treeCardHealthy/treeCardWithered) is a fixed mood
// color in both themes (see those tokens), so unlike the rest of this file
// its text needs to stay light regardless of theme — hence textOption
// instead of the usual theme-tracking textPrimary/textSecondary.
const titleStyle = { ...type.title, color: color.textOption };
const countStyle = { ...type.caption, color: color.textOption, opacity: 0.75 };
const verseStyle = { ...type.body, fontSize: 18, color: color.sage, fontWeight: 600 as const, fontStyle: 'italic' as const, lineHeight: '22px' };
const encourageTextStyle = { ...type.label, color: color.textOption, fontWeight: 600 as const };
// The "Thank you" button's own fill (color.bloom) is fixed regardless of
// theme, same as the sage/bloom CTAs elsewhere — ink matches that pattern.
const thankBtnTextStyle = { ...type.label, color: color.ink, fontWeight: 600 as const };

/**
 * Your own tree, shown whenever you've checked in today. Healthy unless
 * you're distressed AND no one has reached out yet; no action buttons since
 * you can't water your own tree. "Thank you!" is repeatable, since more
 * people may respond later.
 */
export function SelfCareTree({ entry, count }: { entry: SperEntryDTO; count: number }) {
  const { activeCircleId } = useSession();
  const agg = aggregateState(entry);
  const distressed = agg ? isDistress(agg) : false;
  const healthy = !distressed || count > 0;
  const verse = useMemo(() => pickVerse(entry.checkin_id ?? undefined), [entry.checkin_id]);

  const gratitude = useSendGratitude(activeCircleId ?? '', entry.checkin_id ?? '');
  const [justSent, setJustSent] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  // How many touchpoints existed the last time this member said thanks —
  // persisted so an already-thanked batch of care stays quiet across reloads,
  // not just for the current mount. Only a touchpoint count higher than this
  // (someone new reaching out) reopens the "someone cares" prompt.
  const storageKey = `${THANKED_KEY_PREFIX}${entry.checkin_id ?? ''}`;
  const [thankedCount, setThankedCount] = useState(0);
  useEffect(() => {
    if (!entry.checkin_id) return;
    let cancelled = false;
    storage.getItem(storageKey).then((stored) => {
      if (!cancelled && stored) setThankedCount(Number(stored));
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey, entry.checkin_id]);

  const hasNewCare = count > thankedCount;

  const sayThanks = () => {
    gratitude.mutate(undefined, {
      onSuccess: () => {
        setJustSent(true);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setJustSent(false);
          setThankedCount(count);
          void storage.setItem(storageKey, String(count));
        }, 3000);
      },
    });
  };

  return (
    <div
      className="flex flex-col items-center gap-sm rounded-lg border p-lg shadow-lg"
      style={
        healthy
          ? { backgroundColor: color.treeCardHealthy, borderColor: color.treeCardHealthyBorder }
          : { backgroundColor: color.treeCardWithered, borderColor: color.treeCardWitheredBorder }
      }
    >
      <p style={titleStyle} className="self-start">
        {distressed ? strings.care.selfTitle : strings.care.treeTitle}
      </p>
      <Tree healthy={healthy} width={400} />
      {distressed ? (
        count > 0 && (hasNewCare || justSent) ? (
          <>
            <p style={countStyle} className="mt-xs text-center">
              {strings.care.responseCount(count)}
            </p>
            <div
              className="mt-xs rounded-pill border px-md py-sm"
              style={{ backgroundColor: color.bloomSoft, borderColor: color.bloom }}
            >
              <span style={encourageTextStyle}>{strings.care.encouragement}</span>
            </div>
            <button
              onClick={sayThanks}
              disabled={gratitude.isPending}
              aria-label={strings.care.thankYou}
              className={`mt-sm rounded-pill px-lg py-sm shadow-sm ${PRESSABLE}`}
              style={{ backgroundColor: color.bloom }}
            >
              <span style={thankBtnTextStyle}>{justSent ? strings.care.gratitudeSent : strings.care.thankYou}</span>
            </button>
          </>
        ) : (
          <p style={verseStyle} className="mt-xs text-center">
            {verse}
          </p>
        )
      ) : (
        <p style={countStyle} className="mt-xs text-center">
          {strings.care.thrivingCaption}
        </p>
      )}
    </div>
  );
}

export default SelfCareTree;
