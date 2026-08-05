#!/usr/bin/env bash
# Deploy DevHub to GitHub → Vercel (auto) and sync schema to Neon.
# Usage: ./scripts/deploy.sh ["commit message"]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NEON_PROJECT_ID="${NEON_PROJECT_ID:-billowing-math-02392065}"
NEON_ORG_ID="${NEON_ORG_ID:-org-gentle-grass-33543322}"

MSG="${1:-}"

echo "==> Git status"
git status --short

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -z "$MSG" ]]; then
    echo "Working tree has changes. Pass a commit message:"
    echo "  ./scripts/deploy.sh \"your message\""
    exit 1
  fi
  echo "==> Commit"
  git add -A
  git commit -m "$MSG"
else
  echo "No local changes to commit."
fi

echo "==> Push GitHub (origin main)"
git push origin HEAD:main

echo "==> Neon: push Drizzle schema"
# Connection string may contain &; do not source it as a shell file.
export DATABASE_URL
DATABASE_URL="$(npx --yes neonctl connection-string \
  --project-id "$NEON_PROJECT_ID" \
  --org-id "$NEON_ORG_ID" 2>/dev/null | tail -1)"

if [[ -z "$DATABASE_URL" || "$DATABASE_URL" != postgres* ]]; then
  echo "Failed to obtain Neon connection string" >&2
  exit 1
fi

pnpm --filter @workspace/db run push

echo "==> Vercel: production deploy status (Git integration should already be building)"
if command -v vercel >/dev/null 2>&1; then
  vercel ls 2>&1 | head -12 || true
else
  echo "vercel CLI not found; relying on GitHub → Vercel auto-deploy"
fi

echo ""
echo "Done."
echo "  GitHub: pushed"
echo "  Neon:   schema synced (project $NEON_PROJECT_ID)"
echo "  Vercel: https://mr-chris-devhub.vercel.app"
