"""Load corpus files, keeping enough position info for file:line error messages."""

from __future__ import annotations

import datetime as dt
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

from .errors import Issue
from .sources import Source, load_sources

Origin = Literal["real", "fixture"]
KEY_LINE = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):")


@dataclass
class Doc:
    """A markdown file with YAML frontmatter."""

    path: Path
    origin: Origin
    data: dict[str, Any]
    body: str
    key_lines: dict[str, int]
    body_line: int

    @property
    def id(self) -> str:
        return str(self.data.get("id", self.path.stem))

    def line(self, key: str | None) -> int:
        return self.key_lines.get(key or "", 1)


@dataclass
class Corpus:
    root: Path
    corpus_version: str
    topics: list[dict[str, Any]]
    opponents: list[dict[str, Any]]
    nodes: list[Doc] = field(default_factory=list)
    hadith: list[Doc] = field(default_factory=list)
    fixture_dalil: dict[str, dict[str, Any]] = field(default_factory=dict)
    fixture_dalil_lines: dict[str, int] = field(default_factory=dict)
    quran: dict[tuple[int, int], dict[str, Any]] = field(default_factory=dict)
    quran_lines: dict[tuple[int, int], tuple[Path, int]] = field(default_factory=dict)
    load_issues: list[Issue] = field(default_factory=list)
    input_files: list[Path] = field(default_factory=list)
    sources: dict[str, Source] = field(default_factory=dict)
    reviews: dict[str, tuple[Path, dict[str, Any]]] = field(default_factory=dict)


def _stringify_dates(v: Any) -> Any:
    if isinstance(v, dt.date | dt.datetime):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _stringify_dates(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_stringify_dates(x) for x in v]
    return v


def load_markdown(path: Path, origin: Origin) -> Doc | Issue:
    text = path.read_text(encoding="utf-8")
    lines = text.split("\n")
    if not lines or lines[0].strip() != "---":
        return Issue(path, 1, "FRONTMATTER", "file must start with a '---' frontmatter block")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        return Issue(path, 1, "FRONTMATTER", "frontmatter block is not closed with '---'")
    fm = "\n".join(lines[1:end])
    try:
        data = yaml.safe_load(fm) or {}
    except yaml.YAMLError as e:
        mark = getattr(e, "problem_mark", None)
        line = (mark.line + 2) if mark is not None else 1
        return Issue(path, line, "YAML", str(e).splitlines()[0])
    if not isinstance(data, dict):
        return Issue(path, 2, "FRONTMATTER", "frontmatter must be a mapping")
    key_lines: dict[str, int] = {}
    for i in range(1, end):
        if m := KEY_LINE.match(lines[i]):
            key_lines.setdefault(m[1], i + 1)
    body = "\n".join(lines[end + 1 :])
    return Doc(path, origin, _stringify_dates(data), body, key_lines, end + 2)


def _load_yaml_list(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    return yaml.safe_load(path.read_text(encoding="utf-8")) or []


def load_corpus(root: Path, *, include_fixtures: bool) -> Corpus:
    meta_path = root / "corpus.yaml"
    meta = yaml.safe_load(meta_path.read_text()) if meta_path.is_file() else {}
    corpus = Corpus(
        root=root,
        corpus_version=str((meta or {}).get("corpus_version", "0.0.0")),
        topics=_load_yaml_list(root / "topics.yaml"),
        opponents=_load_yaml_list(root / "opponents.yaml"),
    )
    corpus.input_files += [p for p in (meta_path, root / "topics.yaml", root / "opponents.yaml") if p.is_file()]

    def add_docs(folder: Path, origin: Origin, target: list[Doc]) -> None:
        for p in sorted(folder.glob("*.md")):
            corpus.input_files.append(p)
            doc = load_markdown(p, origin)
            if isinstance(doc, Issue):
                corpus.load_issues.append(doc)
            else:
                target.append(doc)

    corpus.sources, source_issues = load_sources(root)
    corpus.load_issues += source_issues

    for p in sorted((root / "reviews").glob("*.yaml")):
        try:
            corpus.reviews[p.stem] = (p, yaml.safe_load(p.read_text(encoding="utf-8")) or {})
        except yaml.YAMLError as e:
            corpus.load_issues.append(Issue(p, 1, "YAML", str(e).splitlines()[0]))

    add_docs(root / "nodes", "real", corpus.nodes)
    add_docs(root / "hadith", "real", corpus.hadith)

    for p in sorted((root / "quran").glob("*.jsonl")):
        corpus.input_files.append(p)
        for n, raw in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
                key = (int(row["surah"]), int(row["ayah"]))
            except (ValueError, KeyError, TypeError) as e:
                corpus.load_issues.append(Issue(p, n, "QURAN_ROW", f"invalid row: {e}"))
                continue
            if key in corpus.quran:
                corpus.load_issues.append(Issue(p, n, "QURAN_DUP", f"duplicate ayah {key[0]}:{key[1]}"))
            corpus.quran[key] = row
            corpus.quran_lines[key] = (p, n)

    if include_fixtures:
        fx = root / "fixtures"
        add_docs(fx / "nodes", "fixture", corpus.nodes)
        dalil = fx / "dalil.jsonl"
        if dalil.is_file():
            corpus.input_files.append(dalil)
            for n, raw in enumerate(dalil.read_text(encoding="utf-8").splitlines(), start=1):
                if not raw.strip():
                    continue
                try:
                    row = json.loads(raw)
                except ValueError as e:
                    corpus.load_issues.append(Issue(dalil, n, "FIXTURE_ROW", f"invalid JSON: {e}"))
                    continue
                ref = str(row.get("ref"))
                corpus.fixture_dalil[ref] = row
                corpus.fixture_dalil_lines[ref] = n
    return corpus
