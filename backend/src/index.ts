import { startAvatarCleanup } from './jobs/avatar-cleanup.job';
import { env } from './shared/config/env';
import { app } from './app';
import { logger } from './shared/logging/logger';
import { startBookingStateWorker } from './jobs/booking-state.job';
import { startMatchmakingScheduler } from './jobs/matchmakingScheduler';
import { startPrivateMediaCleanup } from './jobs/private-media-cleanup.job';
import { startRefundWorker } from './jobs/refund.job';
import { startOwnerEarningWorker } from './jobs/owner-earning.job';
import { messagingWsHub } from './services/messaging/MessagingWsHub';

const port = env.PORT;

const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port}`, {
    port,
    nodeEnv: env.NODE_ENV,
  });
  startAvatarCleanup();
  startBookingStateWorker();
  startMatchmakingScheduler();
  startPrivateMediaCleanup();
  startRefundWorker();
  if (env.OWNER_EARNING_JOB_ENABLED) startOwnerEarningWorker();
  messagingWsHub.attach(server);
});
