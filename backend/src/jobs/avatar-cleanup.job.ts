import { playerAvatarService } from '../services/players/PlayerAvatarService';
import { logger } from '../shared/logging/logger';

let timer: NodeJS.Timeout | undefined;
export function startAvatarCleanup(): void {
  if (timer) return;
  const run = () => playerAvatarService.sweep().catch(() => logger.warn('Avatar cleanup sweep deferred'));
  void run();
  timer = setInterval(() => { void run(); }, 60 * 60 * 1000);
  timer.unref();
}
