import { Pool } from 'pg';
import { CodeAlreadyExistsError, Link, LinkStore } from './store';

const PG_UNIQUE_VIOLATION = '23505';

const isPgError = (err: unknown): err is { code: string } =>
  typeof err === 'object' && err !== null && 'code' in err;

const rowToLink = (row: { code: string; url: string; created_at: Date }): Link => ({
  code: row.code,
  url: row.url,
  createdAt: row.created_at.toISOString(),
});

export type PgStore = LinkStore & { init: () => Promise<void> };

export const createPgStore = (pool: Pool): PgStore => ({
  init: async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  },

  createLink: async (code, url) => {
    try {
      const result = await pool.query(
        'INSERT INTO links (code, url) VALUES ($1, $2) RETURNING code, url, created_at',
        [code, url],
      );
      return rowToLink(result.rows[0]);
    } catch (err: unknown) {
      if (isPgError(err) && err.code === PG_UNIQUE_VIOLATION) {
        throw new CodeAlreadyExistsError(code);
      }
      throw err;
    }
  },

  getLink: async (code) => {
    const result = await pool.query('SELECT code, url, created_at FROM links WHERE code = $1', [code]);
    return result.rows[0] ? rowToLink(result.rows[0]) : null;
  },

  listLinks: async () => {
    const result = await pool.query('SELECT code, url, created_at FROM links ORDER BY created_at DESC');
    return result.rows.map(rowToLink);
  },
});
