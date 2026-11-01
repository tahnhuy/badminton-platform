import { httpClient } from '../../../shared/api/http-client';
import type {
  BlockItem,
  ConversationItem,
  MessageItem,
  MessageReactionSummary,
  MessageReactionType,
  PlayerDisplay,
  SyncConversationResponse,
} from '../types/messaging.types';

export const messagingApi = {
  async searchPlayers(q: string, limit = 20): Promise<PlayerDisplay[]> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    const res = await httpClient<{ data: PlayerDisplay[] }>(
      `/api/v1/players/search?${params.toString()}`
    );
    return res.data;
  },

  async listConversations(
    page = 1,
    limit = 30
  ): Promise<{
    data: ConversationItem[];
    meta: { page: number; limit: number; total: number };
  }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return httpClient(`/api/v1/conversations?${params.toString()}`);
  },

  async getUnreadSummary(): Promise<{ totalUnread: number }> {
    const res = await httpClient<{ data: { totalUnread: number } }>(
      '/api/v1/conversations/unread-summary'
    );
    return res.data;
  },

  async openOrCreateDirectConversation(playerId: number): Promise<ConversationItem> {
    const res = await httpClient<{ data: ConversationItem }>('/api/v1/conversations/direct', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
    return res.data;
  },

  async createGroupConversation(title: string, memberIds: number[]): Promise<ConversationItem> {
    const res = await httpClient<{ data: ConversationItem }>('/api/v1/conversations/group', {
      method: 'POST',
      body: JSON.stringify({ title, memberIds }),
    });
    return res.data;
  },

  async getConversationDetail(conversationId: number): Promise<ConversationItem> {
    const res = await httpClient<{ data: ConversationItem }>(
      `/api/v1/conversations/${conversationId}`
    );
    return res.data;
  },

  async addGroupMembers(conversationId: number, memberIds: number[]): Promise<ConversationItem> {
    const res = await httpClient<{ data: ConversationItem }>(
      `/api/v1/conversations/${conversationId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ memberIds }),
      }
    );
    return res.data;
  },

  async leaveGroupConversation(conversationId: number): Promise<void> {
    await httpClient<void>(`/api/v1/conversations/${conversationId}/leave`, {
      method: 'POST',
    });
  },

  async listMessagesHistory(
    conversationId: number,
    beforeSeq?: number,
    limit = 30
  ): Promise<{
    data: MessageItem[];
    meta: { limit: number; nextBeforeSeq: number | null };
  }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (beforeSeq !== undefined) {
      params.set('beforeSeq', String(beforeSeq));
    }
    return httpClient(`/api/v1/conversations/${conversationId}/messages?${params.toString()}`);
  },

  async syncConversation(
    conversationId: number,
    afterSeq: number,
    sinceVersion: number,
    minLoadedSeq: number
  ): Promise<SyncConversationResponse> {
    const params = new URLSearchParams({
      afterSeq: String(afterSeq),
      sinceVersion: String(sinceVersion),
      minLoadedSeq: String(minLoadedSeq),
    });
    const res = await httpClient<{ data: SyncConversationResponse }>(
      `/api/v1/conversations/${conversationId}/sync?${params.toString()}`
    );
    return res.data;
  },

  async sendMessage(
    conversationId: number,
    input: {
      text?: string | null;
      clientMessageId: string;
      images?: File[];
      file?: File | null;
    }
  ): Promise<MessageItem> {
    const images = input.images || [];
    const file = input.file || null;

    if (images.length > 0 || file) {
      const formData = new FormData();
      formData.append(
        'payload',
        JSON.stringify({
          text: input.text ?? null,
          clientMessageId: input.clientMessageId,
        })
      );
      for (const img of images) {
        formData.append('images', img);
      }
      if (file) {
        formData.append('file', file);
      }
      const res = await httpClient<{ data: MessageItem }>(
        `/api/v1/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: formData,
        }
      );
      return res.data;
    }

    const res = await httpClient<{ data: MessageItem }>(
      `/api/v1/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          text: input.text ?? null,
          clientMessageId: input.clientMessageId,
        }),
      }
    );
    return res.data;
  },

  async markConversationRead(
    conversationId: number,
    seq: number
  ): Promise<{ conversationId: number; lastReadSeq: number }> {
    const res = await httpClient<{ data: { conversationId: number; lastReadSeq: number } }>(
      `/api/v1/conversations/${conversationId}/read`,
      {
        method: 'POST',
        body: JSON.stringify({ seq }),
      }
    );
    return res.data;
  },

  async recordTyping(
    conversationId: number
  ): Promise<{ conversationId: number; expiresAt: string; updated: boolean }> {
    const res = await httpClient<{
      data: { conversationId: number; expiresAt: string; updated: boolean };
    }>(`/api/v1/conversations/${conversationId}/typing`, {
      method: 'POST',
    });
    return res.data;
  },

  async recordHeartbeat(): Promise<{
    lastSeenAt: string;
    isOnline: boolean;
    updated: boolean;
  }> {
    const res = await httpClient<{
      data: { lastSeenAt: string; isOnline: boolean; updated: boolean };
    }>('/api/v1/presence/heartbeat', {
      method: 'POST',
    });
    return res.data;
  },

  async setMessageReaction(
    messageId: number,
    type: MessageReactionType
  ): Promise<{
    messageId: number;
    conversationId: number;
    seq: number;
    reactionVersion: number;
    reactions: MessageReactionSummary[];
  }> {
    const res = await httpClient<{
      data: {
        messageId: number;
        conversationId: number;
        seq: number;
        reactionVersion: number;
        reactions: MessageReactionSummary[];
      };
    }>(`/api/v1/messages/${messageId}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ type }),
    });
    return res.data;
  },

  async removeMessageReaction(
    messageId: number
  ): Promise<{
    messageId: number;
    conversationId: number;
    seq: number;
    reactionVersion: number;
    reactions: MessageReactionSummary[];
  }> {
    const res = await httpClient<{
      data: {
        messageId: number;
        conversationId: number;
        seq: number;
        reactionVersion: number;
        reactions: MessageReactionSummary[];
      };
    }>(`/api/v1/messages/${messageId}/reaction`, {
      method: 'DELETE',
    });
    return res.data;
  },

  async listBlocks(): Promise<BlockItem[]> {
    const res = await httpClient<{ data: BlockItem[] }>('/api/v1/blocks');
    return res.data;
  },

  async blockPlayer(playerId: number): Promise<void> {
    await httpClient<void>('/api/v1/blocks', {
      method: 'POST',
      body: JSON.stringify({ playerId }),
    });
  },

  async unblockPlayer(playerId: number): Promise<void> {
    await httpClient<void>(`/api/v1/blocks/${playerId}`, {
      method: 'DELETE',
    });
  },
};

export function emitMessagingUnreadChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('messaging:unread-changed'));
  }
}
