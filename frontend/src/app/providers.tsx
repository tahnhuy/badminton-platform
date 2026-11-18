import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/features/auth/auth-provider';
import { queryClient } from './query-client';

interface AppProvidersProps {
  children: ReactNode;
}

/** Application-wide providers. Session state stays in `AuthProvider` (React Context). */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </MotionConfig>
    </QueryClientProvider>
  );
}
