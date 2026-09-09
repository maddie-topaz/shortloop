import { Pool } from 'pg';
import { CodeAlreadyExistsError, Link, LinkStore } from './store';

const PG_UNIQUE_VIOLATION = '23505';

export class PgStore implements LinkStore {
  constructor(private pool: Pool) {}

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async createLink(code: string, url: string): Promise<Link> {
    try {
      const result = await this.pool.query(
        'INSERT INTO links (code, url) VALUES ($1, $2) RETURNING code, url, created_at',
        [code, url],
      );
      return rowToLink(result.rows[0]);
    } catch (err: any) {
      if (err.code === PG_UNIQUE_VIOLATION) {
        throw new CodeAlreadyExistsError(code);
      }
      throw err;
    }
  }

  async getLink(code: string): Promise<Link | null> {
    const result = await this.pool.query('SELECT code, url, created_at FROM links WHERE code = $1', [code]);
    return result.rows[0] ? rowToLink(result.rows[0]) : null;
  }

  async listLinks(): Promise<Link[]> {
    const result = await this.pool.query('SELECT code, url, created_at FROM links ORDER BY created_at DESC');
    return result.rows.map(rowToLink);
  }
}

function rowToLink(row: { code: string; url: string; created_at: Date }): Link {
  return { code: row.code, url: row.url, createdAt: row.created_at.toISOString() };
}
