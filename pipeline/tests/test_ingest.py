from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from dalail_pipeline.corpus import load_corpus
from dalail_pipeline.errors import PipelineError
from dalail_pipeline.ingest import fill_spans, find_duplicates, ingest_finish, next_id, summary_text, sync_cited_in
from dalail_pipeline.sources import html_to_text, new_source
from dalail_pipeline.validate import validate
from dalail_pipeline.verbatim import find_spans

from .conftest import TEST_ARTICLE, replace_in

NODE = "nodes/test-real-001.md"


def errors(corpus: Path) -> list[str]:
    return [i.code for i in validate(load_corpus(corpus, include_fixtures=False), "prod").errors]


def test_html_extraction_is_deterministic_and_scoped() -> None:
    text, title, where = html_to_text(TEST_ARTICLE)
    assert (text, title, where) == html_to_text(TEST_ARTICLE)
    assert title == "Test Article" and where == "article"
    assert "menu" not in text and "footer" not in text
    assert "TEST: neutral placeholder claim" in text  # inline whitespace collapsed
    assert "\n\nTEST: placeholder body.\n\n" in text  # paragraphs separated by a blank line


def test_html_entities_and_skipped_tags() -> None:
    text, _, where = html_to_text("<body><p>a &amp; b&nbsp;c</p><script>x()</script><p>d</p></body>")
    assert where == "body"
    # Entities are decoded; a no-break space counts as whitespace, like in the verbatim check.
    assert text == "a & b c\n\nd\n"


def test_new_source_from_markdown_and_no_overwrite(tmp_path: Path) -> None:
    md = tmp_path / "Some Notes.md"
    md.write_text("Line one\r\n\r\n\r\n\r\nLine two\n")
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "opponents.yaml").write_text("- {id: wahhabi, name_en: W, name_roman_urdu: W}\n")
    folder = new_source(corpus, file=md, opponent="wahhabi", today=dt.date(2026, 11, 3))
    assert folder.name == "some-notes"
    assert (folder / "source.md").read_bytes() == md.read_bytes()
    assert (folder / "text.txt").read_text() == "Line one\n\nLine two\n"
    assert "retrieved_on: '2026-11-03'" in (folder / "meta.yaml").read_text()
    assert "default_opponent: wahhabi" in (folder / "meta.yaml").read_text()
    with pytest.raises(PipelineError, match="never overwritten"):
        new_source(corpus, file=md, opponent="wahhabi")
    with pytest.raises(PipelineError, match="--opponent must be one of"):
        new_source(corpus, file=md, opponent=None)


def test_source_is_immutable(real_corpus: Path) -> None:
    txt = real_corpus / "sources/test-source/text.txt"
    txt.write_text(txt.read_text() + "edited\n")
    assert "SOURCE_MODIFIED" in errors(real_corpus)


def test_real_corpus_passes_verbatim(real_corpus: Path) -> None:
    assert errors(real_corpus) == []
    doc = load_corpus(real_corpus, include_fixtures=False).nodes[0]
    assert set(doc.data["source_spans"]) == {"claim", "short_answer", "body"}


@pytest.mark.parametrize(
    ("old", "new"),
    [
        ('claim_en: "TEST: neutral placeholder claim"', 'claim_en: "TEST: neutral placeholder claims"'),
        ('short_answer: "TEST: placeholder short answer"', 'short_answer: "TEST: placeholder short reply"'),
        ("TEST: placeholder body.", "TEST: placeholder body, reworded."),
    ],
)
def test_any_edit_breaks_verbatim(real_corpus: Path, old: str, new: str) -> None:
    replace_in(real_corpus / NODE, old, new)
    assert "NOT_VERBATIM" in errors(real_corpus)


def test_whitespace_and_chips_are_tolerated(real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, "TEST: placeholder body.", "TEST:   placeholder\nbody. [[quran:1:2]]")
    assert errors(real_corpus) == []


def test_extra_paragraph_needs_spans(real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, "TEST: placeholder body.", "TEST: placeholder body.\n\nIntro words.")
    assert "MISSING_SPANS" in errors(real_corpus)


def test_missing_source_id(real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, "source_id: test-source\n", "")
    assert "MISSING_SOURCE" in errors(real_corpus)


