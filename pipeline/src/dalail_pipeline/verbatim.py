"""Verbatim guarantee: extracted fields must equal the source text at their recorded spans.

Comparison normalises whitespace only (runs of whitespace -> one space, ends trimmed).
The only permitted insertion in a node body is a dalil chip like [[quran:5:35]].
Deterministic; no model involved.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from .corpus import Doc
from .errors import Issue
from .sources import Source

CHIP = re.compile(r"\s*\[\[[^\]\s]+\]\]")
NODE_FIELDS = (("claim", "claim_en"), ("short_answer", "short_answer"))
HADITH_FIELDS = ("text_ar", "translation", "reference", "grading")


def ws(s: str) -> str:
    return " ".join(s.split())


def body_paragraphs(body: str) -> list[str]:
    """Paragraphs of the '## Response' section, chips removed."""
    m = re.search(r"^## Response[^\n]*\n", body, re.M)
    section = body[m.end() :] if m else body
    nxt = re.search(r"^## ", section, re.M)
    if nxt:
        section = section[: nxt.start()]
    paras = [CHIP.sub("", p) for p in re.split(r"\n\s*\n", section)]
    return [p for p in (x.strip() for x in paras) if p]


def _norm_index(text: str) -> tuple[str, list[int]]:
    """Whitespace-collapsed text plus, for each of its chars, the index in the raw text."""
    out: list[str] = []
    idx: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        if ch.isspace():
            if not prev_space:
                out.append(" ")
                idx.append(i)
            prev_space = True
        else:
            out.append(ch)
            idx.append(i)
            prev_space = False
    return "".join(out), idx


def find_spans(text: str, needle: str, start_at: int = 0) -> list[tuple[int, int]]:
    """All raw [start, end) spans whose whitespace-normalised text equals ws(needle)."""
    target = ws(needle)
    if not target:
        return []
    norm, idx = _norm_index(text)
    found: list[tuple[int, int]] = []
    pos = norm.find(target)
    while pos != -1:
        s, e = idx[pos], idx[pos + len(target) - 1] + 1
        if s >= start_at:
            found.append((s, e))
        pos = norm.find(target, pos + 1)
    return found


def compute_spans(doc: Doc, text: str, kind: str) -> tuple[dict[str, Any], list[Issue]]:
    """Locate every extracted field of a node/hadith in the source text."""
    spans: dict[str, Any] = {}
    issues: list[Issue] = []

    def locate(key: str, value: str, line_key: str, start_at: int = 0) -> tuple[int, int] | None:
        hits = find_spans(text, value, start_at) or (find_spans(text, value) if start_at else [])
        if not hits:
            issues.append(Issue(doc.path, doc.line(line_key), "NOT_VERBATIM",
                                f"'{key}' text was not found in the source; it must be copied exactly"))  # fmt: skip
            return None
        if len(hits) > 1:
            msg = f"'{key}' occurs {len(hits)} times in the source; recorded the first"
            issues.append(Issue(doc.path, doc.line(line_key), "SPAN_MULTIPLE", msg, "warning"))
        return hits[0]

    if kind == "node":
        for span_key, field in NODE_FIELDS:
            value = str(doc.data.get(field) or "")
            if doc.data.get(f"{field}_origin") == "scholar_review":
                continue
            if value.strip() and (hit := locate(span_key, value, field)):
                spans[span_key] = list(hit)
        body: list[list[int]] = []
        cursor = 0
        for i, para in enumerate(body_paragraphs(doc.body)):
            hit = locate(f"body paragraph {i + 1}", para, "__body__", cursor)
            if hit:
                body.append(list(hit))
                cursor = hit[1]
        if body:
            spans["body"] = body
    else:
        for field in HADITH_FIELDS:
            value = str(doc.data.get(field) or "")
            if value.strip() and (hit := locate(field, value, field)):
                spans[field] = list(hit)
    return spans, issues


def check_doc(doc: Doc, sources: dict[str, Source], kind: str) -> list[Issue]:
    """check-verbatim for one real node or hadith file."""
    issues: list[Issue] = []
    add = issues.append
    sid = doc.data.get("source_id")
    if not sid:
        add(Issue(doc.path, doc.line("id"), "MISSING_SOURCE",
                  "real content must name its source snapshot (source_id); see /ingest-article"))  # fmt: skip
        return issues
    src = sources.get(str(sid))
    if src is None:
        add(Issue(doc.path, doc.line("source_id"), "UNKNOWN_SOURCE", f"no corpus/sources/{sid}/"))
        return issues
    spans = doc.data.get("source_spans") or {}
    text = src.text
    n = len(text)

    def same(field_label: str, value: str, span: Any, line_key: str) -> None:
        if not (isinstance(span, list) and len(span) == 2 and 0 <= span[0] < span[1] <= n):
            add(
                Issue(
                    doc.path,
                    doc.line("source_spans"),
                    "BAD_SPAN",
                    f"span for '{field_label}' is missing or out of range",
                )
            )
            return
        if ws(value) != ws(text[span[0] : span[1]]):
            add(Issue(doc.path, doc.line(line_key), "NOT_VERBATIM",
                      f"'{field_label}' differs from the source at {span}: source says "
                      f"\"{ws(text[span[0]:span[1]])[:80]}\""))  # fmt: skip

    if kind == "node":
        for span_key, field in NODE_FIELDS:
            value = str(doc.data.get(field) or "")
            if doc.data.get(f"{field}_origin") == "scholar_review":
                continue  # written during review; checked against corpus/reviews instead
            if value.strip():
                same(field, value, spans.get(span_key), field)
        paras = body_paragraphs(doc.body)
        body_spans = spans.get("body") or []
        if len(body_spans) != len(paras):
            msg = f"{len(paras)} body paragraph(s) but {len(body_spans)} body span(s); run ingest-finish"
            add(Issue(doc.path, doc.body_line, "MISSING_SPANS", msg))
        for i, (para, span) in enumerate(zip(paras, body_spans, strict=False)):
            same(f"body paragraph {i + 1}", para, span, "__body__")
        # Citation strings must come from the article or its meta.yaml, never from memory.
        haystack = ws(text) + " " + " ".join(ws(str(v)) for v in src.meta.values() if isinstance(v, str))
        for block in ("claim_source", "response_source"):
            for k, v in (doc.data.get(block) or {}).items():
                if isinstance(v, str) and v.strip() and ws(v) not in haystack:
                    add(Issue(doc.path, doc.line(block), "UNSOURCED_CITATION",
                              f"{block}.{k} \"{v}\" does not appear in the source or its meta.yaml"))  # fmt: skip
    else:
        for field in HADITH_FIELDS:
            value = str(doc.data.get(field) or "")
            if value.strip():
                same(field, value, spans.get(field), field)
    return issues


def write_spans(doc: Doc, spans: dict[str, Any], dump: Callable[[Any], str]) -> None:
    """Replace (or insert) the single-line `source_spans:` entry in the file's frontmatter."""
    lines = doc.path.read_text(encoding="utf-8").split("\n")
    end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    new_line = f"source_spans: {dump(spans)}"
    start = next((i for i in range(1, end) if lines[i].startswith("source_spans:")), None)
    if start is not None:
        stop = start + 1
        while stop < end and (lines[stop].startswith((" ", "\t")) or not lines[stop].strip()):
            stop += 1
        lines[start:stop] = [new_line]
    else:
        at = next((i for i in range(1, end) if lines[i].startswith("source_id:")), end - 1) + 1
        lines.insert(at, new_line)
    doc.path.write_text("\n".join(lines), encoding="utf-8")
