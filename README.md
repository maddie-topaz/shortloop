# shortloop

URL shortener used as a testbed for an agentic DevOps pipeline (agent-driven PRs, CI, auto-deploy).

## Stack

- Contract: Zod + ts-rest, shared by both ends (`packages/contract`)
- Backend: Node + TypeScript + Express, Postgres via `pg`
- Frontend: React + TypeScript + Vite
- Tests: Jest (both workspaces)
- Infra: Pulumi (TypeScript), deployed via GitHub Actions to AWS Elastic Beanstalk

## Local development

```bash
npm install
docker compose up -d          # starts Postgres on localhost:5432
DATABASE_URL="postgres://postgres:postgres@localhost:5432/shortloop" npm run dev --workspace=backend
npm run dev --workspace=frontend
```

The frontend dev server proxies `/api` to `http://localhost:4000` (the backend's default port).

## Tests

```bash
docker compose up -d   # backend tests need Postgres on localhost:5432
npm test               # both workspaces
npm run test:backend
npm run test:frontend
```

Backend tests split in two:

- `tests/app.test.ts` — route and validation logic against a mocked `LinkStore`. No database.
- `tests/pgStore.integration.test.ts` — `PgStore` against real Postgres, covering the unique
  constraint, ordering, and the not-found case. Reads `DATABASE_URL`, defaulting to the
  `docker compose` instance on `localhost:5432`.

Mutation testing (`npm run test:mutation`) runs the logic tests only and needs no database —
see `backend/jest.stryker.config.js`.
