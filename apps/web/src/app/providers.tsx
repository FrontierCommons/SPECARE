'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from '../state/session';
import { ThemeProvider } from '../state/theme';
import { RootGate } from '../components/RootGate';
import { ClickFeedback } from '../components/ClickFeedback';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <ClickFeedback />
          <RootGate>{children}</RootGate>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
