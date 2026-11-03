"""Model registry (config/models.json), sha256 verification and dev-only download."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from .errors import PipelineError


@dataclass(frozen=True)
class EmbeddingModel:
    id: str
    file: str
    url: str
    size_bytes: int
    sha256: str
    dims: int
    context_length: int
    runtime_n_ctx: int
    query_prefix: str
    passage_prefix: str
    path: Path


def embedding_model(repo_root: Path) -> EmbeddingModel:
    e = json.loads((repo_root / "config" / "models.json").read_text())["embedding"]
    return EmbeddingModel(
        id=e["id"], file=e["file"], url=e["url"], size_bytes=e["size_bytes"], sha256=e["sha256"],
        dims=e["dims"], context_length=e["context_length"], runtime_n_ctx=e["runtime_n_ctx"],
        query_prefix=e["query_prefix"],
        passage_prefix=e["passage_prefix"], path=repo_root / "models" / e["file"],
    )  # fmt: skip


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_model(m: EmbeddingModel) -> None:
    """Raise unless the model file exists and matches the pinned sha256 (result cached by size+mtime)."""
    if not m.path.is_file():
        raise PipelineError(
            f"embedding model not found at {m.path}.\n"
            "  Run `uv run python -m dalail_pipeline fetch-model`, or build keyword-only with --no-embed."
        )
    st = m.path.stat()
    stamp = m.path.with_suffix(m.path.suffix + ".verified")
    key = f"{m.sha256} {st.st_size} {st.st_mtime_ns}"
    if stamp.is_file() and stamp.read_text() == key:
        return
    actual = sha256_file(m.path)
    if actual != m.sha256:
        raise PipelineError(f"{m.path.name}: sha256 {actual} does not match pinned {m.sha256}")
    stamp.write_text(key)


def fetch_model(m: EmbeddingModel) -> Path:
    """Resumable download to models/ (developer machines only), then verify sha256."""
    m.path.parent.mkdir(parents=True, exist_ok=True)
    if m.path.is_file():
        verify_model(m)
        return m.path
    part = m.path.with_suffix(m.path.suffix + ".part")
    have = part.stat().st_size if part.exists() else 0
    req = urllib.request.Request(m.url, headers={"User-Agent": "dalail-pipeline"})
    if have:
        req.add_header("Range", f"bytes={have}-")
    with urllib.request.urlopen(req, timeout=60) as resp, part.open("ab" if have else "wb") as out:
        if have and resp.status != 206:
            out.truncate(0)
        total = m.size_bytes
        done = have if resp.status == 206 else 0
        while chunk := resp.read(1 << 20):
            out.write(chunk)
            done += len(chunk)
            if os.isatty(2):
                print(f"\r  {done / 1e6:7.1f} / {total / 1e6:.1f} MB", end="", file=sys.stderr)
    if part.stat().st_size != m.size_bytes:
        raise PipelineError(f"download incomplete ({part.stat().st_size} of {m.size_bytes} bytes); re-run to resume")
    part.rename(m.path)
    verify_model(m)
    return m.path
