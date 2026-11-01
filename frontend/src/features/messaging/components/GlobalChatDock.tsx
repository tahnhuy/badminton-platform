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
import '../messaging.css';

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

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          className={`msg-dock-bubble ${isDragging ? 'dragging' : ''}`}
          style={{ bottom: bottomOffset }}
          aria-label="Mở khung tin nhắn nhanh"
          title="Tin nhắn nhanh (Kéo lên/xuống để đổi vị trí)"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => {
            if (consumeWasDragged()) return;
            setLoadingList(true);
            setIsClosing(false);
            setIsOpen(true);
            refreshUnreadAndList();
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          {totalUnread > 0 && (
            <span className="msg-dock-bubble-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      ) : (
        <aside
          className={`msg-dock-window ${isClosing ? 'closing' : ''}`}
          style={{ bottom: windowBottom, height: maxDockHeight }}
          aria-label="Khung tin nhắn nhanh"
        >
          {activeDockConvId !== null ? (
            <div key={`room-${activeDockConvId}`} className="msg-dock-stage room-enter">
              <ConversationRoomPane
                key={activeDockConvId}
                conversationId={activeDockConvId}
                compact={true}
                connectionState={connectionState}
                lastWsEnvelope={lastWsEnvelope}
                reconnectTrigger={reconnectTrigger}
                onBackToList={() => {
                  setActiveDockConvId(null);
                  refreshUnreadAndList();
                }}
                onExpandToWorkspace={(convId) => {
                  setIsOpen(false);
                  setIsClosing(false);
                  navigate(`/messages/${convId}`);
                }}
                onCloseDock={handleCloseDockAnimated}
                onConversationListChanged={refreshUnreadAndList}
                onConversationRemoved={(_removedId, reasonBanner) => {
                  if (reasonBanner) setDockNotice(reasonBanner);
                  setActiveDockConvId(null);
                  refreshUnreadAndList();
                  emitMessagingUnreadChanged();
                }}
              />
            </div>
          ) : (
            <div key="inbox-list" className="msg-dock-stage list-enter">
              {/* Dock Inbox Header */}
              <div className="msg-sidebar-header" style={{ padding: '12px 14px 10px', gap: 10 }}>
                <div className="msg-sidebar-title-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: 'rgba(0, 107, 44, 0.12)',
                        color: '#006b2c',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </span>
                    <strong style={{ fontSize: 15, color: '#0f172a' }}>Tin nhắn nhanh</strong>
                    {totalUnread > 0 && (
                      <span className="msg-unread-badge">{totalUnread}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button
                      type="button"
                      className="msg-btn"
                      style={{ padding: '4px 8px', fontSize: 11.5 }}
                      onClick={() => {
                        setPlayerSearchQuery('');
                        setModalError(null);
                        setShowDirectModal(true);
                      }}
                    >
                      + 1-1
                    </button>
                    <button
                      type="button"
                      className="msg-btn msg-btn-primary"
                      style={{ padding: '4px 8px', fontSize: 11.5 }}
                      onClick={() => {
                        setGroupTitleInput('');
                        setSelectedMemberIds([]);
                        setPlayerSearchQuery('');
                        setModalError(null);
                        setShowGroupModal(true);
                      }}
                    >
                      + Nhóm
                    </button>
                    <button
                      type="button"
                      className="msg-icon-btn"
                      title="Mở trang Tin nhắn đầy đủ"
                      aria-label="Mở trang Tin nhắn đầy đủ"
                      onClick={() => {
                        setIsOpen(false);
                        setIsClosing(false);
                        navigate('/messages');
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="msg-icon-btn"
                      title="Thu gọn thành bong bóng chat"
                      aria-label="Thu gọn thành bong bóng chat"
                      onClick={handleCloseDockAnimated}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  className="msg-search-input"
                  placeholder="Tìm cuộc trò chuyện..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="msg-filter-tabs">
                  <button
                    type="button"
                    className={`msg-filter-tab ${filterTab === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterTab('ALL')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`msg-filter-tab ${filterTab === 'UNREAD' ? 'active' : ''}`}
                    onClick={() => setFilterTab('UNREAD')}
                  >
                    Chưa đọc
                  </button>
                  <button
                    type="button"
                    className={`msg-filter-tab ${filterTab === 'GROUP' ? 'active' : ''}`}
                    onClick={() => setFilterTab('GROUP')}
                  >
                    Nhóm
                  </button>
                </div>
              </div>

              {dockNotice && (
                <div className="msg-banner warning">
                  <span>{dockNotice}</span>
                  <button type="button" className="msg-btn" onClick={() => setDockNotice(null)}>
                    Đóng
                  </button>
                </div>
              )}

              <div className="msg-conv-list">
                {loadingList ? (
                  <p style={{ padding: 16, fontSize: 13, color: '#505F76', margin: 0 }}>
                    Đang tải danh sách...
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#505F76', fontSize: 13 }}>
                    Chưa có cuộc trò chuyện nào. Bấm <b>+ 1-1</b> hoặc <b>+ Nhóm</b> để bắt đầu!
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const name =
                      conv.type === 'GROUP'
                        ? conv.title || 'Nhóm cầu lông'
                        : conv.counterpart?.fullName || 'Người chơi';
                    const isOnline =
                      conv.type === 'DIRECT' &&
                      conv.counterpart &&
                      (presenceMap[conv.counterpart.id]?.isOnline ?? conv.counterpart.isOnline);
                    const previewText = conv.lastMessage
                      ? conv.lastMessage.deletedAt
                        ? 'Tin nhắn đã được thu hồi'
                        : conv.lastMessage.body || '[Đính kèm tệp / hình ảnh]'
                      : 'Chưa có tin nhắn';

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        className="msg-conv-item"
                        onClick={() => setActiveDockConvId(conv.id)}
                      >
                        <div className="msg-avatar-wrap">
                          <div className={`msg-avatar ${conv.type === 'GROUP' ? 'group' : ''}`}>
                            {name.charAt(0).toUpperCase()}
                          </div>
                          {isOnline && <span className="msg-online-dot" />}
                        </div>

                        <div className="msg-conv-body">
                          <div className="msg-conv-top">
                            <span className="msg-conv-name">
                              {conv.isLocked ? '🔒 ' : ''}
                              {name}
                            </span>
                            {conv.lastMessageAt && (
                              <span className="msg-conv-time">
                                {new Date(conv.lastMessageAt).toLocaleTimeString('vi-VN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          <div className="msg-conv-bottom">
                            <span
                              className={`msg-conv-preview ${
                                conv.unreadCount > 0 ? 'unread' : ''
                              }`}
                            >
                              {previewText}
                            </span>
                            {conv.unreadCount > 0 && (
                              <span className="msg-unread-badge">{conv.unreadCount}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>
      )}

      {/* Modal 1: Start 1-1 Direct Chat from Dock */}
      {showDirectModal && (
        <div className="msg-modal-backdrop" onClick={() => setShowDirectModal(false)}>
          <div
            className="msg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Bắt đầu trò chuyện 1-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-modal-header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Bắt đầu trò chuyện 1-1</h2>
              <button type="button" className="msg-btn" onClick={() => setShowDirectModal(false)}>
                Đóng
              </button>
            </div>
            <div className="msg-modal-body">
              {modalError && <div className="msg-banner error">{modalError}</div>}
              <input
                type="text"
                className="msg-search-input"
                placeholder="Tìm người chơi theo tên..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {playerSearchResults.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(189, 202, 186, 0.4)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.fullName}</div>
                      {p.skillLevel && (
                        <div style={{ fontSize: 11.5, color: '#505F76' }}>{p.skillLevel.name}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="msg-btn msg-btn-primary"
                      disabled={modalSubmitting}
                      onClick={() => handleStartDirectChat(p.id)}
                    >
                      Nhắn tin
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Create Group Chat from Dock */}
      {showGroupModal && (
        <div className="msg-modal-backdrop" onClick={() => setShowGroupModal(false)}>
          <div
            className="msg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Tạo nhóm chat mới"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-modal-header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tạo nhóm chat cầu lông</h2>
              <button type="button" className="msg-btn" onClick={() => setShowGroupModal(false)}>
                Đóng
              </button>
            </div>
            <form className="msg-modal-body" onSubmit={handleCreateGroupSubmit}>
              {modalError && <div className="msg-banner error">{modalError}</div>}
              <div>
                <label
                  style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}
                >
                  Tên nhóm (1–120 ký tự)
                </label>
                <input
                  type="text"
                  className="msg-search-input"
                  placeholder="Ví dụ: Hội cầu lông tối thứ 3"
                  maxLength={120}
                  value={groupTitleInput}
                  onChange={(e) => setGroupTitleInput(e.target.value)}
                />
              </div>

              <div>
                <label
                  style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}
                >
                  Tìm và chọn thành viên ({selectedMemberIds.length} đã chọn)
                </label>
                <input
                  type="text"
                  className="msg-search-input"
                  placeholder="Nhập tên người chơi..."
                  value={playerSearchQuery}
                  onChange={(e) => setPlayerSearchQuery(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
                {playerSearchResults.map((p) => {
                  const checked = selectedMemberIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(189, 202, 186, 0.4)',
                        cursor: 'pointer',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.fullName}</div>
                        {p.skillLevel && (
                          <div style={{ fontSize: 11.5, color: '#505F76' }}>
                            {p.skillLevel.name}
                          </div>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedMemberIds((prev) =>
                            checked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>

              <button type="submit" className="msg-btn msg-btn-primary" disabled={modalSubmitting}>
                {modalSubmitting ? 'Đang tạo...' : 'Tạo nhóm chat'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

