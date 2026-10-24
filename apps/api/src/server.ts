import { env } from './core/config/env';
import { buildApp } from './presentation/app';
import { backgroundWatcher } from './infrastructure/background/watcher';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 GeminiHub Enterprise API listening on http://${env.HOST}:${env.PORT}`);
    console.log(`📚 Swagger documentation at http://${env.HOST}:${env.PORT}/docs`);

    // Start background watcher
    backgroundWatcher.start(30000);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, gracefully shutting down...`);
        backgroundWatcher.stop();
        await app.close();
        process.exit(0);
      });
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
