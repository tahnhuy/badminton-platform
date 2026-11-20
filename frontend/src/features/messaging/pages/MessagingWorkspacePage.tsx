import { MessageCircle, Plus, Users, ShieldBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/shared/utils/cn';
import { ConversationFilters, ConversationListItem } from '../components/MessagingUi';
import { StartDirectDialog, StartGroupDialog } from '../components/StartConversationDialogs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../../shared/api/http-client';
import { emitMessagingUnreadChanged, messagingApi } from '../services/messaging-api';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import { ConversationRoomPane } from '../components/ConversationRoomPane';
import type {
  ConversationItem,
  MessagingWsEnvelope,
  PlayerDisplay,
  PresenceEntry,
} from '../types/messaging.types';

export const MessagingWorkspacePage: React.FC = () => {
  const navigate = useNavigate();
  const { conversationId: paramConvId } = useParams<{ conversationId?: string }>();
  const activeConvId = paramConvId ? Number(paramConvId) : null;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD' | 'GROUP'>('ALL');
  const [listFilterQuery, setListFilterQuery] = useState('');
  const [presenceMap, setPresenceMap] = useState<Record<number, PresenceEntry>>({});
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);

  const [lastWsEnvelope, setLastWsEnvelope] = useState<MessagingWsEnvelope | null>(null);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  // Modals for starting 1-1 or creating a group
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerDisplay[]>([]);
  const [groupTitleInput, setGroupTitleInput] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const loadConversationList = useCallback(async () => {
    try {
      const res = await messagingApi.listConversations(1, 50);
      setConversations(res.data);
    } catch {
      // ignore background error
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversationList();
  }, [loadConversationList]);

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
        loadConversationList();
        emitMessagingUnreadChanged();
      } else if (envelope.type === 'presence.updated') {
        const payload = envelope.data as PresenceEntry;
        setPresenceMap((prev) => ({ ...prev, [payload.userId]: payload }));
      }
    },
    [loadConversationList]
  );

  const handleReconnect = useCallback(() => {
    loadConversationList();
    emitMessagingUnreadChanged();
    setReconnectTrigger((n) => n + 1);
  }, [loadConversationList]);

  const { connectionState } = useMessagingSocket({
    enabled: true,
    onEvent: handleWsEvent,
    onReconnect: handleReconnect,
  });

  // Player search in modals
  const runModalPlayerSearch = useCallback(async (q: string) => {
    try {
      const list = await messagingApi.searchPlayers(q, 20);
      setPlayerSearchResults(list);
    } catch {
      setPlayerSearchResults([]);
    }
  }, []);

  useEffect(() => {
    if (showDirectModal || showGroupModal) {
      runModalPlayerSearch(playerSearchQuery);
    }
  }, [showDirectModal, showGroupModal, playerSearchQuery, runModalPlayerSearch]);

  const handleStartDirectChat = async (playerId: number) => {
    setModalSubmitting(true);
    setModalError(null);
    try {
      const conv = await messagingApi.openOrCreateDirectConversation(playerId);
      setShowDirectModal(false);
      await loadConversationList();
      navigate(`/messages/${conv.id}`);
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
      await loadConversationList();
      navigate(`/messages/${conv.id}`);
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
      if (listFilterQuery.trim()) {
        const displayTitle =
          c.type === 'GROUP'
            ? c.title || 'Nhóm chat'
            : c.counterpart?.fullName || 'Người chơi';
        if (!displayTitle.toLowerCase().includes(listFilterQuery.trim().toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, filterTab, listFilterQuery]);

  return <div className="mx-auto grid h-[calc(100svh-116px)] min-h-140 w-full min-w-0 max-w-360 grid-cols-[340px_minmax(0,1fr)] gap-5 px-6 py-4 max-[960px]:grid-cols-[270px_minmax(0,1fr)] max-[960px]:gap-3 max-[960px]:px-3.5 max-[640px]:h-[calc(100svh-96px)] max-[640px]:grid-cols-1 max-[640px]:px-2.5">
    <aside aria-label="Danh sách cuộc trò chuyện" className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', activeConvId && 'max-[640px]:hidden')}>
      <div className="space-y-4 border-b border-border p-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <MessageCircle aria-hidden="true" className="size-6 text-primary" />Tin nhắn</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setPlayerSearchQuery(''); setModalError(null); setShowDirectModal(true); }}>
            <Plus aria-hidden="true" />Chat 1-1</Button>
          <Button onClick={() => { setGroupTitleInput(''); setSelectedMemberIds([]); setPlayerSearchQuery(''); setModalError(null); setShowGroupModal(true); }}>
            <Users aria-hidden="true" />Tạo nhóm</Button>
          <Link to="/settings/blocks" className={buttonVariants({ variant: 'ghost', size: 'icon' })} title="Danh sách chặn" aria-label="Danh sách chặn">
            <ShieldBan aria-hidden="true" />
          </Link>
        </div>
        <Input aria-label="Tìm cuộc trò chuyện" placeholder="Tìm cuộc trò chuyện..." value={listFilterQuery} onChange={e => setListFilterQuery(e.target.value)} />
        <ConversationFilters value={filterTab} onChange={setFilterTab} />
      </div>
      {workspaceNotice && <Alert variant="warning" className="m-3">{workspaceNotice}<Button variant="ghost" onClick={() => setWorkspaceNotice(null)}>Đóng</Button>
      </Alert>}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">{loadingList ? <p role="status" className="p-4 text-sm text-muted-foreground">Đang tải cuộc trò chuyện...</p> : filteredConversations.length === 0 ? <div className="p-4 text-center text-sm leading-6 text-muted-foreground">Chưa có cuộc trò chuyện nào. Bắt đầu bằng nút <b>Chat 1-1</b> hoặc <b>Tạo nhóm</b>!</div> : filteredConversations.map(conv => <ConversationListItem key={conv.id} conversation={conv} selected={conv.id === activeConvId} online={conv.type === 'DIRECT' && !!conv.counterpart && (presenceMap[conv.counterpart.id]?.isOnline ?? conv.counterpart.isOnline)} onClick={() => navigate(`/messages/${conv.id}`)} />)}</div>
    </aside>
    <section aria-label="Nội dung cuộc trò chuyện" className={cn('relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm', !activeConvId && 'max-[640px]:hidden')}>
      {!activeConvId ? <div className="flex h-full items-center justify-center p-6">
        <EmptyState icon={MessageCircle} title="Chọn một cuộc trò chuyện để bắt đầu" description="Nhắn tin thời gian thực 1-1 hoặc tạo nhóm chat cầu lông lâu dài để hẹn lịch sân, chia sẻ hình ảnh và tài liệu." />
      </div> : <ConversationRoomPane key={activeConvId} conversationId={activeConvId} compact={false} connectionState={connectionState} lastWsEnvelope={lastWsEnvelope} reconnectTrigger={reconnectTrigger} onBackToList={() => navigate('/messages')} onConversationListChanged={loadConversationList} onConversationRemoved={(_removedId, reasonBanner) => { if (reasonBanner) setWorkspaceNotice(reasonBanner); loadConversationList(); emitMessagingUnreadChanged(); navigate('/messages', { replace: true }); }} />}
    </section>
    <StartDirectDialog open={showDirectModal} onClose={() => setShowDirectModal(false)} query={playerSearchQuery} onQueryChange={setPlayerSearchQuery} players={playerSearchResults} error={modalError} submitting={modalSubmitting} onStart={handleStartDirectChat} />
    <StartGroupDialog open={showGroupModal} onClose={() => setShowGroupModal(false)} query={playerSearchQuery} onQueryChange={setPlayerSearchQuery} players={playerSearchResults} error={modalError} submitting={modalSubmitting} title={groupTitleInput} onTitleChange={setGroupTitleInput} selectedIds={selectedMemberIds} onToggleMember={(id, checked) => setSelectedMemberIds(prev => checked ? prev.filter(value => value !== id) : [...prev, id])} onSubmit={handleCreateGroupSubmit} />
  </div>;
};
