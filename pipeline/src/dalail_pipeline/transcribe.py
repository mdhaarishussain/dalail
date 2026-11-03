"""Local speech-to-text for research/munazara (developer machines only; never used by the app).

faster-whisper large-v3 on CPU (int8). Output: research/munazara/transcripts-whisper/<source_id>.md
with frontmatter (`transcript_origin: whisper-large-v3`, model revision, audio sha256, settings) and
`[HH:MM:SS] text` lines, exactly as Whisper produced them (no transliteration, no editing).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import yaml

from .errors import PipelineError

SOURCE_ID = re.compile(r"^yt-[A-Za-z0-9_-]{11}$")
COPY_FIELDS = ("url", "title", "channel", "upload_date")


@dataclass(frozen=True)
class TranscriptionModel:
    id: str
    repo: str
    revision: str
    path: Path
    compute_type: str
    beam_size: int
    vad_filter: bool


class Segment(Protocol):
    start: float
    end: float
    text: str


def transcription_model(repo_root: Path) -> TranscriptionModel:
    t = json.loads((repo_root / "config" / "models.json").read_text())["transcription"]
    return TranscriptionModel(
        id=t["id"], repo=t["repo"], revision=t["revision"], path=repo_root / "models" / t["dir"],
        compute_type=t["compute_type"], beam_size=int(t["beam_size"]), vad_filter=bool(t["vad_filter"]),
    )  # fmt: skip


def fetch_transcription_model(m: TranscriptionModel) -> Path:
    try:
        from huggingface_hub import snapshot_download
    except ImportError as e:  # pragma: no cover - depends on the optional extra
        raise PipelineError("install the extra first: uv sync --extra transcribe") from e
    snapshot_download(repo_id=m.repo, revision=m.revision, local_dir=str(m.path))
    (m.path / "REVISION").write_text(m.revision + "\n")
    return m.path


def _clock(sec: float) -> str:
    s = int(sec)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def render(
    *, source_id: str, model: TranscriptionModel, audio: Path, audio_sha: str, segments: Iterable[Segment],
    info: Any, language: str | None, copied: dict[str, Any], today: dt.date,
) -> str:  # fmt: skip
    lines = []
    for seg in segments:
        text = " ".join(str(seg.text).split())
        if text:
            lines.append(f"[{_clock(seg.start)}] {text}")
    fm: dict[str, Any] = {"source_id": source_id, **copied}
    fm.update({
        "transcript_origin": model.id,
        "model": f"{model.repo}@{model.revision}",
        "audio_file": audio.name,
        "audio_sha256": audio_sha,
        "duration": _clock(float(getattr(info, "duration", 0) or 0)),
        "language": getattr(info, "language", None) or language,
        "language_probability": round(float(getattr(info, "language_probability", 0) or 0), 3),
        "settings": {"device": "cpu", "compute_type": model.compute_type, "beam_size": model.beam_size,
                     "vad_filter": model.vad_filter, "language_forced": language},
        "transcribed_on": today.isoformat(),
        "status": "unverified machine transcript",
    })  # fmt: skip
    header = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, width=1000)
    return f"---\n{header}---\n\n## Transcript\n\n" + "\n".join(lines) + "\n"


def transcribe(
    *, repo_root: Path, audio: Path, source_id: str, language: str | None = "ur", force: bool = False,
    out_dir: Path | None = None, whisper: Any = None, today: dt.date | None = None,
) -> Path:  # fmt: skip
    """`whisper` may be injected (tests); otherwise faster-whisper is loaded from models/."""
    if not SOURCE_ID.match(source_id):
        raise PipelineError(f"--source-id must look like yt-<11-char YouTube id>, got {source_id!r}")
    if not audio.is_file():
        raise PipelineError(f"no such audio file: {audio}")
    munazara = repo_root / "research" / "munazara"
    out_dir = out_dir or munazara / "transcripts-whisper"
    out = out_dir / f"{source_id}.md"
    if out.exists() and not force:
        raise PipelineError(f"{out} exists; pass --force to replace it")

    model = transcription_model(repo_root)
    if whisper is None:
        if not (model.path / "model.bin").is_file():
            hint = "uv run python -m dalail_pipeline fetch-model --transcription"
            raise PipelineError(f"Whisper model not found in {model.path}. Run: {hint}")
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise PipelineError("faster-whisper is not installed. Run: uv sync --extra transcribe") from e
        whisper = WhisperModel(str(model.path), device="cpu", compute_type=model.compute_type)

    segments, info = whisper.transcribe(
        str(audio), language=language, beam_size=model.beam_size, vad_filter=model.vad_filter
    )
    copied: dict[str, Any] = {}
    gemini = munazara / "transcripts" / f"{source_id}.md"
    if gemini.is_file():
        text = gemini.read_text(encoding="utf-8")
        if text.startswith("---\n"):
            meta = yaml.safe_load(text[4 : text.find("\n---", 4)]) or {}
            copied = {k: str(meta[k]) for k in COPY_FIELDS if meta.get(k)}
    body = render(
        source_id=source_id, model=model, audio=audio, audio_sha=sha256_file(audio), segments=segments,
        info=info, language=language, copied=copied, today=today or dt.date.today(),
    )  # fmt: skip
    out_dir.mkdir(parents=True, exist_ok=True)
    out.write_text(body, encoding="utf-8")
    return out
