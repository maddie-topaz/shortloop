import { Pool } from 'pg';
import { createApp } from './app';
import { createPgStore } from './pgStore';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

const main = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });
  const store = createPgStore(pool);
  await store.init();

  const app = createApp(store);
  app.listen(PORT, () => {
    console.log(`shortloop backend listening on port ${PORT}`);
  });
};

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
