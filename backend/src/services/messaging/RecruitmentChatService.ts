import { and, eq } from 'drizzle-orm';
import { conversationMembers, conversationTyping, matchmakingRequestConversations } from '../../db';
import type { RecruitmentChatPort } from '../../contracts/RecruitmentChatPort';
import { messagingRepository } from '../../repositories/messaging/MessagingRepository';
import { messagingWsHub } from './MessagingWsHub';

export const recruitmentChatPort: RecruitmentChatPort = {
  async revokeMember(requestId, userId, actorId, tx) {
    const [link] = await tx.select().from(matchmakingRequestConversations)
      .where(eq(matchmakingRequestConversations.requestId, requestId));
    if (!link) return null;
    await messagingRepository.lockConversation(link.conversationId, tx);
    const changed = await tx.update(conversationMembers).set({ state: 'LEFT', updatedAt: new Date() })
      .where(and(eq(conversationMembers.conversationId, link.conversationId),
        eq(conversationMembers.userId, userId), eq(conversationMembers.state, 'ACTIVE')))
      .returning({ userId: conversationMembers.userId });
    await tx.delete(conversationTyping).where(and(eq(conversationTyping.conversationId, link.conversationId),
      eq(conversationTyping.userId, userId)));
    return changed.length ? { conversationId: link.conversationId, actorUserId: actorId,
      action: 'REMOVED', memberIds: [userId] } : null;
  },
  async publishRemoval(event) {
    await messagingWsHub.broadcastConversationEvent(event.conversationId, 'conversation.member_changed', event, event.actorUserId);
    await messagingWsHub.notifyUsers(event.memberIds, 'conversation.member_changed', event);
  },
};
