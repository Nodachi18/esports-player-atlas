# Local development image: runs the Worker with `wrangler dev` (workerd + local D1).
# Not used for deployment — production runs on Cloudflare via `npm run deploy`.
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app /data && chown node:node /app /data

WORKDIR /app
USER node
ENV WRANGLER_SEND_METRICS=false

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

EXPOSE 8787
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
