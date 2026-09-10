import { Pool } from 'pg';
import { PgStore } from '../src/pgStore';
import { CodeAlreadyExistsError } from '../src/store';

/**
 * Verifies PgStore's actual persistence behaviour against real Postgres —
 * uniqueness, ordering, and the not-found case all depend on real SQL
 * semantics that a mock can't stand in for. Needs DATABASE_URL pointed at a
 * reachable Postgres (see docker-compose.yml / scripts/dev.sh for local dev).
 * Deliberately excluded from the mutation-testing run (see
 * jest.stryker.config.js) — Stryker can only blank out these queries
 * wholesale, so it adds noise, not signal, and forces mutation testing onto
 * a shared database it has no way to isolate between parallel workers.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/shortloop',
});
const store = new PgStore(pool);

beforeAll(async () => {
  await store.init();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE links');
});

afterAll(async () => {
  await pool.end();
});

describe('PgStore', () => {
  it('persists a link and returns it', async () => {
    const link = await store.createLink('abc1234', 'https://example.com');
    expect(link).toEqual({ code: 'abc1234', url: 'https://example.com', createdAt: expect.any(String) });
  });

  it('rejects a duplicate code', async () => {
    await store.createLink('dup1234', 'https://example.com/1');
    await expect(store.createLink('dup1234', 'https://example.com/2')).rejects.toThrow(
      CodeAlreadyExistsError,
    );
  });

  it('returns a persisted link by code', async () => {
    await store.createLink('abc1234', 'https://example.com');
    const link = await store.getLink('abc1234');
    expect(link).toEqual({ code: 'abc1234', url: 'https://example.com', createdAt: expect.any(String) });
  });

  it('returns null for an unknown code', async () => {
    const link = await store.getLink('nope');
    expect(link).toBeNull();
  });

  it('lists links newest first', async () => {
    await store.createLink('first01', 'https://example.com/1');
    await store.createLink('second2', 'https://example.com/2');
    const links = await store.listLinks();
    expect(links.map((l) => l.code)).toEqual(['second2', 'first01']);
  });
});
