import { walletRequestExpiryService } from '../services/payments/WalletRequestExpiryService';
import { logger } from '../shared/logging/logger';

let timer: NodeJS.Timeout | null = null;
let running = false;
async function runSafely(): Promise<void> {
  if (running) return;
  running = true;
  try { await walletRequestExpiryService.runOnce(); }
  catch (error) { logger.error('Wallet request expiry failed', { message: error instanceof Error ? error.message : String(error) }); }
  finally { running = false; }
}
export function startWalletRequestExpiryWorker(): void {
  if (timer) return;
  void runSafely();
  timer = setInterval(() => void runSafely(), 30_000);
  timer.unref?.();
}
export function stopWalletRequestExpiryWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
