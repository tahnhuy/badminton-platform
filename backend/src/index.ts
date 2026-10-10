import { env } from './shared/config/env';
import { app } from './app';
import { logger } from './shared/logging/logger';
import { startBookingStateWorker } from './jobs/booking-state.job';
import { startMatchmakingScheduler } from './jobs/matchmakingScheduler';

const port = env.PORT;

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`, {
    port,
    nodeEnv: env.NODE_ENV,
  });
  startBookingStateWorker();
  startMatchmakingScheduler();
});
