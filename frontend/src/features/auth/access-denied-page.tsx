import { Link } from 'react-router-dom';
import { useAuth } from './use-auth';
import { getRoleHomePath } from '../../app/role-home';

export function AccessDeniedPage() {
  const { user, signOut } = useAuth();
  const homePath = user ? getRoleHomePath(user.role) : '/sign-in';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            margin: '0 auto 1.5rem',
          }}
        >
          🚫
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' }}>
          Access Denied
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          You do not have permission to access this resource. Your current role is{' '}
          <strong style={{ color: '#38bdf8' }}>{user?.role || 'Guest'}</strong>.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link
            to={homePath}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.25rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'background-color 0.2s',
            }}
          >
            Go to Your Home
          </Link>
          <button
            onClick={() => signOut()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.625rem 1.25rem',
              backgroundColor: 'transparent',
              color: '#94a3b8',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontWeight: 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
