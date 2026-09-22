export interface AuthUser {
  id: number;
  email: string;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN' | string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
