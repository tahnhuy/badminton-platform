import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { STATUS_LABEL } from '../format';
import type { PlayerRef, TournamentStatus } from '../types';

/** Small building blocks shared by the tournament pages (TRN-07/08). */

const STATUS_TONE: Record<TournamentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  OPEN_FOR_REGISTRATION: 'bg-success-bg text-success',
  REGISTRATION_CLOSED: 'bg-info-bg text-info',
  READY: 'bg-info-bg text-info',
  IN_PROGRESS: 'bg-danger-bg text-danger',
  COMPLETED: 'bg-caution-bg text-caution',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export function StatusPill({ status, onDark = false, className }: { status: TournamentStatus; onDark?: boolean; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
    onDark ? 'bg-primary-foreground/10 text-primary-foreground' : STATUS_TONE[status], className)}>
    {status === 'IN_PROGRESS' && <span aria-hidden="true" className="relative flex size-2">
      <span className="absolute inline-flex size-full rounded-full bg-danger opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-danger" />
    </span>}
    {STATUS_LABEL[status]}
  </span>;
}

export function Chip({ icon: Icon, children, className }: { icon?: LucideIcon; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground', className)}>
    {Icon && <Icon aria-hidden="true" className="size-3.5" />}{children}
  </span>;
}

const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase();

export function PlayerAvatar({ player, size = 'md', className }: { player: Pick<PlayerRef, 'fullName' | 'avatarUrl'>; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = { sm: 'size-7 text-2xs', md: 'size-9 text-xs', lg: 'size-14 text-base' }[size];
  return player.avatarUrl
    ? <img src={player.avatarUrl} alt="" className={cn('shrink-0 rounded-full object-cover ring-2 ring-card', box, className)} />
    : <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-mint font-bold text-brand-forest ring-2 ring-card', box, className)}>{initials(player.fullName)}</span>;
}

export function SeedBadge({ seed, muted = false }: { seed: number | null; muted?: boolean }) {
  return <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-2xs font-extrabold tabular-nums',
    seed === null || muted ? 'bg-muted text-muted-foreground' : 'bg-brand-forest text-brand-lime')}>{seed ?? '–'}</span>;
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn('rounded-2xl border border-border bg-card p-5 shadow-panel sm:p-6', className)}>
    {(title || action) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {title && <h2 className="text-lg font-bold tracking-tight">{title}</h2>}{action}
    </div>}
    {children}
  </section>;
}

export function Notice({ tone = 'info', icon: Icon, children, className }: { tone?: 'info' | 'caution' | 'success' | 'danger'; icon?: LucideIcon; children: ReactNode; className?: string }) {
  const toneClass = { info: 'bg-info-bg text-info', caution: 'bg-caution-bg text-caution', success: 'bg-success-bg text-success', danger: 'bg-danger-bg text-danger' }[tone];
  return <div className={cn('flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm', toneClass, className)}>
    {Icon && <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}<div className="min-w-0">{children}</div>
  </div>;
}

export const sideName = (players: PlayerRef[], teamName: string | null) =>
  teamName ?? (players.length > 0 ? players.map(p => p.fullName).join(' / ') : 'Chờ đối thủ');
