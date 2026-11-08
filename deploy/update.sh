#!/usr/bin/env bash
# Deploy the latest code: run from /opt/app on the server.
set -euo pipefail
git pull --ff-only
docker compose up -d --build
docker image prune -f
docker compose ps
