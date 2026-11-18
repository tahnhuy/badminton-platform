import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SignOutReason } from './auth-context';
import { useAuth } from './use-auth';

/**
 * Ends the current session and opens Sign-in. The reason is kept in the auth context,
 * so the guard drops the saved destination and Sign-in can explain what happened,
 * whichever navigation React commits first.
 */
export function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return useCallback(async (reason: SignOutReason = 'signedOut') => {
    await signOut(reason);
    navigate('/sign-in', { replace: true });
  }, [signOut, navigate]);
}
