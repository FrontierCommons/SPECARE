import { TabBar } from '../../components/TabBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Constrained to a readable column on wide viewports — full-width
          content on a desktop browser reads as oversized boxes around
          phone-sized text; centering it keeps the two proportional. */}
      {/* pb-[72px] reserves space for the now-fixed TabBar so it never
          covers the tail end of scrollable content. */}
      <div className="mx-auto w-full max-w-2xl flex-1 pb-[72px]">{children}</div>
      <TabBar />
    </div>
  );
}
