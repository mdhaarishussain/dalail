"""Dalil reference grammar, mirrored from packages/core/src/refs.ts."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import cache
from importlib import resources

QURAN = re.compile(r"^quran:(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$")
HADITH = re.compile(r"^hadith:(h-\d{4,})$")
FIXTURE = re.compile(r"^fixture:(quran|hadith):(\d+)$")
INLINE = re.compile(r"\[\[([^\]\s]+)\]\]")


@dataclass(frozen=True)
class QuranRef:
    surah: int
    start: int
    end: int


@dataclass(frozen=True)
class HadithRef:
    id: str


@dataclass(frozen=True)
class FixtureRef:
    collection: str
    n: int


Ref = QuranRef | HadithRef | FixtureRef


def parse_ref(raw: str) -> Ref | None:
    if m := QURAN.match(raw):
        surah, start = int(m[1]), int(m[2])
        end = int(m[3]) if m[3] else start
        if surah < 1 or start < 1 or end < start:
            return None
        return QuranRef(surah, start, end)
    if m := HADITH.match(raw):
        return HadithRef(m[1])
    if m := FIXTURE.match(raw):
        return FixtureRef(m[1], int(m[2]))
    return None


def extract_inline_refs(markdown: str) -> list[str]:
    return INLINE.findall(markdown)


@cache
def surah_ayah_counts() -> tuple[int, ...]:
    data = json.loads(resources.files("dalail_pipeline").joinpath("data/surah_ayah_counts.json").read_text())
    return tuple(data["counts"])


def quran_ref_problem(ref: QuranRef) -> str | None:
    """Range-check against the static table. Returns a message, or None if valid."""
    counts = surah_ayah_counts()
    if ref.surah > len(counts):
        return f"surah {ref.surah} does not exist (1-{len(counts)})"
    n = counts[ref.surah - 1]
    if ref.end > n:
        return f"surah {ref.surah} has {n} ayat; ref goes to {ref.end}"
    return None
