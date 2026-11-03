"""Research import (dev-only, ADR 0008) on a tiny synthetic research folder. Neutral placeholder text."""

from __future__ import annotations

import shutil
import sqlite3
from collections.abc import Sequence
from pathlib import Path

import pytest
import yaml

from dalail_pipeline.build import _prod_post_scan, build
from dalail_pipeline.errors import PipelineError
from dalail_pipeline.research_import import import_research

REPO = Path(__file__).resolve().parents[2]


def fake_embed(texts: Sequence[str]) -> list[list[float]]:
    """alpha-texts cluster together, beta-texts together, everything else apart."""
    out = []
    for i, t in enumerate(texts):
        if "alpha" in t:
            out.append([1.0, 0.0, 0.0])
        elif "beta" in t:
            out.append([0.0, 1.0, 0.0])
        else:
            out.append([0.0, 0.0, 1.0] if i % 2 else [0.6, 0.8, 0.0])
    return out


TRANSCRIPT = """---
source_id: {sid}
url: https://www.youtube.com/watch?v={vid}
title: "TEST video {sid}"
duration: "00:10:00"
topics: [tawassul]
speakers:
  - {{label: A, name: "TEST Mufti Rashid speaker"}}
  - {{label: M, name: "TEST opponent speaker"}}
---

## Transcript

[00:00:00] A: TEST words
"""


def move(mid: str, ts: str, kind: str, side: str, speaker: str, quote: str, summary: str, **kw: object) -> dict:
    base = {"move_id": mid, "timestamp": ts, "speaker": speaker, "side": side, "kind": kind}
    base |= {"move_type": "attack-chain", "quote": quote, "summary_en": summary}
    base |= {"evidence_cited": kw.pop("evidence", []), "responds_to": kw.pop("responds_to", None)}
    return base | {"confidence": kw.pop("confidence", "high"), **kw}


@pytest.fixture
def research(tmp_path: Path) -> Path:
    root = tmp_path / "munazara"
    (root / "tools").mkdir(parents=True)
    shutil.copy(REPO / "research/munazara/tools/coverage.py", root / "tools/coverage.py")
    (root / "registry").mkdir()
    (root / "registry/claims.yaml").write_text(yaml.safe_dump({"claims": {"TW-EM-C01": {"title": "TEST suggested"}}}))
    (root / "registry/counter-questions.yaml").write_text(yaml.safe_dump({"counter_questions": {}}))
    (root / "transcripts").mkdir()
    (root / "extractions").mkdir()
    videos = {
        "yt-aaaaaaaaaaa": [
            move(
                "M01",
                "00:00:10-00:00:20",
                "claim",
                "ali-mirza",
                "M",
                "TEST alpha quote one",
                "TEST alpha claim",
                maps_to="TW-EM-C01",
            ),
            move(
                "M02",
                "00:00:30-00:00:40",
                "response",
                "ahl-e-sunnat",
                "A",
                "TEST reply one",
                "TEST reply",
                responds_to="M01",
                evidence=[{"as_said": "TEST evidence as said", "timestamp": "00:00:31"}],
            ),
            move(
                "M03",
                "00:01:00-00:01:10",
                "counter-question",
                "ahl-e-sunnat",
                "A",
                "TEST ask back",
                "TEST cq",
                responds_to="M02",
            ),
            move("M04", "00:02:00-00:02:10", "claim", "ali-mirza", "M", "TEST beta quote", "TEST beta claim"),
            move("M05", "00:03:00-00:03:10", "claim", "ahl-e-sunnat", "A", "TEST sunni claim", "TEST other"),
            move("M06", "00:04:00-00:04:10", "claim", "ali-mirza", "M", "TEST low", "TEST low claim", confidence="low"),
        ],
        "yt-bbbbbbbbbbb": [
            move("M01", "00:05:00-00:05:10", "claim", "ali-mirza", "M", "TEST alpha quote two", "TEST alpha again"),
            move(
                "M02", "00:06:00-00:06:10", "response", "ali-mirza", "M", "TEST not rashid", "TEST x", responds_to="M01"
            ),
        ],
    }
    for sid, moves in videos.items():
        (root / "transcripts" / f"{sid}.md").write_text(TRANSCRIPT.format(sid=sid, vid=sid[3:]))
        phr = [{"maps_to": "TW-EM-C01", "text": "TEST how people say alpha", "timestamp": "00:00:12"}]
        ex = {"source_id": sid, "moves": moves, "new_claims": [], "phrasings": phr if sid.endswith("a") else []}
        (root / "extractions" / f"{sid}.yaml").write_text(yaml.safe_dump(ex, allow_unicode=True))
    return root


def run(research: Path, out: Path) -> dict:
    topics = {"tawassul", "istighatha"}
    return import_research(research, out, fake_embed, topics, {"ali-mirza", "wahhabi", "rawafidh", "other"})


