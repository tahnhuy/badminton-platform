import type { ReactNode } from 'react';
import type { Person } from '../types';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { AuthorizedImage } from '../../../components/common/AuthorizedImage';
import { cn } from '@/shared/utils/cn';

/** Child `small`/`strong` styling is kept here because unmigrated Social/Matchmaking consumers still pass plain markup. */
export function Notice({ children, error = false, warning = false }: { children: ReactNode; error?: boolean; warning?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={cn(
    'flex flex-col items-start gap-2 rounded-lg p-4 text-sm leading-6 wrap-anywhere [&_small]:block [&_small]:text-xs [&_small]:font-normal',
    error ? 'bg-danger-bg text-danger' : warning ? 'bg-caution-bg text-foreground [&_small]:text-muted-foreground' : 'bg-accent text-foreground [&_small]:text-muted-foreground [&_strong]:text-primary',
  )}>{children}</div>;
}
/** Whitespace-safe: repeated or surrounding spaces must not produce empty initials. */
function initials(name: string | null) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(-2).map(word => [...word][0]).join('').toUpperCase() : 'N';
}
export function AuthorRow({ person, subtitle, children }: { person: Person; subtitle?: string; children?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-3">
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground [&_img]:size-10 [&_img]:object-cover">{person.avatarUrl ? <AuthorizedImage key={person.avatarUrl} src={person.avatarUrl} alt="" /> : initials(person.displayName)}</span>
    <div className="flex min-w-0 flex-1 flex-col"><PlayerProfileButton playerId={person.id} displayName={person.displayName} /><small className="-mt-2 text-xs text-muted-foreground">{subtitle}</small></div>{children}
  </div>;
}
