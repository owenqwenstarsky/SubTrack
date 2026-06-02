FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY mobile/package.json mobile/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate \
  && npm --workspace server run build \
  && npm --workspace web run build

FROM node:22-alpine AS runtime

RUN apk add --no-cache nginx wget

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/package*.json ./
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/web/package.json web/package.json
COPY --from=build /app/mobile/package.json mobile/package.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/entrypoint.sh /usr/local/bin/subtrack-entrypoint

RUN chmod +x /usr/local/bin/subtrack-entrypoint \
  && mkdir -p /var/cache/nginx /var/log/nginx /run/nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1/api/health >/dev/null || exit 1

ENTRYPOINT ["subtrack-entrypoint"]
