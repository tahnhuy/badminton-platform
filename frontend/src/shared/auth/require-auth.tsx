import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/use-auth';
import type { SystemRole } from '../../features/auth/auth-api';
import { AccessDeniedPage } from '../../features/auth/access-denied-page';


interface RequireAuthProps {
  children?: React.ReactNode;
  allowedRoles?: SystemRole[];
}

export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Loading session...</p>
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
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
