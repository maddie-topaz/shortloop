import { contract, INVALID_URL_MESSAGE } from '@shortloop/contract';
import { createExpressEndpoints, initServer } from '@ts-rest/express';
import express, { Express } from 'express';
import path from 'path';
import { CodeAlreadyExistsError, LinkStore } from './store';
import { generateCode } from './shortcode';

export const MAX_CODE_ATTEMPTS = 5;
const STATIC_DIR = path.join(__dirname, '..', 'public');

const s = initServer();

const buildRouter = (store: LinkStore) =>
  s.router(contract, {
    createLink: async ({ body }) => {
      for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
        try {
          const link = await store.createLink(generateCode(), body.url);
          return { status: 201 as const, body: link };
        } catch (err) {
          if (!(err instanceof CodeAlreadyExistsError)) throw err;
        }
      }
      return {
        status: 500 as const,
        body: { error: 'failed to generate a unique code, try again' },
      };
    },

    listLinks: async () => ({ status: 200 as const, body: await store.listLinks() }),
  });

export const createApp = (store: LinkStore): Express => {
  const app = express();
  app.use(express.json());
  app.use(express.static(STATIC_DIR));

  createExpressEndpoints(contract, buildRouter(store), app, {
    logInitialization: false,
    // ts-rest's default 400 body is a serialised ZodError. This API's error
    // shape is `{ error: string }` and both the frontend and the smoke test
    // depend on it, so the failing issue's message is surfaced instead.
    requestValidationErrorHandler: (err, _req, res) => {
      // `url` is the only validated input on this contract, so every request
      // validation failure is a bad url — but the issue's own message is used
      // so this stays correct as endpoints are added.
      const message = err.body?.issues[0]?.message ?? INVALID_URL_MESSAGE;
      res.status(400).json({ error: message });
    },
  });

  // Registered last on purpose: a catch-all must come after static files and
  // every /api route. Not part of the contract — it is a 302 to an arbitrary
  // destination, not a JSON endpoint.
  app.get('/:code', async (req, res) => {
    const link = await store.getLink(req.params.code);
    if (!link) {
      return res.status(404).json({ error: 'not found' });
    }
    res.redirect(302, link.url);
  });

  return app;
};
