# Device tests

Real-device results. Add one row per device and APK. Targets (brief): retrieval < 300 ms without
the LLM; embedding parity min cosine > 0.99; works in airplane mode; Phase 6 adds the 4 GB / 6 GB
mid-range matrix.

## Builds tested

| Build                                            | sha256                                                             | Contents                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `dalail-dev-fixtures-arm64-v8a.apk` (2026-11-03) | `167f4f429d7d567879a2a89bfc991e17c8398a372eaeb8c8acee6f78cc3053d0` | release build type, arm64-v8a, **dev corpus** (fixtures + drafts, with embeddings), signed with the debug key; 207 MB |

## Results

| Date       | Phone (model / Android / RAM)                          | Build                            | Model check | sqlite-vec     | Parity (min / mean, n=20) | Search time (4 queries)       | Notes                                 |
| ---------- | ------------------------------------------------------ | -------------------------------- | ----------- | -------------- | ------------------------- | ----------------------------- | ------------------------------------- |
| 2026-11-04 | Samsung Galaxy M32 5G / Android 13 (One UI 5.1) / 6 GB | dev-fixtures arm64 (`167f4f42…`) | verified    | v0.1.7-alpha.2 | **PASS** 0.9999 / 1.0000  | 31 / 20 / 17 / 23 ms (max 31) | init 19 ms; "Hi" → no match (correct) |

## Phase 2 checklist (airplane mode)

- [x] Model copied out of the APK and SHA-256 verified on device
- [x] Embedding parity with the pipeline ≥ 0.99
- [x] Retrieval < 300 ms (including the on-device query embedding)
- [x] Off-topic query → "No answer found yet"
- [ ] "qalam aur kitaab" → straight to the FIXTURE tawassul-001 rebuttal
- [ ] "ghar" → "Did you mean…?" with two claims
- [ ] Follow-up navigation + debate path survives killing and reopening the app
- [ ] Share disabled on fixture answers
- [ ] Urdu body (Nastaliq, RTL) and Arabic dalil (Amiri) render correctly
