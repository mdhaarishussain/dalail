# Architecture

## Overview

```
corpus/ (owner-supplied markdown + JSONL)
   │  python -m dalail_pipeline validate | embed | build --dev/--prod
   ▼
dist/dalail.db  (read-only SQLite: FTS5 + sqlite-vec)  + dist/manifest.json
   │  bundled into the app
   ▼
apps/mobile ──uses──► packages/core (normalise, retrieve, rank)  ◄──uses── eval/
```

- **Corpus** is the only source of religious content. Nodes are markdown files with YAML
  frontmatter (`corpus/schema/node.schema.json`, Phase 1). Quran rows come from owner-supplied
  JSONL; hadith files exist only when a scholar's article quotes them.
- **Pipeline** (Python, CPU-only) validates, embeds aliases and claims with
  `multilingual-e5-small` GGUF (`passage: ` prefix) and writes the versioned DB.
  `build --prod` refuses fixtures (`FIXTURE:`) and anything not `status: verified`.
- **Core** (TypeScript) implements the retrieval contract once, so the app and `eval/` measure
  exactly the same code path.
- **App** (Expo + dev client) opens the DB read-only, embeds queries on device with the same
  e5 GGUF via `llama.rn` (`query: ` prefix), and renders results.

## Retrieval contract

```
query
 -> normaliseRomanUrdu(query)
 -> [optional, Full tier] rewriteQuery()   // JSON-constrained {canonical_query_en, topic_guess}
 -> FTS5 bm25 over claim_en, normalised aliases, topic names
 -> sqlite-vec over alias + claim embeddings
 -> reciprocal rank fusion (k=60), aggregated by node id
 -> confidence = f(top score, gap to #2)
 -> { status: "match" | "ambiguous" | "no_match", candidates }
```

Small gap between #1 and #2 ⇒ `ambiguous` with up to 3 candidates. Thresholds live in config and
are tuned with `eval/`. The query rewrite only ever adds a second result list to fuse; it never
replaces raw retrieval.

## Device tiers

| Tier | RAM    | Features                                                 |
| ---- | ------ | -------------------------------------------------------- |
| Full | ≥ 6 GB | retrieval + optional on-device LLM (rewrite, AI summary) |
| Lite | < 6 GB | retrieval only (FTS5 + on-device e5 embeddings)          |

Detected at runtime; the user can override in Settings.

## Offline guarantees

- No servers, analytics, telemetry or remote crash reporting.
- The only network call: the optional, user-started LLM model download (resumable, sha256-verified).
- Diagnostics are written to a local rotating log and shared only via the user's share sheet.

## Build safety

| Build | Contents                                                            |
| ----- | ------------------------------------------------------------------- |
| dev   | verified + draft/under_review nodes + fixtures, "UNVERIFIED" banner |
| prod  | verified nodes only; build fails on any `FIXTURE:` content          |
