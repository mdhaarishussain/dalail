from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from dalail_pipeline.corpus import load_corpus
from dalail_pipeline.evalcheck import check_real_eval

PROV = 'added_by: "tester"\n    added_on: 2026-11-04\n    origin: "owner"'


@pytest.fixture
def fake_repo(repo: Path, real_corpus: Path, tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "eval").mkdir(parents=True)
    for f in ("questions.schema.json", "config.json"):
        shutil.copy(repo / "eval" / f, root / "eval" / f)
    (root / "packages").symlink_to(repo / "packages")
    return root


def run(root: Path, corpus: Path, body: str) -> list[str]:
    (root / "eval" / "questions.real.yaml").write_text(f"questions:\n{body}")
    return [i.code for i in check_real_eval(root, load_corpus(corpus, include_fixtures=False))]


def test_repo_real_file_is_clean(repo: Path) -> None:
    issues = check_real_eval(repo, load_corpus(repo / "corpus", include_fixtures=True))
    assert [i for i in issues if i.severity == "error"] == []


def test_exact_alias_is_a_leak(fake_repo: Path, real_corpus: Path) -> None:
    body = f'  - q: "TEST: placeholder one"\n    expect: [test-real-001]\n    {PROV}\n'
    assert "EVAL_LEAK" in run(fake_repo, real_corpus, body)


def test_near_exact_after_normalisation_is_a_leak(fake_repo: Path, real_corpus: Path) -> None:
    body = f'  - q: "Test -- placeholder  ONE!!"\n    expect: [test-real-001]\n    {PROV}\n'
    assert "EVAL_LEAK" in run(fake_repo, real_corpus, body)
    body = f'  - q: "test plaseholder one"\n    expect: [test-real-001]\n    {PROV}\n'
    assert "EVAL_LEAK" in run(fake_repo, real_corpus, body)


def test_independent_question_passes(fake_repo: Path, real_corpus: Path) -> None:
    body = f'  - q: "something a person typed in their own words"\n    expect: [test-real-001]\n    {PROV}\n'
    assert run(fake_repo, real_corpus, body) == []


def test_provenance_and_unknown_node(fake_repo: Path, real_corpus: Path) -> None:
    codes = run(fake_repo, real_corpus, '  - q: "own words here"\n    expect: [nope-001]\n')
    assert "EVAL_PROVENANCE" in codes and "EVAL_UNKNOWN_NODE" in codes


def test_schema_error(fake_repo: Path, real_corpus: Path) -> None:
    assert run(fake_repo, real_corpus, '  - q: "no expectation"\n') == ["SCHEMA"]
