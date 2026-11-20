import { cn } from '@/shared/utils/cn';
import type { PlayerProfile } from './profile-api';

export function ProfileAvatar({ profile, className }: { profile: Pick<PlayerProfile, 'avatarUrl' | 'fullName'>; className?: string }) {
  const classes = cn('size-24 shrink-0 rounded-full border-4 border-card object-cover shadow-md', className);
  return profile.avatarUrl
    ? <img className={classes} src={profile.avatarUrl} alt={`Ảnh đại diện ${profile.fullName}`} />
    : <div className={cn(classes, 'flex items-center justify-center bg-primary text-3xl font-bold text-primary-foreground')} aria-label="Chưa có ảnh đại diện">{profile.fullName.slice(0, 1).toUpperCase()}</div>;
}
