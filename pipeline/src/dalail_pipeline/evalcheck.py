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
REAL_REQUIRED = ("added_by", "added_on", "origin")


def _line_of(lines: list[str], q: str) -> int:
    for i, ln in enumerate(lines, start=1):
        if q in ln:
            return i
    return 1


def check_real_eval(repo_root: Path, corpus: Corpus) -> list[Issue]:
    path = repo_root / REAL_FILE
    if not path.is_file():
        return [Issue(path, 1, "EVAL_MISSING", "eval/questions.real.yaml is missing", "warning")]
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
    node_ids = {d.id for d in corpus.nodes}
    targets: list[tuple[str, str, str]] = []  # (node id, original text, folded)
    for d in corpus.nodes:
        for t in [d.data.get("claim_en") or "", *(d.data.get("claim_roman_urdu") or [])]:
            clean = t.removeprefix("FIXTURE:").strip()
            if clean:
                targets.append((d.id, t, norm(clean).folded))

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
