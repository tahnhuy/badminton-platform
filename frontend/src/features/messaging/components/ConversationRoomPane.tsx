import { ArrowLeft, ChevronDown, MoreHorizontal, Maximize2, X, ImagePlus, Paperclip, Smile, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverAnchor, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/shared/utils/cn';
import { MessageBubble } from './MessageBubble';
import { MessagingAvatar, MessagingDialog } from './MessagingUi';
import { MessagingImageViewer } from './MessagingImageViewer';
import { formatBytes } from './message-presentation';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [dismissedHoverMsgId, setDismissedHoverMsgId] = useState<number | null>(null);
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
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [profileModalPlayerId, setProfileModalPlayerId] = useState<number | null>(null);

  useEffect(() => {
    if (!lightboxImageUrl) return;
    setLightboxZoom(1);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImageUrl(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [lightboxImageUrl]);

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
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
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

  if (!activeConversation && loadingMessages) return <div role="status" className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Đang tải cuộc trò chuyện...</div>;
  if (!activeConversation) return null;
  return <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" onDragOver={e => { e.preventDefault(); if (activeConversation.canSend && !editingMessage) setIsDragOver(true); }} onDragLeave={e => { if (e.currentTarget === e.target) setIsDragOver(false); }} onDrop={handleDrop}>
    {isDragOver && <div className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-accent/95 p-6 text-center font-semibold text-primary">
      <Download aria-hidden="true" className="size-8" />Thả ảnh (tối đa 4) hoặc tệp vào đây để đính kèm</div>}
    <Popover open={showHeaderFlyout} onOpenChange={setShowHeaderFlyout}>
      <PopoverAnchor asChild>
        <header ref={headerFlyoutRef} className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card p-3 sm:p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button type="button" variant="ghost" size={compact ? 'icon' : 'default'} className={compact ? '' : 'min-[641px]:hidden'} title="Quay lại danh sách" aria-label="Quay lại danh sách" onClick={onBackToList}>
              <ArrowLeft aria-hidden="true" />{!compact && 'Danh sách'}</Button>
            <span className="relative shrink-0">
              <MessagingAvatar name={activeConvDisplayName} group={activeConversation.type === 'GROUP'} />{activeCounterpartOnline && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-card bg-success" />}</span>
            <div className="min-w-0 flex-1">
              <button type="button" className="flex max-w-full items-center gap-1 rounded-md text-left text-sm font-bold outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring" aria-label="Cài đặt cuộc trò chuyện" aria-haspopup="dialog" aria-expanded={showHeaderFlyout} onClick={() => setShowHeaderFlyout(v => !v)}>
                <span className="truncate">{activeConvDisplayName}</span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
              </button>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">{activeConversation.type === 'GROUP' ? <>
                <span>{activeConversation.members.length} thành viên</span>{isGroupOwner && <Badge>Chủ nhóm</Badge>}{activeConversation.isLocked && <Badge>Đã khóa</Badge>}</> : activeCounterpartOnline ? <span className="font-semibold text-success">● Đang hoạt động</span> : activeConversation.counterpart?.skillLevel?.name || 'Ngoại tuyến'}</div>
            </div>
          </div>
          <div className={cn('flex flex-wrap items-center gap-1', !compact && 'max-[640px]:w-full max-[640px]:justify-end')}>
            {!compact && activeConversation.type === 'GROUP' && <>{isGroupOwner && <Button type="button" variant="outline" onClick={() => { setSelectedMemberIds([]); setPlayerSearchQuery(''); setModalError(null); setShowAddMembersModal(true); }}>+ Thêm thành viên</Button>}{!isGroupOwner && <Button type="button" variant="danger-soft" onClick={handleLeaveGroup}>Rời nhóm</Button>}</>}
            {!compact && activeConversation.type === 'DIRECT' && <>{activeConversation.counterpart && <Button type="button" variant="outline" onClick={() => setProfileModalPlayerId(activeConversation.counterpart!.id)}>Xem hồ sơ</Button>}{activeConversation.canSend && activeConversation.counterpart && <Button type="button" variant="danger-soft" onClick={handleBlockCounterpart}>Chặn</Button>}</>}
            <Button type="button" variant="ghost" size="icon" title="Tùy chọn & Thành viên" aria-label="Tùy chọn & Thành viên" aria-haspopup="dialog" aria-expanded={showHeaderFlyout} onClick={() => setShowHeaderFlyout(v => !v)}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
            {compact && onExpandToWorkspace && <Button type="button" variant="ghost" size="icon" title="Mở trong trang Tin nhắn đầy đủ" aria-label="Mở trong trang Tin nhắn đầy đủ" onClick={() => onExpandToWorkspace(activeConversation.id)}>
              <Maximize2 aria-hidden="true" />
            </Button>}
            {compact && onCloseDock && <Button type="button" variant="ghost" size="icon" title="Thu gọn khung chat" aria-label="Thu gọn khung chat" onClick={onCloseDock}>
              <X aria-hidden="true" />
            </Button>}
          </div>
          <PopoverContent portalled={false} align="end" aria-label="Quản lý cuộc trò chuyện" onOpenAutoFocus={e => e.preventDefault()} className="w-96 space-y-4">
            {activeConversation.type === 'GROUP' ? <>{isGroupOwner && <div className="space-y-3">
              <h2 className="text-sm font-bold">Quản trị của Chủ nhóm</h2>
              <div className="flex gap-2">
                <Input aria-label="Tên nhóm" placeholder="Tên nhóm..." maxLength={120} value={renameTitleInput} onChange={e => setRenameTitleInput(e.target.value)} />
                <Button type="button" disabled={updatingGroup || !renameTitleInput.trim() || renameTitleInput.trim() === activeConversation.title} onClick={() => handleUpdateGroupSettings({ title: renameTitleInput.trim() })}>Lưu tên</Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{activeConversation.isLocked ? '🔒 Nhóm đang khóa gửi tin' : '🔓 Cho phép thành viên gửi tin'}</span>
                <Button type="button" variant="outline" disabled={updatingGroup} onClick={() => handleUpdateGroupSettings({ isLocked: !activeConversation.isLocked })}>{activeConversation.isLocked ? 'Mở khóa' : 'Khóa gửi tin'}</Button>
              </div>
            </div>}
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">Thành viên ({activeConversation.members.length})</h2>{isGroupOwner && <Button type="button" variant="outline" onClick={() => { setShowHeaderFlyout(false); setSelectedMemberIds([]); setPlayerSearchQuery(''); setModalError(null); setShowAddMembersModal(true); }}>+ Thêm</Button>}</div>
                <div className="max-h-60 space-y-2 overflow-y-auto">{activeConversation.members.map(m => {
                  const isCreator = m.id === activeConversation.createdBy; return <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2">
                    <span className="min-w-0 break-words text-sm font-semibold">{m.fullName}{isCreator && <Badge className="ml-1">Chủ nhóm</Badge>}</span>{isGroupOwner && !isCreator && <Button type="button" variant="danger-soft" onClick={() => handleKickMember(m.id)}>Xóa</Button>}</div>;
                })}</div>
              </div>
              <div className="border-t border-border pt-3">{isGroupOwner ? !confirmingDissolve ? <Button type="button" variant="danger-soft" onClick={() => setConfirmingDissolve(true)}>Giải tán nhóm chat</Button> : <div className="space-y-2">
                <p className="text-sm text-destructive">Xác nhận giải tán nhóm? Nhóm sẽ bị đóng với tất cả thành viên.</p>
                <div className="flex gap-2">
                  <Button type="button" variant="danger" disabled={updatingGroup} onClick={handleDissolveGroup}>Xác nhận giải tán</Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingDissolve(false)}>Hủy</Button>
                </div>
              </div> : <Button type="button" variant="danger-soft" onClick={handleLeaveGroup}>Rời khỏi nhóm</Button>}</div>
            </> : <div className="space-y-3">
              <h2 className="text-sm font-bold">Tùy chọn trò chuyện 1-1</h2>{activeConversation.counterpart && <Button type="button" variant="outline" onClick={() => { setShowHeaderFlyout(false); setProfileModalPlayerId(activeConversation.counterpart!.id); }}>Xem hồ sơ người chơi</Button>}{activeConversation.canSend && activeConversation.counterpart && <Button type="button" variant="danger-soft" onClick={handleBlockCounterpart}>Chặn người chơi này</Button>}</div>}
          </PopoverContent>
        </header>
      </PopoverAnchor>
    </Popover>
    {connectionState === 'DISCONNECTED' && !featureDisabled && <Alert variant="warning" role="status">Mất kết nối thời gian thực — đang tự động kết nối lại...<Button type="button" variant="outline" className="ml-2" onClick={runCatchUpSync}>Đồng bộ ngay</Button>
    </Alert>}
    {featureDisabled && <Alert variant="destructive">Tính năng nhắn tin hiện đang tạm khóa bảo trì. Bạn vẫn có thể xem lại lịch sử.</Alert>}
    {actionBanner && <Alert variant="warning" role="status">{actionBanner}<Button type="button" variant="ghost" onClick={() => setActionBanner(null)}>Đóng</Button>
    </Alert>}
    <div ref={historyContainerRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-background/40 p-3 sm:p-5">
      {nextBeforeSeq && <div className="mb-3 text-center">
        <Button type="button" variant="outline" disabled={loadingOlder} onClick={handleLoadOlderMessages}>{loadingOlder ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}</Button>
      </div>}
      {loadingMessages ? <p role="status" className="text-center text-sm text-muted-foreground">Đang tải lịch sử tin nhắn...</p> : messages.length === 0 && activePendingItems.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Hãy gửi lời chào đầu tiên trong cuộc trò chuyện này!</p> : messages.map((msg, idx) => <MessageBubble key={msg.id} message={msg} previous={idx > 0 ? messages[idx - 1] : null} meId={user?.id} conversation={activeConversation} isGroupOwner={isGroupOwner} featureDisabled={featureDisabled} highlighted={highlightedMsgId === msg.id} openMenuMsgId={openMenuMsgId} dismissedHoverMsgId={dismissedHoverMsgId} setOpenMenuMsgId={setOpenMenuMsgId} setDismissedHoverMsgId={setDismissedHoverMsgId} onReply={message => { setEditingMessage(null); setReplyingTo(message); requestAnimationFrame(() => textareaRef.current?.focus()); }} onEdit={handleStartEditMessage} onRecall={handleRecallMessage} onHide={handleHideMessageForMe} onReact={handleToggleReaction} onQuote={scrollToMessageAndPulse} onImage={setLightboxImageUrl} />)}
      {activePendingItems.map(item => <div key={item.clientMessageId} className="mt-4 flex min-w-0 flex-col items-end gap-2">
        <div className="max-w-[90%] rounded-2xl rounded-br-md bg-primary/80 px-4 py-3 text-sm text-primary-foreground [overflow-wrap:anywhere]">{item.text && <div className="whitespace-pre-wrap">{item.text}</div>}{item.images.length > 0 && <p className="mt-1 text-xs">🖼️ Đính kèm {item.images.length} ảnh</p>}{item.file && <p className="mt-1 text-xs">📎 {item.file.name}</p>}</div>{item.status === 'SENDING' ? <span className="text-xs text-muted-foreground">Đang gửi...</span> : <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs font-semibold text-destructive">{item.errorMessage || 'Gửi thất bại'}</span>
          <Button type="button" onClick={() => executeSendItem(item)}>Thử lại</Button>
          <Button type="button" variant="outline" onClick={() => setPendingItems(prev => prev.filter(p => p.clientMessageId !== item.clientMessageId))}>Hủy</Button>
        </div>}</div>)}
    </div>
    {activeTypingNames.length > 0 && <p className="px-4 py-2 text-xs text-muted-foreground">{activeTypingNames.join(', ')} đang nhập tin nhắn...</p>}
    {!activeConversation.canSend || featureDisabled ? <div className="shrink-0 border-t border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">{activeConversation.sendDisabledReason === 'MESSAGING_GROUP_LOCKED' ? '🔒 Nhóm đang khóa gửi tin — chỉ Chủ nhóm mới có thể gửi tin nhắn.' : 'Không thể gửi tin nhắn mới cho cuộc trò chuyện này. Lịch sử tin nhắn vẫn được giữ nguyên.'}</div> : <form onSubmit={handleSendOrEditSubmit} className="relative shrink-0 space-y-3 border-t border-border bg-card p-3">
      {(replyingTo || editingMessage) && <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border-l-2 border-primary bg-accent p-3 text-sm">
        <div className="min-w-0 truncate">{editingMessage ? <b>✏️ Đang chỉnh sửa tin nhắn</b> : <>↩ Đang trả lời <b>{replyingTo?.senderName}</b>: {replyingTo?.body ? replyingTo.body.slice(0, 80) : '[Đính kèm tệp / hình ảnh]'}</>}</div>
        <Button type="button" variant="ghost" onClick={() => { setReplyingTo(null); if (editingMessage) { setEditingMessage(null); setDraftText(''); } }}>Hủy ✕</Button>
      </div>}
      {(selectedImages.length > 0 || selectedFile) && !editingMessage && <div className="flex flex-wrap items-center gap-2">{selectedImages.length > 0 ? <>{selectedImages.map((img, i) => <div key={`${img.name}-${i}`} className="relative size-20">
        <img src={imagePreviewUrls[i]} alt={img.name} className="size-full rounded-lg object-cover" />
        <Button type="button" variant="danger-soft" size="icon" className="absolute -right-1 -top-1" title="Bỏ ảnh này" aria-label="Bỏ ảnh này" onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}>
          <X aria-hidden="true" />
        </Button>
      </div>)}<p className="text-xs text-muted-foreground">Đã chọn {selectedImages.length}/4 ảnh</p>
      </> : <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="break-all">📎 Đã chọn tệp: <b>{selectedFile?.name}</b> ({formatBytes(selectedFile?.size || 0)})</span>
        <Button type="button" variant="outline" onClick={() => setSelectedFile(null)}>Xóa đính kèm</Button>
      </div>}</div>}
      <div className="flex flex-wrap items-end gap-2">
        <div className={cn("flex items-center gap-1", compact ? "basis-full" : "max-[640px]:basis-full")}>
          {!editingMessage && <>
            <label role="button" tabIndex={0} aria-label="Đính kèm ảnh" className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'cursor-pointer' })} title="Đính kèm tối đa 4 ảnh (JPEG/PNG/WebP ≤ 5MB) hoặc dán ảnh Ctrl+V" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.querySelector('input')?.click(); } }}>
              <ImagePlus aria-hidden="true" />
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { const files = Array.from(e.target.files || []).slice(0, 4); if (files.length > 0) { setSelectedFile(null); setSelectedImages(files); } e.target.value = ''; }} />
            </label>
            <label role="button" tabIndex={0} aria-label="Đính kèm tệp" className={buttonVariants({ variant: 'ghost', size: 'icon', className: 'cursor-pointer' })} title="Đính kèm 1 tệp (PDF/DOCX/XLSX/TXT ≤ 10MB)" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.querySelector('input')?.click(); } }}>
              <Paperclip aria-hidden="true" />
              <input className="hidden" type="file" accept=".pdf,.docx,.xlsx,.txt" onChange={e => { const f = e.target.files?.[0] || null; if (f) { setSelectedImages([]); setSelectedFile(f); } e.target.value = ''; }} />
            </label>
          </>}
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" title="Chèn biểu tượng cảm xúc" aria-label="Chèn biểu tượng cảm xúc">
                <Smile aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" aria-label="Chọn biểu tượng cảm xúc" className="grid w-72 grid-cols-5 gap-1 p-2">{QUICK_EMOJIS.map(em => <Button type="button" key={em} variant="ghost" size="icon" onClick={() => { setDraftText(prev => `${prev}${em}`); setShowEmojiPicker(false); requestAnimationFrame(() => textareaRef.current?.focus()); }}>{em}</Button>)}</PopoverContent>
          </Popover>
        </div>
        <Textarea ref={textareaRef} className="min-h-11 flex-1 resize-none" aria-label="Nội dung tin nhắn" placeholder={editingMessage ? 'Nhập nội dung chỉnh sửa...' : compact ? 'Nhập tin nhắn...' : 'Nhập tin nhắn (hỗ trợ dán ảnh Ctrl+V hoặc kéo thả tệp)...'} rows={1} value={draftText} onPaste={handlePaste} onChange={e => { setDraftText(e.target.value); if (e.target.value.trim()) notifyTypingDebounced(); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendOrEditSubmit(e); } else if (e.key === 'Escape' && (replyingTo || editingMessage)) { setReplyingTo(null); setEditingMessage(null); setDraftText(''); } }} />
        <Button type="submit" disabled={draftText.trim().length > 2000}>
          <span>{editingMessage ? 'Lưu' : 'Gửi'}</span>
          <Send aria-hidden="true" />
        </Button>
      </div>
      {draftText.length >= 1500 && <p className={cn('text-right text-xs', draftText.length > 2000 ? 'text-destructive' : 'text-muted-foreground')}>{draftText.length}/2000 ký tự</p>}
    </form>}
    <MessagingDialog open={showAddMembersModal} onClose={() => setShowAddMembersModal(false)} title="Thêm thành viên vào nhóm">
      <form className="space-y-4" onSubmit={handleAddGroupMembersSubmit}>{modalError && <Alert variant="destructive">{modalError}</Alert>}<Input aria-label="Tìm người chơi cần thêm" placeholder="Tìm người chơi cần thêm..." value={playerSearchQuery} onChange={e => setPlayerSearchQuery(e.target.value)} />
        <div className="space-y-2">{playerSearchResults.filter(p => !activeConversation.members.some(m => m.id === p.id)).map(p => {
const checked = selectedMemberIds.includes(p.id); return <label key={p.id} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm font-semibold has-checked:border-primary has-checked:bg-accent">
            <span>{p.fullName}</span>
            <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={checked} onChange={() => setSelectedMemberIds(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id])} />
          </label>;
})}</div>
        <Button type="submit" disabled={modalSubmitting}>Thêm đã chọn ({selectedMemberIds.length})</Button>
      </form>
    </MessagingDialog>
    {lightboxImageUrl && typeof document !== 'undefined' && <MessagingImageViewer url={lightboxImageUrl} zoom={lightboxZoom} onZoom={setLightboxZoom} onClose={() => setLightboxImageUrl(null)} />}
    {profileModalPlayerId !== null && typeof document !== 'undefined' && createPortal(<PlayerProfileModal playerId={profileModalPlayerId} onClose={() => setProfileModalPlayerId(null)} />, document.body)}
  </div>;
};
