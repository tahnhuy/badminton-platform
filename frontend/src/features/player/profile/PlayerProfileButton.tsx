import { useState } from 'react';
import { PlayerProfileModal } from './PlayerProfileModal';
import './profile.css';

interface PlayerProfileButtonProps { playerId: number | null; displayName: string | null; showAvatar?: boolean }
export function PlayerProfileButton({ playerId, displayName, showAvatar }: PlayerProfileButtonProps) {
  const [open, setOpen] = useState(false);
  const name = displayName ?? (playerId ? `Người chơi #${playerId}` : 'Người chơi');
  if (playerId === null) return <span>{name}</span>;
  return <><button type="button" className="public-profile-trigger" onClick={() => setOpen(true)} aria-label={`Xem hồ sơ ${name}`}>
    {showAvatar && <span className="public-profile-initial" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}
    <span>{name}</span>
  </button>{open && <PlayerProfileModal playerId={playerId} onClose={() => setOpen(false)} />}</>;
}
