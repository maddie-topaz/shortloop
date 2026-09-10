FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY infra/package.json infra/package.json
COPY packages/contract/package.json packages/contract/package.json
RUN npm ci
COPY packages packages
COPY backend backend
COPY frontend frontend
# The contract is a workspace dependency of both, so it has to be compiled
# before anything that imports it.
RUN npm run build --workspace=@shortloop/contract
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
# The workspace layout is preserved rather than flattened. npm does not hoist
# every dependency to the root: Stryker's mutation-server-protocol requires
# zod ^4, which takes the root slot and pushes zod 3 — and the @ts-rest
# packages peered to it — into backend/node_modules. Flattening dropped those
# and the container died on `require('@ts-rest/express')`. Keeping the layout
# means node's own resolution walks backend/node_modules then /app/node_modules,
# and it stays correct however npm chooses to hoist next.
COPY --from=build /app/node_modules ./node_modules
# node_modules/@shortloop/contract is a workspace symlink into packages/, so
# the target has to come along or it dangles.
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./backend/public
EXPOSE 4000
CMD ["node", "backend/dist/index.js"]
