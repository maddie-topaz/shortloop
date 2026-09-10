FROM node:20-alpine AS build
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

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package.json ./
RUN npm install --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/frontend/dist ./public
EXPOSE 4000
CMD ["node", "dist/index.js"]
