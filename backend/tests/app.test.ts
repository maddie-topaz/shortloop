import request from 'supertest';
import { createApp, MAX_CODE_ATTEMPTS } from '../src/app';
import { CodeAlreadyExistsError, Link, LinkStore } from '../src/store';

/**
 * Route-level tests exercise app.ts's own logic (URL validation, the retry
 * loop, status codes) against a mocked LinkStore, so they need no database
 * and stay fast and deterministic under mutation testing. PgStore's actual
 * persistence behaviour (uniqueness, ordering, real SQL) is covered
 * separately in pgStore.integration.test.ts against real Postgres.
 */
const createMockStore = (): jest.Mocked<LinkStore> => {
  return {
    createLink: jest.fn(),
    getLink: jest.fn(),
    listLinks: jest.fn(),
  };
};

const fakeLink = (code: string, url: string): Link => ({
  code,
  url,
  createdAt: new Date().toISOString(),
});

describe('POST /api/links', () => {
  it('creates a short link for a valid url', async () => {
    const store = createMockStore();
    store.createLink.mockImplementation((code, url) => Promise.resolve(fakeLink(code, url)));
    const app = createApp(store);

    const res = await request(app).post('/api/links').send({ url: 'https://example.com/some/long/path' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://example.com/some/long/path');
    expect(res.body.code).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('creates a short link for a plain http url', async () => {
    const store = createMockStore();
    store.createLink.mockImplementation((code, url) => Promise.resolve(fakeLink(code, url)));
    const app = createApp(store);

    const res = await request(app).post('/api/links').send({ url: 'http://example.com/insecure' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('http://example.com/insecure');
  });

  it('rejects a missing url', async () => {
    const app = createApp(createMockStore());
    const res = await request(app).post('/api/links').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('rejects a url that is not a string', async () => {
    const app = createApp(createMockStore());
    const res = await request(app).post('/api/links').send({ url: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('rejects a non-http(s) url', async () => {
    const app = createApp(createMockStore());
    const res = await request(app).post('/api/links').send({ url: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('url must be a valid http(s) URL');
  });

  it('retries past code collisions and still succeeds', async () => {
    const store = createMockStore();
    let attempts = 0;
    store.createLink.mockImplementation((code, url) => {
      attempts++;
      if (attempts <= MAX_CODE_ATTEMPTS - 1) {
        return Promise.reject(new CodeAlreadyExistsError(code));
      }
      return Promise.resolve(fakeLink(code, url));
    });
    const app = createApp(store);

    const res = await request(app).post('/api/links').send({ url: 'https://example.com' });

    expect(res.status).toBe(201);
    expect(store.createLink).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
  });

  it('gives up after exactly MAX_CODE_ATTEMPTS collisions', async () => {
    const store = createMockStore();
    store.createLink.mockImplementation((code) => Promise.reject(new CodeAlreadyExistsError(code)));
    const app = createApp(store);

    const res = await request(app).post('/api/links').send({ url: 'https://example.com' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('failed to generate a unique code, try again');
    expect(store.createLink).toHaveBeenCalledTimes(MAX_CODE_ATTEMPTS);
  });

  it('propagates a store failure that is not a code collision', async () => {
    const store = createMockStore();
    store.createLink.mockRejectedValue(new Error('database on fire'));
    const app = createApp(store);

    const res = await request(app).post('/api/links').send({ url: 'https://example.com' });

    expect(res.status).toBe(500);
    // The retry loop is only for collisions. Anything else must abort on the
    // first attempt rather than being swallowed and retried.
    expect(store.createLink).toHaveBeenCalledTimes(1);
    expect(res.body.error).not.toBe('failed to generate a unique code, try again');
  });
});

describe('GET /:code', () => {
  it('redirects to the original url', async () => {
    const store = createMockStore();
    store.getLink.mockResolvedValue(fakeLink('abc1234', 'https://example.com'));
    const app = createApp(store);

    const res = await request(app).get('/abc1234');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com');
  });

  it('returns 404 for an unknown code', async () => {
    const store = createMockStore();
    store.getLink.mockResolvedValue(null);
    const app = createApp(store);

    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});

describe('GET /api/links', () => {
  it('returns whatever the store lists, unmodified', async () => {
    const links = [
      fakeLink('second2', 'https://example.com/2'),
      fakeLink('first01', 'https://example.com/1'),
    ];
    const store = createMockStore();
    store.listLinks.mockResolvedValue(links);
    const app = createApp(store);

    const res = await request(app).get('/api/links');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(links);
  });
});
