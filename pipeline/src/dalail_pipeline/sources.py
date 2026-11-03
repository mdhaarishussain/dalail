"""Source snapshots: corpus/sources/<id>/ holds an article exactly as captured, never edited.

Files:
  source.<ext>  the captured bytes, unchanged (html / md / txt)
  text.txt      deterministic plain text derived once at capture; every span indexes into it
  meta.yaml     provenance + sha256 of both files (immutability check)
"""

from __future__ import annotations

import datetime as dt
import hashlib
import re
import urllib.request
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import yaml

from .errors import Issue, PipelineError

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
SKIP = {"script", "style", "noscript", "svg", "template", "nav", "form", "button", "iframe", "select"}
BLOCK = {
    "p", "div", "section", "article", "main", "header", "footer", "aside", "blockquote", "pre",
    "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "td", "th",
    "h1", "h2", "h3", "h4", "h5", "h6", "figure", "figcaption", "hr", "br", "address",
}  # fmt: skip
VOID = {"br", "hr", "img", "meta", "link", "input", "source", "wbr", "area", "base", "col", "embed", "param", "track"}
EXTRACTOR_VERSION = 1


class _Extractor(HTMLParser):
    """Collect text inside the first <target> element (or the whole document)."""

    def __init__(self, target: str | None) -> None:
        super().__init__(convert_charrefs=True)
        self.target = target
        self.inside = 0 if target else 1
        self.done = False
        self.skip = 0
        self.pre = 0
        self.parts: list[str] = []
        self.title: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self.in_title = True
        if self.done:
            return
        if self.target and tag == self.target and not self.inside:
            self.inside = 1
            return
        if self.inside and self.target and tag == self.target:
            self.inside += 1
        if tag in SKIP and tag not in VOID:
            self.skip += 1
        if tag == "pre":
            self.pre += 1
        if self.inside and not self.skip and tag in BLOCK:
            self.parts.append("\n" if tag in {"br", "li", "tr", "dt", "dd"} else "\n\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self.in_title = False
        if self.done:
            return
        if tag in SKIP and self.skip:
            self.skip -= 1
        if tag == "pre" and self.pre:
            self.pre -= 1
        if self.inside and not self.skip and tag in BLOCK:
            self.parts.append("\n\n" if tag not in {"li", "tr", "dt", "dd"} else "\n")
        if self.target and tag == self.target and self.inside:
            self.inside -= 1
            if not self.inside:
                self.done = True

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title.append(data)
        if self.done or not self.inside or self.skip:
            return
        self.parts.append(data if self.pre else re.sub(r"\s+", " ", data))


def _tidy(text: str) -> str:
    lines = [ln.strip() for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    out = re.sub(r"\n{3,}", "\n\n", "\n".join(lines))
    return out.strip() + "\n"


def html_to_text(html: str) -> tuple[str, str, str]:
    """Return (text, title, extracted_from). Deterministic for a given input."""
    lower = html.lower()
    target = "article" if "<article" in lower else "main" if "<main" in lower else "body" if "<body" in lower else None
    ex = _Extractor(target)
    ex.feed(html)
    ex.close()
    title = " ".join("".join(ex.title).split())
    return _tidy("".join(ex.parts)), title, target or "document"


def _decode(raw: bytes, header_charset: str | None) -> str:
    candidates = [header_charset] if header_charset else []
    m = re.search(rb"<meta[^>]+charset=[\"']?([A-Za-z0-9_-]+)", raw[:4096], re.I)
    if m:
        candidates.append(m.group(1).decode())
    candidates.append("utf-8")
    for enc in candidates:
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    raise PipelineError("could not decode the source as UTF-8 or its declared charset; save it as UTF-8 and use --file")


def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60].strip("-")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def new_source(corpus_dir: Path, *, url: str | None = None, file: Path | None = None, source_id: str | None = None,
               today: dt.date | None = None) -> Path:  # fmt: skip
    if bool(url) == bool(file):
        raise PipelineError("give exactly one of --url or --file")
    header_charset: str | None = None
    if url:
        req = urllib.request.Request(url, headers={"User-Agent": "dalail-pipeline (source snapshot)"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            header_charset = resp.headers.get_content_charset()
            ctype = resp.headers.get_content_type()
        ext = "html" if "html" in ctype else "md" if "markdown" in ctype else "txt"
        name_hint = Path(urllib.request.urlparse(url).path).stem or urllib.request.urlparse(url).netloc
    else:
        assert file is not None
        if not file.is_file():
            raise PipelineError(f"no such file: {file}")
        raw = file.read_bytes()
        suffix = file.suffix.lower().lstrip(".")
        ext = "html" if suffix in {"html", "htm"} else "md" if suffix in {"md", "markdown"} else "txt"
        name_hint = file.stem

    decoded = _decode(raw, header_charset)
    if ext == "html":
        text, title, extracted_from = html_to_text(decoded)
    else:
        text, title, extracted_from = _tidy(decoded), "", "whole file"
    if not text.strip():
        raise PipelineError("no text could be extracted from the source")

    sid = source_id or _slug(title or name_hint) or "source"
    if not ID_RE.match(sid):
        raise PipelineError(f"source id '{sid}' must be kebab-case (a-z, 0-9, -)")
    folder = corpus_dir / "sources" / sid
    if folder.exists():
        raise PipelineError(f"{folder} already exists; sources are never overwritten (use --id for a new snapshot)")
    folder.mkdir(parents=True)
    src = folder / f"source.{ext}"
    src.write_bytes(raw)
    txt = folder / "text.txt"
    txt.write_text(text, encoding="utf-8")
    meta: dict[str, Any] = {
        "id": sid,
        "url": url or "",
        "title": title,
        "scholar": "",
        "work": "",
        "lang": "",
        "retrieved_on": (today or dt.date.today()).isoformat(),
        "captured_from": "url" if url else "file",
        "original_filename": file.name if file else "",
        "extracted_from": extracted_from,
        "extractor_version": EXTRACTOR_VERSION,
        "sha256": {"source": sha256(src), "text": sha256(txt)},
        "notes": "",
    }
    header = (
        "# Source snapshot. Never edit source.* or text.txt; a changed article becomes a new snapshot.\n"
        "# Owner: fill in scholar, work and lang (and url if captured from a file).\n"
    )
    (folder / "meta.yaml").write_text(header + yaml.safe_dump(meta, sort_keys=False, allow_unicode=True))
    return folder


@dataclass
class Source:
    id: str
    folder: Path
    meta: dict[str, Any]
    text: str


def load_sources(corpus_dir: Path) -> tuple[dict[str, Source], list[Issue]]:
    sources: dict[str, Source] = {}
    issues: list[Issue] = []
    for meta_path in sorted((corpus_dir / "sources").glob("*/meta.yaml")):
        folder = meta_path.parent
        try:
            meta = yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as e:
            issues.append(Issue(meta_path, 1, "YAML", str(e).splitlines()[0]))
            continue
        sid = str(meta.get("id", folder.name))
        if sid != folder.name:
            issues.append(Issue(meta_path, 1, "SOURCE_ID", f"id '{sid}' must equal the folder name '{folder.name}'"))
        txt = folder / "text.txt"
        srcs = sorted(folder.glob("source.*"))
        if not txt.is_file() or len(srcs) != 1:
            issues.append(Issue(meta_path, 1, "SOURCE_FILES", "needs exactly one source.* file and text.txt"))
            continue
        shas = meta.get("sha256") or {}
        if shas.get("source") != sha256(srcs[0]) or shas.get("text") != sha256(txt):
            msg = "source.* or text.txt changed since capture; sources are immutable — capture a new snapshot"
            issues.append(Issue(meta_path, 1, "SOURCE_MODIFIED", msg))
        for k in ("scholar", "work"):
            if not str(meta.get(k) or "").strip():
                issues.append(
                    Issue(meta_path, 1, "SOURCE_META_INCOMPLETE", f"'{k}' is empty (owner to fill in)", "warning")
                )
        sources[sid] = Source(sid, folder, meta, txt.read_text(encoding="utf-8"))
    return sources, issues
