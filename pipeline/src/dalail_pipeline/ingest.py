"""Ingestion helpers used by /ingest-article: fill spans, sync cited_in, next ids, duplicates, summary."""

from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from importlib import resources
from pathlib import Path

from .corpus import Corpus, Doc, load_corpus, load_markdown
from .errors import Issue, PipelineError
from .refs import HadithRef, extract_inline_refs, parse_ref
from .validate import validate
from .verbatim import compute_spans, write_spans


def _flow(v: object) -> str:
    return json.dumps(v, ensure_ascii=False).replace('"', "")


def _citers(corpus: Corpus) -> dict[str, list[str]]:
    out: dict[str, set[str]] = defaultdict(set)
    for d in corpus.nodes:
        refs = [*(d.data.get("dalail") or []), *(d.data.get("their_evidence") or []), *extract_inline_refs(d.body)]
        for raw in refs:
            if isinstance(r := parse_ref(raw), HadithRef):
                out[r.id].add(d.id)
    return {k: sorted(v) for k, v in out.items()}


def sync_cited_in(corpus: Corpus) -> list[str]:
    """Rewrite each hadith's `cited_in:` line to match the nodes that actually cite it."""
    changed = []
    citers = _citers(corpus)
    for h in corpus.hadith:
        want = citers.get(h.id, [])
        if sorted(h.data.get("cited_in") or []) == want:
            continue
        text = h.path.read_text(encoding="utf-8")
        new_line = f"cited_in: [{', '.join(want)}]"
        text, n = re.subn(r"(?m)^cited_in:.*$", new_line, text, count=1)
        if n == 0:
            text = text.replace("\n---", f"\n{new_line}\n---", 1)
        h.path.write_text(text, encoding="utf-8")
        changed.append(h.id)
    return changed


def fill_spans(corpus: Corpus, source_id: str) -> tuple[int, list[Issue]]:
    src = corpus.sources.get(source_id)
    if src is None:
        raise PipelineError(f"no corpus/sources/{source_id}/ (run new-source first)")
    issues: list[Issue] = []
    count = 0
    for kind, docs in (("node", corpus.nodes), ("hadith", corpus.hadith)):
        for d in docs:
            if d.origin != "real" or d.data.get("source_id") != source_id:
                continue
            spans, found = compute_spans(d, src.text, kind)
            issues += found
            write_spans(d, spans, _flow)
            count += 1
    return count, issues


def next_id(corpus: Corpus, kind: str, topic: str | None = None) -> str:
    if kind == "hadith":
        nums = [int(m[1]) for h in corpus.hadith if (m := re.match(r"^h-(\d+)$", h.id))]
        return f"h-{max(nums, default=0) + 1:04d}"
    if not topic:
        raise PipelineError("next-id node needs --topic")
    nums = [int(m[1]) for d in corpus.nodes if (m := re.match(rf"^{re.escape(topic)}-(\d+)$", d.id))]
    return f"{topic}-{max(nums, default=0) + 1:03d}"


@dataclass
class DuplicatePair:
    a: str
    b: str
    cosine: float | None
    jaccard: float


def find_duplicates(corpus: Corpus, repo_root: Path, use_model: bool = True) -> list[DuplicatePair]:
    from .build import index_text
    from .normalise import Normaliser
    from .paths import normalise_dir

    cfg = json.loads(resources.files("dalail_pipeline").joinpath("data/ingest.json").read_text())
    nodes = sorted((d for d in corpus.nodes if d.origin == "real"), key=lambda d: d.id)
    norm = Normaliser(normalise_dir(repo_root))
    toks = [set(norm(index_text(d.data.get("claim_en") or "")).folded.split()) for d in nodes]
    vecs: list[list[float]] | None = None
    if use_model and len(nodes) > 1:
        from .embed import Embedder
        from .models import embedding_model

        emb = Embedder(embedding_model(repo_root), repo_root / "dist" / ".embed-cache.sqlite")
        vecs = emb.passages([index_text(d.data.get("claim_en") or "") for d in nodes])
    pairs = []
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            a, b = nodes[i], nodes[j]
            if a.data.get("status") == "verified" and b.data.get("status") == "verified":
                continue
            union = toks[i] | toks[j]
            jac = len(toks[i] & toks[j]) / len(union) if union else 0.0
            cos = sum(x * y for x, y in zip(vecs[i], vecs[j], strict=True)) if vecs else None
            if jac >= cfg["duplicate_jaccard"] or (cos is not None and cos >= cfg["duplicate_cosine"]):
                pairs.append(DuplicatePair(a.id, b.id, cos, jac))
    return sorted(pairs, key=lambda p: -(p.cosine or p.jaccard))


