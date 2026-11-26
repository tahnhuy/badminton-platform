import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../index';
import { ownerEarningSettlements, walletBankAccounts, walletHolds, walletPayoutRequests } from '../../schema/wallet';
import { ownerEarningService } from '../../../services/finance/OwnerEarningService';
import { walletPayoutService } from '../../../services/payments/WalletPayoutService';
import { DEMO_WITHDRAWAL_PIN, MAIN_PLAYER_KEY } from '../data/people';
import { withConfig } from '../lib/config';
import { spendableAt } from '../lib/funds';
import { stampAt } from '../lib/stamp';
import type { SeedContext } from '../context';

/**
 * Admin finance work: review the PENDING owner earnings left by step 04 (approve most, reject
 * one, keep the newest pending) and payout / withdrawal requests in every status.
 */
export async function seedFinance(ctx: SeedContext): Promise<void> {
  const { clock } = ctx;
  const earnings = await reviewOwnerEarnings(ctx);

  const owner = (key: string) => ctx.owners.get(key)!;
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  const p05 = ctx.players.get('player05')!;
  await stampAt(clock.at(-7, '21:00'), () => walletPayoutService.createBankAccount(p05.id, {
    bankCode: 'MB', accountNumber: '0886123456789', accountName: 'VO THU HA', isDefault: true,
  }));

  type Final = 'PAID' | 'APPROVED' | 'PENDING' | 'REJECTED';
  const requests: Array<{ userId: number; type: 'OWNER_PAYOUT' | 'WITHDRAWAL'; target: number; day: number; final: Final; note?: string }> = [
    { userId: owner('owner1'), type: 'OWNER_PAYOUT', target: 2_000_000, day: -20, final: 'PAID' },
    { userId: owner('owner3'), type: 'OWNER_PAYOUT', target: 1_500_000, day: -15, final: 'PAID' },
    { userId: main.id, type: 'WITHDRAWAL', target: 500_000, day: -12, final: 'PAID' },
    { userId: owner('owner2'), type: 'OWNER_PAYOUT', target: 1_000_000, day: -10, final: 'REJECTED', note: 'Tên chủ tài khoản không khớp với hồ sơ chủ sân, vui lòng cập nhật.' },
    { userId: owner('owner2'), type: 'OWNER_PAYOUT', target: 3_000_000, day: -2, final: 'APPROVED' },
    { userId: owner('owner1'), type: 'OWNER_PAYOUT', target: 1_000_000, day: -1, final: 'PENDING' },
    { userId: p05.id, type: 'WITHDRAWAL', target: 300_000, day: -1, final: 'PENDING' },
  ];

  const done: Record<Final, number> = { PAID: 0, APPROVED: 0, PENDING: 0, REJECTED: 0 };
  for (const [index, request] of requests.entries()) {
    const requestedAt = clock.at(request.day, '10:15');
    const spendable = await spendableAt(request.userId, requestedAt);
    const amount = Math.min(request.target, Math.floor((spendable * 0.7) / 100_000) * 100_000);
    if (amount < 100_000) {
      ctx.log(`  ! Bỏ qua yêu cầu rút ${request.type} của user ${request.userId}: số dư lúc đó chỉ ${spendable.toLocaleString('vi-VN')} đ`);
      continue;
    }
    const [bank] = await db.select({ id: walletBankAccounts.id }).from(walletBankAccounts).where(eq(walletBankAccounts.userId, request.userId)).limit(1);
    if (!bank) throw new Error(`User ${request.userId} has no bank account`);

    const autoApprove = request.final === 'PAID' || request.final === 'APPROVED' ? 'true' : 'false';
    const created = await withConfig({ WALLET_AUTO_APPROVE_PAYOUTS: autoApprove }, () => stampAt(requestedAt, () =>
      walletPayoutService.createRequest(request.userId, {
        requestType: request.type, amount, bankAccountId: bank.id, withdrawalPin: DEMO_WITHDRAWAL_PIN, clientRequestId: uuidFor(`payout-${index}`),
      })));

    const decidedAt = clock.at(request.day + 1, '09:30');
    if (request.final === 'PAID') {
      await stampAt(decidedAt, () => walletPayoutService.markPaid(created.id, ctx.adminId, `VCB-FT${String(created.id).padStart(8, '0')}`));
      await db.update(walletPayoutRequests).set({ paidAt: decidedAt, updatedAt: decidedAt }).where(eq(walletPayoutRequests.id, created.id));
      await db.update(walletHolds).set({ capturedAt: decidedAt, updatedAt: decidedAt }).where(eq(walletHolds.id, created.holdId!));
    } else if (request.final === 'REJECTED') {
      await stampAt(decidedAt, () => walletPayoutService.reject(created.id, ctx.adminId, request.note!));
      await db.update(walletPayoutRequests).set({ reviewedAt: decidedAt, updatedAt: decidedAt }).where(eq(walletPayoutRequests.id, created.id));
      await db.update(walletHolds).set({ releasedAt: decidedAt, updatedAt: decidedAt }).where(eq(walletHolds.id, created.holdId!));
    }
    const [stored] = await db.select({ status: walletPayoutRequests.status }).from(walletPayoutRequests).where(eq(walletPayoutRequests.id, created.id));
    if (stored.status !== request.final) throw new Error(`Payout ${created.id}: status ${stored.status}, expected ${request.final}`);
    done[request.final] += 1;
  }
  ctx.log(`Tài chính: doanh thu chủ sân ${earnings}; rút tiền ${Object.entries(done).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

/** Approve the older PENDING earnings, reject one, keep the newest ones for the Admin to review. */
async function reviewOwnerEarnings(ctx: SeedContext): Promise<string> {
  const pending = await db.select({ id: ownerEarningSettlements.id, createdAt: ownerEarningSettlements.createdAt })
    .from(ownerEarningSettlements).where(eq(ownerEarningSettlements.status, 'PENDING')).orderBy(asc(ownerEarningSettlements.createdAt));
  // The 5 newest earnings stay PENDING in the Admin queue; older ones were reviewed.
  const reviewable = pending.slice(0, Math.max(0, pending.length - 5));
  let approved = 0;
  let rejected = 0;
  for (const [index, row] of reviewable.entries()) {
    // Reviewed the next morning, but never later than an hour ago (and always after creation).
    const at = new Date(Math.max(row.createdAt.getTime() + 60_000, Math.min(row.createdAt.getTime() + 20 * 3_600_000, ctx.clock.now.getTime() - 3_600_000)));
    if (index === 0) {
      await stampAt(at, () => ownerEarningService.reject(row.id, ctx.adminId, 'Khách khiếu nại sân không đủ đèn, tạm giữ doanh thu để xác minh.'));
      rejected += 1;
    } else {
      await stampAt(at, () => ownerEarningService.approve(row.id, ctx.adminId, 'Đã đối soát với lịch sân.'));
      approved += 1;
    }
    await db.update(ownerEarningSettlements).set({ decidedAt: at, updatedAt: at }).where(eq(ownerEarningSettlements.id, row.id));
  }
  const left = await db.select({ n: sql<number>`count(*)::int` }).from(ownerEarningSettlements).where(eq(ownerEarningSettlements.status, 'PENDING'));
  const credited = await db.select({ n: sql<number>`count(*)::int` }).from(ownerEarningSettlements)
    .where(and(eq(ownerEarningSettlements.status, 'CREDITED'), inArray(ownerEarningSettlements.mode, ['AUTO', 'MANUAL'])));
  return `${credited[0].n} đã cộng, ${approved} duyệt tay, ${rejected} từ chối, ${left[0].n} chờ duyệt`;
}

/** Stable UUID v4-shaped id so reruns create the same client request ids. */
function uuidFor(key: string): string {
  const hex = createHash('sha256').update(`demo-seed:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