def test_import_clusters_and_links(research: Path, tmp_path: Path) -> None:
    out = tmp_path / "out"
    m = run(research, out)
    nodes = yaml.safe_load((out / "nodes.yaml").read_text())
    assert m["counts"]["claim_nodes"] == 2  # alpha (merged across 2 videos) + beta
    alpha = next(n for n in nodes if "alpha" in n["summary_en"])
    assert alpha["origin"] == "gemini-research" and alpha["status"] == "draft"
    assert [o["source_id"] for o in alpha["occurrences"]] == ["yt-aaaaaaaaaaa", "yt-bbbbbbbbbbb"]
    assert alpha["occurrences"][0]["deep_link"] == "https://www.youtube.com/watch?v=aaaaaaaaaaa&t=10s"
    assert alpha["suggested_name"] == "TEST suggested"
    assert "TEST how people say alpha" in alpha["aliases"]
    (resp,) = alpha["candidate_responses"]  # the non-Rashid response is skipped
    assert resp["evidence_as_said"] == ["TEST evidence as said"] and resp["at"] == "00:30"
    cqs = yaml.safe_load((out / "counter_questions.yaml").read_text())
    assert cqs[0]["counters"] == [alpha["id"]]
    edges = yaml.safe_load((out / "edges.yaml").read_text())
    beta = next(n for n in nodes if "beta" in n["summary_en"])
    assert {"from": alpha["id"], "to": beta["id"], "kind": "follow_up"} in edges
    report = (out / "report.md").read_text()
    assert "claim by side 'ahl-e-sunnat'" in report and "confidence: low" in report and "not Mufti Rashid" in report
    assert "GENERATED" in (out / "nodes.yaml").read_text().splitlines()[0]


def test_dev_build_includes_research_and_prod_refuses_it(research: Path, real_corpus: Path, tmp_path: Path) -> None:
    run(research, real_corpus / "research-import")
    dev = build(repo_root=REPO, corpus_dir=real_corpus, out_dir=tmp_path / "dev", mode="dev", embed=False)
    con = sqlite3.connect(dev.db_path)
    rows = con.execute("SELECT origin, node_type, COUNT(*) FROM nodes GROUP BY 1, 2 ORDER BY 1, 2").fetchall()
    assert ("gemini-research", "claim-only", 2) in rows and ("gemini-research", "counter-question", 1) in rows
    assert con.execute("SELECT COUNT(*) FROM edges WHERE kind = 'counters'").fetchone()[0] == 1
    hits = con.execute("SELECT DISTINCT node_id FROM nodes_fts WHERE nodes_fts MATCH 'beta'").fetchall()
    assert hits and hits[0][0].startswith("rs-tawassul-")
    # Prod ignores the import entirely and passes its own safety scan.
    prod = build(repo_root=REPO, corpus_dir=real_corpus, out_dir=tmp_path / "prod", mode="prod", embed=False)
    pcon = sqlite3.connect(prod.db_path)
    assert pcon.execute("SELECT COUNT(*) FROM nodes WHERE origin = 'gemini-research'").fetchone()[0] == 0


def test_post_scan_rejects_research_rows(research: Path, real_corpus: Path, tmp_path: Path) -> None:
    run(research, real_corpus / "research-import")
    dev = build(repo_root=REPO, corpus_dir=real_corpus, out_dir=tmp_path / "dev", mode="dev", embed=False)
    con = sqlite3.connect(dev.db_path)
    con.execute("DELETE FROM nodes WHERE status != 'verified' AND origin != 'gemini-research'")
    con.execute("UPDATE nodes SET status = 'verified'")
    with pytest.raises(PipelineError) as e:
        _prod_post_scan(con)
    msg = str(e.value)
    assert "gemini-research" in msg and "counters" in msg and "research alias" in msg


def test_research_origin_in_corpus_nodes_is_refused(real_corpus: Path) -> None:
    from dalail_pipeline.corpus import load_corpus
    from dalail_pipeline.validate import validate

    p = real_corpus / "nodes/test-real-001.md"
    p.write_text(p.read_text().replace("status: verified", "origin: gemini-research\nstatus: verified"))
    codes = [i.code for i in validate(load_corpus(real_corpus, include_fixtures=False), "prod").errors]
    assert "RESEARCH_IN_CORPUS" in codes


def test_import_refuses_empty_folder(tmp_path: Path) -> None:
    root = tmp_path / "m"
    (root / "extractions").mkdir(parents=True)
    (root / "tools").mkdir()
    shutil.copy(REPO / "research/munazara/tools/coverage.py", root / "tools/coverage.py")
    with pytest.raises(PipelineError, match="no extractions"):
        run(root, tmp_path / "o")
