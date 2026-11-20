import { motion } from 'motion/react';
import { MessageCircle, Maximize2, X, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/shared/utils/cn';
import { ConversationFilters, ConversationListItem } from './MessagingUi';
import { StartDirectDialog, StartGroupDialog } from './StartConversationDialogs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { ApiError } from '../../../shared/api/http-client';
import { emitMessagingUnreadChanged, messagingApi } from '../services/messaging-api';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import { getHeaderBottomPx, useDraggableBubbleOffset } from '../hooks/useDraggableBubbleOffset';
import { ConversationRoomPane } from './ConversationRoomPane';
import type {
  ConversationItem,
  MessagingWsEnvelope,
  PlayerDisplay,
  PresenceEntry,
} from '../types/messaging.types';

export const GlobalChatDock: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isMessagesRoute = location.pathname.startsWith('/messages');
  const isPlayerAuthenticated = Boolean(user && user.role === 'PLAYER');

  const {
    bottomOffset,
    isDragging,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeWasDragged,
  } = useDraggableBubbleOffset();

  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activeDockConvId, setActiveDockConvId] = useState<number | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD' | 'GROUP'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [presenceMap, setPresenceMap] = useState<Record<number, PresenceEntry>>({});
  const [dockNotice, setDockNotice] = useState<string | null>(null);

  const [lastWsEnvelope, setLastWsEnvelope] = useState<MessagingWsEnvelope | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Quick modals inside dock
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerDisplay[]>([]);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const refreshUnreadAndList = useCallback(async () => {
    if (!isPlayerAuthenticated) return;
    try {
      const [unreadRes, listRes] = await Promise.all([
        messagingApi.getUnreadSummary(),
        messagingApi.listConversations(1, 30),
      ]);
      setTotalUnread(unreadRes.totalUnread);
      setConversations(listRes.data);
    } catch {
      // ignore background error
    } finally {
      setLoadingList(false);
    }
  }, [isPlayerAuthenticated]);

  useEffect(() => {
    if (!isPlayerAuthenticated || isMessagesRoute) return;
    refreshUnreadAndList();
  }, [isPlayerAuthenticated, isMessagesRoute, refreshUnreadAndList]);

  // Listen to custom event `messaging:open-dock` from anywhere in the app (e.g. PlayerProfileModal)
  useEffect(() => {
    const handleOpenDock = (event: Event) => {
      const custom = event as CustomEvent<{ conversationId?: number }>;
      const targetConvId = custom.detail?.conversationId;
      if (location.pathname.startsWith('/messages')) {
        if (targetConvId) navigate(`/messages/${targetConvId}`);
        return;
      }
      setIsOpen(true);
      if (targetConvId) {
        setActiveDockConvId(targetConvId);
      }
      refreshUnreadAndList();
    };
    window.addEventListener('messaging:open-dock', handleOpenDock);
    return () => window.removeEventListener('messaging:open-dock', handleOpenDock);
  }, [location.pathname, navigate, refreshUnreadAndList]);

  const handleWsEvent = useCallback(
    (envelope: MessagingWsEnvelope) => {
      if (envelope.type === 'conversation.read_updated') {
        return;
      }
      setLastWsEnvelope(envelope);
      if (
        envelope.type === 'message.created' ||
        envelope.type === 'message.updated' ||
        envelope.type === 'message.recalled' ||
        envelope.type === 'conversation.member_changed' ||
        envelope.type === 'conversation.updated' ||
        envelope.type === 'conversation.dissolved'
      ) {
        refreshUnreadAndList();
        emitMessagingUnreadChanged();
      } else if (envelope.type === 'presence.updated') {
        const payload = envelope.data as PresenceEntry;
        setPresenceMap((prev) => ({ ...prev, [payload.userId]: payload }));
      }
    },
    [refreshUnreadAndList]
  );

  const handleReconnect = useCallback(() => {
    refreshUnreadAndList();
    emitMessagingUnreadChanged();
    setReconnectTrigger((n) => n + 1);
  }, [refreshUnreadAndList]);

  const { connectionState } = useMessagingSocket({
    enabled: isPlayerAuthenticated && !isMessagesRoute,
    onEvent: handleWsEvent,
    onReconnect: handleReconnect,
  });

  // Player search in modals
  useEffect(() => {
    if (!showDirectModal && !showGroupModal) return;
    messagingApi
      .searchPlayers(playerSearchQuery, 20)
      .then((list) => setPlayerSearchResults(list))
      .catch(() => setPlayerSearchResults([]));
  }, [showDirectModal, showGroupModal, playerSearchQuery]);

  const handleStartDirectChat = async (playerId: number) => {
    setModalSubmitting(true);
    setModalError(null);
    try {
      const conv = await messagingApi.openOrCreateDirectConversation(playerId);
      setShowDirectModal(false);
      await refreshUnreadAndList();
      setActiveDockConvId(conv.id);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Không thể mở cuộc trò chuyện');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupTitleInput.trim() || selectedMemberIds.length === 0) {
      setModalError('Vui lòng nhập tên nhóm và chọn ít nhất 1 thành viên');
      return;
    }
    setModalSubmitting(true);
    setModalError(null);
    try {
      const conv = await messagingApi.createGroupConversation(
        groupTitleInput.trim(),
        selectedMemberIds
      );
      setShowGroupModal(false);
      setGroupTitleInput('');
      setSelectedMemberIds([]);
      await refreshUnreadAndList();
      setActiveDockConvId(conv.id);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Không thể tạo nhóm chat');
    } finally {
      setModalSubmitting(false);
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filterTab === 'UNREAD' && c.unreadCount <= 0) return false;
      if (filterTab === 'GROUP' && c.type !== 'GROUP') return false;
      if (searchQuery.trim()) {
        const displayTitle =
          c.type === 'GROUP'
            ? c.title || 'Nhóm chat'
            : c.counterpart?.fullName || 'Người chơi';
        if (!displayTitle.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, filterTab, searchQuery]);

  const handleCloseDockAnimated = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 165);
  }, []);

  if (!isPlayerAuthenticated || isMessagesRoute) {
    return null;
  }

  const headerBottom = getHeaderBottomPx();
  const maxDockHeight =
    typeof window !== 'undefined'
      ? Math.min(550, window.innerHeight - headerBottom - 30)
      : 550;
  const windowBottom =
    typeof window !== 'undefined'
      ? Math.max(16, Math.min(bottomOffset, window.innerHeight - maxDockHeight - headerBottom - 14))
      : bottomOffset;

  const bubbleStyle = { bottom: bottomOffset };
  const dockStyle = { '--dock-bottom': `${windowBottom}px`, height: maxDockHeight };
  return <>
    {!isOpen ? <motion.button type="button" aria-label="Mở khung tin nhắn nhanh" title="Tin nhắn nhanh (Kéo lên/xuống để đổi vị trí)" className={cn('fixed right-6 z-120 flex size-14 touch-none select-none items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-xl outline-none focus-visible:ring-4 focus-visible:ring-ring/30', isDragging ? 'cursor-grabbing' : 'cursor-grab')} style={bubbleStyle} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} whileHover={isDragging ? undefined : { scale: 1.07 }} whileTap={isDragging ? undefined : { scale: 0.95 }} transition={{ duration: 0.2 }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onClick={() => { if (consumeWasDragged()) return; setLoadingList(true); setIsClosing(false); setIsOpen(true); refreshUnreadAndList(); }}>
      <MessageCircle aria-hidden="true" className="size-6" />{totalUnread > 0 && <span className="absolute -right-1 -top-1 flex min-w-6 items-center justify-center rounded-full border-2 border-card bg-destructive px-1 text-xs font-bold text-destructive-foreground">{totalUnread > 99 ? '99+' : totalUnread}</span>}</motion.button> : <motion.aside aria-label="Khung tin nhắn nhanh" style={dockStyle} className={cn('fixed right-6 bottom-(--dock-bottom) z-125 flex max-h-[calc(100svh-32px)] w-97.5 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl max-[640px]:left-2 max-[640px]:right-2 max-[640px]:bottom-2 max-[640px]:w-auto', isClosing && 'pointer-events-none')} initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={isClosing ? { opacity: 0, scale: 0.97, y: 8 } : { opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.16 }}>
      {activeDockConvId !== null ? <motion.div key={`room-${activeDockConvId}`} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        <ConversationRoomPane key={activeDockConvId} conversationId={activeDockConvId} compact={true} connectionState={connectionState} lastWsEnvelope={lastWsEnvelope} reconnectTrigger={reconnectTrigger} onBackToList={() => { setActiveDockConvId(null); refreshUnreadAndList(); }} onExpandToWorkspace={convId => { setIsOpen(false); setIsClosing(false); navigate(`/messages/${convId}`); }} onCloseDock={handleCloseDockAnimated} onConversationListChanged={refreshUnreadAndList} onConversationRemoved={(_removedId, reasonBanner) => { if (reasonBanner) setDockNotice(reasonBanner); setActiveDockConvId(null); refreshUnreadAndList(); emitMessagingUnreadChanged(); }} />
      </motion.div> : <motion.div key="inbox-list" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-primary" />
              <strong className="text-base">Tin nhắn nhanh</strong>{totalUnread > 0 && <Badge variant="success">{totalUnread}</Badge>}</div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" title="Mở trang Tin nhắn đầy đủ" aria-label="Mở trang Tin nhắn đầy đủ" onClick={() => { setIsOpen(false); setIsClosing(false); navigate('/messages'); }}>
                <Maximize2 aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon" title="Thu gọn thành bong bóng chat" aria-label="Thu gọn thành bong bóng chat" onClick={handleCloseDockAnimated}>
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="px-3" onClick={() => { setPlayerSearchQuery(''); setModalError(null); setShowDirectModal(true); }}>
              <Plus aria-hidden="true" />1-1</Button>
            <Button type="button" className="px-3" onClick={() => { setGroupTitleInput(''); setSelectedMemberIds([]); setPlayerSearchQuery(''); setModalError(null); setShowGroupModal(true); }}>
              <Users aria-hidden="true" />Nhóm</Button>
          </div>
          <Input aria-label="Tìm cuộc trò chuyện" placeholder="Tìm cuộc trò chuyện..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          <ConversationFilters value={filterTab} onChange={setFilterTab} groupLabel="Nhóm" />
        </div>
        {dockNotice && <Alert variant="warning" className="m-3">{dockNotice}<Button type="button" variant="ghost" onClick={() => setDockNotice(null)}>Đóng</Button>
        </Alert>}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">{loadingList ? <p role="status" className="p-4 text-sm text-muted-foreground">Đang tải danh sách...</p> : filteredConversations.length === 0 ? <p className="p-4 text-center text-sm leading-6 text-muted-foreground">Chưa có cuộc trò chuyện nào. Bấm <b>1-1</b> hoặc <b>Nhóm</b> để bắt đầu!</p> : filteredConversations.map(conv =>
          <ConversationListItem key={conv.id} conversation={conv} online={conv.type === 'DIRECT' && !!conv.counterpart && (presenceMap[conv.counterpart.id]?.isOnline ?? conv.counterpart.isOnline)} onClick={() => setActiveDockConvId(conv.id)} />)}</div>
      </motion.div>}
    </motion.aside>}
    <StartDirectDialog open={showDirectModal} onClose={() => setShowDirectModal(false)} query={playerSearchQuery} onQueryChange={setPlayerSearchQuery} players={playerSearchResults} error={modalError} submitting={modalSubmitting} onStart={handleStartDirectChat} />
    <StartGroupDialog open={showGroupModal} onClose={() => setShowGroupModal(false)} query={playerSearchQuery} onQueryChange={setPlayerSearchQuery} players={playerSearchResults} error={modalError} submitting={modalSubmitting} title={groupTitleInput} onTitleChange={setGroupTitleInput} selectedIds={selectedMemberIds} onToggleMember={(id, checked) => setSelectedMemberIds(prev => checked ? prev.filter(value => value !== id) : [...prev, id])} onSubmit={handleCreateGroupSubmit} />
  </>;
};
