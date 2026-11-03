# 0002 — On-device DB: op-sqlite with FTS5 + sqlite-vec

- Status: Accepted
- Date: 2026-11-03

## Context

The brief requires SQLite with FTS5 and sqlite-vec via `@op-engineering/op-sqlite`, and asked to
stop if either was missing.

## Findings (op-sqlite 19.0.3, published 2026-10-29; read from the npm package)

- Both are build-time flags read from the **app's** `package.json`:
  `"op-sqlite": { "fts5": true, "sqliteVec": true }`.
  - Android `build.gradle`: `fts5` adds `-DSQLITE_ENABLE_FTS5=1`; `sqliteVec` adds
    `-DOP_SQLITE_USE_SQLITE_VEC=1` and links prebuilt `libsqlite_vec.so` (arm64-v8a, armeabi-v7a,
    x86, x86_64). iOS: `sqlitevec.xcframework`.
  - Bundled SQLite 3.53.4; bundled sqlite-vec **v0.1.7-alpha.2**.
- libsql/turso backends (which have sync features) stay **off**; nothing in our config makes
  network calls.

## Decision

- Use op-sqlite 19.x in Phase 2 with `fts5` and `sqliteVec` enabled.
- Pipeline pins Python `sqlite-vec==0.1.7` (closest release to the device build). The eval runner
  loads that same `vec0` binary into Node's built-in `node:sqlite`, so no native npm dependency.
- **Vector storage is a plain table**, not a `vec0` virtual table:
  `vec_aliases(alias_rowid INTEGER PRIMARY KEY, embedding BLOB)` — float32 little-endian ×384,
  L2-normalised — searched with `vec_distance_cosine()` and `ORDER BY … LIMIT`.
  - The corpus is small (hundreds to a few thousand aliases), so brute force costs a few ms.
  - It avoids depending on `vec0` shadow-table formats matching between the pipeline's 0.1.7 and
    the device's 0.1.7-alpha.2 builds.
  - Deviation from the brief's `embedding float[384]` column syntax (that is `vec0` syntax).
    Revisit if the corpus grows past ~50k aliases.

## Consequences

- The DB opens on any SQLite. Vector search needs sqlite-vec loaded; keyword search does not.
- Phase 2 must check `vec_version()` on device and run the embedding parity test.
