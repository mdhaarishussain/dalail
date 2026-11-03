"""Write dist/dalail.db (read-only, shipped in the app) and dist/manifest.json."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sqlite3
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .corpus import Corpus, Doc, load_corpus
from .embed import Embedder, to_blob
from .errors import PipelineError
from .models import embedding_model
from .normalise import Normaliser
from .paths import normalise_dir
from .refs import extract_inline_refs
from .validate import FIXTURE_MARK, Mode, Report, validate

SCHEMA_VERSION = 1

DDL = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE topics (id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_roman_urdu TEXT NOT NULL, sort INTEGER NOT NULL);
CREATE TABLE opponents (id TEXT PRIMARY KEY, name_en TEXT NOT NULL, name_roman_urdu TEXT NOT NULL);
CREATE TABLE nodes (
  id TEXT PRIMARY KEY, topic TEXT NOT NULL REFERENCES topics(id), opponent_json TEXT NOT NULL,
  claim_en TEXT NOT NULL, short_answer TEXT NOT NULL, body_md TEXT NOT NULL,
  response_source_json TEXT NOT NULL, claim_source_json TEXT NOT NULL,
  madhhab TEXT NOT NULL, lang TEXT NOT NULL, status TEXT NOT NULL,
  verified_by TEXT, verified_on TEXT, is_fixture INTEGER NOT NULL
);
CREATE TABLE node_aliases (
  rowid INTEGER PRIMARY KEY, node_id TEXT NOT NULL REFERENCES nodes(id),
  text TEXT NOT NULL, text_norm TEXT NOT NULL, text_folded TEXT NOT NULL,
  lang TEXT NOT NULL, kind TEXT NOT NULL
);
CREATE INDEX node_aliases_node ON node_aliases(node_id);
CREATE TABLE edges (from_id TEXT NOT NULL, to_id TEXT NOT NULL, kind TEXT NOT NULL, ord INTEGER NOT NULL);
CREATE INDEX edges_from ON edges(from_id);
CREATE INDEX edges_to ON edges(to_id);
CREATE TABLE node_dalail (node_id TEXT NOT NULL, ref TEXT NOT NULL, role TEXT NOT NULL, ord INTEGER NOT NULL);
CREATE INDEX node_dalail_node ON node_dalail(node_id);
CREATE INDEX node_dalail_ref ON node_dalail(ref);
CREATE TABLE quran_ayah (
  surah INTEGER NOT NULL, ayah INTEGER NOT NULL, text_ar TEXT NOT NULL, translation_ur TEXT,
  translation_en TEXT, translation_en_source TEXT, PRIMARY KEY (surah, ayah)
);
CREATE TABLE hadith (
  id TEXT PRIMARY KEY, text_ar TEXT, translation TEXT NOT NULL, reference TEXT NOT NULL,
  grading TEXT, cited_in_json TEXT NOT NULL, source_json TEXT NOT NULL, status TEXT NOT NULL
);
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  text, text_norm, text_folded, node_id UNINDEXED, topic UNINDEXED, kind UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
"""

DDL_FIXTURE = """
CREATE TABLE fixture_dalil (
  ref TEXT PRIMARY KEY, kind TEXT NOT NULL, text_ar TEXT NOT NULL, translation TEXT NOT NULL,
  reference TEXT NOT NULL, grading TEXT
);
"""

DDL_VEC = """
CREATE TABLE vec_aliases (alias_rowid INTEGER PRIMARY KEY REFERENCES node_aliases(rowid), embedding BLOB NOT NULL);
"""


@dataclass
class BuildResult:
    db_path: Path
    manifest_path: Path
    manifest: dict[str, Any]
    report: Report


def index_text(text: str) -> str:
    """Text used for search. The FIXTURE: marker is display-only, so it is not indexed or embedded."""
    return text.removeprefix(FIXTURE_MARK).lstrip()


def _j(v: Any) -> str:
    return json.dumps(v if v is not None else {}, ensure_ascii=False, sort_keys=True)


def _content_sha(corpus: Corpus, repo_root: Path) -> str:
    h = hashlib.sha256()
    named = [(f"corpus/{p.relative_to(corpus.root)}", p) for p in set(corpus.input_files)]
    named += [(f"normalise/{p.name}", p) for p in normalise_dir(repo_root).glob("*.json")]
    for name, p in sorted(named):
        h.update(name.encode() + b"\0" + p.read_bytes() + b"\0")
    return h.hexdigest()