@dataclass
class IngestSummary:
    source_id: str
    rows: list[tuple[str, str, int, str]] = field(default_factory=list)  # id, kind, spans, needs
    issues: list[Issue] = field(default_factory=list)
    duplicates: list[DuplicatePair] = field(default_factory=list)
    duplicates_skipped: str = ""
    cited_in_synced: list[str] = field(default_factory=list)


def ingest_finish(repo_root: Path, corpus_dir: Path, source_id: str, use_model: bool = True) -> IngestSummary:
    summary = IngestSummary(source_id)
    corpus = load_corpus(corpus_dir, include_fixtures=False)
    _, span_issues = fill_spans(corpus, source_id)
    corpus = load_corpus(corpus_dir, include_fixtures=False)
    summary.cited_in_synced = sync_cited_in(corpus)
    corpus = load_corpus(corpus_dir, include_fixtures=False)
    rep = validate(corpus, "dev")
    from .evalcheck import check_real_eval

    summary.issues = span_issues + rep.issues + check_real_eval(repo_root, corpus)
    try:
        summary.duplicates = find_duplicates(corpus, repo_root, use_model=use_model)
    except PipelineError as e:
        summary.duplicates = find_duplicates(corpus, repo_root, use_model=False)
        summary.duplicates_skipped = f"embedding check skipped ({str(e).splitlines()[0]}); token overlap only"

    by_file: dict[Path, list[Issue]] = defaultdict(list)
    for i in summary.issues:
        by_file[i.path].append(i)
    docs: list[tuple[str, Doc]] = [("node", d) for d in corpus.nodes] + [("hadith", h) for h in corpus.hadith]
    for kind, d in docs:
        if d.data.get("source_id") != source_id:
            continue
        spans = d.data.get("source_spans") or {}
        n_spans = sum(len(v) if k == "body" else 1 for k, v in spans.items())
        needs = []
        if kind == "node" and not d.data.get("short_answer"):
            needs.append("short_answer")
        needs += sorted({i.code for i in by_file.get(d.path, [])})
        summary.rows.append((d.id, kind, n_spans, ", ".join(needs) or "-"))
    return summary


def summary_text(s: IngestSummary, root: Path) -> str:
    out = [
        f"INGEST SUMMARY — source {s.source_id}",
        "",
        f"{'id':<22}{'kind':<8}{'spans':>6}  needs human input / issues",
    ]
    out += [f"{i:<22}{k:<8}{n:>6}  {needs}" for i, k, n, needs in s.rows]
    nodes = sum(1 for r in s.rows if r[1] == "node")
    out += ["", f"nodes: {nodes}   hadith: {len(s.rows) - nodes}   spans: {sum(r[2] for r in s.rows)}"]
    if s.cited_in_synced:
        out.append(f"cited_in updated: {', '.join(s.cited_in_synced)}")
    errors = [i for i in s.issues if i.severity == "error"]
    warnings = [i for i in s.issues if i.severity == "warning"]
    out.append(f"errors: {len(errors)}   warnings: {len(warnings)}")
    out += ["  " + i.format(root) for i in errors + warnings]
    out.append("")
    out.append("possible duplicates (merge aliases into the existing node instead of keeping both):")
    if s.duplicates_skipped:
        out.append(f"  ({s.duplicates_skipped})")
    out += [
        f"  {p.a} ~ {p.b}  cosine {p.cosine:.3f}  jaccard {p.jaccard:.2f}" if p.cosine is not None
        else f"  {p.a} ~ {p.b}  jaccard {p.jaccard:.2f}"
        for p in s.duplicates
    ] or ["  none"]  # fmt: skip
    return "\n".join(out)


__all__ = [
    "fill_spans",
    "find_duplicates",
    "ingest_finish",
    "load_markdown",
    "next_id",
    "summary_text",
    "sync_cited_in",
]
