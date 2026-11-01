export interface SkillLevelSummary {
  id: number;
  code: string;
  name: string;
  rank: number;
}

export interface PlayerDisplay {
  id: number;
  fullName: string;
  avatarUrl: string | null;
  skillLevel: SkillLevelSummary | null;
  isActive: boolean;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface ConversationMember extends PlayerDisplay {
  state: 'ACTIVE' | 'LEFT';
  lastReadSeq: number;
  joinedAt: string;
}

export interface ConversationLastMessage {
  id: number;
  seq: number;
  senderId: number;
  body: string | null;
  createdAt: string;
}

export interface ConversationItem {
  id: number;
  type: 'DIRECT' | 'GROUP';
  title: string | null;
  createdBy: number | null;
  lastSeq: number;
  activityVersion: number;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  canSend: boolean;
  sendDisabledReason: string | null;
  counterpart: PlayerDisplay | null;
  members: ConversationMember[];
  lastMessage: ConversationLastMessage | null;
}

export type MessageReactionType = 'LIKE' | 'LOVE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

export interface MessageAttachment {
  id: number;
  mediaId: number;
  kind: 'IMAGE' | 'FILE';
  mimeType: string;
  byteSize: number;
  originalName: string | null;
  position: number;
  url: string;
}

export interface MessageReactionSummary {
  type: MessageReactionType;
  count: number;
  reactedByMe: boolean;
}

export interface MessageItem {
  id: number;
  conversationId: number;
  seq: number;
  senderId: number;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string | null;
  clientMessageId: string;
  reactionVersion: number;
  attachments: MessageAttachment[];
  reactions: MessageReactionSummary[];
  createdAt: string;
}

export interface PendingMessageItem {
  clientMessageId: string;
  conversationId: number;
  text: string;
  images: File[];
  file: File | null;
  status: 'SENDING' | 'FAILED';
  errorMessage: string | null;
  createdAt: string;
}

export interface BlockItem {
  playerId: number;
  fullName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export interface PresenceEntry {
  userId: number;
  lastSeenAt: string;
  isOnline: boolean;
}

export interface TypingEntry {
  userId: number;
  expiresAt: string;
}

export interface SyncConversationResponse {
  messages: MessageItem[];
  nextAfterSeq: number;
  hasMore: boolean;
  changedReactions: Array<{
    messageId: number;
    seq: number;
    reactionVersion: number;
    reactions: MessageReactionSummary[];
  }>;
  nextSinceVersion: number;
  presence?: PresenceEntry[];
  typing?: TypingEntry[];
}

export type MessagingWsEventType =
  | 'message.created'
  | 'message.reaction_updated'
  | 'conversation.read_updated'
  | 'conversation.member_changed'
  | 'presence.updated'
  | 'typing.updated';

export interface MessagingWsEnvelope<T = unknown> {
  type: MessagingWsEventType;
  data: T;
  timestamp: string;
}
