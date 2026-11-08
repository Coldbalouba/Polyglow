#!/usr/bin/env bash
# Deploy the latest code: run from /opt/app on the server.
# If APP_IMAGE is set in .env, pulls the image GitHub built (best for 1-2 GB servers);
# otherwise builds on the server (needs about 2 GB of RAM + swap).
set -euo pipefail
git pull --ff-only
if grep -Eq '^APP_IMAGE="?[^"[:space:]]+' .env 2>/dev/null; then
  docker compose pull app
  docker compose up -d --no-build
else
  docker compose up -d --build
fi
docker image prune -f
docker compose ps
