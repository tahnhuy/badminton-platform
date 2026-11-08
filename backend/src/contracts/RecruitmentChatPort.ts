import type { TransactionContext } from './TransactionContext';

export interface RecruitmentChatRemoval {
  conversationId: number;
  actorUserId: number;
  action: 'REMOVED';
  memberIds: number[];
}

export interface RecruitmentChatPort {
  /** Caller holds roster locks; revocation shares the withdrawal transaction. No feature gate. */
  revokeMember(requestId: number, userId: number, actorId: number, tx: TransactionContext): Promise<RecruitmentChatRemoval | null>;
  publishRemoval(event: RecruitmentChatRemoval): Promise<void>;
}
