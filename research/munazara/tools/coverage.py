#!/usr/bin/env python3
"""Coverage audit for research/munazara transcripts (Gemini or Whisper).

Per transcript: duration, word count, estimated coverage = words / (140 x minutes), minutes
inside explicitly marked gaps ([skipped: ... a–b], [not transcribed a–b], [unclear a–b]), and
unmarked timestamp jumps longer than 2 minutes (between consecutive lines, before the first line,
after the last line) that no marked gap covers.

    python research/munazara/tools/coverage.py                  # table on stdout
    python research/munazara/tools/coverage.py --json           # machine-readable
    python research/munazara/tools/coverage.py --update-readme  # Coverage column + Re-transcribe list
    python research/munazara/tools/coverage.py --dir research/munazara/transcripts-whisper

Standard library only. Re-running --update-readme on unchanged transcripts changes nothing.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

WORDS_PER_MINUTE = 140
JUMP_SECONDS = 120
NEAR_FULL = 0.75  # coverage >= this
PARTIAL = 0.35  # PARTIAL <= coverage < NEAR_FULL; below is "thin"

HERE = Path(__file__).resolve().parent
MUNAZARA = HERE.parent
TS = r"(\d{1,2}:\d{2}(?::\d{2})?)"
LINE_TS = re.compile(r"^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*")
MARKED = re.compile(r"\[(skipped:[^\]]*?|not transcribed|unclear)\s*" + TS + r"\s*[–-]\s*" + TS + r"\s*\]", re.I)
BRACKETS = re.compile(r"\[[^\]]*\]")
SPEAKER = re.compile(r"^[^:\[\]\"]{1,40}:\s+")
README_START = "<!-- coverage:start -->"
README_END = "<!-- coverage:end -->"


def seconds(ts: str) -> int:
    parts = [int(p) for p in ts.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, s = parts
    return h * 3600 + m * 60 + s


def clock(sec: int) -> str:
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


@dataclass
class Jump:
    start: int
    end: int

    @property
    def minutes(self) -> float:
        return (self.end - self.start) / 60

    def label(self) -> str:
        return f"{clock(self.start)}→{clock(self.end)} ({self.minutes:.1f} min)"


@dataclass
class Report:
    source_id: str
    path: str
    duration_s: int
    words: int
    coverage: float
    bucket: str
    marked_gap_minutes: float
    rashid: bool
    jumps: list[Jump] = field(default_factory=list)


def bucket(coverage: float) -> str:
    return "near-full" if coverage >= NEAR_FULL else "partial" if coverage >= PARTIAL else "thin"


def split_frontmatter(text: str) -> tuple[str, str]:
    if text.startswith("---\n"):
        end = text.find("\n---", 4)
        if end != -1:
            return text[4:end], text[end + 4 :]
    return "", text


def analyse(path: Path) -> Report:
    text = path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)
    sid = re.search(r"(?m)^source_id:\s*(\S+)", fm)
    dur = re.search(r"(?m)^duration:\s*\"?(\d{1,2}:\d{2}(?::\d{2})?)\"?", fm)
    duration_s = seconds(dur.group(1)) if dur else 0
    rashid = bool(re.search(r"(?mi)^\s*name:.*rashid", fm))

    stamps: list[int] = []
    marked: list[tuple[int, int]] = []
    words = 0
    for line in body.splitlines():
        m = LINE_TS.match(line)
        if not m:
            continue
        stamps.append(seconds(m.group(1)))
        rest = line[m.end() :]
        marked += [(seconds(a), seconds(b)) for _, a, b in MARKED.findall(rest)]
        rest = SPEAKER.sub("", BRACKETS.sub(" ", rest), count=1)
        rest = rest.replace("phrase_as_heard:", " ")
        words += len(rest.split())

    edges = ([0] if stamps else []) + stamps + ([duration_s] if duration_s and stamps else [])
    jumps = []
    for a, b in zip(edges, edges[1:], strict=False):
        if b - a > JUMP_SECONDS and not any(ms < b and me > a for ms, me in marked):
            jumps.append(Jump(a, b))

    minutes = duration_s / 60 if duration_s else 0
    coverage = round(words / (WORDS_PER_MINUTE * minutes), 2) if minutes else 0.0
    gap_minutes = round(sum(max(0, b - a) for a, b in marked) / 60, 1)
    return Report(
        source_id=sid.group(1) if sid else path.stem,
        path=str(path),
        duration_s=duration_s,
        words=words,
        coverage=coverage,
        bucket=bucket(coverage),
        marked_gap_minutes=gap_minutes,
        rashid=rashid,
        jumps=jumps,
    )


def analyse_dir(folder: Path) -> list[Report]:
    return [analyse(p) for p in sorted(folder.glob("*.md"))]


def retranscribe_order(reports: list[Report]) -> list[Report]:
    """Partial + thin videos, Mufti Rashid's first, then lowest coverage first."""
    todo = [r for r in reports if r.bucket != "near-full"]
    return sorted(todo, key=lambda r: (not r.rashid, r.coverage, r.source_id))


