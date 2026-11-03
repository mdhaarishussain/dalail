# pipeline

Python 3.11+ CLI that turns `corpus/` into `dist/dalail.db` + `dist/manifest.json`. CPU only.

```bash
cd pipeline
uv sync                      # validate / build --no-embed / tests
uv sync --extra embed        # adds llama-cpp-python (compiles llama.cpp; a few minutes)
uv run python -m dalail_pipeline fetch-model
uv run python -m dalail_pipeline validate          # dev scope: corpus + fixtures
uv run python -m dalail_pipeline validate --prod   # verified, non-fixture only
uv run python -m dalail_pipeline build --dev       # needs the model unless --no-embed
uv run python -m dalail_pipeline build --prod
uv run python -m dalail_pipeline stats
uv run pytest && uv run ruff check . && uv run ruff format --check .

# research only (never used by the app): local speech-to-text for research/munazara
uv sync --extra transcribe
uv run python -m dalail_pipeline fetch-model --transcription   # pinned faster-whisper large-v3, ~3.1 GB
uv run python -m dalail_pipeline transcribe ../research/munazara/audio/yt-<id>.m4a --source-id yt-<id>
```

Errors are printed as `path:line: error CODE: message`. Tests that need the model are skipped
when `models/` or the `embed` extra is missing.
