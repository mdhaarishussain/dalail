# 0004 — Roman Urdu normaliser: TS implementation + Python port, held to one golden file

- Status: Accepted
- Date: 2026-11-03

## Context

Queries are normalised on device (TypeScript, Hermes); aliases are normalised at build time
(Python). Both must produce identical output, or keyword search silently degrades.

## Decision

- Rules are data, shared by both: `packages/core/src/normalise/{rules,synonyms,stopwords}.json`.
- `packages/core/src/normalise/index.ts` (queries) and `pipeline/src/dalail_pipeline/normalise.py`
  (index) both run `normalise.golden.json` in their test suites (Vitest and pytest). Every rule id
  in `rules.json` must have a golden case (enforced by a test).
- Output is `{ norm, folded }`; both are indexed in FTS5 and both are searched.
- `synonyms.json` holds only the brief's example group (`prophet`: nabi, rasool, huzoor, aaqa);
  the owner extends it.
- The `FIXTURE:` marker is display-only and is stripped before indexing/embedding.

## Alternatives rejected

- Calling Node from the pipeline for one implementation: adds a cross-runtime dependency to every
  build for little gain, given the golden file catches drift.
