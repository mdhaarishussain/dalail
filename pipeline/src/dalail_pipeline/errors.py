from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


class PipelineError(Exception):
    """A fatal, user-facing error (bad usage, missing model, failed safety check)."""


Severity = Literal["error", "warning"]


@dataclass(frozen=True)
class Issue:
    path: Path
    line: int
    code: str
    message: str
    severity: Severity = "error"

    def format(self, root: Path | None = None) -> str:
        p = self.path
        if root is not None and self.path.is_relative_to(root):
            p = self.path.relative_to(root)
        return f"{p}:{self.line}: {self.severity} {self.code}: {self.message}"
