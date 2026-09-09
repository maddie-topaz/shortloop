# shortloop

URL shortener used as a testbed for an agentic DevOps pipeline (agent-driven PRs, CI, auto-deploy).

## Stack

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
npm test               # both workspaces
npm run test:backend
npm run test:frontend
```

Backend tests run against an in-memory store — no database required.
