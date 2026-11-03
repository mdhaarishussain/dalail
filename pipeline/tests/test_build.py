from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pytest

from dalail_pipeline.build import _prod_post_scan, build
from dalail_pipeline.errors import PipelineError
from dalail_pipeline.models import embedding_model


def test_dev_build_keyword_only(repo: Path, tmp_path: Path) -> None:
    res = build(repo_root=repo, corpus_dir=repo / "corpus", out_dir=tmp_path, mode="dev", embed=False)
    con = sqlite3.connect(res.db_path)
    meta = dict(con.execute("SELECT key, value FROM meta"))
    assert meta["embed_model"] == "none" and meta["build_mode"] == "dev"
    assert con.execute("SELECT COUNT(*) FROM nodes").fetchone()[0] == 12
    assert (
        con.execute("SELECT COUNT(*) FROM node_aliases").fetchone()[0] == 12 * 7 + 3
    )  # + 3 Urdu-script fixture aliases
    assert con.execute("SELECT COUNT(*) FROM fixture_dalil").fetchone()[0] == 10
    assert not con.execute("SELECT name FROM sqlite_master WHERE name = 'vec_aliases'").fetchall()
    # FTS rowids equal alias rowids; topic rows come after them.
    assert con.execute(
        "SELECT COUNT(*) FROM nodes_fts f JOIN node_aliases a ON a.rowid = f.rowid WHERE a.node_id = f.node_id"
    ).fetchone()[0] == 87  # fmt: skip
    hits = con.execute(
        "SELECT DISTINCT node_id FROM nodes_fts WHERE nodes_fts MATCH ? AND kind != 'topic'",
        ('{text_norm text_folded}: "kalam" OR "kitab"',),
    ).fetchall()
    assert ("fixture-tawassul-001",) in hits
    manifest = json.loads(res.manifest_path.read_text())
    assert manifest["counts"]["nodes"] == 12 and manifest["embed_model"] == "none"


def test_build_fails_without_model(repo: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    fake_root = tmp_path / "repo"
    (fake_root / "config").mkdir(parents=True)
    (fake_root / "config" / "models.json").write_text((repo / "config" / "models.json").read_text())
    (fake_root / "packages").symlink_to(repo / "packages")
    with pytest.raises(PipelineError, match="embedding model not found"):
        build(repo_root=fake_root, corpus_dir=repo / "corpus", out_dir=tmp_path / "out", mode="dev", embed=True)


def test_prod_refuses_fixtures(repo: Path, tmp_path: Path) -> None:
    with pytest.raises(PipelineError, match="validation failed"):
        build(repo_root=repo, corpus_dir=repo / "corpus", out_dir=tmp_path, mode="prod", embed=False)
    assert not (tmp_path / "dalail.db").exists()


def test_prod_build_of_real_corpus(repo: Path, real_corpus: Path, tmp_path: Path) -> None:
    res = build(repo_root=repo, corpus_dir=real_corpus, out_dir=tmp_path, mode="prod", embed=False)
    con = sqlite3.connect(res.db_path)
    assert con.execute("SELECT id, status FROM nodes").fetchall() == [("test-real-001", "verified")]
    assert con.execute("SELECT id FROM hadith").fetchall() == [("h-9999",)]
    assert not con.execute("SELECT name FROM sqlite_master WHERE name = 'fixture_dalil'").fetchall()
    roles = set(con.execute("SELECT ref, role FROM node_dalail"))
    assert ("quran:2:1-5", "supports") in roles
    assert con.execute("SELECT COUNT(*) FROM quran_ayah").fetchone()[0] == 7 + 286
    assert res.manifest["prod_report"] == {
        "nodes_included": ["test-real-001"],
        "nodes_excluded": {},
        "edges_pruned": [],
    }


def test_prod_build_prunes_edge_to_draft(repo: Path, real_corpus: Path, tmp_path: Path) -> None:
    node = (real_corpus / "nodes/test-real-001.md").read_text()
    draft = node.replace("test-real-001", "test-real-002").replace("status: verified", "status: draft")
    (real_corpus / "nodes/test-real-002.md").write_text(draft.replace("hadith:h-9999", "quran:1:2"))
    (real_corpus / "nodes/test-real-001.md").write_text(node.replace("follow_ups: []", "follow_ups: [test-real-002]"))
    res = build(repo_root=repo, corpus_dir=real_corpus, out_dir=tmp_path, mode="prod", embed=False)
    con = sqlite3.connect(res.db_path)
    assert con.execute("SELECT COUNT(*) FROM edges").fetchone()[0] == 0
    assert res.manifest["prod_report"]["edges_pruned"] == [["test-real-001", "test-real-002"]]
    assert res.manifest["prod_report"]["nodes_excluded"] == {"test-real-002": "draft"}


def test_prod_build_fails_on_unverified_hadith(repo: Path, real_corpus: Path, tmp_path: Path) -> None:
    h = real_corpus / "hadith/h-9999.md"
    h.write_text(h.read_text().replace("status: verified", "status: draft"))
    with pytest.raises(PipelineError):
        build(repo_root=repo, corpus_dir=real_corpus, out_dir=tmp_path, mode="prod", embed=False)


def test_post_scan_catches_fixture_text(tmp_path: Path) -> None:
    con = sqlite3.connect(tmp_path / "x.db")
    con.execute("CREATE TABLE nodes (id TEXT, status TEXT, is_fixture INTEGER, body TEXT)")
    con.execute("CREATE TABLE hadith (id TEXT, status TEXT)")
    con.execute("INSERT INTO nodes VALUES ('a', 'verified', 0, 'see [[fixture:quran:1]]')")
    with pytest.raises(PipelineError, match=r"nodes\.body"):
        _prod_post_scan(con)
    con.execute("UPDATE nodes SET body = 'ok', status = 'draft'")
    with pytest.raises(PipelineError, match="not verified"):
        _prod_post_scan(con)


def _model_available(repo: Path) -> bool:
    try:
        import llama_cpp  # noqa: F401
    except ImportError:
        return False
    return embedding_model(repo).path.is_file()


@pytest.mark.needs_model
def test_dev_build_with_embeddings(repo: Path, tmp_path: Path) -> None:
    if not _model_available(repo):
        pytest.skip("models/ GGUF or the embed extra is missing")
    import sqlite_vec

    res = build(repo_root=repo, corpus_dir=repo / "corpus", out_dir=tmp_path, mode="dev", embed=True)
    con = sqlite3.connect(res.db_path)
    con.enable_load_extension(True)
    sqlite_vec.load(con)
    assert dict(con.execute("SELECT key, value FROM meta"))["embed_dims"] == "384"
    assert con.execute("SELECT COUNT(*) FROM vec_aliases").fetchone()[0] == 87
    blob = con.execute("SELECT embedding FROM vec_aliases WHERE alias_rowid = 1").fetchone()[0]
    assert len(blob) == 384 * 4
    (nearest,) = con.execute(
        "SELECT alias_rowid FROM vec_aliases ORDER BY vec_distance_cosine(embedding, ?) LIMIT 1", (blob,)
    ).fetchone()
    assert nearest == 1
