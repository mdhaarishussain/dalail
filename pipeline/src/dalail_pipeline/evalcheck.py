"""Eval integrity: the human-written real question set must not overlap the indexed aliases."""

from __future__ import annotations

import difflib
import json
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

from .corpus import Corpus
from .errors import Issue
from .normalise import Normaliser
from .paths import normalise_dir

REAL_FILE = "eval/questions.real.yaml"
# Human-written sets: same schema, provenance rules and alias-leak check.
HUMAN_FILES = (REAL_FILE, "eval/questions.heldout.yaml")
REAL_REQUIRED = ("added_by", "added_on", "origin")


def _line_of(lines: list[str], q: str) -> int:
    for i, ln in enumerate(lines, start=1):
        if q in ln:
            return i
    return 1


def _research_targets(corpus: Corpus) -> list[tuple[str, str]]:
    """(node id, text) for the dev-only research import (ADR 0008): claims, aliases, summaries."""
    path = corpus.root / "research-import" / "nodes.yaml"
    if not path.is_file():
        return []
    out = []
    for n in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
        for t in [n.get("claim") or "", n.get("summary_en") or "", *(n.get("aliases") or [])]:
            if t:
                out.append((str(n["id"]), str(t)))
    return out


def check_real_eval(repo_root: Path, corpus: Corpus) -> list[Issue]:
    issues: list[Issue] = []
    for rel in HUMAN_FILES:
        issues += _check_file(repo_root, repo_root / rel, corpus)
    return issues


def _check_file(repo_root: Path, path: Path, corpus: Corpus) -> list[Issue]:
    if not path.is_file():
        return [Issue(path, 1, "EVAL_MISSING", f"{path.name} is missing", "warning")]
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as e:
        return [Issue(path, 1, "YAML", str(e).splitlines()[0])]
    data = json.loads(json.dumps(data, default=str))  # dates -> strings for the schema
    schema = json.loads((repo_root / "eval" / "questions.schema.json").read_text())
    issues = [
        Issue(path, 1, "SCHEMA", f"{'.'.join(map(str, e.path)) or '(root)'}: {e.message}")
        for e in Draft202012Validator(schema).iter_errors(data)
    ]
    if issues:
        return issues

    cfg = json.loads((repo_root / "eval" / "config.json").read_text())["leak"]
    norm = Normaliser(normalise_dir(repo_root))
    research = _research_targets(corpus)
    node_ids = {d.id for d in corpus.nodes} | {nid for nid, _ in research}
    targets: list[tuple[str, str, str]] = []  # (node id, original text, folded)
    for d in corpus.nodes:
        for t in [d.data.get("claim_en") or "", *(d.data.get("claim_roman_urdu") or [])]:
            clean = t.removeprefix("FIXTURE:").strip()
            if clean:
                targets.append((d.id, t, norm(clean).folded))
    targets += [(nid, t, norm(t).folded) for nid, t in research]

    for q in data["questions"]:
        line = _line_of(lines, q["q"])
        for k in REAL_REQUIRED:
            if not q.get(k):
                issues.append(Issue(path, line, "EVAL_PROVENANCE", f"real question needs '{k}'"))
        for nid in q.get("expect") or []:
            if nid not in node_ids:
                issues.append(
                    Issue(path, line, "EVAL_UNKNOWN_NODE", f"expected node '{nid}' does not exist", "warning")
                )
        fq = norm(q["q"]).folded
        if not fq:
            continue
        qt = set(fq.split())
        for nid, original, ft in targets:
            tt = set(ft.split())
            jac = len(qt & tt) / len(qt | tt) if qt | tt else 0.0
            ratio = difflib.SequenceMatcher(None, fq, ft).ratio()
            if fq == ft or jac >= cfg["jaccard"] or ratio >= cfg["ratio"]:
                issues.append(
                    Issue(path, line, "EVAL_LEAK",
                          f"\"{q['q']}\" is (near-)identical to {nid}: \"{original}\" "
                          f"(jaccard {jac:.2f}, ratio {ratio:.2f}); real questions must be human-written, not aliases")
                )  # fmt: skip
                break
    return issues