def cell(r: Report) -> str:
    return f"{r.bucket} {r.coverage:.2f}"


def update_readme(readme: Path, reports: list[Report]) -> bool:
    by_id = {r.source_id: r for r in reports}
    lines = readme.read_text(encoding="utf-8").split("\n")
    out: list[str] = []
    in_table = False
    for line in lines:
        if line.startswith("| # | Files |"):
            in_table = True
            cols = [c.strip() for c in line.strip("|").split("|")]
            if cols[-1] != "Coverage":
                line = line.rstrip() + " Coverage |"
        elif in_table and line.startswith("| ---"):
            if line.count("|") - 1 < len(out[-1].split("|")) - 2:
                line = line.rstrip() + " --- |"
        elif in_table and line.startswith("| "):
            m = re.search(r"\((?:transcripts|transcripts-whisper)/(yt-[^).]+)\.md\)", line)
            cells = line.rstrip().rstrip("|").split("|")[1:]
            header_cols = len(out[[i for i, x in enumerate(out) if x.startswith("| # | Files |")][-1]].strip("|").split("|"))
            value = f" {cell(by_id[m.group(1)])} " if m and m.group(1) in by_id else " — "
            if len(cells) >= header_cols:
                cells[-1] = value
            else:
                cells.append(value)
            line = "|" + "|".join(cells) + "|"
        else:
            in_table = False
        out.append(line)

    text = "\n".join(out)
    section = render_retranscribe(reports)
    if README_START in text and README_END in text:
        before, rest = text.split(README_START, 1)
        _, after = rest.split(README_END, 1)
        text = before + section + after
    else:
        text = text.rstrip("\n") + "\n\n" + section + "\n"
    changed = text != readme.read_text(encoding="utf-8")
    if changed:
        readme.write_text(text, encoding="utf-8")
    return changed


def render_retranscribe(reports: list[Report]) -> str:
    todo = retranscribe_order(reports)
    lines = [
        README_START,
        "## Re-transcribe",
        "",
        "Generated by `python research/munazara/tools/coverage.py --update-readme`; do not edit by hand.",
        f"Coverage = words / ({WORDS_PER_MINUTE} × minutes): near-full ≥ {NEAR_FULL}, partial ≥ {PARTIAL}, thin below.",
        f"Unmarked jumps: timestamp gaps over {JUMP_SECONDS // 60} minutes with no `[skipped …]` / "
        "`[not transcribed …]` / `[unclear …]` marker. Mufti Rashid's videos first, then lowest coverage.",
        "",
        f"{len(todo)} of {len(reports)} transcripts are partial or thin.",
        "",
        "| Order | Source | Coverage | Words | Duration | Marked gaps | Unmarked jumps > 2 min |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for i, r in enumerate(todo, start=1):
        who = " (Mufti Rashid)" if r.rashid else ""
        jumps = "; ".join(j.label() for j in r.jumps) or "—"
        lines.append(
            f"| {i} | [{r.source_id}](transcripts/{r.source_id}.md){who} | {cell(r)} | {r.words} | "
            f"{clock(r.duration_s)} | {r.marked_gap_minutes} min | {jumps} |"
        )
    lines.append(README_END)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", type=Path, default=MUNAZARA / "transcripts")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--update-readme", action="store_true")
    ap.add_argument("--readme", type=Path, default=MUNAZARA / "README.md")
    args = ap.parse_args(argv)

    reports = analyse_dir(args.dir)
    if args.json:
        print(json.dumps([asdict(r) | {"jumps": [asdict(j) for j in r.jumps]} for r in reports], indent=2))
    else:
        print(f"{'source':<16}{'dur':>9}{'words':>7}{'cov':>6}  {'bucket':<10}{'marked':>7}  unmarked jumps")
        for r in reports:
            jumps = "; ".join(j.label() for j in r.jumps) or "-"
            print(f"{r.source_id:<16}{clock(r.duration_s):>9}{r.words:>7}{r.coverage:>6.2f}  "
                  f"{r.bucket:<10}{r.marked_gap_minutes:>6}m  {jumps}")  # fmt: skip
        counts = {b: sum(r.bucket == b for r in reports) for b in ("near-full", "partial", "thin")}
        print(f"\n{len(reports)} transcripts: " + ", ".join(f"{v} {k}" for k, v in counts.items()))
    if args.update_readme:
        changed = update_readme(args.readme, reports)
        print(f"README {'updated' if changed else 'already up to date'}: {args.readme}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
