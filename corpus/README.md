# corpus

All religious content in Dalail comes **only** from this folder and is supplied by the project
owner. Code and tooling must never author Quran text, hadith, translations, gradings, rebuttals,
scholar names or citations (see `/CLAUDE.md`, non-negotiable 1).

| Folder      | Contents                                                           | Phase |
| ----------- | ------------------------------------------------------------------ | ----- |
| `nodes/`    | Real claim → response nodes (markdown + frontmatter)               | 3+    |
| `hadith/`   | Hadith exactly as quoted in a scholar's article                    | 3+    |
| `quran/`    | Owner-supplied Arabic text + Kanz ul Iman JSONL                    | 1+    |
| `sources/`  | Immutable snapshots of scholar articles + `meta.yaml`              | 3     |
| `fixtures/` | `nodes/` (12 fake nodes) + `dalil.jsonl` (fake dalil), dev/tests   | 1     |
| `schema/`   | JSON Schemas: node, hadith, fixture dalil                          | 1     |

Data files: `corpus.yaml` (`corpus_version`), `topics.yaml`, `opponents.yaml`. A new topic or
opponent is added there — no code change. Quran format: `docs/quran-format.md`.

Fixtures always start with `FIXTURE:` and use the reserved `fixture:` ref collection.
`build --prod` refuses them.
