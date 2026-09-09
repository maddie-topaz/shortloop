#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d

until docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

DATABASE_URL="postgres://postgres:postgres@localhost:5432/shortloop" \
  npx concurrently -n backend,frontend -c blue,green \
  "npm run dev --workspace=backend" \
  "npm run dev --workspace=frontend"
