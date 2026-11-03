from __future__ import annotations

from pathlib import Path

import pytest

from dalail_pipeline.corpus import load_corpus
from dalail_pipeline.validate import validate

from .conftest import replace_in


def codes(corpus_dir: Path, mode: str = "dev") -> list[str]:
    return [i.code for i in validate(load_corpus(corpus_dir, include_fixtures=mode == "dev"), mode).errors]  # type: ignore[arg-type]


def test_repo_fixtures_are_valid(repo: Path) -> None:
    rep = validate(load_corpus(repo / "corpus", include_fixtures=True), "dev")
    assert rep.errors == []
    assert len(rep.included_nodes) == 12


def test_real_corpus_is_valid_in_prod(real_corpus: Path) -> None:
    rep = validate(load_corpus(real_corpus, include_fixtures=False), "prod")
    assert rep.errors == []
    assert [d.id for d in rep.included_nodes] == ["test-real-001"]


T1 = "fixtures/nodes/fixture-tawassul-001.md"


@pytest.mark.parametrize(
    ("old", "new", "code"),
    [
        ("follow_ups: [fixture-tawassul-002,", "follow_ups: [fixture-tawassul-999,", "BROKEN_LINK"),
        ("follow_ups: [fixture-tawassul-002,", "follow_ups: [fixture-tawassul-001,", "SELF_LINK"),
        ("dalail: [fixture:quran:1,", "dalail: [fixture:quran:99,", "FIXTURE_MISSING"),
        ("dalail: [fixture:quran:1,", "dalail: [bukhari:1,", "SCHEMA"),
        ('short_answer: "FIXTURE: short', 'short_answer: "short', "FIXTURE_UNMARKED"),
        ("FIXTURE: response paragraph two", "response paragraph two", "FIXTURE_UNMARKED"),
        ("topic: tawassul", "topic: mawlid", "UNKNOWN_TOPIC"),
        ("opponent: [wahhabi]", "opponent: [someone]", "UNKNOWN_OPPONENT"),
        ("madhhab: all", "madhhab: other", "SCHEMA"),
        ("id: fixture-tawassul-001", "id: fixture-tawassul-002", "DUP_ID"),
        ('verified_by: "FIXTURE: reviewer"\n', "", "VERIFIED_INCOMPLETE"),
        ("## Response", "## Something", "NO_RESPONSE"),
        ("[[fixture:quran:1]]", "[[fixture:quran:42]]", "FIXTURE_MISSING"),
        ("claim_en: ", "claim_en: [", "YAML"),
    ],
)
def test_detects(corpus_copy: Path, old: str, new: str, code: str) -> None:
    replace_in(corpus_copy / T1, old, new)
    assert code in codes(corpus_copy)


def test_error_has_file_and_line(corpus_copy: Path) -> None:
    replace_in(corpus_copy / T1, "madhhab: all", "madhhab: other")
    rep = validate(load_corpus(corpus_copy, include_fixtures=True), "dev")
    (issue,) = [i for i in rep.errors if i.code == "SCHEMA"]
    assert issue.path.name == "fixture-tawassul-001.md"
    lines = (corpus_copy / T1).read_text().split("\n")
    assert lines[issue.line - 1].startswith("madhhab:")


def test_quran_range_against_static_table(real_corpus: Path) -> None:
    replace_in(real_corpus / "nodes/test-real-001.md", "quran:1:1,", "quran:1:8,")
    assert "QURAN_RANGE" in codes(real_corpus, "prod")


def test_quran_rows_checked_when_present(real_corpus: Path) -> None:
    (real_corpus / "quran").mkdir(exist_ok=True)
    (real_corpus / "quran" / "partial.jsonl").write_text('{"surah": 1, "ayah": 1, "text_ar": "TEST"}\n')
    found = codes(real_corpus, "prod")
    assert "QURAN_COUNT" in found and "QURAN_MISSING" in found


def test_hadith_missing_and_cited_in(real_corpus: Path) -> None:
    replace_in(real_corpus / "hadith/h-9999.md", "cited_in: [test-real-001]", "cited_in: []")
    assert "CITED_IN" in codes(real_corpus, "prod")
    (real_corpus / "hadith/h-9999.md").unlink()
    assert "HADITH_MISSING" in codes(real_corpus, "prod")


def test_fixture_content_in_real_node_rejected(real_corpus: Path) -> None:
    replace_in(real_corpus / "nodes/test-real-001.md", "TEST: placeholder body", "FIXTURE: sneaked in")
    assert "FIXTURE_IN_REAL" in codes(real_corpus, "prod")
    replace_in(real_corpus / "nodes/test-real-001.md", "dalail: [quran:1:1,", "dalail: [fixture:quran:1, quran:1:1,")
    assert codes(real_corpus, "dev").count("FIXTURE_IN_REAL") >= 2


def test_prod_rules(real_corpus: Path) -> None:
    replace_in(real_corpus / "hadith/h-9999.md", "status: verified", "status: draft")
    assert "PROD_HADITH_UNVERIFIED" in codes(real_corpus, "prod")


def test_prod_excludes_unverified_and_rejects_links_to_them(real_corpus: Path) -> None:
    node = (real_corpus / "nodes/test-real-001.md").read_text()
    draft = node.replace("test-real-001", "test-real-002").replace("status: verified", "status: draft")
    draft = draft.replace("dalail: [quran:1:1, hadith:h-9999]", "dalail: [quran:1:1]")
    (real_corpus / "nodes/test-real-002.md").write_text(draft)
    rep = validate(load_corpus(real_corpus, include_fixtures=False), "prod")
    assert rep.excluded == ["test-real-002"] and not rep.errors
    replace_in(real_corpus / "nodes/test-real-001.md", "follow_ups: []", "follow_ups: [test-real-002]")
    assert "PROD_LINK_UNVERIFIED" in codes(real_corpus, "prod")


def test_prod_refuses_fixture_only_corpus(repo: Path) -> None:
    assert "PROD_EMPTY" in codes(repo / "corpus", "prod")


def test_orphan_is_a_warning(corpus_copy: Path) -> None:
    replace_in(
        corpus_copy / "fixtures/nodes/fixture-tawassul-005.md", "follow_ups: [fixture-istighatha-001]", "follow_ups: []"
    )
    replace_in(
        corpus_copy / "fixtures/nodes/fixture-tawassul-003.md", "follow_ups: [fixture-tawassul-005]", "follow_ups: []"
    )
    rep = validate(load_corpus(corpus_copy, include_fixtures=True), "dev")
    assert "ORPHAN" in [w.code for w in rep.warnings]
