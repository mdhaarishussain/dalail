# 0007 — Embedding model storage on Android: verified copy-out

- Status: Accepted
- Date: 2026-11-04
- Supersedes the "Model path on Android" bullet of ADR 0005.

## Question

The e5 GGUF (126 MiB) is bundled as an uncompressed APK asset and copied to app storage on first
launch, so it is stored twice (~250 MiB). Can llama.rn load it in place?

## Options checked

| Option                                                                                                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **APK asset via file descriptor + offset** (`AssetManager.openFd` → fd, start offset; asset is uncompressed) | **Not without patching llama.rn.** llama.cpp has `llama_model_load_from_file_ptr(FILE*, …)`, which reads a GGUF from the current position of a larger file (mmap needs the data section 32-byte aligned). llama.rn 0.13.0-rc.9 never calls it: it loads through `common_init_from_params()` with a path (`cpp/rn-llama.cpp`), and `is_model_asset` is implemented only under `#if defined(__APPLE__)` (`cpp/jsi/RNLlamaJSI.cpp`). APK packaging aligns uncompressed assets to 4 bytes, not 32, so mmap could fail and the model would load into RAM. |
| **Play Asset Delivery, install-time pack**                                                                   | Same constraint: install-time packs are installed as split APKs and read through `AssetManager`, not as file paths.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **PAD fast-follow / on-demand pack**                                                                         | These give real file paths, but they download after install — excluded (no extra runtime download, non-negotiable 5 / owner decision 2026-11-03).                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Copy out of the APK**                                                                                      | Works with stock llama.rn. Costs ~126 MiB extra storage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

## Decision

Keep the copy, and make it verifiable (`apps/mobile/src/services/modelCopy.ts`):

1. First launch of each app build: copy the asset (op-sqlite `moveAssetsDatabase`, overwrite),
   compute SHA-256 natively (`expo-file-system` `File.digest('SHA-256')`, streamed in Kotlin on the
   IO dispatcher), compare with `config/models.json`.
2. Mismatch → delete the copy and copy again (one retry). Still wrong → status `sha_mismatch`, the
   embedder is not started and search runs keyword-only (never with an unverified model).
3. Later launches: the copy was verified for this build; a size check catches truncation, which
   triggers a full re-copy and re-hash.
4. Status is shown in Settings → Developer → Diagnostics (`model check: verified | sha_mismatch |
missing | not_bundled`).

## Also decided: fewer llama.rn CPU variants

llama.rn builds 7 arm64 libraries (~240 MB each unstripped). Our config plugin sets
`rnllamaVariants=rnllama,rnllama_v8_2_dotprod,rnllama_v8_2_dotprod_i8mm`: the generic fallback plus
the two variants modern phones select at runtime (`RNLlama.java` picks the best one present).
OpenCL/Hexagon were already disabled. This cuts APK size and build time; phones without dot-product
support use the generic build.

## Follow-up option (owner decision)

Removing the duplicate needs a small maintained patch to llama.rn (Android: pass fd + offset from
`AssetManager.openFd` through JSI; native: `fdopen` + `fseek` + `llama_model_load_from_file_ptr`, and
build the context from that model), plus ensuring 32-byte alignment of the asset (or accepting a
RAM load). Estimated 1–2 days plus re-testing on each llama.rn upgrade. Worth it only if storage
becomes a real complaint on 4 GB / small-storage phones.

## Verified on device (2026-11-04)

First real-phone run: `model check: verified` (copy + SHA-256 OK), embeddings working, parity
0.9999 (see `docs/device-tests.md`).
