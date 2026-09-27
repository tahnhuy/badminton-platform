export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: SystemRole;
  mustChangePassword?: boolean;
}

export interface AuthenticatedSession {
  id: number;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      authSession?: AuthenticatedSession;
    }
  }
}

