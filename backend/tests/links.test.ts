import request from 'supertest';
import { createApp } from '../src/app';
import { MemoryStore } from '../src/memoryStore';

describe('POST /api/links', () => {
  it('creates a short link for a valid url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 'https://example.com/some/long/path' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://example.com/some/long/path');
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('rejects a missing url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({});
    expect(res.status).toBe(400);
  });

  it('rejects a non-http(s) url', async () => {
    const app = createApp(new MemoryStore());
    const res = await request(app).post('/api/links').send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
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
