import type { ReactNode } from 'react';
import type { Person } from '../types';
import { PlayerProfileButton } from '../../player/profile/PlayerProfileButton';
import { AuthorizedImage } from '../../../components/common/AuthorizedImage';

export function Notice({ children, error = false, warning = false }: { children: ReactNode; error?: boolean; warning?: boolean }) {
  return <div className={`social-notice${error ? ' social-error' : warning ? ' social-warning' : ''}`} role={error ? 'alert' : 'status'}>{children}</div>;
}
/** Whitespace-safe: repeated or surrounding spaces must not produce empty initials. */
function initials(name: string | null) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(-2).map(word => [...word][0]).join('').toUpperCase() : 'N';
}
export function AuthorRow({ person, subtitle, children }: { person: Person; subtitle?: string; children?: ReactNode }) {
  return <div className="social-author"><span className="social-avatar">{person.avatarUrl ? <AuthorizedImage key={person.avatarUrl} src={person.avatarUrl} alt="" /> : initials(person.displayName)}</span>
    <div className="social-author-name"><PlayerProfileButton playerId={person.id} displayName={person.displayName} /><small>{subtitle}</small></div>{children}</div>;
}
