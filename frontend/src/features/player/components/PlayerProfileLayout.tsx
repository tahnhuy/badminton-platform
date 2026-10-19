import { useAuth } from '../../auth/use-auth';
import { ProfileProvider } from '../profile/ProfileProvider';
import { PlayerLayout } from './PlayerLayout';

/** Scope cached identity to the account and share it across header and Player routes. */
export function PlayerProfileLayout() {
  const { user } = useAuth();
  if (!user) return null;
  return <ProfileProvider key={user.id}><PlayerLayout /></ProfileProvider>;
}
