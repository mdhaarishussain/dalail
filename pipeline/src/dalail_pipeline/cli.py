"""Command-line entry point: ``python -m dalail_pipeline <command>``."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

import yaml

from . import __version__
from .corpus import load_corpus
from .errors import PipelineError
from .models import embedding_model, fetch_model
from .paths import find_repo_root
from .stats import stats_text
from .validate import validate

COMMANDS: dict[str, str] = {
    "validate": "Check every node and hadith file against its schema, links and refs.",
    "embed": "Embed claim_en and aliases with the e5 GGUF model (passage: prefix) into the cache.",
    "build": "Write dist/dalail.db and dist/manifest.json (--dev or --prod).",
    "stats": "Report nodes per topic, verified %%, aliases per node, missing follow-ups.",
    "fetch-model": "Download the pinned embedding model to models/ (developer machines only).",
    "embed-queries": "Embed eval queries (query: prefix) for the Node eval runner.",
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="dalail_pipeline", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("--repo-root", type=Path, help="Monorepo root (default: auto-detect).")
    parser.add_argument("--corpus", type=Path, help="Corpus folder (default: <repo>/corpus).")
    sub = parser.add_subparsers(dest="command", required=True, metavar="<command>")
    for name, help_text in COMMANDS.items():
        cmd = sub.add_parser(name, help=help_text, description=help_text)
        if name == "validate":
            cmd.add_argument("--prod", action="store_true", help="Apply prod rules (verified only, no fixtures).")
        if name == "build":
            mode = cmd.add_mutually_exclusive_group(required=True)
            mode.add_argument("--dev", action="store_true", help="Include fixtures and drafts.")
            mode.add_argument("--prod", action="store_true", help="Verified, non-fixture only.")
            cmd.add_argument("--no-embed", action="store_true", help="Keyword-only DB (meta.embed_model = none).")
            cmd.add_argument("--out", type=Path, help="Output folder (default: <repo>/dist).")
        if name == "embed":
            cmd.add_argument("--out", type=Path, help="Folder holding the cache (default: <repo>/dist).")
        if name == "embed-queries":
            cmd.add_argument("questions", type=Path, help="YAML file with a `questions` list of {q: ...}.")
            cmd.add_argument("--out", type=Path, help="Default: <repo>/eval/.cache/query-embeddings.json")
    return parser


def _print_issues(issues: Sequence, root: Path) -> None:
    for i in issues:
        print(i.format(root), file=sys.stderr)


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    repo = (args.repo_root or find_repo_root()).resolve()
    corpus_dir = (args.corpus or repo / "corpus").resolve()
    try:
        if args.command == "validate":
            mode = "prod" if args.prod else "dev"
            report = validate(load_corpus(corpus_dir, include_fixtures=mode == "dev"), mode)
            _print_issues(report.issues, repo)
            print(
                f"{mode}: {len(report.included_nodes)} node(s) in scope, {len(report.errors)} error(s), "
                f"{len(report.warnings)} warning(s)"
                + (f"; excluded (not verified): {', '.join(sorted(report.excluded))}" if report.excluded else "")
            )
            return 1 if report.errors else 0

        if args.command == "build":
            from .build import build

            mode = "prod" if args.prod else "dev"
            try:
                res = build(repo_root=repo, corpus_dir=corpus_dir, out_dir=(args.out or repo / "dist").resolve(),
                            mode=mode, embed=not args.no_embed)  # fmt: skip
            except PipelineError:
                report = validate(load_corpus(corpus_dir, include_fixtures=mode == "dev"), mode)
                _print_issues(report.errors, repo)
                raise
            _print_issues(res.report.warnings, repo)
            m = res.manifest
            print(
                f"built {res.db_path} ({m['db_size_bytes']} bytes, {m['build_mode']}, embed_model={m['embed_model']})"
            )
            print(json.dumps(m["counts"], indent=2))
            return 0

        if args.command == "embed":
            from .build import build

            # A dev build with embeddings fills the cache for every node; the DB is a by-product.
            out = (args.out or repo / "dist").resolve()
            res = build(repo_root=repo, corpus_dir=corpus_dir, out_dir=out, mode="dev", embed=True)
            print(f"embedded {res.manifest['counts']['aliases']} alias(es); cache at {out / '.embed-cache.sqlite'}")
            return 0

        if args.command == "stats":
            print(stats_text(load_corpus(corpus_dir, include_fixtures=True)))
            return 0

        if args.command == "fetch-model":
            path = fetch_model(embedding_model(repo))
            print(f"ok: {path} (sha256 verified)")
            return 0

        if args.command == "embed-queries":
            from .embed import Embedder

            model = embedding_model(repo)
            qs = [q["q"] for q in (yaml.safe_load(args.questions.read_text()) or {}).get("questions", [])]
            emb = Embedder(model, repo / "dist" / ".embed-cache.sqlite")
            vecs = emb.queries(qs)
            out = args.out or repo / "eval" / ".cache" / "query-embeddings.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            payload = {"embed_model": model.id, "sha256": model.sha256, "prefix": model.query_prefix,
                       "vectors": dict(zip(qs, vecs, strict=True))}  # fmt: skip
            out.write_text(json.dumps(payload))
            print(f"embedded {len(qs)} queries -> {out}")
            return 0
    except PipelineError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    raise AssertionError(args.command)  # pragma: no cover
