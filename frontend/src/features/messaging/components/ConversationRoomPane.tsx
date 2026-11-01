import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/use-auth';
import { ApiError } from '../../../shared/api/http-client';
import { PlayerProfileModal } from '../../player/profile/PlayerProfileModal';
import { emitMessagingUnreadChanged, messagingApi } from '../services/messaging-api';
import type { WsConnectionState } from '../hooks/useMessagingSocket';
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

export const REACTION_META: Array<{ type: MessageReactionType; emoji: string; label: string }> = [
  { type: 'LIKE', emoji: '👍', label: 'Thích' },
  { type: 'LOVE', emoji: '❤️', label: 'Tim' },
  { type: 'HAHA', emoji: '😆', label: 'Haha' },
  { type: 'WOW', emoji: '😮', label: 'Wow' },
  { type: 'SAD', emoji: '😢', label: 'Buồn' },
  { type: 'ANGRY', emoji: '😡', label: 'Phẫn nộ' },
];

const QUICK_EMOJIS = [
  '🏸',
  '🔥',
  '👏',
  '😂',
  '❤️',
  '👍',
  '🙌',
  '💪',
  '😅',
  '🤝',
  '🎉',
  '🏆',
  '⚡',
  '😉',
  '🤔',
  '😢',
  '😡',
  '🙏',
  '💯',
  '👌',
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

interface ConversationRoomPaneProps {
  conversationId: number;
  compact?: boolean;
  connectionState: WsConnectionState;
  lastWsEnvelope: MessagingWsEnvelope | null;
  reconnectTrigger: number;
  onBackToList: () => void;
  onExpandToWorkspace?: (conversationId: number) => void;
  onCloseDock?: () => void;
  onConversationListChanged: () => void;
  onConversationRemoved: (conversationId: number, reasonBanner?: string) => void;
}

export const ConversationRoomPane: React.FC<ConversationRoomPaneProps> = ({
  conversationId,
  compact = false,
  connectionState,
  lastWsEnvelope,
  reconnectTrigger,
  onBackToList,
  onExpandToWorkspace,
  onCloseDock,
  onConversationListChanged,
  onConversationRemoved,
}) => {
  const { user } = useAuth();

  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [nextBeforeSeq, setNextBeforeSeq] = useState<number | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [presenceMap, setPresenceMap] = useState<Record<number, PresenceEntry>>({});
  const [typingEntries, setTypingEntries] = useState<TypingEntry[]>([]);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Composer state & reply/edit mode
  const [draftText, setDraftText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingMessageItem[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const lastTypingSentAtRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Message action menu & highlight state
  const [openMenuMsgId, setOpenMenuMsgId] = useState<number | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);

  // Header flyout & Group Owner settings state
  const [showHeaderFlyout, setShowHeaderFlyout] = useState(false);
  const [renameTitleInput, setRenameTitleInput] = useState('');
  const [confirmingDissolve, setConfirmingDissolve] = useState(false);
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const headerFlyoutRef = useRef<HTMLDivElement | null>(null);

  // Modals inside room pane
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [playerSearchResults, setPlayerSearchResults] = useState<PlayerDisplay[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [profileModalPlayerId, setProfileModalPlayerId] = useState<number | null>(null);

  // Sync cursors & callback refs (prevents parent re-renders from re-triggering room load)
  const afterSeqRef = useRef<number>(0);
  const sinceVersionRef = useRef<number>(0);
  const minLoadedSeqRef = useRef<number>(1);
  const lastMarkedReadSeqRef = useRef<number>(0);
  const onConversationListChangedRef = useRef(onConversationListChanged);
  const onConversationRemovedRef = useRef(onConversationRemoved);

  useEffect(() => {
    onConversationListChangedRef.current = onConversationListChanged;
    onConversationRemovedRef.current = onConversationRemoved;
  }, [onConversationListChanged, onConversationRemoved]);

  // Scroll preservation when prepending older messages
  const historyContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRestoreRef = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(
    null
  );

  // Object URLs for image previews in composer
  const imagePreviewUrls = useMemo(
    () => selectedImages.map((file) => URL.createObjectURL(file)),
    [selectedImages]
  );

  useEffect(() => {
    return () => {
      for (const url of imagePreviewUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [imagePreviewUrls]);

  // Close popovers on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (headerFlyoutRef.current && !headerFlyoutRef.current.contains(e.target as Node)) {
        setShowHeaderFlyout(false);
        setConfirmingDissolve(false);
      }
      setOpenMenuMsgId(null);
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  const maybeMarkRead = useCallback(async (convId: number, renderedMessages: MessageItem[]) => {
    if (renderedMessages.length === 0) return;
    const highestRenderedSeq = renderedMessages[renderedMessages.length - 1].seq;
    if (highestRenderedSeq <= lastMarkedReadSeqRef.current) return;
    lastMarkedReadSeqRef.current = highestRenderedSeq;

    try {
      await messagingApi.markConversationRead(convId, highestRenderedSeq);
      onConversationListChangedRef.current();
      emitMessagingUnreadChanged();
    } catch {
      // ignore read error
    }
  }, []);

  const loadConversationRoom = useCallback(
    async (convId: number) => {
      setLoadingMessages(true);
      setActionBanner(null);
      setReplyingTo(null);
      setEditingMessage(null);
      setShowHeaderFlyout(false);
      lastMarkedReadSeqRef.current = 0;

      try {
        const [detail, historyRes] = await Promise.all([
          messagingApi.getConversationDetail(convId),
          messagingApi.listMessagesHistory(convId, undefined, 30),
        ]);

        setActiveConversation(detail);
        setRenameTitleInput(detail.title || '');
        const ascending = [...historyRes.data].reverse();
        setMessages(ascending);
        setNextBeforeSeq(historyRes.meta.nextBeforeSeq);

        const maxSeq = ascending.length > 0 ? ascending[ascending.length - 1].seq : detail.lastSeq;
        const minSeq = ascending.length > 0 ? ascending[0].seq : 1;
        afterSeqRef.current = maxSeq;
        minLoadedSeqRef.current = minSeq;
        sinceVersionRef.current = detail.activityVersion;

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
          if (detail.unreadCount > 0) {
            await maybeMarkRead(convId, ascending);
          } else {
            lastMarkedReadSeqRef.current = maxSeq;
          }
        }

        requestAnimationFrame(() => {
          if (historyContainerRef.current) {
            historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
          }
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'MESSAGING_CONVERSATION_NOT_FOUND') {
          onConversationRemovedRef.current(convId);
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [maybeMarkRead]
  );

  useEffect(() => {
    if (conversationId > 0) {
      loadConversationRoom(conversationId);
    }
  }, [conversationId, loadConversationRoom]);

  const runCatchUpSync = useCallback(async () => {
    if (!conversationId) return;
    try {
      const detail = await messagingApi.getConversationDetail(conversationId);
      setActiveConversation(detail);
      setRenameTitleInput(detail.title || '');

      const snap = await messagingApi.syncConversation(
        conversationId,
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
    } catch (err) {
      if (err instanceof ApiError && err.code === 'MESSAGING_CONVERSATION_NOT_FOUND') {
        onConversationRemovedRef.current(conversationId);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    if (reconnectTrigger > 0) {
      runCatchUpSync();
    }
  }, [reconnectTrigger, runCatchUpSync]);

  // Process incoming WebSocket envelopes for this conversation
  useEffect(() => {
    if (!lastWsEnvelope) return;
    const envelope = lastWsEnvelope;

    if (envelope.type === 'message.created') {
      const incoming = envelope.data as MessageItem;
      if (incoming.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.seq === incoming.seq)) return prev;
          const next = [...prev, incoming].sort((a, b) => a.seq - b.seq);
          afterSeqRef.current = Math.max(afterSeqRef.current, incoming.seq);
          maybeMarkRead(incoming.conversationId, next);
          return next;
        });
        setTypingEntries((prev) => prev.filter((t) => t.userId !== incoming.senderId));
        requestAnimationFrame(() => {
          if (historyContainerRef.current) {
            historyContainerRef.current.scrollTop = historyContainerRef.current.scrollHeight;
          }
        });
      }
    } else if (envelope.type === 'message.updated' || envelope.type === 'message.recalled') {
      const updated = envelope.data as MessageItem;
      if (updated.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === updated.id) return updated;
            if (m.parentId === updated.id) {
              return {
                ...m,
                parentMessage: m.parentMessage
                  ? {
                      ...m.parentMessage,
                      body: updated.deletedAt ? null : updated.body ? updated.body.slice(0, 140) : null,
                      hasAttachments: updated.deletedAt ? false : updated.attachments.length > 0,
                      isRecalled: Boolean(updated.deletedAt),
                    }
                  : null,
              };
            }
            return m;
          })
        );
      }
    } else if (envelope.type === 'message.reaction_updated') {
      const payload = envelope.data as {
        messageId: number;
        conversationId: number;
        seq: number;
        reactionVersion: number;
        reactions: MessageReactionSummary[];
      };
      if (payload.conversationId === conversationId) {
        messagingApi
          .syncConversation(
            conversationId,
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
      if (payload.conversationId === conversationId && payload.userId !== user?.id) {
        setTypingEntries((prev) => {
          const rest = prev.filter((t) => t.userId !== payload.userId);
          return [...rest, { userId: payload.userId, expiresAt: payload.expiresAt }];
        });
      }
    } else if (envelope.type === 'presence.updated') {
      const payload = envelope.data as PresenceEntry;
      setPresenceMap((prev) => ({ ...prev, [payload.userId]: payload }));
    } else if (
      envelope.type === 'conversation.member_changed' ||
      envelope.type === 'conversation.updated'
    ) {
      const payload = envelope.data as { conversationId: number };
      if (payload.conversationId === conversationId) {
        messagingApi
          .getConversationDetail(conversationId)
          .then((detail) => {
            setActiveConversation(detail);
            setRenameTitleInput(detail.title || '');
          })
          .catch(() => {
            onConversationRemovedRef.current(
              conversationId,
              'Bạn không còn là thành viên của nhóm này.'
            );
          });
      }
    } else if (envelope.type === 'conversation.dissolved') {
      const payload = envelope.data as { conversationId: number };
      if (payload.conversationId === conversationId) {
        onConversationRemovedRef.current(
          conversationId,
          'Nhóm chat đã được chủ nhóm giải tán.'
        );
      }
    }
  }, [lastWsEnvelope, conversationId, maybeMarkRead, user?.id]);

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
    if (!conversationId || !nextBeforeSeq || loadingOlder) return;
    const container = historyContainerRef.current;
    if (container) {
      pendingScrollRestoreRef.current = {
        prevScrollHeight: container.scrollHeight,
        prevScrollTop: container.scrollTop,
      };
    }

    setLoadingOlder(true);
    try {
      const res = await messagingApi.listMessagesHistory(conversationId, nextBeforeSeq, 30);
      const olderAscending = [...res.data].reverse();
      setMessages((prev) => {
        const existingSeqs = new Set(prev.map((m) => m.seq));
        const prepended = [...olderAscending.filter((m) => !existingSeqs.has(m.seq)), ...prev];
        if (prepended.length > 0) {
          minLoadedSeqRef.current = prepended[0].seq;
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

  const notifyTypingDebounced = () => {
    if (!conversationId || !activeConversation?.canSend) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 3000) return;
    lastTypingSentAtRef.current = now;
    messagingApi.recordTyping(conversationId).catch(() => {});
  };

  const scrollToMessageAndPulse = (targetMsgId: number) => {
    const el = document.getElementById(`msg-item-${targetMsgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetMsgId);
      window.setTimeout(() => {
        setHighlightedMsgId((cur) => (cur === targetMsgId ? null : cur));
      }, 1500);
    }
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
        parentId: item.parentId ?? null,
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

      onConversationListChanged();
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

  const handleSendOrEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversationId || !activeConversation?.canSend) return;

    const trimmed = draftText.trim();
    if (trimmed.length > 2000) return;

    // Handle inline Edit submit
    if (editingMessage) {
      if (!trimmed) return;
      try {
        const updated = await messagingApi.editMessage(editingMessage.id, trimmed);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setEditingMessage(null);
        setDraftText('');
        onConversationListChanged();
      } catch (err) {
        if (err instanceof ApiError) setActionBanner(err.message);
      }
      return;
    }

    if (!trimmed && selectedImages.length === 0 && !selectedFile) return;

    const newItem: PendingMessageItem = {
      clientMessageId: generateClientUuid(),
      conversationId,
      text: trimmed,
      parentId: replyingTo ? replyingTo.id : null,
      parentMessage: replyingTo
        ? {
            id: replyingTo.id,
            seq: replyingTo.seq,
            senderId: replyingTo.senderId,
            senderName: replyingTo.senderName,
            body: replyingTo.body ? replyingTo.body.slice(0, 140) : null,
            hasAttachments: replyingTo.attachments.length > 0,
            isRecalled: false,
          }
        : null,
      images: [...selectedImages],
      file: selectedFile,
      status: 'SENDING',
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };

    setPendingItems((prev) => [...prev, newItem]);
    setDraftText('');
    setReplyingTo(null);
    setSelectedImages([]);
    setSelectedFile(null);
    setShowEmojiPicker(false);

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

  const handleStartEditMessage = (msg: MessageItem) => {
    setReplyingTo(null);
    setSelectedImages([]);
    setSelectedFile(null);
    setEditingMessage(msg);
    setDraftText(msg.body || '');
    setOpenMenuMsgId(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleRecallMessage = async (msg: MessageItem) => {
    setOpenMenuMsgId(null);
    try {
      const recalled = await messagingApi.recallMessage(msg.id);
      setMessages((prev) => prev.map((m) => (m.id === recalled.id ? recalled : m)));
      onConversationListChanged();
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

  const handleHideMessageForMe = async (msg: MessageItem) => {
    setOpenMenuMsgId(null);
    try {
      await messagingApi.hideMessageForMe(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      onConversationListChanged();
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

  // Drag & Drop + Clipboard Paste handlers
  const attachIncomingFiles = (fileList: File[]) => {
    if (!activeConversation?.canSend || editingMessage) return;
    const imgFiles = fileList.filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    const docFiles = fileList.filter(
      (f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );

    if (imgFiles.length > 0) {
      setSelectedFile(null);
      setSelectedImages((prev) => [...prev, ...imgFiles].slice(0, 4));
    } else if (docFiles.length > 0) {
      setSelectedImages([]);
      setSelectedFile(docFiles[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) imageFiles.push(f);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      attachIncomingFiles(imageFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      attachIncomingFiles(files);
    }
  };

  // Group Owner & Member actions
  const isGroupOwner =
    activeConversation?.type === 'GROUP' && activeConversation.createdBy === user?.id;

  const handleUpdateGroupSettings = async (patch: { title?: string; isLocked?: boolean }) => {
    if (!activeConversation) return;
    setUpdatingGroup(true);
    try {
      const updated = await messagingApi.updateGroupConversation(activeConversation.id, patch);
      setActiveConversation(updated);
      setRenameTitleInput(updated.title || '');
      onConversationListChanged();
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleKickMember = async (targetUserId: number) => {
    if (!activeConversation) return;
    try {
      const updated = await messagingApi.removeGroupMember(activeConversation.id, targetUserId);
      setActiveConversation(updated);
      onConversationListChanged();
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

  const handleDissolveGroup = async () => {
    if (!activeConversation) return;
    setUpdatingGroup(true);
    try {
      await messagingApi.dissolveGroupConversation(activeConversation.id);
      onConversationRemoved(activeConversation.id, 'Đã giải tán nhóm chat.');
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversation || activeConversation.type !== 'GROUP') return;
    try {
      await messagingApi.leaveGroupConversation(activeConversation.id);
      onConversationRemoved(activeConversation.id);
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
      onConversationListChanged();
      setShowHeaderFlyout(false);
      setActionBanner('Đã chặn người chơi này. Lịch sử trò chuyện vẫn được giữ lại.');
    } catch (err) {
      if (err instanceof ApiError) setActionBanner(err.message);
    }
  };

  // Add members modal search
  useEffect(() => {
    if (!showAddMembersModal) return;
    messagingApi
      .searchPlayers(playerSearchQuery, 20)
      .then((list) => setPlayerSearchResults(list))
      .catch(() => setPlayerSearchResults([]));
  }, [showAddMembersModal, playerSearchQuery]);

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
      onConversationListChanged();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Không thể thêm thành viên');
    } finally {
      setModalSubmitting(false);
    }
  };

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
    () => pendingItems.filter((p) => p.conversationId === conversationId),
    [pendingItems, conversationId]
  );

  if (!activeConversation && loadingMessages) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#505F76', fontSize: 13.5 }}>
        Đang tải cuộc trò chuyện...
      </div>
    );
  }

  if (!activeConversation) {
    return null;
  }

  return (
    <div
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
      onDragOver={(e) => {
        e.preventDefault();
        if (activeConversation.canSend && !editingMessage) setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragOver(false);
      }}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="msg-dropzone-overlay">
          <span style={{ fontSize: 28 }}>📥</span>
          <span>Thả ảnh (tối đa 4) hoặc tệp vào đây để đính kèm</span>
        </div>
      )}

      {/* Header */}
      <header className="msg-chat-header" ref={headerFlyoutRef}>
        <div className="msg-chat-header-info">
          <button
            type="button"
            className={compact ? 'msg-icon-btn' : 'msg-btn msg-back-mobile'}
            title="Quay lại danh sách"
            aria-label="Quay lại danh sách"
            onClick={onBackToList}
          >
            {compact ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            ) : (
              '← Danh sách'
            )}
          </button>

          <div className="msg-avatar-wrap" style={compact ? { width: 36, height: 36 } : undefined}>
            <div
              className={`msg-avatar ${activeConversation.type === 'GROUP' ? 'group' : ''}`}
              style={compact ? { width: 36, height: 36, fontSize: 13.5 } : undefined}
            >
              {activeConvDisplayName.charAt(0).toUpperCase()}
            </div>
            {activeCounterpartOnline && <span className="msg-online-dot" />}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <button
              type="button"
              className="msg-header-title-trigger"
              aria-label="Cài đặt cuộc trò chuyện"
              onClick={() => setShowHeaderFlyout((v) => !v)}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: compact ? 14 : 15,
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeConvDisplayName}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            <div className="msg-chat-subtitle">
              {activeConversation.type === 'GROUP' ? (
                <>
                  <span>{activeConversation.members.length} thành viên</span>
                  {isGroupOwner && <span className="msg-owner-badge">Chủ nhóm</span>}
                  {activeConversation.isLocked && (
                    <span className="msg-lock-badge">🔒 Đã khóa</span>
                  )}
                </>
              ) : activeCounterpartOnline ? (
                <span style={{ color: '#059669', fontWeight: 600 }}>● Đang hoạt động</span>
              ) : (
                activeConversation.counterpart?.skillLevel?.name || 'Ngoại tuyến'
              )}
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {!compact && activeConversation.type === 'GROUP' && (
            <>
              {isGroupOwner && (
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
              )}
              {!isGroupOwner && (
                <button
                  type="button"
                  className="msg-btn msg-btn-danger"
                  onClick={handleLeaveGroup}
                >
                  Rời nhóm
                </button>
              )}
            </>
          )}

          {!compact && activeConversation.type === 'DIRECT' && (
            <>
              {activeConversation.counterpart && (
                <button
                  type="button"
                  className="msg-btn"
                  onClick={() => setProfileModalPlayerId(activeConversation.counterpart!.id)}
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

          <button
            type="button"
            className="msg-icon-btn"
            title="Tùy chọn & Thành viên"
            aria-label="Tùy chọn & Thành viên"
            onClick={() => setShowHeaderFlyout((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
              <circle cx="5" cy="12" r="1.5" />
            </svg>
          </button>

          {compact && onExpandToWorkspace && (
            <button
              type="button"
              className="msg-icon-btn"
              title="Mở trong trang Tin nhắn đầy đủ"
              aria-label="Mở trong trang Tin nhắn đầy đủ"
              onClick={() => onExpandToWorkspace(activeConversation.id)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
            </button>
          )}

          {compact && onCloseDock && (
            <button
              type="button"
              className="msg-icon-btn"
              title="Thu gọn khung chat"
              aria-label="Thu gọn khung chat"
              onClick={onCloseDock}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Header Flyout Menu (Group Owner Admin / Members / 1-1 Actions) */}
        {showHeaderFlyout && (
          <div className="msg-header-flyout" role="dialog" aria-label="Quản lý cuộc trò chuyện">
            {activeConversation.type === 'GROUP' ? (
              <>
                {isGroupOwner && (
                  <div className="msg-flyout-section">
                    <span className="msg-flyout-label">Quản trị của Chủ nhóm</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        className="msg-search-input"
                        placeholder="Tên nhóm..."
                        maxLength={120}
                        value={renameTitleInput}
                        onChange={(e) => setRenameTitleInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="msg-btn msg-btn-primary"
                        disabled={
                          updatingGroup ||
                          !renameTitleInput.trim() ||
                          renameTitleInput.trim() === activeConversation.title
                        }
                        onClick={() =>
                          handleUpdateGroupSettings({ title: renameTitleInput.trim() })
                        }
                      >
                        Lưu tên
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {activeConversation.isLocked
                          ? '🔒 Nhóm đang khóa gửi tin'
                          : '🔓 Cho phép thành viên gửi tin'}
                      </span>
                      <button
                        type="button"
                        className="msg-btn"
                        disabled={updatingGroup}
                        onClick={() =>
                          handleUpdateGroupSettings({ isLocked: !activeConversation.isLocked })
                        }
                      >
                        {activeConversation.isLocked ? 'Mở khóa' : 'Khóa gửi tin'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="msg-flyout-section">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span className="msg-flyout-label">
                      Thành viên ({activeConversation.members.length})
                    </span>
                    {isGroupOwner && (
                      <button
                        type="button"
                        className="msg-btn"
                        style={{ padding: '3px 8px', fontSize: 11.5 }}
                        onClick={() => {
                          setShowHeaderFlyout(false);
                          setSelectedMemberIds([]);
                          setPlayerSearchQuery('');
                          setModalError(null);
                          setShowAddMembersModal(true);
                        }}
                      >
                        + Thêm
                      </button>
                    )}
                  </div>

                  <div className="msg-member-list-compact">
                    {activeConversation.members.map((m) => {
                      const isCreator = m.id === activeConversation.createdBy;
                      return (
                        <div key={m.id} className="msg-member-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {m.fullName}
                            </span>
                            {isCreator && <span className="msg-owner-badge">Chủ nhóm</span>}
                          </div>
                          {isGroupOwner && !isCreator && (
                            <button
                              type="button"
                              className="msg-btn msg-btn-danger"
                              style={{ padding: '2px 7px', fontSize: 11 }}
                              onClick={() => handleKickMember(m.id)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="msg-flyout-section">
                  {isGroupOwner ? (
                    !confirmingDissolve ? (
                      <button
                        type="button"
                        className="msg-btn msg-btn-danger"
                        onClick={() => setConfirmingDissolve(true)}
                      >
                        Giải tán nhóm chat
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#991B1B', fontWeight: 600 }}>
                          Xác nhận giải tán nhóm? Nhóm sẽ bị đóng với tất cả thành viên.
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="msg-btn msg-btn-danger"
                            disabled={updatingGroup}
                            onClick={handleDissolveGroup}
                          >
                            Xác nhận giải tán
                          </button>
                          <button
                            type="button"
                            className="msg-btn"
                            onClick={() => setConfirmingDissolve(false)}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      className="msg-btn msg-btn-danger"
                      onClick={handleLeaveGroup}
                    >
                      Rời khỏi nhóm
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="msg-flyout-section">
                <span className="msg-flyout-label">Tùy chọn trò chuyện 1-1</span>
                {activeConversation.counterpart && (
                  <button
                    type="button"
                    className="msg-btn"
                    onClick={() => {
                      setShowHeaderFlyout(false);
                      setProfileModalPlayerId(activeConversation.counterpart!.id);
                    }}
                  >
                    Xem hồ sơ người chơi
                  </button>
                )}
                {activeConversation.canSend && activeConversation.counterpart && (
                  <button
                    type="button"
                    className="msg-btn msg-btn-danger"
                    onClick={handleBlockCounterpart}
                  >
                    Chặn người chơi này
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Status Banners */}
      {connectionState === 'DISCONNECTED' && !featureDisabled && (
        <div className="msg-banner warning" role="status">
          <span>Mất kết nối thời gian thực — đang tự động kết nối lại...</span>
          <button type="button" className="msg-btn" onClick={runCatchUpSync}>
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
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
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
          messages.map((msg, idx) => {
            const isMine = msg.senderId === user?.id;
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const isGroupedWithPrev =
              prevMsg !== null &&
              prevMsg.senderId === msg.senderId &&
              new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() <
                5 * 60 * 1000;

            const isRecalled = Boolean(msg.deletedAt);
            const recalledByGroupOwner =
              isRecalled &&
              msg.deletedByUserId !== null &&
              msg.deletedByUserId !== msg.senderId;

            const imageAttachments = msg.attachments.filter((a) => a.kind === 'IMAGE');
            const fileAttachments = msg.attachments.filter((a) => a.kind === 'FILE');
            const senderIsOwner =
              activeConversation.type === 'GROUP' &&
              msg.senderId === activeConversation.createdBy;

            const canEditMsg =
              isMine && !isRecalled && Boolean(msg.body) && activeConversation.canSend;
            const canRecallMsg = (isMine || isGroupOwner) && !isRecalled;

            return (
              <div
                key={msg.id}
                id={`msg-item-${msg.id}`}
                className={`msg-row ${isMine ? 'mine' : 'theirs'} ${
                  isGroupedWithPrev ? 'grouped' : ''
                } ${highlightedMsgId === msg.id ? 'msg-highlight-pulse' : ''}`}
              >
                {!isMine && !isGroupedWithPrev && (
                  <span className="msg-sender-label">
                    <span>{msg.senderName}</span>
                    {senderIsOwner && <span className="msg-owner-badge">Chủ nhóm</span>}
                  </span>
                )}

                <div className="msg-bubble-wrap">
                  <div className={`msg-bubble ${isRecalled ? 'recalled' : ''}`}>
                    {/* Quoted Reply Snippet */}
                    {!isRecalled && msg.parentMessage && (
                      <div
                        className="msg-quote-box"
                        role="button"
                        tabIndex={0}
                        onClick={() => scrollToMessageAndPulse(msg.parentMessage!.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') scrollToMessageAndPulse(msg.parentMessage!.id);
                        }}
                      >
                        <span className="msg-quote-sender">↩ {msg.parentMessage.senderName}</span>
                        <span className="msg-quote-snippet">
                          {msg.parentMessage.isRecalled
                            ? 'Tin nhắn đã được thu hồi'
                            : msg.parentMessage.body ||
                              (msg.parentMessage.hasAttachments ? '[Đính kèm tệp / ảnh]' : '')}
                        </span>
                      </div>
                    )}

                    {isRecalled ? (
                      <div>
                        {recalledByGroupOwner
                          ? 'Tin nhắn đã bị chủ nhóm thu hồi'
                          : 'Tin nhắn đã được thu hồi'}
                      </div>
                    ) : (
                      <>
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
                                  fontSize: 12.5,
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
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#006B2C' }}>
                              Tải về
                            </span>
                          </a>
                        ))}

                        <div className="msg-meta-footer">
                          {msg.editedAt && <span>(đã chỉnh sửa)</span>}
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Hover Action Toolbar beside Bubble */}
                  {!featureDisabled && (
                    <div
                      className={`msg-hover-toolbar ${
                        openMenuMsgId === msg.id ? 'menu-open' : ''
                      }`}
                    >
                      {!isRecalled && activeConversation.canSend && (
                        <>
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

                          <button
                            type="button"
                            className="msg-action-icon-btn"
                            title="Trả lời tin nhắn"
                            aria-label="Trả lời tin nhắn"
                            onClick={() => {
                              setEditingMessage(null);
                              setReplyingTo(msg);
                              requestAnimationFrame(() => textareaRef.current?.focus());
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 17 4 12 9 7" />
                              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                            </svg>
                          </button>
                        </>
                      )}

                      <div style={{ position: 'relative' }} onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="msg-action-icon-btn"
                          title="Tùy chọn tin nhắn"
                          aria-label="Tùy chọn tin nhắn"
                          onClick={() =>
                            setOpenMenuMsgId((cur) => (cur === msg.id ? null : msg.id))
                          }
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1.2" />
                            <circle cx="19" cy="12" r="1.2" />
                            <circle cx="5" cy="12" r="1.2" />
                          </svg>
                        </button>

                        {openMenuMsgId === msg.id && (
                          <div className="msg-more-popover" role="menu">
                            {canEditMsg && (
                              <button
                                type="button"
                                className="msg-more-item"
                                role="menuitem"
                                onClick={() => handleStartEditMessage(msg)}
                              >
                                ✏️ Chỉnh sửa
                              </button>
                            )}
                            {canRecallMsg && (
                              <button
                                type="button"
                                className="msg-more-item danger"
                                role="menuitem"
                                onClick={() => handleRecallMessage(msg)}
                              >
                                🗑️ Thu hồi
                              </button>
                            )}
                            <button
                              type="button"
                              className="msg-more-item"
                              role="menuitem"
                              onClick={() => handleHideMessageForMe(msg)}
                            >
                              🙈 Ẩn ở phía tôi
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing Reactions */}
                {!isRecalled && msg.reactions.length > 0 && (
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
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Pending & Failed Send Items */}
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
            padding: '4px 16px',
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
          style={{ textAlign: 'center', color: '#505F76', fontSize: 13 }}
        >
          {activeConversation.sendDisabledReason === 'MESSAGING_GROUP_LOCKED'
            ? '🔒 Nhóm đang khóa gửi tin — chỉ Chủ nhóm mới có thể gửi tin nhắn.'
            : 'Không thể gửi tin nhắn mới cho cuộc trò chuyện này. Lịch sử tin nhắn vẫn được giữ nguyên.'}
        </div>
      ) : (
        <form className="msg-composer" onSubmit={handleSendOrEditSubmit}>
          {/* Reply or Edit Context Banner */}
          {(replyingTo || editingMessage) && (
            <div className="msg-composer-context-bar">
              <div style={{ minWidth: 0, flex: 1 }}>
                {editingMessage ? (
                  <span>
                    ✏️ <b>Đang chỉnh sửa tin nhắn</b>
                  </span>
                ) : (
                  <span>
                    ↩ Đang trả lời <b>{replyingTo?.senderName}</b>:{' '}
                    {replyingTo?.body
                      ? replyingTo.body.slice(0, 80)
                      : '[Đính kèm tệp / hình ảnh]'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="msg-btn"
                style={{ padding: '2px 7px', fontSize: 11 }}
                onClick={() => {
                  setReplyingTo(null);
                  if (editingMessage) {
                    setEditingMessage(null);
                    setDraftText('');
                  }
                }}
              >
                Hủy ✕
              </button>
            </div>
          )}

          {/* Selected Images Thumbnails or File Preview */}
          {(selectedImages.length > 0 || selectedFile) && !editingMessage && (
            <div className="msg-composer-thumbs">
              {selectedImages.length > 0 ? (
                <>
                  {selectedImages.map((img, i) => (
                    <div key={`${img.name}-${i}`} className="msg-composer-thumb-item">
                      <img src={imagePreviewUrls[i]} alt={img.name} />
                      <button
                        type="button"
                        className="msg-composer-thumb-remove"
                        title="Bỏ ảnh này"
                        onClick={() =>
                          setSelectedImages((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 12,
                      color: '#505F76',
                      marginLeft: 4,
                    }}
                  >
                    Đã chọn {selectedImages.length}/4 ảnh
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    fontSize: 12.5,
                  }}
                >
                  <span>
                    📎 Đã chọn tệp: <b>{selectedFile?.name}</b> (
                    {formatBytes(selectedFile?.size || 0)})
                  </span>
                  <button
                    type="button"
                    className="msg-btn"
                    style={{ padding: '2px 8px', fontSize: 11.5 }}
                    onClick={() => setSelectedFile(null)}
                  >
                    Xóa đính kèm
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="msg-emoji-popover" role="dialog" aria-label="Chọn biểu tượng cảm xúc">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="msg-reaction-btn"
                  style={{ fontSize: 17, padding: 5 }}
                  onClick={() => {
                    setDraftText((prev) => `${prev}${em}`);
                    setShowEmojiPicker(false);
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          <div className="msg-composer-row">
            <div className="msg-composer-tools">
              {!editingMessage && (
                <>
                  <label
                    className="msg-icon-btn"
                    title="Đính kèm tối đa 4 ảnh (JPEG/PNG/WebP ≤ 5MB) hoặc dán ảnh Ctrl+V"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
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

                  <label
                    className="msg-icon-btn"
                    title="Đính kèm 1 tệp (PDF/DOCX/XLSX/TXT ≤ 10MB)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
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
                </>
              )}

              <button
                type="button"
                className="msg-icon-btn"
                title="Chèn biểu tượng cảm xúc"
                aria-label="Chèn biểu tượng cảm xúc"
                onClick={() => setShowEmojiPicker((v) => !v)}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
            </div>

            <textarea
              ref={textareaRef}
              className="msg-composer-textarea"
              placeholder={
                editingMessage
                  ? 'Nhập nội dung chỉnh sửa...'
                  : compact
                    ? 'Nhập tin nhắn...'
                    : 'Nhập tin nhắn (hỗ trợ dán ảnh Ctrl+V hoặc kéo thả tệp)...'
              }
              rows={1}
              value={draftText}
              onPaste={handlePaste}
              onChange={(e) => {
                setDraftText(e.target.value);
                if (e.target.value.trim()) {
                  notifyTypingDebounced();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendOrEditSubmit(e);
                } else if (e.key === 'Escape' && (replyingTo || editingMessage)) {
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setDraftText('');
                }
              }}
            />

            <button
              type="submit"
              className="msg-send-btn"
              disabled={draftText.trim().length > 2000}
            >
              <span>{editingMessage ? 'Lưu' : 'Gửi'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {draftText.length >= 1500 && (
            <div className={`msg-char-counter ${draftText.length > 2000 ? 'over' : ''}`}>
              {draftText.length}/2000 ký tự
            </div>
          )}
        </form>
      )}

      {/* Modal: Add Members to Group */}
      {showAddMembersModal && (
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
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}
              >
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

      {/* Modal: Image Lightbox */}
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

      {/* Modal: Player Profile Modal */}
      {profileModalPlayerId !== null && (
        <PlayerProfileModal
          playerId={profileModalPlayerId}
          onClose={() => setProfileModalPlayerId(null)}
        />
      )}
    </div>
  );
};

