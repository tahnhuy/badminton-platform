import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { AuthUser, SignInPayload, RegisterPayload, ChangePasswordPayload } from './auth-api';
import { authApi } from './auth-api';
import { setAuthErrorHandler } from '../../shared/api/http-client';
import { AuthContext, type AuthStatus, type AuthContextValue } from './auth-context';


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const clearSessionMessage = useCallback(() => {
    setSessionMessage(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
      if (res.data.requiresPasswordChange) {
        setStatus('passwordChangeRequired');
      } else {
        setStatus('authenticated');
      }
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  // Initialize auth state once on mount
  useEffect(() => {
    let mounted = true;
    authApi
      .me()
      .then((res) => {
        if (!mounted) return;
        setUser(res.data);
        setStatus(res.data.requiresPasswordChange ? 'passwordChangeRequired' : 'authenticated');
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Hook into http-client for global 401 and 403 password change handling
  useEffect(() => {
    setAuthErrorHandler((type) => {
      if (type === 'SESSION_INVALID') {
        setUser(null);
        setStatus('unauthenticated');
        setSessionMessage('Your session has expired. Please sign in again.');
      } else if (type === 'PASSWORD_CHANGE_REQUIRED') {
        setStatus('passwordChangeRequired');
      }
    });

    return () => {
      setAuthErrorHandler(null);
    };
  }, []);

  const signIn = useCallback(async (payload: SignInPayload): Promise<AuthUser> => {
    const res = await authApi.signIn(payload);
    setUser(res.data);
    setSessionMessage(null);
    if (res.data.requiresPasswordChange) {
      setStatus('passwordChangeRequired');
    } else {
      setStatus('authenticated');
    }
    return res.data;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthUser> => {
    const res = await authApi.register(payload);
    setUser(res.data);
    setSessionMessage(null);
    setStatus('authenticated');
    return res.data;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await authApi.signOut();
    } catch {
      // Ignore network errors during sign out
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      setSessionMessage(null);
    }
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordPayload): Promise<AuthUser> => {
    const res = await authApi.changePassword(payload);
    setUser(res.data);
    setStatus('authenticated');
    return res.data;
  }, []);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      sessionMessage,
      clearSessionMessage,
      signIn,
      register,
      signOut,
      changePassword,
      refreshUser,
    }),
    [
      status,
      user,
      sessionMessage,
      clearSessionMessage,
      signIn,
      register,
      signOut,
      changePassword,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}
