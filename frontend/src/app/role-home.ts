import type { SystemRole } from '../features/auth/auth-api';


export function getRoleHomePath(role: SystemRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'COURT_OWNER':
      return '/owner';
    case 'PLAYER':
    default:
      return '/';
  }
}
