#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "[1/4] TypeScript typecheck"
bun run lint
echo "[2/4] Vite production build"
bun run build
echo "[3/4] Database contract validation"
bun run db:validate
echo "[4/4] Analytics checks + Python tests"
bun run analytics:check
bun run analytics:test
echo "CareOS verification complete."