def test_citations_must_come_from_source_or_meta(real_corpus: Path) -> None:
    replace_in(
        real_corpus / NODE,
        "source_id: test-source\n",
        'source_id: test-source\nresponse_source: {scholar: "TEST: invented name"}\n',
    )
    assert "UNSOURCED_CITATION" in errors(real_corpus)
    replace_in(real_corpus / NODE, "TEST: invented name", "Test Article")  # the title is in meta.yaml
    assert "UNSOURCED_CITATION" not in errors(real_corpus)


def test_fill_spans_rejects_text_not_in_source(real_corpus: Path) -> None:
    replace_in(
        real_corpus / NODE, 'claim_en: "TEST: neutral placeholder claim"', 'claim_en: "TEST: written from memory"'
    )
    _, issues = fill_spans(load_corpus(real_corpus, include_fixtures=False), "test-source")
    assert "NOT_VERBATIM" in [i.code for i in issues]


def test_find_spans_maps_back_to_raw_offsets() -> None:
    text = "aa  bb\n\ncc bb"
    assert find_spans(text, "bb cc") == [(4, 10)]
    assert find_spans(text, "bb") == [(4, 6), (11, 13)]
    assert find_spans(text, "bb", start_at=7) == [(11, 13)]


def test_sync_cited_in(real_corpus: Path) -> None:
    replace_in(real_corpus / "hadith/h-9999.md", "cited_in: [test-real-001]", "cited_in: []")
    assert sync_cited_in(load_corpus(real_corpus, include_fixtures=False)) == ["h-9999"]
    assert "cited_in: [test-real-001]" in (real_corpus / "hadith/h-9999.md").read_text()


def test_next_id(real_corpus: Path) -> None:
    c = load_corpus(real_corpus, include_fixtures=False)
    assert next_id(c, "hadith") == "h-10000"
    assert next_id(c, "node", "tawassul") == "tawassul-001"
    with pytest.raises(PipelineError):
        next_id(c, "node")


def test_duplicates_by_token_overlap(repo: Path, real_corpus: Path) -> None:
    node = (real_corpus / NODE).read_text()
    dup = node.replace("test-real-001", "test-real-002").replace("status: verified", "status: draft")
    (real_corpus / "nodes/test-real-002.md").write_text(dup)
    pairs = find_duplicates(load_corpus(real_corpus, include_fixtures=False), repo, use_model=False)
    assert [(p.a, p.b) for p in pairs] == [("test-real-001", "test-real-002")]


def test_ingest_finish_summary(repo: Path, real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, 'short_answer: "TEST: placeholder short answer"', 'short_answer: ""')
    replace_in(real_corpus / NODE, "status: verified", "status: draft")
    s = ingest_finish(repo, real_corpus, "test-source", use_model=False)
    text = summary_text(s, repo)
    assert "test-real-001" in text and "h-9999" in text
    row = next(r for r in s.rows if r[0] == "test-real-001")
    assert "short_answer" in row[3]
    assert not [i for i in s.issues if i.severity == "error"]


@pytest.mark.needs_model
def test_duplicates_with_model(repo: Path, real_corpus: Path) -> None:
    from .test_build import _model_available

    if not _model_available(repo):
        pytest.skip("model not available")
    node = (real_corpus / NODE).read_text()
    dup = node.replace("test-real-001", "test-real-002").replace("status: verified", "status: draft")
    (real_corpus / "nodes/test-real-002.md").write_text(dup)
    (pair,) = find_duplicates(load_corpus(real_corpus, include_fixtures=False), repo)
    assert pair.cosine is not None and pair.cosine > 0.99


def test_opponent_differs_is_flagged(real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, "opponent: [wahhabi]", "opponent: [rawafidh]")
    rep = validate(load_corpus(real_corpus, include_fixtures=False), "prod")
    assert "OPPONENT_DIFFERS" in [w.code for w in rep.warnings]


def test_source_needs_default_opponent(real_corpus: Path) -> None:
    meta = real_corpus / "sources/test-source/meta.yaml"
    meta.write_text(meta.read_text().replace("default_opponent: wahhabi", "default_opponent: ''"))
    assert "SOURCE_OPPONENT" in errors(real_corpus)