def build(
    *, repo_root: Path, corpus_dir: Path, out_dir: Path, mode: Mode, embed: bool,
    built_at: dt.datetime | None = None,
) -> BuildResult:  # fmt: skip
    corpus = load_corpus(corpus_dir, include_fixtures=(mode == "dev"))
    report = validate(corpus, mode)
    if report.errors:
        raise PipelineError(f"validation failed with {len(report.errors)} error(s); run `validate` for details")

    normaliser = Normaliser(normalise_dir(repo_root))
    nodes = sorted(report.included_nodes, key=lambda d: d.id)
    node_ids = {d.id for d in nodes}
    topic_of = {d.id: d.data["topic"] for d in nodes}

    aliases: list[tuple[str, str, str, str]] = []  # node_id, text, lang, kind
    for d in nodes:
        aliases.append((d.id, d.data["claim_en"], "en", "claim"))
        aliases += [(d.id, a, "roman-ur", "alias") for a in d.data.get("claim_roman_urdu") or []]

    model = embedding_model(repo_root)
    vectors: list[list[float]] | None = None
    if embed:
        embedder = Embedder(model, out_dir / ".embed-cache.sqlite")
        vectors = embedder.passages([index_text(a[1]) for a in aliases])

    out_dir.mkdir(parents=True, exist_ok=True)
    db_path = out_dir / "dalail.db"
    tmp = out_dir / "dalail.db.tmp"
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    try:
        con.executescript(DDL)
        if mode == "dev":
            con.executescript(DDL_FIXTURE)
        if vectors is not None:
            con.executescript(DDL_VEC)
        _write(con, corpus, report, nodes, node_ids, topic_of, aliases, vectors, normaliser, mode)
        built = (built_at or dt.datetime.now(dt.UTC)).replace(microsecond=0).isoformat()
        meta = {
            "schema_version": str(SCHEMA_VERSION),
            "corpus_version": corpus.corpus_version,
            "built_at": built,
            "build_mode": mode,
            "embed_model": model.id if vectors is not None else "none",
            "embed_model_sha256": model.sha256 if vectors is not None else "",
            "embed_dims": str(model.dims) if vectors is not None else "0",
            "query_prefix": model.query_prefix,
            "normaliser_rules_version": str(normaliser.rules_version),
            "sha": _content_sha(corpus, repo_root),
        }
        con.executemany("INSERT INTO meta VALUES (?, ?)", sorted(meta.items()))
        con.execute("INSERT INTO nodes_fts(nodes_fts) VALUES ('optimize')")
        con.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
        con.commit()
        if mode == "prod":
            _prod_post_scan(con)
        con.execute("VACUUM")
    except BaseException:
        con.close()
        tmp.unlink(missing_ok=True)
        raise
    con.close()
    os.replace(tmp, db_path)

    manifest = _manifest(db_path, meta, nodes, report, aliases, corpus)
    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    return BuildResult(db_path, manifest_path, manifest, report)


