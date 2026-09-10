import request from 'supertest';
import { createApp, MAX_CODE_ATTEMPTS } from '../src/app';
import { MemoryStore } from '../src/memoryStore';
import { CodeAlreadyExistsError, Link } from '../src/store';

/** Fails the first `collisions` writes, so the retry path can be exercised. */
class CollidingStore extends MemoryStore {
  constructor(private collisions: number) {
    super();
  }

  async createLink(code: string, url: string): Promise<Link> {
    if (this.collisions > 0) {
      this.collisions--;
      throw new CodeAlreadyExistsError(code);
    }
    return super.createLink(code, url);
  }
}

describe('POST /api/links', () => {
  it('creates a short link for a valid url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 'https://example.com/some/long/path' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://example.com/some/long/path');
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('creates a short link for a plain http url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 'http://example.com/insecure' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('http://example.com/insecure');
  });

  it('rejects a missing url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('rejects a url that is not a string', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('rejects a non-http(s) url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('retries past code collisions and still succeeds', async () => {
    const app = createApp(new CollidingStore(MAX_CODE_ATTEMPTS - 1));
    const res = await request(app).post('/api/links').send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
  });

  it('gives up after exactly MAX_CODE_ATTEMPTS collisions', async () => {
    const app = createApp(new CollidingStore(MAX_CODE_ATTEMPTS));
    const res = await request(app).post('/api/links').send({ url: 'https://example.com' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('failed to generate a unique code, try again');
  });
});

describe('GET /:code', () => {
  it('redirects to the original url', async () => {
    const store = new MemoryStore();
    await store.createLink('abc1234', 'https://example.com');
    const app = createApp(store);

    const res = await request(app).get('/abc1234');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('returns 404 for an unknown code', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});

describe('GET /api/links', () => {
  it('lists created links, newest first', async () => {
    const store = new MemoryStore();
    await store.createLink('first01', 'https://example.com/1');
    await store.createLink('second2', 'https://example.com/2');
    const app = createApp(store);

    const res = await request(app).get('/api/links');
    expect(res.status).toBe(200);
    expect(res.body.map((l: { code: string }) => l.code)).toEqual(['second2', 'first01']);
  });
});
