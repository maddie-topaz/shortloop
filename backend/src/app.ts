import express, { Express } from 'express';
import path from 'path';
import { CodeAlreadyExistsError, LinkStore } from './store';
import { generateCode } from './shortcode';

const MAX_CODE_ATTEMPTS = 5;
const STATIC_DIR = path.join(__dirname, '..', 'public');

function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function createApp(store: LinkStore): Express {
  const app = express();
  app.use(express.json());
  app.use(express.static(STATIC_DIR));

  app.post('/api/links', async (req, res) => {
    const { url } = req.body ?? {};
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'url must be a valid http(s) URL' });
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        const link = await store.createLink(generateCode(), url);
        return res.status(201).json(link);
      } catch (err) {
        if (!(err instanceof CodeAlreadyExistsError)) throw err;
      }
    }
    return res.status(500).json({ error: 'failed to generate a unique code, try again' });
  });

  app.get('/api/links', async (_req, res) => {
    const links = await store.listLinks();
    res.json(links);
  });

  app.get('/:code', async (req, res) => {
    const link = await store.getLink(req.params.code);
    if (!link) {
      return res.status(404).json({ error: 'not found' });
    }
    res.redirect(302, link.url);
  });

  return app;
}
