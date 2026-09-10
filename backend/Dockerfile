FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY infra/package.json infra/package.json
RUN npm ci
COPY backend backend
COPY frontend frontend
RUN npm run build --workspace=backend
RUN npm run build --workspace=frontend
# Prune to production dependencies using the lockfile. Installing from
# backend/package.json instead would make npm re-resolve the whole tree,
# including devDependencies it is about to discard — so a dev-only peer
# conflict could break the production image.
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/frontend/dist ./public
EXPOSE 4000
CMD ["node", "dist/index.js"]
