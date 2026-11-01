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
import '../messaging.css';

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

  return (
    <div className={`msg-workspace ${activeConvId ? 'has-active-conv' : ''}`}>
      {/* Left Column: Conversation List */}
      <aside className="msg-sidebar" aria-label="Danh sách cuộc trò chuyện">
        <div className="msg-sidebar-header">
          <div className="msg-sidebar-title-row">
            <h1 className="msg-sidebar-title">Tin nhắn</h1>
            <div className="msg-sidebar-actions">
              <button
                type="button"
                className="msg-btn"
                onClick={() => {
                  setPlayerSearchQuery('');
                  setModalError(null);
                  setShowDirectModal(true);
                }}
              >
                + Chat 1-1
              </button>
              <button
                type="button"
                className="msg-btn msg-btn-primary"
                onClick={() => {
                  setGroupTitleInput('');
                  setSelectedMemberIds([]);
                  setPlayerSearchQuery('');
                  setModalError(null);
                  setShowGroupModal(true);
                }}
              >
                + Tạo nhóm
              </button>
              <Link to="/settings/blocks" className="msg-btn" title="Danh sách chặn">
                Chặn
              </Link>
            </div>
          </div>

          <input
            type="text"
            className="msg-search-input"
            placeholder="Tìm cuộc trò chuyện..."
            value={listFilterQuery}
            onChange={(e) => setListFilterQuery(e.target.value)}
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
              Nhóm chat
            </button>
          </div>
        </div>

        {workspaceNotice && (
          <div className="msg-banner warning">
            <span>{workspaceNotice}</span>
            <button type="button" className="msg-btn" onClick={() => setWorkspaceNotice(null)}>
              Đóng
            </button>
          </div>
        )}

        <div className="msg-conv-list">
          {loadingList ? (
            <p style={{ padding: 16, fontSize: 13.5, color: '#505F76', margin: 0 }}>
              Đang tải cuộc trò chuyện...
            </p>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#505F76', fontSize: 13.5 }}>
              Chưa có cuộc trò chuyện nào. Bắt đầu bằng nút <b>+ Chat 1-1</b> hoặc <b>+ Tạo nhóm</b>!
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === activeConvId;
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
                  className={`msg-conv-item ${isSelected ? 'active' : ''}`}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                >
                  <div className="msg-avatar-wrap">
                    <div className={`msg-avatar ${conv.type === 'GROUP' ? 'group' : ''}`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    {isOnline && (
                      <span
                        className="msg-online-dot"
                        title="Đang hoạt động (gần thời gian thực)"
                      />
                    )}
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
                        className={`msg-conv-preview ${conv.unreadCount > 0 ? 'unread' : ''}`}
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
      </aside>

      {/* Right Column: Active Conversation Detail */}
      <section className="msg-main" aria-label="Nội dung cuộc trò chuyện">
        {!activeConvId ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 32,
              textAlign: 'center',
              color: '#505F76',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>🏸💬</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#131B2E' }}>
              Chọn một cuộc trò chuyện để bắt đầu
            </h2>
            <p style={{ margin: 0, fontSize: 14, maxWidth: 420 }}>
              Nhắn tin thời gian thực 1-1 hoặc tạo nhóm chat cầu lông lâu dài để hẹn lịch sân, chia sẻ hình ảnh và tài liệu.
            </p>
          </div>
        ) : (
          <ConversationRoomPane
            key={activeConvId}
            conversationId={activeConvId}
            compact={false}
            connectionState={connectionState}
            lastWsEnvelope={lastWsEnvelope}
            reconnectTrigger={reconnectTrigger}
            onBackToList={() => navigate('/messages')}
            onConversationListChanged={loadConversationList}
            onConversationRemoved={(_removedId, reasonBanner) => {
              if (reasonBanner) setWorkspaceNotice(reasonBanner);
              loadConversationList();
              emitMessagingUnreadChanged();
              navigate('/messages', { replace: true });
            }}
          />
        )}
      </section>

      {/* Modal 1: Start 1-1 Direct Chat */}
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

      {/* Modal 2: Create Standalone Group Chat */}
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
                  placeholder="Ví dụ: Hội cầu lông tối thứ 3 - Sân Kỳ Hòa"
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
    </div>
  );
};
