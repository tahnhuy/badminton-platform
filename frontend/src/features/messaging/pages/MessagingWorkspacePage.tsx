import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { ApiError } from '../../../shared/api/http-client';
import { PlayerProfileModal } from '../../player/profile/PlayerProfileModal';
import { emitMessagingUnreadChanged, messagingApi } from '../services/messaging-api';
import { useMessagingSocket } from '../hooks/useMessagingSocket';
import type {
  ConversationItem,
  MessageItem,
  MessageReactionSummary,
  MessageReactionType,
  MessagingWsEnvelope,
  PendingMessageItem,
  PlayerDisplay,
  PresenceEntry,
  TypingEntry,
} from '../types/messaging.types';
import '../messaging.css';

const REACTION_META: Array<{ type: MessageReactionType; emoji: string; label: string }> = [
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'LOVE', emoji: '❤️', label: 'Tim' },
  { type: 'HAHA', emoji: '😆', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'SAD', emoji: '😢', label: 'Buồn' },
  { type: 'ANGRY', emoji: '😡', label: 'Phẫn nộ' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const MessagingWorkspacePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { conversationId: paramConvId } = useParams<{ conversationId?: string }>();
  const activeConvId = paramConvId ? Number(paramConvId) : null;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [filterTab, setFilterTab] = useState<'ALL' | 'UNREAD' | 'GROUP'>('ALL');
  const [listFilterQuery, setListFilterQuery] = useState('');

  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextBeforeSeq, setNextBeforeSeq] = useState<number | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<number, PresenceEntry>>({});
  const [typingEntries, setTypingEntries] = useState<TypingEntry[]>([]);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Composer state & failed-send queue
  const [draftText, setDraftText] = useState('');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingMessageItem[]>([]);
  const lastTypingSentAtRef = useRef<number>(0);

  // Sync cursors
  const afterSeqRef = useRef<number>(0);
  const sinceVersionRef = useRef<number>(0);
  const minLoadedSeqRef = useRef<number>(1);
  const lastMarkedReadSeqRef = useRef<number>(0);

  // Scroll preservation when prepending older messages
  const historyContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(
    null
  );

  // Modals
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [profileModalPlayerId, setProfileModalPlayerId] = useState<number | null>(null);

  // Modal search state
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

  // Mark rendered messages as read (monotonic, only for messages actually rendered in view)
  const maybeMarkRead = useCallback(
    async (convId: number, renderedMessages: MessageItem[]) => {
      if (renderedMessages.length === 0) return;
      const highestRenderedSeq = renderedMessages[renderedMessages.length - 1].seq;
      if (highestRenderedSeq <= lastMarkedReadSeqRef.current) return;
      lastMarkedReadSeqRef.current = highestRenderedSeq;

      try {
        await messagingApi.markConversationRead(convId, highestRenderedSeq);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
        );
        emitMessagingUnreadChanged();
      } catch {
        // ignore read error
      }
    },
    []
  );

  // Load active conversation detail + initial history + sync snapshot
  const loadActiveConversation = useCallback(
    async (convId: number) => {
      setLoadingMessages(true);
      setActionBanner(null);
      lastMarkedReadSeqRef.current = 0;

      try {
        const [detail, historyRes] = await Promise.all([
          messagingApi.getConversationDetail(convId),
          messagingApi.listMessagesHistory(convId, undefined, 30),
        ]);

        setActiveConversation(detail);
        const ascending = [...historyRes.data].reverse();
        setMessages(ascending);
        setNextBeforeSeq(historyRes.meta.nextBeforeSeq);

        const maxSeq = ascending.length > 0 ? ascending[ascending.length - 1].seq : detail.lastSeq;
        const minSeq = ascending.length > 0 ? ascending[0].seq : 1;
        afterSeqRef.current = maxSeq;
        minLoadedSeqRef.current = minSeq;
        sinceVersionRef.current = detail.activityVersion;

        // Fetch initial presence/typing snapshot via sync
        const syncSnap = await messagingApi.syncConversation(
          convId,
          maxSeq,
          detail.activityVersion,
          minSeq
        );
        if (syncSnap.presence) {
          const pMap: Record<number, PresenceEntry> = {};
          for (const p of syncSnap.presence) pMap[p.userId] = p;
          setPresenceMap(pMap);
        }
        if (syncSnap.typing) {
          setTypingEntries(syncSnap.typing);
        }

        if (ascending.length > 0) {
          await maybeMarkRead(convId, ascending);
        }

        // Scroll to bottom on initial load
        requestAnimationFrame(() => {
          if (historyContainerRef.current) {
            historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
          }
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'MESSAGING_CONVERSATION_NOT_FOUND') {
          setActiveConversation(null);
          setMessages([]);
          navigate('/messages', { replace: true });
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [maybeMarkRead, navigate]
  );

  useEffect(() => {
    if (activeConvId && Number.isInteger(activeConvId) && activeConvId > 0) {
      loadActiveConversation(activeConvId);
    } else {
      setActiveConversation(null);
      setMessages([]);
      setNextBeforeSeq(null);
    }
  }, [activeConvId, loadActiveConversation]);

  // Catch-up sync on WebSocket reconnect or tab visibility restore
  const runReconnectCatchUp = useCallback(async () => {
    await loadConversationList();
    emitMessagingUnreadChanged();

    if (!activeConvId) return;
    try {
      const snap = await messagingApi.syncConversation(
        activeConvId,
        afterSeqRef.current,
        sinceVersionRef.current,
        minLoadedSeqRef.current
      );

      if (snap.messages.length > 0) {
        setMessages((prev) => {
          const existingSeqs = new Set(prev.map((m) => m.seq));
          const merged = [...prev];
          for (const m of snap.messages) {
            if (!existingSeqs.has(m.seq)) {
              merged.push(m);
            }
          }
          merged.sort((a, b) => a.seq - b.seq);
          return merged;
        });
      }

      if (snap.changedReactions.length > 0) {
        const reactMap = new Map(snap.changedReactions.map((r) => [r.messageId, r]));
        setMessages((prev) =>
          prev.map((m) => {
            const changed = reactMap.get(m.id);
            return changed
              ? { ...m, reactionVersion: changed.reactionVersion, reactions: changed.reactions }
              : m;
          })
        );
      }

      afterSeqRef.current = snap.nextAfterSeq;
      sinceVersionRef.current = snap.nextSinceVersion;

      if (snap.presence) {
        const pMap: Record<number, PresenceEntry> = {};
        for (const p of snap.presence) pMap[p.userId] = p;
        setPresenceMap(pMap);
      }
      if (snap.typing) {
        setTypingEntries(snap.typing);
      }
    } catch {
      // ignore sync error
    }
  }, [activeConvId, loadConversationList]);

  // Handle incoming real-time WebSocket events
  const handleWsEvent = useCallback(
    (envelope: MessagingWsEnvelope) => {
      if (envelope.type === 'message.created') {
        const incoming = envelope.data as MessageItem;
        loadConversationList();
        emitMessagingUnreadChanged();

        if (incoming.conversationId === activeConvId) {
          setMessages((prev) => {
            if (prev.some((m) => m.seq === incoming.seq)) return prev;
            const next = [...prev, incoming].sort((a, b) => a.seq - b.seq);
            afterSeqRef.current = Math.max(afterSeqRef.current, incoming.seq);
            maybeMarkRead(incoming.conversationId, next);
            return next;
          });
          // Clear typing indicator for sender
          setTypingEntries((prev) => prev.filter((t) => t.userId !== incoming.senderId));
          requestAnimationFrame(() => {
            if (historyContainerRef.current) {
              historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
            }
          });
        }
      } else if (envelope.type === 'message.reaction_updated') {
        const payload = envelope.data as {
          messageId: number;
          conversationId: number;
          seq: number;
          reactionVersion: number;
          reactions: MessageReactionSummary[];
        };
        if (payload.conversationId === activeConvId) {
          // Re-sync reaction summary so reactedByMe reflects current user accurately
          messagingApi
            .syncConversation(
              activeConvId,
              afterSeqRef.current,
              sinceVersionRef.current,
              minLoadedSeqRef.current
            )
            .then((snap) => {
              sinceVersionRef.current = snap.nextSinceVersion;
              if (snap.changedReactions.length > 0) {
                const reactMap = new Map(snap.changedReactions.map((r) => [r.messageId, r]));
                setMessages((prev) =>
                  prev.map((m) => {
                    const changed = reactMap.get(m.id);
                    return changed
                      ? {
                          ...m,
                          reactionVersion: changed.reactionVersion,
                          reactions: changed.reactions,
                        }
                      : m;
                  })
                );
              }
            })
            .catch(() => {});
        }
      } else if (envelope.type === 'typing.updated') {
        const payload = envelope.data as {
          conversationId: number;
          userId: number;
          expiresAt: string;
        };
        if (payload.conversationId === activeConvId && payload.userId !== user?.id) {
          setTypingEntries((prev) => {
            const rest = prev.filter((t) => t.userId !== payload.userId);
            return [...rest, { userId: payload.userId, expiresAt: payload.expiresAt }];
          });
        }
      } else if (envelope.type === 'presence.updated') {
        const payload = envelope.data as PresenceEntry;
        setPresenceMap((prev) => ({ ...prev, [payload.userId]: payload }));
      } else if (envelope.type === 'conversation.member_changed') {
        const payload = envelope.data as { conversationId: number };
        loadConversationList();
        if (payload.conversationId === activeConvId) {
          messagingApi
            .getConversationDetail(activeConvId)
            .then((detail) => setActiveConversation(detail))
            .catch(() => {
              navigate('/messages', { replace: true });
            });
        }
      }
    },
    [activeConvId, loadConversationList, maybeMarkRead, navigate, user?.id]
  );

  const { connectionState } = useMessagingSocket({
    enabled: !featureDisabled,
    onEvent: handleWsEvent,
    onReconnect: runReconnectCatchUp,
  });

  // Expire stale typing entries locally every second
  useEffect(() => {
    if (typingEntries.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTypingEntries((prev) => prev.filter((t) => new Date(t.expiresAt).getTime() > now));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [typingEntries.length]);

  // Preserve scroll offset after prepending older messages
  useLayoutEffect(() => {
    const restore = pendingScrollRestoreRef.current;
    const container = historyContainerRef.current;
    if (restore && container) {
      const delta = container.scrollHeight - restore.prevScrollHeight;
      container.scrollTop = restore.prevScrollTop + delta;
      pendingScrollRestoreRef.current = null;
    }
  }, [messages]);

  const handleLoadOlderMessages = async () => {
    if (!activeConvId || !nextBeforeSeq || loadingOlder) return;
    const container = historyContainerRef.current;
    if (container) {
      pendingScrollRestoreRef.current = {
        prevScrollHeight: container.scrollHeight,
        prevScrollTop: container.scrollTop,
      };
    }

    setLoadingOlder(true);
    try {
      const res = await messagingApi.listMessagesHistory(activeConvId, nextBeforeSeq, 30);
      const olderAscending = [...res.data].reverse();
      setMessages((prev) => {
        const existingSeqs = new Set(prev.map((m) => m.seq));
        const prepended = [...olderAscending.filter((m) => !existingSeqs.has(m.seq)), ...prev];
        if (prepended.length > 0) {
          minLoadedSeqRef.current = prepended[0].seq;
          // Reset sinceVersion to 0 per Tech Design §7.5 when minLoadedSeq lowers
          sinceVersionRef.current = 0;
        }
        return prepended;
      });
      setNextBeforeSeq(res.meta.nextBeforeSeq);
    } catch {
      pendingScrollRestoreRef.current = null;
    } finally {
      setLoadingOlder(false);
    }
  };

  // Debounced typing notification (at most every 3s while user types)
  const notifyTypingDebounced = () => {
    if (!activeConvId || !activeConversation?.canSend) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 3000) return;
    lastTypingSentAtRef.current = now;
    messagingApi.recordTyping(activeConvId).catch(() => {});
  };

  // Execute send or retry with a preserved clientMessageId
  const executeSendItem = async (item: PendingMessageItem) => {
    setPendingItems((prev) =>
      prev.map((p) =>
        p.clientMessageId === item.clientMessageId
          ? { ...p, status: 'SENDING', errorMessage: null }
          : p
      )
    );

    try {
      const sent = await messagingApi.sendMessage(item.conversationId, {
        text: item.text || null,
        clientMessageId: item.clientMessageId,
        images: item.images,
        file: item.file,
      });

      setPendingItems((prev) =>
        prev.filter((p) => p.clientMessageId !== item.clientMessageId)
      );

      setMessages((prev) => {
        if (prev.some((m) => m.seq === sent.seq)) return prev;
        const next = [...prev, sent].sort((a, b) => a.seq - b.seq);
        afterSeqRef.current = Math.max(afterSeqRef.current, sent.seq);
        return next;
      });

      loadConversationList();
      requestAnimationFrame(() => {
        if (historyContainerRef.current) {
          historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
        }
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MESSAGING_DISABLED') {
        setFeatureDisabled(true);
      }
      const msg = err instanceof ApiError ? err.message : 'Gửi tin nhắn thất bại, vui lòng thử lại';
      setPendingItems((prev) =>
        prev.map((p) =>
          p.clientMessageId === item.clientMessageId
            ? { ...p, status: 'FAILED', errorMessage: msg }
            : p
        )
      );
    }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !activeConversation?.canSend) return;

    const trimmed = draftText.trim();
    if (!trimmed && selectedImages.length === 0 && !selectedFile) return;

    const newItem: PendingMessageItem = {
      clientMessageId: generateClientUuid(),
      conversationId: activeConvId,
      text: trimmed,
      images: [...selectedImages],
      file: selectedFile,
      status: 'SENDING',
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };

    setPendingItems((prev) => [...prev, newItem]);
    setDraftText('');
    setSelectedImages([]);
    setSelectedFile(null);

    await executeSendItem(newItem);
  };

  const handleToggleReaction = async (msg: MessageItem, type: MessageReactionType) => {
    const existing = msg.reactions.find((r) => r.type === type && r.reactedByMe);
    try {
      const updated = existing
        ? await messagingApi.removeMessageReaction(msg.id)
        : await messagingApi.setMessageReaction(msg.id, type);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, reactionVersion: updated.reactionVersion, reactions: updated.reactions }
            : m
        )
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setActionBanner(err.message);
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation || activeConversation.type !== 'GROUP') return;
    try {
      await messagingApi.leaveGroupConversation(activeConversation.id);
      await loadConversationList();
      navigate('/messages', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

  const handleBlockCounterpart = async () => {
    if (!activeConversation?.counterpart) return;
    try {
      await messagingApi.blockPlayer(activeConversation.counterpart.id);
      const refreshed = await messagingApi.getConversationDetail(activeConversation.id);
      setActiveConversation(refreshed);
      await loadConversationList();
      setActionBanner('Đã chặn người chơi này. Lịch sử trò chuyện vẫn được giữ lại.');
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

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
    if (showDirectModal || showGroupModal || showAddMembersModal) {
      runModalPlayerSearch(playerSearchQuery);
    }
  }, [showDirectModal, showGroupModal, showAddMembersModal, playerSearchQuery, runModalPlayerSearch]);

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

  const handleAddGroupMembersSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || selectedMemberIds.length === 0) return;
    setModalSubmitting(true);
    setModalError(null);
    try {
      const updated = await messagingApi.addGroupMembers(
        activeConversation.id,
        selectedMemberIds
      );
      setActiveConversation(updated);
      setShowAddMembersModal(false);
      setSelectedMemberIds([]);
      await loadConversationList();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Không thể thêm thành viên');
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

  const activeConvDisplayName = useMemo(() => {
    if (!activeConversation) return '';
    if (activeConversation.type === 'GROUP') {
      return activeConversation.title || 'Nhóm cầu lông';
    }
    return activeConversation.counterpart?.fullName || 'Người chơi';
  }, [activeConversation]);

  const activeCounterpartOnline = useMemo(() => {
    if (!activeConversation || activeConversation.type !== 'DIRECT') return false;
    const cpId = activeConversation.counterpart?.id;
    if (!cpId) return false;
    if (presenceMap[cpId] !== undefined) return presenceMap[cpId].isOnline;
    return Boolean(activeConversation.counterpart?.isOnline);
  }, [activeConversation, presenceMap]);

  const activeTypingNames = useMemo(() => {
    if (!activeConversation || typingEntries.length === 0) return [];
    const memberMap = new Map(activeConversation.members.map((m) => [m.id, m.fullName]));
    return typingEntries
      .filter((t) => t.userId !== user?.id)
      .map((t) => memberMap.get(t.userId) || 'Người chơi');
  }, [activeConversation, typingEntries, user?.id]);

  const activePendingItems = useMemo(
    () => pendingItems.filter((p) => p.conversationId === activeConvId),
    [pendingItems, activeConvId]
  );

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
                ? conv.lastMessage.body || '[Đính kèm tệp / hình ảnh]'
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
                    {isOnline && <span className="msg-online-dot" title="Đang hoạt động (gần thời gian thực)" />}
                  </div>

                  <div className="msg-conv-body">
                    <div className="msg-conv-top">
                      <span className="msg-conv-name">{name}</span>
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
        {!activeConversation ? (
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
            <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#131B2E' }}>
              Chọn một cuộc trò chuyện để bắt đầu
            </h2>
            <p style={{ margin: 0, fontSize: 14, maxWidth: 420 }}>
              Nhắn tin thời gian thực 1-1 hoặc tạo nhóm chat cầu lông lâu dài để hẹn lịch sân, chia sẻ hình ảnh và tài liệu.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="msg-chat-header">
              <div className="msg-chat-header-info">
                <button
                  type="button"
                  className="msg-btn msg-back-mobile"
                  onClick={() => navigate('/messages')}
                >
                  ← Danh sách
                </button>
                <div className="msg-avatar-wrap">
                  <div
                    className={`msg-avatar ${activeConversation.type === 'GROUP' ? 'group' : ''}`}
                  >
                    {activeConvDisplayName.charAt(0).toUpperCase()}
                  </div>
                  {activeCounterpartOnline && <span className="msg-online-dot" />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 15.5,
                      color: '#131B2E',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {activeConvDisplayName}
                  </div>
                  <div className="msg-chat-subtitle">
                    {activeConversation.type === 'GROUP'
                      ? `${activeConversation.members.length} thành viên đang hoạt động`
                      : activeCounterpartOnline
                        ? 'Đang hoạt động (gần thời gian thực)'
                        : activeConversation.counterpart?.skillLevel?.name || 'Ngoại tuyến'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {activeConversation.type === 'GROUP' ? (
                  <>
                    <button
                      type="button"
                      className="msg-btn"
                      onClick={() => {
                        setSelectedMemberIds([]);
                        setPlayerSearchQuery('');
                        setModalError(null);
                        setShowAddMembersModal(true);
                      }}
                    >
                      + Thêm thành viên
                    </button>
                    <button
                      type="button"
                      className="msg-btn msg-btn-danger"
                      onClick={handleLeaveGroup}
                    >
                      Rời nhóm
                    </button>
                  </>
                ) : (
                  <>
                    {activeConversation.counterpart && (
                      <button
                        type="button"
                        className="msg-btn"
                        onClick={() =>
                          setProfileModalPlayerId(activeConversation.counterpart!.id)
                        }
                      >
                        Xem hồ sơ
                      </button>
                    )}
                    {activeConversation.canSend && activeConversation.counterpart && (
                      <button
                        type="button"
                        className="msg-btn msg-btn-danger"
                        onClick={handleBlockCounterpart}
                      >
                        Chặn
                      </button>
                    )}
                  </>
                )}
              </div>
            </header>

            {/* Status Banners */}
            {connectionState === 'DISCONNECTED' && !featureDisabled && (
              <div className="msg-banner warning" role="status">
                <span>Mất kết nối thời gian thực — đang tự động kết nối lại và đồng bộ tin nhắn...</span>
                <button type="button" className="msg-btn" onClick={runReconnectCatchUp}>
                  Đồng bộ ngay
                </button>
              </div>
            )}

            {featureDisabled && (
              <div className="msg-banner error" role="alert">
                <span>Tính năng nhắn tin hiện đang tạm khóa bảo trì. Bạn vẫn có thể xem lại lịch sử.</span>
              </div>
            )}

            {actionBanner && (
              <div className="msg-banner warning" role="status">
                <span>{actionBanner}</span>
                <button type="button" className="msg-btn" onClick={() => setActionBanner(null)}>
                  Đóng
                </button>
              </div>
            )}

            {/* Message History */}
            <div className="msg-history" ref={historyContainerRef}>
              {nextBeforeSeq && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    className="msg-btn"
                    disabled={loadingOlder}
                    onClick={handleLoadOlderMessages}
                  >
                    {loadingOlder ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <p style={{ color: '#505F76', fontSize: 13.5, textAlign: 'center' }}>
                  Đang tải lịch sử tin nhắn...
                </p>
              ) : messages.length === 0 && activePendingItems.length === 0 ? (
                <p style={{ color: '#505F76', fontSize: 13.5, textAlign: 'center', marginTop: 24 }}>
                  Hãy gửi lời chào đầu tiên trong cuộc trò chuyện này!
                </p>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  const imageAttachments = msg.attachments.filter((a) => a.kind === 'IMAGE');
                  const fileAttachments = msg.attachments.filter((a) => a.kind === 'FILE');

                  return (
                    <div key={msg.id} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                      {!isMine && (
                        <span className="msg-sender-label">
                          {msg.senderName} • #{msg.seq}
                        </span>
                      )}

                      <div className="msg-bubble">
                        {msg.body && <div>{msg.body}</div>}

                        {imageAttachments.length > 0 && (
                          <div className="msg-image-grid">
                            {imageAttachments.map((att) => (
                              <img
                                key={att.id}
                                src={att.url}
                                alt="Ảnh đính kèm"
                                className="msg-image-thumb"
                                onClick={() => setLightboxImageUrl(att.url)}
                              />
                            ))}
                          </div>
                        )}

                        {fileAttachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            download={att.originalName || `attachment-${att.mediaId}`}
                            className="msg-file-card"
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                📎 {att.originalName || `Tệp #${att.mediaId}`}
                              </div>
                              <div style={{ fontSize: 11, color: '#505F76' }}>
                                {formatBytes(att.byteSize)} • Bấm để tải xuống
                              </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#006B2C' }}>
                              Tải về
                            </span>
                          </a>
                        ))}
                      </div>

                      {/* Reactions & Picker */}
                      <div className="msg-reactions-row">
                        {msg.reactions.map((r) => {
                          const meta = REACTION_META.find((m) => m.type === r.type);
                          return (
                            <button
                              key={r.type}
                              type="button"
                              className={`msg-reaction-pill ${r.reactedByMe ? 'active' : ''}`}
                              onClick={() => handleToggleReaction(msg, r.type)}
                            >
                              <span>{meta?.emoji || r.type}</span>
                              <span>{r.count}</span>
                            </button>
                          );
                        })}

                        {activeConversation.canSend && !featureDisabled && (
                          <div className="msg-reaction-picker" aria-label="Bày tỏ cảm xúc">
                            {REACTION_META.map((meta) => (
                              <button
                                key={meta.type}
                                type="button"
                                className="msg-reaction-btn"
                                title={meta.label}
                                onClick={() => handleToggleReaction(msg, meta.type)}
                              >
                                {meta.emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Pending & Failed Send Items (preserves clientMessageId on retry) */}
              {activePendingItems.map((item) => (
                <div key={item.clientMessageId} className="msg-row mine">
                  <div
                    className="msg-bubble"
                    style={{
                      opacity: item.status === 'SENDING' ? 0.7 : 0.95,
                      border:
                        item.status === 'FAILED' ? '2px solid var(--color-danger, #ba1a1a)' : undefined,
                    }}
                  >
                    {item.text && <div>{item.text}</div>}
                    {item.images.length > 0 && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        🖼️ Đính kèm {item.images.length} ảnh
                      </div>
                    )}
                    {item.file && (
                      <div style={{ fontSize: 12, marginTop: 4 }}>📎 {item.file.name}</div>
                    )}
                  </div>
                  {item.status === 'SENDING' ? (
                    <span style={{ fontSize: 11.5, color: '#505F76' }}>Đang gửi...</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: '#BA1A1A', fontWeight: 600 }}>
                        {item.errorMessage || 'Gửi thất bại'}
                      </span>
                      <button
                        type="button"
                        className="msg-btn msg-btn-primary"
                        style={{ padding: '3px 8px', fontSize: 11.5 }}
                        onClick={() => executeSendItem(item)}
                      >
                        Thử lại
                      </button>
                      <button
                        type="button"
                        className="msg-btn"
                        style={{ padding: '3px 8px', fontSize: 11.5 }}
                        onClick={() =>
                          setPendingItems((prev) =>
                            prev.filter((p) => p.clientMessageId !== item.clientMessageId)
                          )
                        }
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Typing Indicator */}
            {activeTypingNames.length > 0 && (
              <div
                style={{
                  padding: '4px 20px',
                  fontSize: 12,
                  color: '#006B2C',
                  fontStyle: 'italic',
                  background: '#FAFBFF',
                }}
              >
                {activeTypingNames.join(', ')} đang nhập tin nhắn...
              </div>
            )}

            {/* Composer */}
            {!activeConversation.canSend || featureDisabled ? (
              <div
                className="msg-composer"
                style={{ textAlign: 'center', color: '#505F76', fontSize: 13.5 }}
              >
                Không thể gửi tin nhắn mới cho cuộc trò chuyện này. Lịch sử tin nhắn vẫn được giữ nguyên.
              </div>
            ) : (
              <form className="msg-composer" onSubmit={handleSendSubmit}>
                {(selectedImages.length > 0 || selectedFile) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: '#F2F3FF',
                      fontSize: 12.5,
                    }}
                  >
                    <span>
                      {selectedImages.length > 0
                        ? `Đã chọn ${selectedImages.length}/4 ảnh: ${selectedImages
                            .map((f) => f.name)
                            .join(', ')}`
                        : `Đã chọn tệp: ${selectedFile?.name} (${formatBytes(
                            selectedFile?.size || 0
                          )})`}
                    </span>
                    <button
                      type="button"
                      className="msg-btn"
                      style={{ padding: '2px 8px', fontSize: 11.5 }}
                      onClick={() => {
                        setSelectedImages([]);
                        setSelectedFile(null);
                      }}
                    >
                      Xóa đính kèm
                    </button>
                  </div>
                )}

                <div className="msg-composer-row">
                  <label className="msg-btn" title="Đính kèm tối đa 4 ảnh (JPEG/PNG/WebP ≤ 5MB)">
                    🖼️ Ảnh
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []).slice(0, 4);
                        if (files.length > 0) {
                          setSelectedFile(null);
                          setSelectedImages(files);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <label className="msg-btn" title="Đính kèm 1 tệp (PDF/DOCX/XLSX/TXT ≤ 10MB)">
                    📎 Tệp
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.txt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f) {
                          setSelectedImages([]);
                          setSelectedFile(f);
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <textarea
                    className="msg-composer-textarea"
                    placeholder="Nhập tin nhắn (tối đa 2000 ký tự)..."
                    maxLength={2000}
                    rows={1}
                    value={draftText}
                    onChange={(e) => {
                      setDraftText(e.target.value);
                      if (e.target.value.trim()) {
                        notifyTypingDebounced();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendSubmit(e);
                      }
                    }}
                  />

                  <button type="submit" className="msg-btn msg-btn-primary">
                    Gửi
                  </button>
                </div>
              </form>
            )}
          </>
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
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
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
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
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
                          <div style={{ fontSize: 11.5, color: '#505F76' }}>{p.skillLevel.name}</div>
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

      {/* Modal 3: Add Members to Group */}
      {showAddMembersModal && activeConversation && (
        <div className="msg-modal-backdrop" onClick={() => setShowAddMembersModal(false)}>
          <div
            className="msg-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Thêm thành viên vào nhóm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-modal-header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Thêm thành viên vào nhóm</h2>
              <button
                type="button"
                className="msg-btn"
                onClick={() => setShowAddMembersModal(false)}
              >
                Đóng
              </button>
            </div>
            <form className="msg-modal-body" onSubmit={handleAddGroupMembersSubmit}>
              {modalError && <div className="msg-banner error">{modalError}</div>}
              <input
                type="text"
                className="msg-search-input"
                placeholder="Tìm người chơi cần thêm..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                {playerSearchResults
                  .filter((p) => !activeConversation.members.some((m) => m.id === p.id))
                  .map((p) => {
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
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.fullName}</span>
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
                Thêm đã chọn ({selectedMemberIds.length})
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Image Lightbox */}
      {lightboxImageUrl && (
        <div className="msg-modal-backdrop" onClick={() => setLightboxImageUrl(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Xem ảnh phóng to"
            style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImageUrl}
              alt="Xem ảnh lớn"
              style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12, display: 'block' }}
            />
            <button
              type="button"
              className="msg-btn"
              style={{ position: 'absolute', top: 12, right: 12 }}
              onClick={() => setLightboxImageUrl(null)}
            >
              Đóng ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal 5: Player Profile Modal */}
      {profileModalPlayerId !== null && (
        <PlayerProfileModal
          playerId={profileModalPlayerId}
          onClose={() => setProfileModalPlayerId(null)}
        />
      )}
    </div>
  );
};
