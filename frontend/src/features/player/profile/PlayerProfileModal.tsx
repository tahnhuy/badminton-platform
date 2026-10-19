import { useEffect, useId } from 'react';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { usePlayerProfile } from './use-player-profile';
import { PlayerProfileCard } from './PlayerProfileCard';

interface PlayerProfileModalProps { playerId: number; onClose: () => void }
export function PlayerProfileModal({ playerId, onClose }: PlayerProfileModalProps) {
  const { profile, loading, error, retry } = usePlayerProfile(playerId);
  const titleId = useId();
  useEffect(() => {
    const trigger = document.activeElement;
    return () => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  const ref = useModalA11y<HTMLDivElement>(true, onClose);
  return <div className="profile-backdrop" onClick={onClose}>
    <div className="profile-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
      tabIndex={-1} onClick={event => event.stopPropagation()}>
      <div className="profile-actions"><h2 id={titleId}>Hồ sơ người chơi</h2><button onClick={onClose}>Đóng</button></div>
      {loading && <p role="status">Đang tải hồ sơ…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={retry}>Thử lại</button></div>}
      {profile && <PlayerProfileCard profile={profile} />}
    </div>
  </div>;
}
