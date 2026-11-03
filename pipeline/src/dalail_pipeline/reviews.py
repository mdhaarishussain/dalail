"""Scholar-supplied fields (`<field>_origin: scholar_review`) and their review records.

A field marked scholar_review is exempt from the verbatim check because a scholar wrote it during
review. In exchange it must sit on a verified node and be backed by an entry in
corpus/reviews/<node-id>.yaml whose sha256 matches the current value. Tooling never fills these.
"""

from __future__ import annotations

import datetime as dt
import hashlib
from pathlib import Path
from typing import Any

import yaml

from .corpus import Corpus, Doc
from .errors import Issue, PipelineError
from .schemas import validator
from .verbatim import ws

SCHOLAR = "scholar_review"


def scholar_fields(doc: Doc) -> list[str]:
    return [k[: -len("_origin")] for k, v in doc.data.items() if k.endswith("_origin") and v == SCHOLAR]


def value_sha(value: Any) -> str:
    return hashlib.sha256(ws(str(value)).encode("utf-8")).hexdigest()


def check_reviews(corpus: Corpus) -> list[Issue]:
    issues: list[Issue] = []
    for node_id, (path, data) in corpus.reviews.items():
        for err in validator(corpus.root, "review").iter_errors(data):
            issues.append(Issue(path, 1, "SCHEMA", f"{'.'.join(map(str, err.path)) or '(root)'}: {err.message}"))
        if data.get("node_id") != node_id:
            issues.append(Issue(path, 1, "REVIEW_ID", f"node_id must equal the file name '{node_id}'"))
    for doc in corpus.nodes:
        for field in scholar_fields(doc):
            line = doc.line(f"{field}_origin")
            if doc.origin == "fixture":
                issues.append(Issue(doc.path, line, "ORIGIN_IN_FIXTURE", "fixtures cannot carry scholar_review fields"))
                continue
            if doc.data.get("status") != "verified":
                issues.append(Issue(doc.path, line, "ORIGIN_NOT_VERIFIED",
                                    f"'{field}' is scholar_review but the node is not verified"))  # fmt: skip
            value = doc.data.get(field)
            if not str(value or "").strip():
                issues.append(Issue(doc.path, line, "ORIGIN_EMPTY", f"'{field}' is marked scholar_review but is empty"))
                continue
            entries = [
                e for e in (corpus.reviews.get(doc.id, (None, {}))[1].get("entries") or [])
                if e.get("field") == field and e.get("origin") == SCHOLAR
            ]  # fmt: skip
            if not entries:
                msg = f"no corpus/reviews/{doc.id}.yaml entry records who wrote/approved '{field}'"
                issues.append(Issue(doc.path, line, "REVIEW_MISSING", msg))
            elif entries[-1].get("sha256") != value_sha(value):
                msg = f"'{field}' changed after it was approved; it needs a new review entry"
                issues.append(Issue(doc.path, line, "REVIEW_HASH_MISMATCH", msg))
    return issues


def record_review(corpus: Corpus, node_id: str, field: str, written_by: str, approved_by: str,
                  note: str = "", today: dt.date | None = None) -> Path:  # fmt: skip
    """Owner-run: append an entry for a scholar-supplied value the owner already typed into the node."""
    doc = next((d for d in corpus.nodes if d.id == node_id and d.origin == "real"), None)
    if doc is None:
        raise PipelineError(f"no real node '{node_id}'")
    if doc.data.get(f"{field}_origin") != SCHOLAR:
        raise PipelineError(f"set `{field}_origin: scholar_review` in {doc.path.name} first")
    value = doc.data.get(field)
    if not str(value or "").strip():
        raise PipelineError(f"'{field}' is empty in {doc.path.name}")
    path = corpus.root / "reviews" / f"{node_id}.yaml"
    data: dict[str, Any] = yaml.safe_load(path.read_text()) if path.is_file() else {"node_id": node_id, "entries": []}
    data["entries"].append({
        "field": field, "origin": SCHOLAR, "written_by": written_by, "approved_by": approved_by,
        "date": (today or dt.date.today()).isoformat(), "sha256": value_sha(value), "note": note,
    })  # fmt: skip
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True))
    return path
