'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { strings } from '../design/strings';

const TABS = [
  { href: '/today', label: strings.nav.today, glyph: '◔' },
  { href: '/checkin', label: strings.nav.checkIn, glyph: '✎' },
  { href: '/circle', label: strings.nav.circle, glyph: '◎' },
  { href: '/settings', label: strings.nav.settings, glyph: '⚙' },
] as const;

/**
 * Web port of apps/mobile/src/components/TabBar.tsx. The only way to move
 * between the app's destinations. Flat by design — four peers, no nesting —
 * so moving around never feels like leaving "the" app. Ported as real links
 * rather than a local-state switcher so each destination is a real,
 * bookmarkable URL.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-border bg-surface py-sm shadow-md">
      <div className="mx-auto flex w-full max-w-2xl">
        {TABS.map((tab) => {
          const selected = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={selected ? 'page' : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 py-xs"
            >
              <span className={`text-2xl ${selected ? 'text-sage' : 'text-textMuted'}`}>{tab.glyph}</span>
              <span
                className={`text-[13px] ${selected ? 'font-semibold text-sage' : 'text-textMuted'}`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default TabBar;
