# 0005 — App data: bundled DB and model, user data, variants

- Status: Accepted
- Date: 2026-11-04

## Decision

- **Bundling.** `apps/mobile/plugins/withDalailAssets.js` (Expo config plugin, runs at
  `expo prebuild`) copies `dist/dalail.db` (dev) or `dist/prod/dalail.db` (prod, `APP_VARIANT=prod`)
  to `android/app/src/main/assets/custom/`, and the pinned e5 GGUF to `assets/models/`. Both are
  stored uncompressed (`noCompress`). Prebuild fails if the DB's `build_mode` doesn't match the
  variant, if the DB was embedded with another model, or if the GGUF's sha256 doesn't match
  `config/models.json`.
- **First launch.** op-sqlite `moveAssetsDatabase` copies both files to the app's databases folder,
  again whenever the app version/build changes (so a new release replaces the corpus).
- **Model path on Android.** llama.rn's `is_model_asset` is implemented for iOS only (checked in
  `cpp/jsi/RNLlamaJSI.cpp`), and llama.cpp needs a real file path, so the GGUF is copied out of the
  APK. Cost: ~126 MiB more storage on the phone (APK copy + extracted copy). Revisit if storage
  complaints appear (e.g. ship the model as an install-time asset pack and copy-then-delete is not
  possible for APK assets).
- **User data** (language, onboarding, mode, recents, bookmarks, saved questions, debate path)
  lives in a separate op-sqlite key-value file `dalail-user.sqlite` via Zustand `persist`. The
  corpus DB is never written.
- **Visibility.** Prod DBs contain only verified rows. Dev DBs contain everything; the app shows
  unverified nodes only in dev builds (dev setting, on by default) and always with an UNVERIFIED
  banner. Fixtures carry a FIXTURE banner and can never be shared.
- **Embeddings.** Lazy-loaded llama.rn context (`embedding: true`, `n_ctx` 512 — ADR 0003, 4
  threads, mmap, CPU only; OpenCL/Hexagon disabled in the llama.rn plugin). Released when the app
  goes to the background. If embedding fails or takes over 1.5 s, search runs keyword-only.
- **iOS** stays buildable but untested: the asset plugin only handles Android, so iOS builds run
  keyword-only until bundling is added there.
- **Parity.** `python -m dalail_pipeline parity-export` writes 20 neutral strings + pipeline vectors
  to `apps/mobile/src/diagnostics/parity.json`; the dev-only Diagnostics screen embeds them on device
  and reports min/mean cosine (pass ≥ 0.99).

## Testing

Screens are tested in Jest against the real fixture DB (`dist/ci/dalail.db`, built by
`scripts/ci.sh`) through `node:sqlite`, with `expo-router` mocked. (`renderRouter` turns on fake
timers, which stalls the real async data loading.) Device-only paths — op-sqlite, llama.rn,
asset copy — need an emulator or phone.
