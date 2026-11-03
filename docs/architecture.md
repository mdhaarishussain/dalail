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
- **Pipeline** (Python, CPU-only) validates, embeds aliases and claims with the pinned
  `multilingual-e5-small` GGUF (`passage: ` prefix, ADR 0003) and writes the versioned DB.
  `build --prod` includes only verified, non-fixture content and re-scans the written DB for any
  `FIXTURE:` text or unverified row. `build --no-embed` writes a keyword-only DB
  (`meta.embed_model = none`); without that flag a missing model is an error.
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

Per node, _confidence_ combines keyword coverage (share of the query's content words found in the
node's best alias, via the normalised/folded forms) and vector similarity (cosine rescaled between
`cosFloor` and `cosCeil`) as independent evidence: `1 − (1 − coverage)(1 − vector)`, plus a small
boost if the query names the node's topic. Candidates are ordered by RRF; the decision uses the top
candidate's confidence and its gap to #2. A query made only of function words is `no_match`.
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

## Database (built by the pipeline, read-only on device)

Tables per brief §6, plus: `opponents`, `node_aliases.text_folded` / `kind`, `edges.ord`,
`node_dalail.ord`, `nodes.is_fixture`, and (dev builds only) `fixture_dalil`. `nodes_fts` is FTS5
(`unicode61 remove_diacritics 2`) with one row per claim/alias (rowid = `node_aliases.rowid`) and
one per topic name. `vec_aliases` is a plain BLOB table (ADR 0002). `meta` holds
`schema_version, corpus_version, built_at, build_mode, embed_model, embed_model_sha256, embed_dims,
query_prefix, normaliser_rules_version, sha`.
