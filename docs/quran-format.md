# Quran data format (`corpus/quran/*.jsonl`)

Supplied by the project owner: Arabic text plus the Kanz ul Iman translation. Nothing here is
downloaded or written by tooling.

One JSON object per line, one line per ayah. Any number of files (e.g. one per surah).

```json
{
  "surah": 1,
  "ayah": 1,
  "text_ar": "…",
  "translation_ur": "…",
  "translation_en": null,
  "translation_en_source": null
}
```

| Field                   | Required              | Notes                                                          |
| ----------------------- | --------------------- | -------------------------------------------------------------- |
| `surah`                 | yes                   | 1–114                                                          |
| `ayah`                  | yes                   | 1–N for that surah                                             |
| `text_ar`               | yes                   | Arabic text exactly as supplied                                |
| `translation_ur`        | yes                   | Kanz ul Iman (Urdu) exactly as supplied                        |
| `translation_en`        | no                    | English rendering of Kanz ul Iman, when the owner supplies one |
| `translation_en_source` | with `translation_en` | Who produced that English rendering                            |

Validation (`python -m dalail_pipeline validate`):

- Until these files exist, `quran:` refs are range-checked against the static ayah-count table
  (`pipeline/src/dalail_pipeline/data/surah_ayah_counts.json`, 114 surahs, 6236 ayat).
- Once they exist, every referenced ayah must be present, and each surah's row count must match the
  table; duplicates are errors.
