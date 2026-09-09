import { Pool } from 'pg';
import { createApp } from './app';
import { PgStore } from './pgStore';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const store = new PgStore(pool);
  await store.init();

  const app = createApp(store);
  app.listen(PORT, () => {
    console.log(`shortloop backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('failed to start server', err);
  process.exit(1);
});
