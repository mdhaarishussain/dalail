from __future__ import annotations

import datetime as dt
import importlib.util
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

import pytest

from dalail_pipeline.errors import PipelineError
from dalail_pipeline.transcribe import transcribe

REPO = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("coverage_tool", REPO / "research/munazara/tools/coverage.py")
assert spec and spec.loader
cov = importlib.util.module_from_spec(spec)
sys.modules["coverage_tool"] = cov  # dataclasses need the module registered
spec.loader.exec_module(cov)

# Synthetic, neutral test transcripts (not research content).
T = """---
source_id: {sid}
duration: "{dur}"
speakers:
  - label: A
    name: "{name}"
---

## Transcript

{body}
"""


def write(folder: Path, sid: str, dur: str, body: str, name: str = "Test Speaker") -> Path:
    p = folder / f"{sid}.md"
    p.write_text(T.format(sid=sid, dur=dur, name=name, body=body))
    return p


def test_words_coverage_and_markers(tmp_path: Path) -> None:
    body = "[00:00:00] A: one two three [ARABIC RECITATION]\n[00:00:30] A: four five phrase_as_heard: six"
    r = cov.analyse(write(tmp_path, "yt-aaaaaaaaaaa", "00:01:00", body))
    assert r.words == 6
    assert r.coverage == round(6 / 140, 2) and r.bucket == "thin"
    assert r.jumps == []


def test_unmarked_jumps_including_tail_and_marked_ranges(tmp_path: Path) -> None:
    body = "\n".join([
        "[00:00:00] A: start",
        "[00:05:00] A: after an unmarked gap",
        "[00:05:10] [skipped: test reason 00:05:10\u201300:09:00]",
        "[00:09:00] A: after a marked gap",
        "[00:10:00] A: last line",
    ])  # fmt: skip
    r = cov.analyse(write(tmp_path, "yt-bbbbbbbbbbb", "00:20:00", body))
    assert [(j.start, j.end) for j in r.jumps] == [(0, 300), (600, 1200)]
    assert r.marked_gap_minutes == pytest.approx(3.8, abs=0.1)


def test_buckets() -> None:
    assert (cov.bucket(0.8), cov.bucket(0.5), cov.bucket(0.1)) == ("near-full", "partial", "thin")


def test_retranscribe_order_puts_rashid_first(tmp_path: Path) -> None:
    words = " ".join(["w"] * 100)
    write(tmp_path, "yt-ccccccccccc", "00:01:00", f"[00:00:00] A: {words} {words[:99]}")  # 150 words: near-full
    write(tmp_path, "yt-ddddddddddd", "00:10:00", f"[00:00:00] A: {words}")  # thin, other speaker
    write(tmp_path, "yt-eeeeeeeeeee", "00:02:00", f"[00:00:00] A: {words}", name="Mufti Rashid Test")  # partial
    order = [r.source_id for r in cov.retranscribe_order(cov.analyse_dir(tmp_path))]
    assert order == ["yt-eeeeeeeeeee", "yt-ddddddddddd"]


def test_readme_update_is_idempotent(tmp_path: Path) -> None:
    folder = tmp_path / "t"
    folder.mkdir()
    write(folder, "yt-fffffffffff", "00:10:00", "[00:00:00] A: hello")
    readme = tmp_path / "README.md"
    readme.write_text(
        "# x\n\n| # | Files | Topics |\n| --- | --- | --- |\n"
        "| 1 | [yt-fffffffffff](transcripts/yt-fffffffffff.md) | t |\n\nend\n"
    )
    reports = cov.analyse_dir(folder)
    assert cov.update_readme(readme, reports) is True
    text = readme.read_text()
    assert "| # | Files | Topics | Coverage |" in text and "thin 0.00" in text and "## Re-transcribe" in text
    assert cov.update_readme(readme, reports) is False


def test_real_research_set_parses() -> None:
    reports = cov.analyse_dir(REPO / "research/munazara/transcripts")
    assert len(reports) >= 46 and all(r.duration_s > 0 for r in reports)


@dataclass
class Seg:
    start: float
    end: float
    text: str


@dataclass
class Info:
    language: str = "ur"
    language_probability: float = 0.97
    duration: float = 75.0


class FakeWhisper:
    def __init__(self) -> None:
        self.kwargs: dict[str, object] = {}

    def transcribe(self, path: str, **kwargs: object) -> tuple[list[Seg], Info]:
        self.kwargs = kwargs
        return [Seg(0.0, 4.2, "  segment one  "), Seg(65.5, 70.0, "segment two"), Seg(71, 72, " ")], Info()


@pytest.fixture
def fake_repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "config").mkdir(parents=True)
    shutil.copy(REPO / "config/models.json", root / "config/models.json")
    gem = root / "research/munazara/transcripts"
    gem.mkdir(parents=True)
    (gem / "yt-ggggggggggg.md").write_text(
        '---\nsource_id: yt-ggggggggggg\nurl: https://example.invalid/v\ntitle: "T"\n---\n'
    )
    return root


def test_transcribe_writes_frontmatter_and_segments(fake_repo: Path, tmp_path: Path) -> None:
    audio = tmp_path / "a.m4a"
    audio.write_bytes(b"not really audio")
    fake = FakeWhisper()
    out = transcribe(repo_root=fake_repo, audio=audio, source_id="yt-ggggggggggg", whisper=fake,
                     today=dt.date(2026, 11, 4))  # fmt: skip
    text = out.read_text()
    assert out == fake_repo / "research/munazara/transcripts-whisper/yt-ggggggggggg.md"
    assert "transcript_origin: whisper-large-v3" in text
    assert "model: Systran/faster-whisper-large-v3@" in text
    assert "url: https://example.invalid/v" in text and "audio_file: a.m4a" in text
    assert "duration: 00:01:15" in text
    assert "[00:00:00] segment one\n[00:01:05] segment two\n" in text
    assert fake.kwargs == {"language": "ur", "beam_size": 5, "vad_filter": True}
    with pytest.raises(PipelineError, match="--force"):
        transcribe(repo_root=fake_repo, audio=audio, source_id="yt-ggggggggggg", whisper=fake)
    transcribe(repo_root=fake_repo, audio=audio, source_id="yt-ggggggggggg", whisper=fake, force=True)


def test_transcribe_validates_inputs(fake_repo: Path, tmp_path: Path) -> None:
    audio = tmp_path / "a.wav"
    audio.write_bytes(b"x")
    with pytest.raises(PipelineError, match="source-id"):
        transcribe(repo_root=fake_repo, audio=audio, source_id="hqDt_1BwzLc", whisper=FakeWhisper())
    with pytest.raises(PipelineError, match="no such audio"):
        transcribe(
            repo_root=fake_repo, audio=tmp_path / "missing.wav", source_id="yt-ggggggggggg", whisper=FakeWhisper()
        )
    with pytest.raises(PipelineError, match="Whisper model not found"):
        transcribe(repo_root=fake_repo, audio=audio, source_id="yt-ggggggggggg")
