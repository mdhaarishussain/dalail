# Ingesting a scholar's article

Goal: turn an article into **draft** nodes where every word of the claim, short answer, response
and hadith can be traced to the article — enforced by a checker, not by trust.

## 1. Capture the article (owner)

From `pipeline/`:

```bash
uv run python -m dalail_pipeline new-source --url "https://…"          # or:
uv run python -m dalail_pipeline new-source --file ~/Downloads/article.html --id tawassul-some-article
```

This creates `corpus/sources/<id>/`:

| File                           | What it is                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `source.html` / `.md` / `.txt` | The page or file exactly as captured. Never edited.                                             |
| `text.txt`                     | Plain text derived once from it (deterministic). All spans point into this file.                |
| `meta.yaml`                    | Provenance + sha256 of both files. **Fill in `scholar`, `work`, `lang`** (and `url` for files). |

If the article changes later, capture it again as a new snapshot (`--id …-v2`); editing
`source.*` or `text.txt` makes `validate` fail with `SOURCE_MODIFIED`. If a site blocks the
fetch, save the page from your browser ("Save page as… HTML only") and use `--file`.

## 2. Extract nodes (Claude Code)

```
/ingest-article corpus/sources/<id>
```

Claude reads the article, writes draft nodes and hadith files by **copying** the article's text,
adds 8–15 Roman Urdu search phrasings per node, then runs `ingest-finish`, which:

1. records `source_spans` (character offsets into `text.txt`) for every copied field,
2. syncs each hadith's `cited_in`,
3. runs `check-verbatim`, `validate` and the eval leak check,
4. looks for duplicate objections (embeddings + word overlap),
5. prints a summary of what needs your input.

## 3. What the checks guarantee

- `claim_en`, `short_answer`, every response paragraph, and hadith `text_ar` / `translation` /
  `reference` / `grading` equal the article text at their spans (whitespace differences only;
  `[[quran:…]]` chips are the only insertion allowed in a response).
- `claim_source` / `response_source` strings appear in the article or its `meta.yaml`.
- Every real node and hadith names its source; the source is unchanged since capture.
- Everything stays `status: draft` until a scholar approves it (Phase 4).

## 4. What needs a human

The summary lists: empty `short_answer` (the article had no direct 1–3 sentence answer — the
scholar decides), empty `scholar`/`work`, possible duplicates (merge aliases instead), and any
uncertain follow-up links or skipped passages.
