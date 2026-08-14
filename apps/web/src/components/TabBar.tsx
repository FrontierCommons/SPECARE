'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { strings } from '../design/strings';

const TABS = [
  { href: '/today', label: strings.nav.today, glyph: '◔' },
  { href: '/checkin', label: strings.nav.checkIn, glyph: '✎' },
  { href: '/circle', label: strings.nav.circle, glyph: '◎' },
  // U+FE0E forces the flat "text" glyph — without it, some platforms render
  // ⚙ with its emoji presentation (colored), breaking from the other three
  // tabs' plain currentColor-tinted symbols.
  { href: '/settings', label: strings.nav.settings, glyph: '⚙︎' },
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
    <nav className="fixed inset-x-0 bottom-0 z-20 h-[72px] border-t border-border bg-surface shadow-md">
      <div className="mx-auto flex h-full w-full max-w-2xl items-center">
        {TABS.map((tab) => {
          const selected = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={selected ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-xs"
            >
              {selected ? (
                <span className="absolute top-0 h-[2px] w-8 rounded-pill bg-sage" aria-hidden />
              ) : null}
              <span
                className={`text-2xl transition-colors duration-150 ${selected ? 'text-sage' : 'text-textMuted'}`}
              >
                {tab.glyph}
              </span>
              <span
                className={`text-[13px] transition-colors duration-150 ${
                  selected ? 'font-semibold text-sage' : 'text-textMuted'
                }`}
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
