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
| `fixtures/` | Obviously fake `FIXTURE:` nodes and dalil for dev/tests            | 1     |
| `schema/`   | JSON Schemas for node and hadith frontmatter                       | 1     |

Fixtures always start with `FIXTURE:` and use the reserved `fixture:` ref collection.
`build --prod` refuses them.
