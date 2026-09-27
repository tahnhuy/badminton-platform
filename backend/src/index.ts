import { env } from './shared/config/env';
import { app } from './app';
import { logger } from './shared/logging/logger';

const port = env.PORT;

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`, {
    port,
    nodeEnv: env.NODE_ENV,
  });
});
