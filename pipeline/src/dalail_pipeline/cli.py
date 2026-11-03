"""Command-line entry point: ``python -m dalail_pipeline <command>``."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from . import __version__

COMMANDS: dict[str, str] = {
    "validate": "Check every node and hadith file against its schema, links and refs.",
    "embed": "Embed claim_en and aliases with the e5 GGUF model (passage: prefix).",
    "build": "Write dist/dalail.db and dist/manifest.json (--dev or --prod).",
    "stats": "Report nodes per topic, verified %%, aliases per node, missing follow-ups.",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dalail_pipeline", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    sub = parser.add_subparsers(dest="command", required=True, metavar="<command>")
    for name, help_text in COMMANDS.items():
        cmd = sub.add_parser(name, help=help_text, description=help_text)
        if name == "build":
            mode = cmd.add_mutually_exclusive_group(required=True)
            mode.add_argument("--dev", action="store_true", help="Include fixtures and drafts.")
            mode.add_argument("--prod", action="store_true", help="Verified, non-fixture only.")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    print(f"'{args.command}' is not implemented yet (Phase 1).", file=sys.stderr)
    return 2
