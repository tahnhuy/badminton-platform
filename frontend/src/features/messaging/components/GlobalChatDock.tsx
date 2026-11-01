import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { ApiError } from '../../../shared/api/http-client';
import { emitMessagingUnreadChanged, messagingApi } from '../services/messaging-api';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import { useDraggableBubbleOffset } from '../hooks/useDraggableBubbleOffset';
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

  useEffect(() => {
    const syncUnread = () => {
      if (!isPlayerAuthenticated) return;
      messagingApi
        .getUnreadSummary()
        .then((r) => setTotalUnread(r.totalUnread))
        .catch(() => {});
    };
    window.addEventListener('messaging:unread-changed', syncUnread);
    return () => window.removeEventListener('messaging:unread-changed', syncUnread);
  }, [isPlayerAuthenticated]);

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

  if (!isPlayerAuthenticated || isMessagesRoute) {
    return null;
  }

  const windowBottom =
    typeof window !== 'undefined'
      ? Math.max(16, Math.min(bottomOffset, window.innerHeight - 560))
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
            setIsOpen(true);
            refreshUnreadAndList();
          }}
        >
          <span>💬</span>
          {totalUnread > 0 && (
            <span className="msg-dock-bubble-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      ) : (
        <aside
          className="msg-dock-window"
          style={{ bottom: windowBottom }}
          aria-label="Khung tin nhắn nhanh"
        >
          {activeDockConvId !== null ? (
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
                navigate(`/messages/${convId}`);
              }}
              onCloseDock={() => setIsOpen(false)}
              onConversationListChanged={refreshUnreadAndList}
              onConversationRemoved={(_removedId, reasonBanner) => {
                if (reasonBanner) setDockNotice(reasonBanner);
                setActiveDockConvId(null);
                refreshUnreadAndList();
                emitMessagingUnreadChanged();
              }}
            />
          ) : (
            <>
              {/* Dock Inbox Header */}
              <div className="msg-sidebar-header" style={{ padding: '12px 14px 10px', gap: 10 }}>
                <div className="msg-sidebar-title-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span>
                    <strong style={{ fontSize: 15.5, color: '#131B2E' }}>Tin nhắn nhanh</strong>
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
                      className="msg-btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      title="Mở trang Tin nhắn đầy đủ"
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/messages');
                      }}
                    >
                      ⤢
                    </button>
                    <button
                      type="button"
                      className="msg-btn"
                      style={{ padding: '4px 8px', fontSize: 12 }}
                      title="Thu gọn thành bong bóng chat"
                      onClick={() => setIsOpen(false)}
                    >
                      ✕
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
            </>
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
