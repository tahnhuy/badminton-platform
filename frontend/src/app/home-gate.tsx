import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { SessionLoading } from '@/features/auth/session-loading';
import { getRoleHomePath } from './role-home';
import { LazyLandingPage } from './lazy-routes';

/**
 * Index `/` (AUTH-34, frontend.md §4.2): visitors see the public landing page; signed-in users go to their role
 * home and never see it. The forced password change still comes first.
 */
export function HomeGate() {
  const { status, user } = useAuth();
  if (status === 'loading') return <SessionLoading />;
  if (status === 'unauthenticated' || !user) return <LazyLandingPage />;
  if (status === 'passwordChangeRequired') return <Navigate to="/change-password" replace />;
  return <Navigate to={getRoleHomePath(user.role)} replace />;
}
