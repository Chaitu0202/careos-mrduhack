#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${GITHUB_REMOTE:-}" ]]; then
  GITHUB_REMOTE="$(git remote get-url origin)"
fi

echo "Verifying CareOS before deployment..."
bash scripts/verify.sh

echo "Pushing to ${GITHUB_REMOTE}..."
git push origin HEAD:main
echo "Deployment push complete. Vercel will build from main."
