import { initContract } from '@ts-rest/core';
import { z } from 'zod';

/**
 * The single source of truth for the HTTP API. Both sides import this: the
 * backend implements it via @ts-rest/express, the frontend calls it via a
 * generated client. `Link` is inferred from the schema rather than declared
 * twice, so the two ends cannot drift apart.
 *
 * `GET /:code` is deliberately absent — it is a 302 redirect to an arbitrary
 * destination, not a JSON endpoint, so it stays a plain Express route.
 */

// Referenced by the frontend and the smoke test, so it lives with the schema
// that produces it rather than being duplicated as a literal.
export const INVALID_URL_MESSAGE = 'url must be a valid http(s) URL';

// Only http(s): shortening a javascript: URL would make this an XSS vector.
// The type-level messages matter as much as the refine's: without them a
// missing or non-string url reports Zod's default ("Required", "Expected
// string, received number") instead of the message this API documents.
const httpUrl = z
  .string({ required_error: INVALID_URL_MESSAGE, invalid_type_error: INVALID_URL_MESSAGE })
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }, INVALID_URL_MESSAGE);

export const linkSchema = z.object({
  code: z.string(),
  url: z.string(),
  createdAt: z.string(),
});

export const errorSchema = z.object({ error: z.string() });

export type Link = z.infer<typeof linkSchema>;

const c = initContract();

export const contract = c.router(
  {
    createLink: {
      method: 'POST',
      path: '/links',
      body: z.object({ url: httpUrl }),
      responses: {
        201: linkSchema,
        400: errorSchema,
        500: errorSchema,
      },
      summary: 'Create a short link for a URL',
    },
    listLinks: {
      method: 'GET',
      path: '/links',
      responses: {
        200: z.array(linkSchema),
      },
      summary: 'List every short link, newest first',
    },
  },
  { pathPrefix: '/api' },
);
