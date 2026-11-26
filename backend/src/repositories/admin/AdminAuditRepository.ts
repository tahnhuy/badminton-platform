import { db } from '../../db';
import { adminActionAudits } from '../../db/schema/admin-audit';

export const adminAuditRepository = {
  async record(input: {
    adminId: number;
    targetUserId: number;
    action: string;
    reason: string;
    result: 'SUCCESS' | 'FAILED';
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    await db.insert(adminActionAudits).values({
      adminId: input.adminId,
      targetUserId: input.targetUserId,
      action: input.action,
      reason: input.reason,
      result: input.result,
      metadata: input.metadata ?? null,
    });
  },
};
