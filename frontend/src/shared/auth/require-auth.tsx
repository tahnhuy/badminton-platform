import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/use-auth';
import type { SystemRole } from '../../features/auth/auth-api';
import { AccessDeniedPage } from '../../features/auth/access-denied-page';
import { SessionLoading } from '../../features/auth/session-loading';

interface RequireAuthProps {
  children?: React.ReactNode;
  allowedRoles?: SystemRole[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { status, user, signOutReason } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionLoading />;
  }

  if (status === 'unauthenticated' || !user) {
    // After a deliberate sign-out the next sign-in starts from the role home, not the page left behind.
    return <Navigate to="/sign-in" state={signOutReason ? undefined : { from: location }} replace />;
  }

  if (status === 'passwordChangeRequired') {
    if (location.pathname !== '/change-password') {
      return <Navigate to="/change-password" replace />;
    }
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return children ? <>{children}</> : null;
}
