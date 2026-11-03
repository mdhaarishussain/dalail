"""Corpus validation. Deterministic, no network, no model."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any, Literal

from .corpus import Corpus, Doc
from .errors import Issue
from .refs import FixtureRef, HadithRef, QuranRef, extract_inline_refs, parse_ref, quran_ref_problem
from .schemas import validator
from .verbatim import check_doc

Mode = Literal["dev", "prod"]
FIXTURE_MARK = "FIXTURE:"
# Frontmatter keys whose values are identifiers/enums, not placeholder prose.
STRUCTURAL_KEYS = {
    "id", "topic", "type", "opponent", "their_evidence", "dalail", "follow_ups",
    "madhhab", "lang", "status", "verified_on", "source_id", "source_spans", "cited_in",
}  # fmt: skip
ALIAS_MIN, ALIAS_MAX = 5, 15


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    included_nodes: list[Doc] = field(default_factory=list)
    included_hadith: list[Doc] = field(default_factory=list)
    excluded: list[str] = field(default_factory=list)
    excluded_status: dict[str, str] = field(default_factory=dict)
    pruned_edges: list[tuple[str, str]] = field(default_factory=list)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "warning"]


def _strings(value: Any, key: str) -> Iterator[tuple[str, str]]:
    """Yield (top-level key, string) for every string inside a frontmatter value."""
    if isinstance(value, str):
        yield key, value
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v, key)
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v, key)


def _node_refs(doc: Doc) -> list[tuple[str, str]]:
    """(ref, key-for-line) for dalail, their_evidence and inline body refs."""
    out = [(r, "dalail") for r in doc.data.get("dalail") or []]
    out += [(r, "their_evidence") for r in doc.data.get("their_evidence") or []]
    out += [(r, "__body__") for r in extract_inline_refs(doc.body)]
    return out


def validate(corpus: Corpus, mode: Mode = "dev") -> Report:
    rep = Report(issues=list(corpus.load_issues))
    add = rep.issues.append

    def line_of(doc: Doc, key: str) -> int:
        return doc.body_line if key == "__body__" else doc.line(key)

    topic_ids = {t.get("id") for t in corpus.topics}
    opponent_ids = {o.get("id") for o in corpus.opponents}
    hadith_by_id = {str(h.data.get("id")): h for h in corpus.hadith}
    node_by_id: dict[str, Doc] = {}

    # --- per-file checks -------------------------------------------------------------
    for doc in corpus.nodes:
        for err in validator(corpus.root, "node").iter_errors(doc.data):
            key = str(err.path[0]) if err.path else None
            add(
                Issue(
                    doc.path,
                    doc.line(key),
                    "SCHEMA",
                    f"{'.'.join(map(str, err.path)) or '(root)'}: {err.message}",
                )
            )
        if doc.id in node_by_id:
            add(
                Issue(
                    doc.path,
                    doc.line("id"),
                    "DUP_ID",
                    f"id '{doc.id}' also used in {node_by_id[doc.id].path.name}",
                )
            )
        node_by_id[doc.id] = doc
        if doc.path.stem != doc.id:
            add(Issue(doc.path, doc.line("id"), "FILENAME", f"file name should be '{doc.id}.md'"))
        if (t := doc.data.get("topic")) is not None and t not in topic_ids:
            add(Issue(doc.path, doc.line("topic"), "UNKNOWN_TOPIC", f"topic '{t}' not in topics.yaml"))
        for o in doc.data.get("opponent") or []:
            if o not in opponent_ids:
                add(
                    Issue(
                        doc.path,
                        doc.line("opponent"),
                        "UNKNOWN_OPPONENT",
                        f"opponent '{o}' not in opponents.yaml",
                    )
                )
        if "## Response" not in doc.body:
            add(
                Issue(
                    doc.path,
                    doc.body_line,
                    "NO_RESPONSE",
                    "body must contain a '## Response' section",
                )
            )
        src = corpus.sources.get(str(doc.data.get("source_id") or ""))
        if src is not None and (default := src.meta.get("default_opponent")):
            others = [o for o in doc.data.get("opponent") or [] if o != default]
            if others:
                add(Issue(doc.path, doc.line("opponent"), "OPPONENT_DIFFERS",
                          f"opponent {others} differs from the source's default_opponent '{default}'; "
                          "owner decision needed", "warning"))  # fmt: skip
        n_alias = len(doc.data.get("claim_roman_urdu") or [])
        if not ALIAS_MIN <= n_alias <= ALIAS_MAX:
            add(Issue(doc.path, doc.line("claim_roman_urdu"), "ALIAS_COUNT",
                      f"{n_alias} Roman Urdu phrasings; aim for {ALIAS_MIN}-{ALIAS_MAX}", "warning"))  # fmt: skip
        status = doc.data.get("status")
        if status == "verified":
            for k in ("verified_by", "verified_on", "short_answer"):
                if not doc.data.get(k):
                    add(Issue(doc.path, doc.line(k if k in doc.key_lines else "status"), "VERIFIED_INCOMPLETE",
                              f"verified node needs a non-empty '{k}'"))  # fmt: skip
        elif not doc.data.get("short_answer"):
            add(Issue(doc.path, doc.line("short_answer" if "short_answer" in doc.key_lines else "id"),
                      "NEEDS_SHORT_ANSWER", "no short_answer yet (needs human input)", "warning"))  # fmt: skip
        _check_fixture_marking(doc, add)

    for h in corpus.hadith:
        for err in validator(corpus.root, "hadith").iter_errors(h.data):
            key = str(err.path[0]) if err.path else None
            add(
                Issue(
                    h.path,
                    h.line(key),
                    "SCHEMA",
                    f"{'.'.join(map(str, err.path)) or '(root)'}: {err.message}",
                )
            )
        if h.path.stem != h.id:
            add(Issue(h.path, h.line("id"), "FILENAME", f"file name should be '{h.id}.md'"))
        _check_fixture_marking(h, add)

    fx_path = corpus.root / "fixtures" / "dalil.jsonl"
    for ref, row in corpus.fixture_dalil.items():
        for err in validator(corpus.root, "fixture-dalil").iter_errors(row):
            add(
                Issue(
                    fx_path,
                    corpus.fixture_dalil_lines[ref],
                    "SCHEMA",
                    f"{'.'.join(map(str, err.path)) or '(root)'}: {err.message}",
                )
            )

    # --- verbatim: every real node/hadith traces back to a source snapshot --------------
    for doc in corpus.nodes:
        if doc.origin == "real":
            rep.issues += check_doc(doc, corpus.sources, "node")
    for h in corpus.hadith:
        rep.issues += check_doc(h, corpus.sources, "hadith")

    from .reviews import check_reviews

    rep.issues += check_reviews(corpus)

    # --- Quran data vs static table --------------------------------------------------
    if corpus.quran:
        from .refs import surah_ayah_counts

        per_surah: dict[int, int] = defaultdict(int)
        for s, _a in corpus.quran:
            per_surah[s] += 1
        absent = []
        for s, n in enumerate(surah_ayah_counts(), start=1):
            have = per_surah.get(s, 0)
            if have == 0:
                absent.append(s)
            elif have != n:
                add(Issue(corpus.root / "quran", 1, "QURAN_COUNT", f"surah {s}: {have} rows, expected {n}"))
        if absent:
            add(Issue(corpus.root / "quran", 1, "QURAN_PARTIAL",
                      f"{len(absent)} surah(s) not supplied yet (first: {absent[0]})", "warning"))  # fmt: skip

    # --- refs ------------------------------------------------------------------------
    citers: dict[str, set[str]] = defaultdict(set)
    for doc in corpus.nodes:
        for raw, key in _node_refs(doc):
            ref = parse_ref(raw)
            line = line_of(doc, key)
            if ref is None:
                add(Issue(doc.path, line, "BAD_REF", f"'{raw}' is not a valid dalil reference"))
            elif isinstance(ref, QuranRef):
                if problem := quran_ref_problem(ref):
                    add(Issue(doc.path, line, "QURAN_RANGE", f"{raw}: {problem}"))
                elif corpus.quran:
                    missing = [a for a in range(ref.start, ref.end + 1) if (ref.surah, a) not in corpus.quran]
                    if missing:
                        add(
                            Issue(
                                doc.path,
                                line,
                                "QURAN_MISSING",
                                f"{raw}: ayah {missing[0]} not in corpus/quran",
                            )
                        )
            elif isinstance(ref, HadithRef):
                citers[ref.id].add(doc.id)
                if ref.id not in hadith_by_id:
                    add(Issue(doc.path, line, "HADITH_MISSING", f"{raw}: no corpus/hadith/{ref.id}.md"))
            elif isinstance(ref, FixtureRef):
                if doc.origin == "real":
                    add(
                        Issue(
                            doc.path,
                            line,
                            "FIXTURE_IN_REAL",
                            f"{raw}: fixture refs are not allowed in corpus/nodes",
                        )
                    )
                elif raw not in corpus.fixture_dalil:
                    add(Issue(doc.path, line, "FIXTURE_MISSING", f"{raw}: not in fixtures/dalil.jsonl"))

    for h in corpus.hadith:
        declared = set(h.data.get("cited_in") or [])
        actual = citers.get(h.id, set())
        if declared != actual:
            add(Issue(h.path, h.line("cited_in"), "CITED_IN",
                      f"cited_in {sorted(declared)} but actually cited by {sorted(actual)}"))  # fmt: skip

    # --- tree --------------------------------------------------------------------------
    incoming: dict[str, int] = defaultdict(int)
    for doc in corpus.nodes:
        for target in doc.data.get("follow_ups") or []:
            if target == doc.id:
                add(
                    Issue(
                        doc.path,
                        doc.line("follow_ups"),
                        "SELF_LINK",
                        "node lists itself as a follow-up",
                    )
                )
            elif target not in node_by_id:
                add(
                    Issue(
                        doc.path,
                        doc.line("follow_ups"),
                        "BROKEN_LINK",
                        f"follow-up '{target}' does not exist",
                    )
                )
            else:
                incoming[target] += 1
    if len(corpus.nodes) > 1:
        for doc in corpus.nodes:
            if not incoming[doc.id] and not doc.data.get("follow_ups"):
                add(
                    Issue(
                        doc.path,
                        doc.line("follow_ups"),
                        "ORPHAN",
                        "no follow-ups and nothing links here",
                        "warning",
                    )
                )

    # --- scope ------------------------------------------------------------------------
    if mode == "dev":
        rep.included_nodes = list(corpus.nodes)
        rep.included_hadith = list(corpus.hadith)
    else:
        _prod_scope(corpus, node_by_id, hadith_by_id, rep)
    return rep


def _check_fixture_marking(doc: Doc, add: Any) -> None:
    if doc.origin == "fixture":
        for key, s in ((k, s) for k, v in doc.data.items() if k not in STRUCTURAL_KEYS for _, s in _strings(v, k)):
            if not s.startswith(FIXTURE_MARK):
                add(
                    Issue(
                        doc.path,
                        doc.line(key),
                        "FIXTURE_UNMARKED",
                        f"fixture text in '{key}' must start with '{FIXTURE_MARK}'",
                    )
                )
        for i, ln in enumerate(doc.body.split("\n")):
            if ln.strip() and not ln.lstrip().startswith(("#", FIXTURE_MARK)):
                add(
                    Issue(
                        doc.path,
                        doc.body_line + i,
                        "FIXTURE_UNMARKED",
                        f"fixture body line must start with '{FIXTURE_MARK}'",
                    )
                )
    else:
        for key, s in ((k, s) for k, v in doc.data.items() for _, s in _strings(v, k)):
            if FIXTURE_MARK in s or s.startswith("fixture:"):
                add(Issue(doc.path, doc.line(key), "FIXTURE_IN_REAL", f"fixture content in '{key}'"))
        if FIXTURE_MARK in doc.body:
            add(Issue(doc.path, doc.body_line, "FIXTURE_IN_REAL", "fixture content in body"))


def _prod_scope(corpus: Corpus, node_by_id: dict[str, Doc], hadith_by_id: dict[str, Doc], rep: Report) -> None:
    add = rep.issues.append
    for doc in corpus.nodes:
        if doc.origin != "real":
            add(Issue(doc.path, 1, "PROD_FIXTURE", "fixtures can never be part of a prod build"))
            continue
        if doc.data.get("status") == "verified":
            rep.included_nodes.append(doc)
        else:
            rep.excluded.append(doc.id)
            rep.excluded_status[doc.id] = str(doc.data.get("status"))
    included = {d.id for d in rep.included_nodes}
    for doc in rep.included_nodes:
        for target in doc.data.get("follow_ups") or []:
            if target in node_by_id and target not in included:
                # Owner decision: prune the edge from the prod DB, warn, don't fail.
                rep.pruned_edges.append((doc.id, target))
                msg = f"follow-up '{target}' is not verified; edge left out of the prod build"
                add(Issue(doc.path, doc.line("follow_ups"), "PROD_EDGE_PRUNED", msg, "warning"))
        for raw, _key in _node_refs(doc):
            ref = parse_ref(raw)
            if isinstance(ref, QuranRef) and quran_ref_problem(ref) is None:
                missing = [a for a in range(ref.start, ref.end + 1) if (ref.surah, a) not in corpus.quran]
                if missing:
                    msg = f"cites {raw}; ayah {ref.surah}:{missing[0]} is not in corpus/quran (owner-supplied text)"
                    add(Issue(doc.path, doc.line("dalail"), "PROD_QURAN_MISSING", msg))
            if isinstance(ref, HadithRef) and (h := hadith_by_id.get(ref.id)) is not None:
                if h.data.get("status") != "verified":
                    add(
                        Issue(
                            doc.path,
                            doc.line("dalail"),
                            "PROD_HADITH_UNVERIFIED",
                            f"cites {raw}, which is not verified",
                        )
                    )
                elif h not in rep.included_hadith:
                    rep.included_hadith.append(h)
    if not rep.included_nodes:
        add(Issue(corpus.root / "nodes", 1, "PROD_EMPTY",
                  "no verified nodes in corpus/nodes (fixtures are never included in prod)"))  # fmt: skip
