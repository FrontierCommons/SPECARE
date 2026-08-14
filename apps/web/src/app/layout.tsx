import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Display face carries the app's warmth, body stays highly legible — see
// the comment on `type` in design/tokens.ts. Exposed as CSS variables so
// the token objects (used as inline styles all over the app) can reference
// them without every call site importing a font module.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SPER',
};

// Sets data-theme on <html> from localStorage before React hydrates, so a
// visitor who picked "Light" in Settings doesn't see a flash of the dark
// default on reload. Runs as a plain blocking script (not a React effect)
// specifically to execute before first paint; state/theme.tsx's
// ThemeProvider reads the attribute this leaves behind as its own initial
// state, so the two never disagree.
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('sper.theme')==='light'){document.documentElement.dataset.theme='light';}}catch(e){}})();`;

// suppressHydrationWarning below is scoped to just the <html> element (not
// deep) — it exists specifically because THEME_INIT_SCRIPT mutates this
// tag's data-theme attribute before React hydrates, which React would
// otherwise (correctly, but unhelpfully here) flag as a mismatch since its
// own render of this element never mentions that attribute.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
