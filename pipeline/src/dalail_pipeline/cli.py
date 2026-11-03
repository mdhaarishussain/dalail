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
from .evalcheck import check_real_eval
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
    "new-source": "Capture an article into corpus/sources/<id>/ (immutable snapshot + meta.yaml template).",
    "check-verbatim": "Check every real node/hadith field equals its source text at the recorded span.",
    "fill-spans": "Locate extracted fields of a source's draft files in its text and record source_spans.",
    "ingest-finish": "After /ingest-article: fill spans, sync cited_in, validate, find duplicates, summarise.",
    "dedupe": "Report nodes whose claims look like duplicates (embedding cosine + token overlap).",
    "next-id": "Print the next free node id for a topic, or the next hadith id.",
    "transcribe": "Developer-only: transcribe an audio file with faster-whisper large-v3 (research/munazara).",
    "parity-export": "Write the e5 parity set (20 strings + pipeline vectors) for the app's Diagnostics screen.",
    "record-review": "Owner: record who wrote/approved a scholar_review field (hashes the current value).",
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
        if name == "new-source":
            src = cmd.add_mutually_exclusive_group(required=True)
            src.add_argument("--url", help="Fetch this page (developer machine only).")
            src.add_argument("--file", type=Path, help="A saved .html / .md / .txt file.")
            cmd.add_argument("--id", help="Source id (kebab-case). Default: from the title or file name.")
            cmd.add_argument("--opponent", help="Group the article answers (an id from corpus/opponents.yaml).")
        if name in {"fill-spans", "ingest-finish"}:
            cmd.add_argument("source_id")
        if name in {"ingest-finish", "dedupe"}:
            cmd.add_argument("--no-model", action="store_true", help="Token overlap only (skip embeddings).")
        if name == "fetch-model":
            cmd.add_argument("--transcription", action="store_true", help="Fetch the pinned Whisper model instead.")
        if name == "transcribe":
            cmd.add_argument("audio", type=Path, help="Audio file (kept out of git).")
            cmd.add_argument("--source-id", required=True, help="yt-<YouTube id>")
            cmd.add_argument("--language", default="ur", help="Whisper language code (default ur; 'auto' to detect).")
            cmd.add_argument("--force", action="store_true", help="Replace an existing transcript.")
        if name == "record-review":
            cmd.add_argument("--node", required=True)
            cmd.add_argument("--field", required=True)
            cmd.add_argument("--written-by", required=True)
            cmd.add_argument("--approved-by", required=True)
            cmd.add_argument("--note", default="")
        if name == "next-id":
            cmd.add_argument("kind", choices=["node", "hadith"])
            cmd.add_argument("--topic")
        if name == "embed-queries":
            cmd.add_argument("questions", type=Path, nargs="+", help="YAML files with a `questions` list of {q: ...}.")
            cmd.add_argument("--out", type=Path, help="Default: <repo>/eval/.cache/query-embeddings.json")
    return parser


