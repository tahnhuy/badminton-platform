import { privateMediaService } from '../services/media/PrivateMediaService';
import { logger } from '../shared/logging/logger';

// Hourly GC for the private media root (schema §13.9 rule 4; SOC-02).
let timer: NodeJS.Timeout | undefined;

export function startPrivateMediaCleanup(): void {
  if (timer) return;
  const run = () => privateMediaService.sweep().catch(() => logger.warn('Private media cleanup sweep deferred'));
  void run();
  timer = setInterval(() => { void run(); }, 60 * 60 * 1000);
  timer.unref();
}
