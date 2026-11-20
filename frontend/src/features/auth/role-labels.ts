import type { SystemRole } from './auth-api';

/** User-facing Vietnamese names of the three system roles. */
export const ROLE_LABELS: Record<SystemRole, string> = {
  PLAYER: 'Người chơi',
  COURT_OWNER: 'Chủ sân',
  ADMIN: 'Quản trị viên',
};
