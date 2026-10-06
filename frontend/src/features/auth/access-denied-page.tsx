import { Link } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath } from '../../app/role-home';
import { CheckShieldIcon } from '../../components/common/Icons';

export function AccessDeniedPage() {
  const { user, signOut } = useAuth();
  const homePath = user ? getRoleHomePath(user.role) : '/sign-in';

  return (
    <div className="auth-main" style={{ minHeight: '100vh' }}>
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-card-icon auth-card-icon-danger" style={{ margin: '0 auto 16px' }}>
          <CheckShieldIcon size={22} />
        </div>
        <h1 className="auth-title">Access Denied</h1>
        <p className="auth-subtitle" style={{ marginBottom: 24 }}>
          You do not have permission to access this resource. Your current role is{' '}
          <strong>{user?.role || 'Guest'}</strong>.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={homePath} className="auth-btn-primary auth-btn-inline">
            Go to Your Home
          </Link>
          <button type="button" onClick={() => signOut()} className="auth-btn-secondary">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
