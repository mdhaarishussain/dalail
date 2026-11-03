# pipeline

Python 3.11+ CLI that turns `corpus/` into `dist/dalail.db`. Runs on a normal laptop, CPU only.

```bash
cd pipeline
uv sync
uv run python -m dalail_pipeline --help
uv run pytest
uv run ruff check . && uv run ruff format --check .
```
