#!/bin/sh
# Applies D1 migrations to the persistent local database, optionally seeds demo data, then starts wrangler dev.
set -e

STATE=/data

npx wrangler d1 migrations apply DB --local --persist-to "$STATE"

if [ "$SEED_DEMO" = "true" ]; then
  # INSERT OR IGNORE, so re-running on every start is harmless.
  npx wrangler d1 execute DB --local --persist-to "$STATE" --file=seed/demo.sql
fi

exec npx wrangler dev \
  --ip 0.0.0.0 \
  --port 8787 \
  --persist-to "$STATE" \
  --show-interactive-dev-session=false \
  --var "ADMIN_KEY:$ADMIN_KEY" \
  --var "APP_SECRET:$APP_SECRET"
