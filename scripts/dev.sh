#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Starting CareOS preview at http://localhost:3000"
bun run dev
