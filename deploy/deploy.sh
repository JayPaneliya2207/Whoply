#!/usr/bin/env bash
# Build and start (or update) Whoply on this server. Run from the deploy/ folder:
#   ./deploy.sh            first time and after every `git pull`
# Safe to run again: builds new images, updates the database (migrate — safe to
# re-run), then restarts only what changed. Shop data is never deleted.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "❌ deploy/.env is missing — copy .env.example to .env and fill it in (DEPLOY.md, step 5)."
    exit 1
fi
set -a; . ./.env; set +a
for v in DOMAIN MONGODB_URI JWT_SECRET; do
    if [ -z "${!v:-}" ] || [ "${!v}" = "yourdomain.com" ]; then echo "❌ Set $v in deploy/.env"; exit 1; fi
done
if [ ${#JWT_SECRET} -lt 32 ]; then echo "❌ JWT_SECRET must be at least 32 characters (openssl rand -hex 48)"; exit 1; fi

# The API runs as user 1000 (node) and writes the daily backups here.
mkdir -p backups && chown 1000:1000 backups 2>/dev/null || true

echo "→ Building…"
docker compose build

echo "→ Updating the database (indexes and fixes — safe to repeat)…"
docker compose run --rm --no-deps api node dist/seeds/migrate.js

echo "→ Starting…"
docker compose up -d --remove-orphans

echo "→ Waiting for the API…"
for i in $(seq 1 30); do
    if docker compose exec -T api node -e "fetch('http://127.0.0.1:7000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
        echo "✅ Whoply is running:"
        echo "   https://$DOMAIN   https://app.$DOMAIN   https://admin.$DOMAIN   https://api.$DOMAIN/api/health"
        docker image prune -f >/dev/null 2>&1 || true
        exit 0
    fi
    sleep 2
done
echo "❌ The API did not start — see: docker compose logs api"
exit 1
