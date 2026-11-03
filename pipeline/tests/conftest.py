from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from dalail_pipeline.paths import find_repo_root

REPO = find_repo_root()

# The "article" the test node is extracted from. Neutral placeholder text, not religious content.
TEST_ARTICLE = """<html><head><title>Test Article</title></head><body>
<nav>menu</nav>
<article>
<h1>Test Article</h1>
<p>TEST: neutral   placeholder claim</p>
<p>Intro words. TEST: placeholder short answer</p>
<p>TEST: placeholder body.</p>
<p>TEST: placeholder translation</p>
<p>TEST: placeholder reference</p>
</article>
<footer>footer</footer>
</body></html>
"""

# Neutral, obviously-fake placeholder text for "real" (non-fixture) test nodes.
# It is not religious content and not FIXTURE: text, so it exercises the prod path.
REAL_NODE = """---
id: test-real-001
topic: tawassul
type: claim-response
opponent: [wahhabi]
claim_en: "TEST: neutral placeholder claim"
claim_roman_urdu:
  - "TEST: placeholder one"
  - "TEST: placeholder two"
  - "TEST: placeholder three"
  - "TEST: placeholder four"
  - "TEST: placeholder five"
short_answer: "TEST: placeholder short answer"
source_id: test-source
dalail: [quran:1:1, hadith:h-9999]
follow_ups: []
madhhab: all
lang: en
verified_by: "TEST: reviewer"
verified_on: 2026-11-01
status: verified
---

## Response

TEST: placeholder body. [[quran:2:1-5]]
"""

REAL_HADITH = """---
id: h-9999
translation: "TEST: placeholder translation"
reference: "TEST: placeholder reference"
cited_in: [test-real-001]
source_id: test-source
source: {scholar: "TEST: placeholder", work: "TEST: placeholder", url: "TEST: placeholder"}
status: verified
---
"""


@pytest.fixture
def repo() -> Path:
    return REPO


@pytest.fixture
def corpus_copy(tmp_path: Path) -> Path:
    """A writable copy of corpus/ (schemas, topics, fixtures; nodes/ and hadith/ as in the repo)."""
    dst = tmp_path / "corpus"
    shutil.copytree(REPO / "corpus", dst)
    return dst


@pytest.fixture
def real_corpus(tmp_path: Path) -> Path:
    """A corpus with one verified real node + hadith and no fixtures."""
    dst = tmp_path / "corpus"
    shutil.copytree(REPO / "corpus", dst, ignore=shutil.ignore_patterns("fixtures"))
    (dst / "nodes" / "test-real-001.md").write_text(REAL_NODE)
    (dst / "hadith" / "h-9999.md").write_text(REAL_HADITH)
    write_test_quran(dst, surahs=(1, 2))
    capture_test_source(dst, tmp_path)
    return dst


def capture_test_source(corpus: Path, tmp_path: Path) -> None:
    import datetime as dt

    from dalail_pipeline.corpus import load_corpus
    from dalail_pipeline.ingest import fill_spans
    from dalail_pipeline.sources import new_source

    html = tmp_path / "test-article.html"
    html.write_text(TEST_ARTICLE)
    new_source(corpus, file=html, source_id="test-source", today=dt.date(2026, 11, 3))
    _, issues = fill_spans(load_corpus(corpus, include_fixtures=False), "test-source")
    assert [i for i in issues if i.severity == "error"] == []


def write_test_quran(corpus: Path, surahs: tuple[int, ...]) -> None:
    """Complete placeholder rows for the given surahs (TEST: text, never real Quran text)."""
    import json

    from dalail_pipeline.refs import surah_ayah_counts

    rows = [
        {"surah": s, "ayah": a, "text_ar": f"TEST: placeholder {s}:{a}", "translation_ur": "TEST: placeholder"}
        for s in surahs
        for a in range(1, surah_ayah_counts()[s - 1] + 1)
    ]
    (corpus / "quran").mkdir(exist_ok=True)
    (corpus / "quran" / "test.jsonl").write_text("".join(json.dumps(r) + "\n" for r in rows))


def replace_in(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    assert old in text, f"{old!r} not in {path.name}"
    path.write_text(text.replace(old, new, 1))