def prod_report_text(pr: dict) -> str:
    lines = ["", "PROD BUILD REPORT", f"  nodes included ({len(pr['nodes_included'])}):"]
    lines += [f"    {i}" for i in pr["nodes_included"]]
    lines.append(f"  drafts / under review excluded ({len(pr['nodes_excluded'])}):")
    lines += [f"    {i} [{st}]" for i, st in pr["nodes_excluded"].items()]
    lines.append(f"  follow-up edges pruned ({len(pr['edges_pruned'])}):")
    lines += [f"    {a} -> {b}" for a, b in pr["edges_pruned"]]
    return "\n".join(lines)


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
            corpus = load_corpus(corpus_dir, include_fixtures=mode == "dev")
            report = validate(corpus, mode)
            report.issues += check_real_eval(repo, corpus)
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
            if (pr := m.get("prod_report")) is not None:
                print(prod_report_text(pr))
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

        if args.command == "fetch-model" and args.transcription:
            from .transcribe import fetch_transcription_model, transcription_model

            print(f"ok: {fetch_transcription_model(transcription_model(repo))}")
            return 0

        if args.command == "transcribe":
            from .transcribe import transcribe

            lang = None if args.language == "auto" else args.language
            out = transcribe(repo_root=repo, audio=args.audio.resolve(), source_id=args.source_id,
                             language=lang, force=args.force)  # fmt: skip
            print(f"wrote {out}")
            return 0

        if args.command == "fetch-model":
            path = fetch_model(embedding_model(repo))
            print(f"ok: {path} (sha256 verified)")
            return 0

        if args.command == "new-source":
            from .sources import new_source, opponent_ids

            opponent = args.opponent
            if not opponent and sys.stdin.isatty():
                choices = sorted(opponent_ids(corpus_dir))
                opponent = input(f"Which group does this article answer? [{'/'.join(choices)}]: ").strip()
            folder = new_source(corpus_dir, url=args.url, file=args.file, source_id=args.id, opponent=opponent)
            shown = folder.relative_to(repo) if folder.is_relative_to(repo) else folder
            print(f"created {folder}\n  next: fill in scholar/work/lang in meta.yaml, then /ingest-article {shown}")
            return 0

        if args.command == "check-verbatim":
            from .verbatim import check_doc

            corpus = load_corpus(corpus_dir, include_fixtures=False)
            issues = list(corpus.load_issues)
            for d in corpus.nodes:
                issues += check_doc(d, corpus.sources, "node")
            for h in corpus.hadith:
                issues += check_doc(h, corpus.sources, "hadith")
            _print_issues(issues, repo)
            errors = [i for i in issues if i.severity == "error"]
            print(f"check-verbatim: {len(corpus.nodes)} node(s), {len(corpus.hadith)} hadith, {len(errors)} error(s)")
            return 1 if errors else 0

        if args.command == "fill-spans":
            from .ingest import fill_spans

            n, issues = fill_spans(load_corpus(corpus_dir, include_fixtures=False), args.source_id)
            _print_issues(issues, repo)
            print(f"recorded spans for {n} file(s)")
            return 1 if any(i.severity == "error" for i in issues) else 0

        if args.command == "ingest-finish":
            from .ingest import ingest_finish, summary_text

            summary = ingest_finish(repo, corpus_dir, args.source_id, use_model=not args.no_model)
            print(summary_text(summary, repo))
            return 1 if any(i.severity == "error" for i in summary.issues) else 0

        if args.command == "dedupe":
            from .ingest import find_duplicates

            pairs = find_duplicates(load_corpus(corpus_dir, include_fixtures=False), repo, use_model=not args.no_model)
            for p in pairs:
                cos = f"cosine {p.cosine:.3f}  " if p.cosine is not None else ""
                print(f"{p.a} ~ {p.b}  {cos}jaccard {p.jaccard:.2f}")
            print(f"{len(pairs)} possible duplicate pair(s)")
            return 0

        if args.command == "parity-export":
            from .embed import Embedder

            model = embedding_model(repo)
            strings = json.loads((repo / "pipeline/tools/e5_reference_check/strings.json").read_text())
            vecs = Embedder(model, repo / "dist" / ".embed-cache.sqlite").embed(strings)
            out = repo / "apps/mobile/src/diagnostics/parity.json"
            out.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "_doc": "Generated by `python -m dalail_pipeline parity-export`; strings carry their e5 prefix.",
                "embed_model": model.id,
                "sha256": model.sha256,
                "threshold": 0.99,
                "items": [{"text": s, "vector": [round(x, 6) for x in v]} for s, v in zip(strings, vecs, strict=True)],
            }
            out.write_text(json.dumps(payload, ensure_ascii=False) + "\n")
            print(f"wrote {len(strings)} parity vectors -> {out}")
            return 0

        if args.command == "record-review":
            from .reviews import record_review

            corpus = load_corpus(corpus_dir, include_fixtures=False)
            path = record_review(corpus, args.node, args.field, args.written_by, args.approved_by, args.note)
            print(f"recorded review entry in {path}")
            return 0

        if args.command == "next-id":
            from .ingest import next_id

            print(next_id(load_corpus(corpus_dir, include_fixtures=False), args.kind, args.topic))
            return 0

        if args.command == "embed-queries":
            from .embed import Embedder

            model = embedding_model(repo)
            qs: list[str] = []
            for f in args.questions:
                for q in (yaml.safe_load(f.read_text()) or {}).get("questions") or []:
                    if q["q"] not in qs:
                        qs.append(q["q"])
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
