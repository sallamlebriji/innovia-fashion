FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci
RUN DATABASE_URL=mysql://build:build@127.0.0.1:3306/build npx prisma generate && npm run build

FROM node:24-bookworm-slim AS api
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && mkdir -p /data/media && chown node:node /data/media
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/api ./apps/api
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/bootstrap.ts ./scripts/bootstrap.ts
COPY --from=build --chown=node:node /app/scripts/migrate-media-storage.mts ./scripts/migrate-media-storage.mts
COPY --from=build --chown=node:node /app/docs ./docs
COPY --from=build --chown=node:node /app/package.json ./package.json
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4001 MEDIA_DIR=/data/media
USER node
EXPOSE 4001
CMD ["node", "apps/api/dist/server.js"]

FROM node:24-bookworm-slim AS storefront
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps/storefront ./apps/storefront
COPY --from=build --chown=node:node /app/package.json ./package.json
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/storefront", "--hostname", "0.0.0.0", "--port", "3000"]

FROM nginx:1.28-alpine AS admin
COPY --from=build /app/apps/merchant-admin/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
