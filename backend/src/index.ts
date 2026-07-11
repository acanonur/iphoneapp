import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const { fastify } = buildApp(config);

fastify
  .listen({ port: config.port, host: config.host })
  .then(() => {
    fastify.log.info(
      `AI Secretary backend up — provider: ${config.provider}, webhook path: /webhooks/retell/${config.webhookSecret}`,
    );
  })
  .catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
