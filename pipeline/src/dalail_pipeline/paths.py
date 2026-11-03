from __future__ import annotations

from pathlib import Path


def find_repo_root(start: Path | None = None) -> Path:
    """Walk up from `start` (default: this file) to the directory holding pnpm-workspace.yaml."""
    here = (start or Path(__file__)).resolve()
    for d in [here, *here.parents]:
        if (d / "pnpm-workspace.yaml").is_file():
            return d
    raise FileNotFoundError("could not find repo root (pnpm-workspace.yaml)")


def normalise_dir(repo_root: Path) -> Path:
    return repo_root / "packages" / "core" / "src" / "normalise"
