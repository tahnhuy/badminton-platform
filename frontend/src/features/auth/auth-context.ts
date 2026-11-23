import { createContext, useContext } from 'react';
import type { AuthUser, SignInPayload, RegisterPayload, ChangePasswordPayload, SkillSurveyResult } from './auth-api';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'passwordChangeRequired';

/** Why the user deliberately ended the session; null when signed in or the session expired. */
export type SignOutReason = 'signedOut' | 'passwordChanged';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  sessionMessage: string | null;
  signOutReason: SignOutReason | null;
  clearSessionMessage: () => void;
  signIn: (payload: SignInPayload) => Promise<AuthUser>;
  /** Creates the Player and session; resolves with the one-time survey result. */
  register: (payload: RegisterPayload) => Promise<SkillSurveyResult>;
  signOut: (reason?: SignOutReason) => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
