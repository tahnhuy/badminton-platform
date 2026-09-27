import { useAuth } from '../features/auth/use-auth';

interface RoleHomeProps {
  title: string;
  roleBadge: string;
  badgeColor: string;
}

function RoleHomePlaceholder({ title, roleBadge, badgeColor }: RoleHomeProps) {
  const { user, signOut } = useAuth();

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
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: '16px',
          padding: '2.5rem',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: `${badgeColor}20`,
              color: badgeColor,
              border: `1px solid ${badgeColor}40`,
            }}
          >
            {roleBadge}
          </span>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' }}>
          {title}
        </h1>

        <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '1.5rem' }}>
          Signed in as <strong style={{ color: '#f8fafc' }}>{user?.email}</strong>
        </p>

        <button
          onClick={() => signOut()}
          style={{
            padding: '0.625rem 1.5rem',
            backgroundColor: '#ef4444',
            color: '#ffffff',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export function PlayerHomePage() {
  return (
    <RoleHomePlaceholder
      title="Player Dashboard"
      roleBadge="Player Account"
      badgeColor="#10b981"
    />
  );
}

export function OwnerHomePage() {
  return (
    <RoleHomePlaceholder
      title="Court Owner Dashboard"
      roleBadge="Court Owner"
      badgeColor="#f59e0b"
    />
  );
}

export function AdminHomePage() {
  return (
    <RoleHomePlaceholder
      title="Administration Control Panel"
      roleBadge="Administrator"
      badgeColor="#8b5cf6"
    />
  );
}
