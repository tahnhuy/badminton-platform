import type { ReactNode } from 'react';
import { usePlayerProfile } from './use-player-profile';
import { ProfileContext } from './profile-context';

export function ProfileProvider({ children, avatarUploadEnabled = true }: { children: ReactNode; avatarUploadEnabled?: boolean }) {
  const state = usePlayerProfile();
  return <ProfileContext.Provider value={{ ...state, avatarUploadEnabled }}>{children}</ProfileContext.Provider>;
}
