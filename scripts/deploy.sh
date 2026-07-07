#!/usr/bin/env bash
# Convenience deploy script for Catalyst. Builds the client and deploys both
# the function and the web client hosting bundle. Assumes `catalyst login`
# and `catalyst init` have already been run. See docs/ARCHITECTURE.md#deployment.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Generating seed data (for Data Store import)…"
node data/generate_seed.js

echo "==> Installing function deps…"
(cd functions/api && npm install --production)

echo "==> Building client…"
(cd client && npm install && npm run build)

echo "==> Deploying to Catalyst…"
catalyst deploy

echo "Done. Remember to set function env vars (DATA_PROVIDER=catalyst, LLM_PROVIDER=quickml, QUICKML_*) in the console."