def _write(
    con: sqlite3.Connection, corpus: Corpus, report: Report, nodes: list[Doc], node_ids: set[str],
    topic_of: dict[str, str], aliases: list[tuple[str, str, str, str]],
    vectors: list[list[float]] | None, normaliser: Normaliser, mode: Mode,
) -> None:  # fmt: skip
    for t in corpus.topics:
        con.execute(
            "INSERT INTO topics VALUES (?, ?, ?, ?)",
            (t["id"], t["name_en"], t["name_roman_urdu"], int(t["sort"])),
        )
    for o in corpus.opponents:
        con.execute("INSERT INTO opponents VALUES (?, ?, ?)", (o["id"], o["name_en"], o["name_roman_urdu"]))

    for d in nodes:
        x = d.data
        con.execute(
            "INSERT INTO nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                d.id, x["topic"], _j(x.get("opponent") or []), x["claim_en"], x.get("short_answer") or "",
                d.body.strip() + "\n", _j(x.get("response_source")), _j(x.get("claim_source")),
                x["madhhab"], x["lang"], x["status"], x.get("verified_by"), x.get("verified_on"),
                int(d.origin == "fixture"),
            ),
        )  # fmt: skip
        for i, target in enumerate(x.get("follow_ups") or []):
            if target in node_ids:
                con.execute("INSERT INTO edges VALUES (?, ?, 'follow_up', ?)", (d.id, target, i))
        seen: set[tuple[str, str]] = set()
        refs = [(r, "supports") for r in x.get("dalail") or []]
        refs += [(r, "supports") for r in extract_inline_refs(d.body)]
        refs += [(r, "opponent_cites") for r in x.get("their_evidence") or []]
        for i, (ref, role) in enumerate(refs):
            if (ref, role) not in seen:
                seen.add((ref, role))
                con.execute("INSERT INTO node_dalail VALUES (?, ?, ?, ?)", (d.id, ref, role, i))

    for i, (node_id, text, lang, kind) in enumerate(aliases, start=1):
        n = normaliser(index_text(text))
        con.execute(
            "INSERT INTO node_aliases VALUES (?, ?, ?, ?, ?, ?, ?)",
            (i, node_id, text, n.norm, n.folded, lang, kind),
        )
        con.execute(
            "INSERT INTO nodes_fts(rowid, text, text_norm, text_folded, node_id, topic, kind)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (i, text, n.norm, n.folded, node_id, topic_of[node_id], kind),
        )
        if vectors is not None:
            con.execute("INSERT INTO vec_aliases VALUES (?, ?)", (i, to_blob(vectors[i - 1])))

    # Topic-name rows go after the aliases so FTS rowids stay equal to node_aliases.rowid.
    for t in corpus.topics:
        n = normaliser(f"{t['name_en']} {t['name_roman_urdu']}")
        con.execute(
            "INSERT INTO nodes_fts(text, text_norm, text_folded, node_id, topic, kind)"
            " VALUES (?, ?, ?, '', ?, 'topic')",
            (t["name_en"], n.norm, n.folded, t["id"]),
        )

    for (s, a), row in sorted(corpus.quran.items()):
        con.execute(
            "INSERT INTO quran_ayah VALUES (?, ?, ?, ?, ?, ?)",
            (
                s,
                a,
                row.get("text_ar", ""),
                row.get("translation_ur"),
                row.get("translation_en"),
                row.get("translation_en_source"),
            ),
        )
    for h in sorted(report.included_hadith, key=lambda d: d.id):
        y = h.data
        con.execute(
            "INSERT INTO hadith VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (h.id, y.get("text_ar"), y["translation"], y["reference"], y.get("grading"),
             _j(sorted(y.get("cited_in") or [])), _j(y.get("source")), y["status"]),
        )  # fmt: skip
    if mode == "dev":
        for ref, row in sorted(corpus.fixture_dalil.items()):
            con.execute(
                "INSERT INTO fixture_dalil VALUES (?, ?, ?, ?, ?, ?)",
                (
                    ref,
                    ref.split(":")[1],
                    row["text_ar"],
                    row["translation"],
                    row["reference"],
                    row.get("grading"),
                ),
            )


def _prod_post_scan(con: sqlite3.Connection) -> None:
    """Defence in depth: re-read every text cell of the written DB."""
    problems: list[str] = []
    tables = [
        r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'nodes_fts_%'")
    ]
    if "fixture_dalil" in tables:
        problems.append("fixture_dalil table present")
    for t in tables:
        cols = [r[1] for r in con.execute(f"PRAGMA table_info({t})")]
        for col in cols:
            n = con.execute(
                f"SELECT COUNT(*) FROM {t} WHERE typeof({col}) = 'text' AND (instr({col}, ?) > 0"
                f" OR {col} LIKE 'fixture:%' OR instr({col}, '[[fixture:') > 0)",
                (FIXTURE_MARK,),
            ).fetchone()[0]
            if n:
                problems.append(f"{t}.{col}: {n} row(s) with fixture content")
    for t in ("nodes", "hadith"):
        n = con.execute(f"SELECT COUNT(*) FROM {t} WHERE status != 'verified'").fetchone()[0]
        if n:
            problems.append(f"{t}: {n} row(s) not verified")
    if con.execute("SELECT COUNT(*) FROM nodes WHERE is_fixture != 0").fetchone()[0]:
        problems.append("nodes: fixture rows present")
    if problems:
        raise PipelineError("prod safety scan failed:\n  " + "\n  ".join(problems))


def _manifest(
    db_path: Path, meta: dict[str, str], nodes: list[Doc], report: Report,
    aliases: list[tuple[str, str, str, str]], corpus: Corpus,
) -> dict[str, Any]:  # fmt: skip
    by_topic: dict[str, Counter[str]] = defaultdict(Counter)
    for d in nodes:
        by_topic[d.data["topic"]][d.data["status"]] += 1
    db_bytes = db_path.read_bytes()
    return {
        "corpus_version": meta["corpus_version"],
        "built_at": meta["built_at"],
        "build_mode": meta["build_mode"],
        "db_file": db_path.name,
        "db_sha256": hashlib.sha256(db_bytes).hexdigest(),
        "db_size_bytes": len(db_bytes),
        "embed_model": meta["embed_model"],
        "content_sha": meta["sha"],
        "counts": {
            "nodes_by_topic_status": {t: dict(sorted(c.items())) for t, c in sorted(by_topic.items())},
            "nodes": len(nodes),
            "aliases": len(aliases),
            "hadith": len(report.included_hadith),
            "quran_ayah": len(corpus.quran),
            "fixture_dalil": len(corpus.fixture_dalil) if meta["build_mode"] == "dev" else 0,
        },
        "excluded_unverified": sorted(report.excluded),
    }
