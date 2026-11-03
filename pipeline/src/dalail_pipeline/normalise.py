"""Python port of packages/core/src/normalise (index side). Parity: normalise.golden.json."""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from .paths import find_repo_root, normalise_dir


@dataclass(frozen=True)
class Normalised:
    norm: str
    folded: str


def _py_replace(js_replace: str) -> str:
    return re.sub(r"\$(\d)", r"\\\1", js_replace)


class Normaliser:
    def __init__(self, data_dir: Path) -> None:
        rules = json.loads((data_dir / "rules.json").read_text())
        synonyms = json.loads((data_dir / "synonyms.json").read_text())
        stop = json.loads((data_dir / "stopwords.json").read_text())
        self.rules_version: int = rules["version"]
        self._izafat = [(re.compile(r["pattern"]), _py_replace(r["replace"])) for r in rules["izafat"]]
        self._fold = [(re.compile(r["pattern"]), _py_replace(r["replace"])) for r in rules["fold"]]
        self._syn: dict[str, str] = {}
        for group, members in synonyms["groups"].items():
            for m in members:
                self._syn[self.fold_token(m)] = group
        self.stopwords = frozenset(stop["words"])

    def fold_token(self, token: str) -> str:
        for rx, rep in self._fold:
            token = rx.sub(rep, token)
        return token

    def base_tokens(self, text: str) -> list[str]:
        s = unicodedata.normalize("NFKD", text)
        s = "".join(ch for ch in s if not unicodedata.category(ch).startswith("M")).lower()
        for rx, rep in self._izafat:
            s = rx.sub(rep, s)
        s = "".join(ch if unicodedata.category(ch)[0] in "LN" else " " for ch in s)
        return s.split()

    def __call__(self, text: str) -> Normalised:
        tokens = self.base_tokens(text)
        groups: list[str] = []
        for t in tokens:
            g = self._syn.get(self.fold_token(t))
            if g is not None and g not in groups and g not in tokens:
                groups.append(g)
        all_tokens = tokens + groups
        return Normalised(" ".join(all_tokens), " ".join(self.fold_token(t) for t in all_tokens))


@cache
def default_normaliser() -> Normaliser:
    return Normaliser(normalise_dir(find_repo_root()))
