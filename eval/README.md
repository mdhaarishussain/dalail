# eval

Retrieval evaluation. Runs `@dalail/core`'s `retrieve()` — the same code the app uses — against a
built `dist/dalail.db` through Node's built-in `node:sqlite`.

```bash
cd pipeline
uv run python -m dalail_pipeline build --dev                       # or --no-embed for keyword-only
uv run python -m dalail_pipeline embed-queries ../eval/questions.fixture.yaml   # hybrid only
cd ..
pnpm --filter @dalail/eval eval                    # auto: hybrid if the DB has vectors
pnpm --filter @dalail/eval eval --mode keyword --min-top1 0.9
```

Reports top-1, top-3, ambiguous rate and no-match rate over answerable questions, status accuracy
for questions with `expect_status`, a per-style breakdown, latency, and every miss. Full results
go to `eval/results/latest.json` (gitignored).

- `questions.fixture.yaml` — fixture queries (neutral vocabulary; no religious text).
- Thresholds live in `packages/core/src/retrieval/config.json`; tune there.
- Vector search loads the same sqlite-vec binary as the pipeline (found via `uv`), or set
  `DALAIL_SQLITE_VEC=/path/to/vec0`.
