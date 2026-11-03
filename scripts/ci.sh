#!/usr/bin/env bash
# Everything CI runs. Usable locally: `bash scripts/ci.sh`.
# Model-dependent checks (embeddings) run locally only; CI builds keyword-only (--no-embed).
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
  # --inexact keeps an optional `--extra embed` install in local venvs.
  uv sync --frozen --inexact
  uv run ruff check .
  uv run ruff format --check .
  uv run pytest -q
)
echo "::endgroup::"

echo "::group::Corpus: validate, build, prod refusal"
(
  cd pipeline
  uv run python -m dalail_pipeline validate
  uv run python -m dalail_pipeline build --dev --no-embed --out ../dist/ci
  if uv run python -m dalail_pipeline build --prod --no-embed --out ../dist/ci-prod; then
    echo "ERROR: build --prod must refuse a corpus that only has fixtures" >&2
    exit 1
  fi
  echo "ok: build --prod refused the fixture-only corpus"
)
echo "::endgroup::"

echo "::group::Eval (keyword-only)"
pnpm --filter @dalail/eval eval --db "$PWD/dist/ci/dalail.db" --mode keyword --min-top1 0.9
echo "::endgroup::"

echo "CI OK"
