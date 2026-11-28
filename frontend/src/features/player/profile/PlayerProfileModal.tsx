import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '../../auth/use-auth';
import { messagingApi, openGlobalChatDock } from '../../messaging/services/messaging-api';
import { messagingErrorMessage } from '../../messaging/utils/messages';
import { usePlayerProfile } from './use-player-profile';
import { ProfileTournaments } from '../../tournaments/components/ProfileTournaments';
import { PlayerProfileCard } from './PlayerProfileCard';

interface PlayerProfileModalProps {
  playerId: number;
  onClose: () => void;
}

/** Preserve the previous dialog's reverse-Tab behavior when focus starts on the content itself. */
function handleInitialReverseTab(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'Tab' || !event.shiftKey || event.target !== event.currentTarget) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.offsetParent !== null);
  if (controls.length) { event.preventDefault(); controls.at(-1)?.focus(); }
}

export function PlayerProfileModal({ playerId, onClose }: PlayerProfileModalProps) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, loading, error, retry } = usePlayerProfile(playerId);
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    const trigger = document.activeElement;
    return () => {
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  const handleMessageClick = async () => {
    setOpeningChat(true);
    setChatError(null);
    try {
      const conv = await messagingApi.openOrCreateDirectConversation(playerId);
      onClose();
      if (location.pathname.startsWith('/messages')) {
        navigate(`/messages/${conv.id}`);
      } else {
        openGlobalChatDock(conv.id);
      }
    } catch (err) {
      setOpeningChat(false);
      setChatError(messagingErrorMessage(err, 'Không thể mở cuộc trò chuyện với người chơi này.'));
    }
  };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showClose={false} aria-labelledby={titleId} className="max-h-[85svh] max-w-2xl overflow-y-auto"
      onKeyDown={handleInitialReverseTab}
      onOpenAutoFocus={event => { event.preventDefault(); if (event.target instanceof HTMLElement) event.target.focus(); }}
      onCloseAutoFocus={event => event.preventDefault()}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <DialogTitle id={titleId}>Hồ sơ người chơi</DialogTitle>
        <div className="flex gap-2">
          {user?.role === 'PLAYER' && user.id !== playerId && <Button type="button" variant="brand" disabled={openingChat} onClick={handleMessageClick}>{openingChat ? 'Đang mở...' : 'Nhắn tin'}</Button>}
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </div>
      <DialogDescription className="sr-only">Thông tin hồ sơ công khai của người chơi.</DialogDescription>
      {chatError && <Alert variant="destructive" className="mb-4">{chatError}</Alert>}
      {loading && <p role="status" className="py-5 text-sm text-muted-foreground">Đang tải hồ sơ…</p>}
      {error && <div role="alert" className="rounded-lg bg-danger-bg p-4 text-sm text-danger"><p>{error}</p><Button variant="outline" className="mt-3" onClick={retry}>Thử lại</Button></div>}
      {profile && <PlayerProfileCard profile={profile} />}
      {profile && <div className="mt-4"><ProfileTournaments playerId={profile.userId} compact /></div>}
    </DialogContent>
  </Dialog>;
}
