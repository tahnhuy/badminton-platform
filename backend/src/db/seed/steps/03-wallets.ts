import { walletTopUpService } from '../../../services/payments/WalletTopUpService';
import { walletPayoutService } from '../../../services/payments/WalletPayoutService';
import { DEMO_OWNERS, DEMO_PLAYERS, MAIN_PLAYER_KEY } from '../data/people';
import { stampAt } from '../lib/stamp';
import type { SeedContext } from '../context';

/**
 * Opening balances through the real top-up flow (mock provider: create + confirm), dated the
 * evening a player joined, before any spending. Bank accounts for payouts.
 */
export async function seedWallets(ctx: SeedContext): Promise<void> {
  let total = 0;
  let count = 0;
  for (const spec of DEMO_PLAYERS) {
    const player = ctx.players.get(spec.key)!;
    if (spec.topUp <= 0 || !player.active) continue;
    const at = new Date(player.joinedAt.getTime() + 11 * 3_600_000); // 19:30 VN on the sign-up day
    await stampAt(at, async () => {
      const topUp = await walletTopUpService.createTopUp({ userId: player.id, amount: spec.topUp, provider: 'MOCK', idempotencyKey: `seed-topup-${spec.key}` });
      await walletTopUpService.mockConfirm(topUp.topUpId, player.id);
    });
    total += spec.topUp;
    count += 1;
  }

  const bankAccounts: Array<{ userId: number; name: string; bank: string; number: string; at: Date }> = [];
  DEMO_OWNERS.forEach((owner, index) => {
    const name = owner.businessName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
    bankAccounts.push({ userId: ctx.owners.get(owner.key)!, name, bank: 'VCB', number: `007100012345${index + 1}`, at: ctx.clock.at(-owner.joinedDaysAgo + 2, '09:00') });
  });
  const main = ctx.players.get(MAIN_PLAYER_KEY)!;
  bankAccounts.push({ userId: main.id, name: 'DANG NGOC TAI', bank: 'TCB', number: '1903456789011', at: ctx.clock.at(-30, '21:00') });
  for (const account of bankAccounts) {
    await stampAt(account.at, () => walletPayoutService.createBankAccount(account.userId, {
      bankCode: account.bank, accountNumber: account.number, accountName: account.name, isDefault: true,
    }));
  }
  ctx.log(`Ví: ${count} lượt nạp (${total.toLocaleString('vi-VN')} đ), ${bankAccounts.length} tài khoản ngân hàng`);
}
