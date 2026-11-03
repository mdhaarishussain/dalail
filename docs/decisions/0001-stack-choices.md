# 0001 — Stack choices

- Status: Accepted
- Date: 2026-11-03

## Context

Dalail must run fully offline on mid-range Android phones (4–6 GB RAM), ship a read-only corpus
DB with keyword + vector search, optionally run a small LLM on device, and keep iOS buildable.
The corpus is maintained by a non-developer owner and verified by scholars.

## Decision

| Area          | Choice                                                                                            | Notes                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| App framework | Expo SDK 58 (React Native 0.88, React 19.3) with `expo-dev-client` + Continuous Native Generation | Native modules (SQLite extensions, llama.cpp) rule out Expo Go. `android/`/`ios/` are generated, not committed. |
| Navigation    | Expo Router (`src/app/`)                                                                          | File-based routes; SDK 58 template default.                                                                     |
| State         | Zustand                                                                                           | Added in Phase 2 when there is state to hold.                                                                   |
| UI            | Own small component set, no UI kit                                                                | Keeps bundle small; full control over RTL Arabic/Urdu.                                                          |
| i18n          | Plain JSON tables (`en.json`, `roman-ur.json`) + tiny typed `t()`                                 | No dependency; key parity enforced by a test. `ur.json` later.                                                  |
| On-device DB  | `@op-engineering/op-sqlite` with FTS5 + sqlite-vec                                                | **To verify** against current docs before Phase 2 (per brief: stop and report if either is missing).            |
| On-device ML  | `llama.rn`                                                                                        | Embeddings (e5) in Phase 2, LLM in Phase 5.                                                                     |
| Embeddings    | `multilingual-e5-small` GGUF, same file in pipeline and app                                       | Parity test (cosine > 0.99 on 20 strings).                                                                      |
| JS tooling    | pnpm 10 workspaces (`node-linker=hoisted`), TypeScript 6 strict, ESLint 10 flat config, Prettier  | Hoisted linker avoids Metro/RN resolution issues with pnpm symlinks.                                            |
| JS tests      | Vitest for `packages/core` and `eval`; Jest (`jest-expo` preset) + Testing Library for the app    | `jest-expo` is the supported way to mock RN/Expo modules.                                                       |
| Python        | 3.11+, uv, pydantic, python-frontmatter, pytest, ruff                                             | `llama-cpp-python` and `sqlite-vec` added in Phase 1. CPU only.                                                 |
| CI            | `scripts/ci.sh` (lint, typecheck, tests, ruff, pytest) + GitHub Actions wrapper                   | Same script locally and in CI.                                                                                  |

## Deviations from the brief / library drift

- **ESLint 10 + `eslint-plugin-react` 7.37**: the plugin's React-version auto-detect calls an API
  removed in ESLint 10, so the React version is pinned in `eslint.config.mjs`
  (`settings.react.version`). Update it with React upgrades, or drop the pin once the plugin
  supports ESLint 10.
- **Expo template** now puts routes under `src/app/` (not `app/`); we follow it.
- The Expo template ships `AGENTS.md` that recommends EAS cloud builds/updates. EAS Update (OTA)
  would be a network call and is **not** used; a note at the top of that file defers to `CLAUDE.md`.

## Consequences

- Any developer needs the Android SDK (or EAS Build) to produce a dev client; Expo Go will not work.
- Expo SDK upgrades are done with `npx expo install --fix` and recorded here.
