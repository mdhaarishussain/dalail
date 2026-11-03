from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from dalail_pipeline.corpus import load_corpus
from dalail_pipeline.errors import PipelineError
from dalail_pipeline.reviews import record_review
from dalail_pipeline.validate import validate

from .conftest import replace_in

NODE = "nodes/test-real-001.md"
OWN = 'short_answer: "TEST: scholar-written placeholder"\nshort_answer_origin: scholar_review'


def codes(corpus: Path) -> list[str]:
    return [i.code for i in validate(load_corpus(corpus, include_fixtures=False), "prod").errors]


def make_scholar_short_answer(corpus: Path) -> None:
    replace_in(corpus / NODE, 'short_answer: "TEST: placeholder short answer"', OWN)


def test_scholar_review_needs_a_record(real_corpus: Path) -> None:
    make_scholar_short_answer(real_corpus)
    found = codes(real_corpus)
    assert "REVIEW_MISSING" in found
    assert "NOT_VERBATIM" not in found  # exempt from the verbatim check


def test_recorded_review_passes_and_detects_later_edits(real_corpus: Path) -> None:
    make_scholar_short_answer(real_corpus)
    record_review(load_corpus(real_corpus, include_fixtures=False), "test-real-001", "short_answer",
                  "TEST: writer", "TEST: approver", today=dt.date(2026, 11, 4))  # fmt: skip
    assert codes(real_corpus) == []
    replace_in(real_corpus / NODE, "scholar-written placeholder", "scholar-written placeholder, edited")
    assert "REVIEW_HASH_MISMATCH" in codes(real_corpus)


def test_scholar_review_only_on_verified_nodes(real_corpus: Path) -> None:
    make_scholar_short_answer(real_corpus)
    replace_in(real_corpus / NODE, "status: verified", "status: draft")
    rep = validate(load_corpus(real_corpus, include_fixtures=False), "dev")
    assert "ORIGIN_NOT_VERIFIED" in [i.code for i in rep.errors]


def test_record_review_refuses_without_origin(real_corpus: Path) -> None:
    with pytest.raises(PipelineError, match="scholar_review"):
        record_review(load_corpus(real_corpus, include_fixtures=False), "test-real-001", "short_answer", "a", "b")


def test_generic_origin_field_and_schema(real_corpus: Path) -> None:
    replace_in(real_corpus / NODE, "status: verified", "body_roman_urdu_origin: scholar_review\nstatus: verified")
    assert "ORIGIN_EMPTY" in codes(real_corpus)
    replace_in(real_corpus / NODE, "body_roman_urdu_origin: scholar_review", "body_roman_urdu_origin: guessed")
    assert "SCHEMA" in codes(real_corpus)


def test_db_records_short_answer_origin(repo: Path, real_corpus: Path, tmp_path: Path) -> None:
    import sqlite3

    from dalail_pipeline.build import build

    res = build(repo_root=repo, corpus_dir=real_corpus, out_dir=tmp_path, mode="prod", embed=False)
    con = sqlite3.connect(res.db_path)
    assert con.execute("SELECT short_answer_origin FROM nodes").fetchall() == [("article",)]
