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

## Addendum (2026-11-04): Urdu script

Articles and queries may be in Urdu script. Search-side normalisation only — display always uses
the stored text exactly as written, and nothing is translated or transliterated.

- `charmap_norm` (both forms): delete ZWNJ/ZWJ and tatweel (ZWNJ would otherwise split a word into
  two tokens); unify Arabic-codepoint variants commonly typed for Urdu letters: `ي ى → ی`, `ك → ک`,
  `ه ة → ہ`. NFKD + mark stripping already removes harakat and hamza/madda marks.
- `charmap_fold` (folded form only): `ے → ی`, `ھ → ہ`, Urdu and Arabic-Indic digits → ASCII.
- Urdu punctuation (`،`, `۔`) is treated as a separator like Latin punctuation.
- Every charmap id has a golden case, held by both test suites.
- `validate` warns `LANG_MISMATCH` when a node's `lang` disagrees with its body's script.
