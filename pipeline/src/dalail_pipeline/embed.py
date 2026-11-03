"""e5 embeddings via llama-cpp-python, with an on-disk cache keyed by (model sha256, text)."""

from __future__ import annotations

import array
import hashlib
import math
import sqlite3
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .errors import PipelineError
from .models import EmbeddingModel, verify_model


def to_blob(vec: Sequence[float]) -> bytes:
    """float32 little-endian, the layout sqlite-vec expects."""
    a = array.array("f", vec)
    if array.array("H", [1]).tobytes() != b"\x01\x00":  # pragma: no cover - big-endian hosts
        a.byteswap()
    return a.tobytes()


def l2_normalise(v: Sequence[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


class Embedder:
    def __init__(self, model: EmbeddingModel, cache_path: Path) -> None:
        verify_model(model)
        try:
            from llama_cpp import Llama
        except ImportError as e:
            raise PipelineError(
                "llama-cpp-python is not installed. Run `uv sync --extra embed` in pipeline/, "
                "or build keyword-only with --no-embed."
            ) from e
        self.model = model
        self._llm: Any = Llama(
            model_path=str(model.path), embedding=True, n_ctx=model.runtime_n_ctx,
            n_threads=4, verbose=False,
        )  # fmt: skip
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        self._cache = sqlite3.connect(cache_path)
        self._cache.execute("CREATE TABLE IF NOT EXISTS emb (k TEXT PRIMARY KEY, v BLOB NOT NULL)")

    def _key(self, text: str) -> str:
        return hashlib.sha256(f"{self.model.sha256}\0{text}".encode()).hexdigest()

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed full strings (prefix already applied). L2-normalised, cached."""
        out: list[list[float]] = []
        for t in texts:
            k = self._key(t)
            row = self._cache.execute("SELECT v FROM emb WHERE k = ?", (k,)).fetchone()
            if row is not None:
                out.append(list(array.array("f", row[0])))
                continue
            v = l2_normalise(self._llm.embed(t))
            if len(v) != self.model.dims:
                raise PipelineError(f"model returned {len(v)} dims, expected {self.model.dims}")
            self._cache.execute("INSERT OR REPLACE INTO emb VALUES (?, ?)", (k, to_blob(v)))
            out.append(v)
        self._cache.commit()
        return out

    def passages(self, texts: Sequence[str]) -> list[list[float]]:
        return self.embed([self.model.passage_prefix + t for t in texts])

    def queries(self, texts: Sequence[str]) -> list[list[float]]:
        return self.embed([self.model.query_prefix + t for t in texts])
