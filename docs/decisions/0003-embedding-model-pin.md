# 0003 — Embedding model: pinned multilingual-e5-small GGUF

- Status: Accepted
- Date: 2026-11-03

## Context

The same e5 file must be used by the pipeline (`llama-cpp-python`) and on device (`llama.rn`).
`intfloat` publishes no official GGUF, so a community conversion had to be chosen.

## Decision

Pinned in `config/models.json`:

| Field    | Value                                                              |
| -------- | ------------------------------------------------------------------ |
| Repo     | `TwinSunsLLC/multilingual-e5-small-gguf`                           |
| Revision | `b6cac9615d4ecce28d7f22539b7322d695fc2886`                         |
| File     | `multilingual-e5-small-q8_0.gguf`                                  |
| Size     | 132,439,008 bytes (126 MiB)                                        |
| sha256   | `e011debc1208e31bf7b6aebee2d9fc8bd2ca11694a77ed66ac9d0c9d0a877c93` |
| Licence  | MIT (same as the base model)                                       |

Why this file: its GGUF header has `tokenizer.ggml.model = t5` (SentencePiece Unigram with the
precompiled charsmap), which is what stock llama.cpp `convert_hf_to_gguf.py` emits for
XLM-RoBERTa. The other candidates use a `llama` tokenizer (`cstr/…`, built for CrispEmbed) or a
BERT WordPiece tokenizer (`keisuke-miyako/…`), both wrong for this model.

## Verification (2026-11-03)

`pipeline/tools/e5_reference_check/`: 20 neutral English/Roman Urdu strings with `query: ` /
`passage: ` prefixes, embedded by the pinned GGUF (llama-cpp-python 0.3.36) and by the official
`intfloat/multilingual-e5-small` via sentence-transformers. Cosine: **min 0.9952, mean 0.9985**
(threshold 0.99).

## Notes

- **`n_ctx` must be 512**, not the trained length 511: `n_ctx=511` trips
  `GGML_ASSERT(ggml_can_mul_mat(a, b))` in llama.cpp. Recorded as `runtime_n_ctx` in the registry;
  Phase 2 must use the same on device.
- **Size**: 126 MiB on its own. With the app (~30 MB) and the DB, the base APK would be ~155–165 MB,
  over the 150 MB target. 4-bit quants save only ~11 MiB (the 250k-token vocabulary dominates).
  Open question for Phase 2.
- `models/` is gitignored; `python -m dalail_pipeline fetch-model` downloads and verifies it
  (developer machines only — the app never downloads it from here).
