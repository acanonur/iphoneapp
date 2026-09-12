import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = buildApp(config);

async function main(): Promise<void> {
  try {
    await app.fastify.listen({ port: config.port, host: config.host });
    app.fastify.log.info(
      { db: config.dbPath, linkPreviews: config.linkPreviews },
      'ortak server listening',
    );
  } catch (error) {
    app.fastify.log.error({ err: error }, 'failed to start');
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

void main();
