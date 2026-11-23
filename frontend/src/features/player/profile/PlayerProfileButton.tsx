import { useState } from 'react';
import { PlayerProfileModal } from './PlayerProfileModal';
import { Button } from '@/components/ui/button';

interface PlayerProfileButtonProps { playerId: number | null; displayName: string | null; showAvatar?: boolean }
export function PlayerProfileButton({ playerId, displayName, showAvatar }: PlayerProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const name = displayName ?? (playerId ? `Người chơi #${playerId}` : 'Người chơi');
  if (playerId === null) return <span>{name}</span>;
  return <><Button type="button" variant="ghost" className="h-auto min-h-11 min-w-0 justify-start whitespace-normal px-0 text-left font-semibold text-foreground hover:bg-transparent hover:text-primary" onClick={() => setOpen(true)} aria-label={`Xem hồ sơ ${name}`}>
    {showAvatar && <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
    <span>{name}</span>
  </Button>{open && <PlayerProfileModal playerId={playerId} onClose={() => setOpen(false)} />}</>;
}
