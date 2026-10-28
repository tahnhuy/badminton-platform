import { createContext, useContext } from 'react';
import type { PlayerProfile } from './profile-api';
import type { usePlayerProfile } from './use-player-profile';

type OwnProfileState = ReturnType<typeof usePlayerProfile> & {
  isPreview?: boolean;
  avatarUploadEnabled?: boolean;
  saveName?: (fullName: string) => Promise<PlayerProfile>;
  uploadAvatar?: (file: File) => Promise<string>;
};
export const ProfileContext = createContext<OwnProfileState | null>(null);
/** PlayerLayout/header can consume this same state once the live API is mounted. */
export function useOwnPlayerProfile(): OwnProfileState {
  const state = useContext(ProfileContext);
  if (!state) throw new Error('Own profile consumers require ProfileProvider');
  return state;
}
