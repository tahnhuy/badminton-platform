import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { useAuth } from '../../auth/use-auth';
import { messagingApi } from '../../messaging/services/messaging-api';
import { usePlayerProfile } from './use-player-profile';
import { PlayerProfileCard } from './PlayerProfileCard';

interface PlayerProfileModalProps {
  playerId: number;
  onClose: () => void;
}

export function PlayerProfileModal({ playerId, onClose }: PlayerProfileModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, loading, error, retry } = usePlayerProfile(playerId);
  const [openingChat, setOpeningChat] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const trigger = document.activeElement;
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  const ref = useModalA11y<HTMLDivElement>(true, onClose);

  const handleMessageClick = async () => {
    setOpeningChat(true);
    try {
      const conv = await messagingApi.openOrCreateDirectConversation(playerId);
      onClose();
      navigate(`/messages/${conv.id}`);
    } catch {
      setOpeningChat(false);
    }
  };

  return (
    <div className="profile-backdrop" onClick={onClose}>
      <div
        className="profile-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="profile-actions">
          <h2 id={titleId}>Hồ sơ người chơi</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {user?.role === 'PLAYER' && user.id !== playerId && (
              <button type="button" disabled={openingChat} onClick={handleMessageClick}>
                {openingChat ? 'Đang mở...' : 'Nhắn tin'}
              </button>
            )}
            <button onClick={onClose}>Đóng</button>
          </div>
        </div>
        {loading && <p role="status">Đang tải hồ sơ…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={retry}>Thử lại</button>
          </div>
        )}
        {profile && <PlayerProfileCard profile={profile} />}
      </div>
    </div>
  );
}
