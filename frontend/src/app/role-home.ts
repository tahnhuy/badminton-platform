import type { SystemRole } from '../features/auth/auth-api';


export function getRoleHomePath(role: SystemRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'COURT_OWNER':
      return '/owner';
    case 'PLAYER':
    default:
      return '/';
  }
}

/** Whether `path` lies in the area of the app that `role` is allowed to open. */
export function isPathInRoleArea(path: string, role: SystemRole): boolean {
  const inArea = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

  switch (role) {
    case 'ADMIN':
      return inArea('/admin');
    case 'COURT_OWNER':
      return inArea('/owner');
    case 'PLAYER':
    default:
      return !inArea('/admin') && !inArea('/owner');
  }
}
