import { config } from './config';
import { createApp } from './app';
import { runMigrations } from './db/migrate';
import { createPool } from './db/pool';
import { seedDatabase } from './db/seed';

async function start(): Promise<void> {
  const pool = createPool();
  await runMigrations(pool);
  await seedDatabase(pool);

  const app = createApp(pool);
  app.listen(config.port, () => {
    console.log(`Flight Booking API listening on port ${config.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

