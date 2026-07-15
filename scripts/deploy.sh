#!/usr/bin/env bash
# Convenience deploy script for Catalyst. Builds the client and deploys both
# the function and the web client hosting bundle. Assumes `catalyst login`
# and `catalyst init` have already been run. See docs/ARCHITECTURE.md#deployment.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Generating seed data (for Data Store import)…"
node data/generate_seed.js

echo "==> Copying seed data into the function package…"
mkdir -p function/api/data/seed
cp data/seed/*.json function/api/data/seed/

echo "==> Installing function deps…"
(cd function/api && npm install --production)

echo "==> Building client…"
(cd client && npm install && npm run build)

echo "==> Deploying to Catalyst…"
catalyst deploy

echo "Done. Remember to set function env vars (DATA_PROVIDER=catalyst, LLM_PROVIDER=quickml, QUICKML_*) in the console."
