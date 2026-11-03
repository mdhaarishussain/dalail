#!/usr/bin/env bash
# Everything CI runs. Usable locally: `bash scripts/ci.sh`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "::group::JS install"
pnpm install --frozen-lockfile
echo "::endgroup::"

echo "::group::JS lint / format / typecheck / test"
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
echo "::endgroup::"

echo "::group::Python pipeline"
(
  cd pipeline
  uv sync --frozen
  uv run ruff check .
  uv run ruff format --check .
  uv run pytest -q
)
echo "::endgroup::"

echo "CI OK"
